#!/usr/bin/env python
"""Evaluate the visual deepfake model on a labelled image dataset.

Expected dataset layout:

    dataset/
        real/
            image-1.jpg
        fake/
            image-2.jpg

The evaluator intentionally requires an explicit dataset. It never falls
back to the synthetic training generator and never reports training metadata
as test performance.
"""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Iterable

import cv2
import numpy as np


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
CLASS_LABELS = {"real": 0, "fake": 1}


def iter_samples(data_dir: Path) -> Iterable[tuple[Path, int]]:
    """Yield labelled image paths in a deterministic order."""
    for class_name, label in CLASS_LABELS.items():
        class_dir = data_dir / class_name
        if not class_dir.is_dir():
            raise FileNotFoundError(
                f"Required class directory is missing: {class_dir}"
            )

        paths = sorted(
            path
            for path in class_dir.rglob("*")
            if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS
        )
        if not paths:
            raise ValueError(f"No supported images found in: {class_dir}")

        for path in paths:
            yield path, label


def load_image(path: Path) -> np.ndarray:
    """Load and preprocess one image for MobileNetV2."""
    image = cv2.imread(str(path), cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError(f"Could not decode image: {path}")

    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    image = cv2.resize(image, (224, 224), interpolation=cv2.INTER_AREA)
    image = image.astype(np.float32)
    return (image / 127.5) - 1.0


def binary_metrics(labels: np.ndarray, predictions: np.ndarray) -> dict[str, float | int]:
    """Compute binary classification metrics without extra dependencies."""
    true_negative = int(np.sum((labels == 0) & (predictions == 0)))
    false_positive = int(np.sum((labels == 0) & (predictions == 1)))
    false_negative = int(np.sum((labels == 1) & (predictions == 0)))
    true_positive = int(np.sum((labels == 1) & (predictions == 1)))

    total = len(labels)
    accuracy = (true_positive + true_negative) / total if total else 0.0
    precision = (
        true_positive / (true_positive + false_positive)
        if true_positive + false_positive
        else 0.0
    )
    recall = (
        true_positive / (true_positive + false_negative)
        if true_positive + false_negative
        else 0.0
    )
    specificity = (
        true_negative / (true_negative + false_positive)
        if true_negative + false_positive
        else 0.0
    )
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall
        else 0.0
    )

    return {
        "accuracy": accuracy,
        "precision_fake": precision,
        "recall_fake": recall,
        "f1_fake": f1,
        "specificity_real": specificity,
        "false_positive_rate": 1.0 - specificity,
        "true_negative": true_negative,
        "false_positive": false_positive,
        "false_negative": false_negative,
        "true_positive": true_positive,
        "sample_count": total,
    }


def roc_auc(labels: np.ndarray, scores: np.ndarray) -> float | None:
    """Compute ROC-AUC with average ranks for tied scores."""
    positives = labels == 1
    negatives = labels == 0
    positive_count = int(np.sum(positives))
    negative_count = int(np.sum(negatives))
    if not positive_count or not negative_count:
        return None

    order = np.argsort(scores, kind="mergesort")
    sorted_scores = scores[order]
    ranks = np.empty(len(scores), dtype=np.float64)
    start = 0
    while start < len(sorted_scores):
        end = start + 1
        while end < len(sorted_scores) and sorted_scores[end] == sorted_scores[start]:
            end += 1
        ranks[order[start:end]] = ((start + 1) + end) / 2.0
        start = end

    positive_rank_sum = float(np.sum(ranks[positives]))
    return (
        positive_rank_sum - positive_count * (positive_count + 1) / 2
    ) / (positive_count * negative_count)


def evaluate(
    model_path: Path,
    data_dir: Path,
    output_dir: Path,
    threshold: float,
    batch_size: int,
) -> dict:
    """Run inference and write auditable evaluation artifacts."""
    if not model_path.is_file():
        raise FileNotFoundError(f"Model file is missing: {model_path}")
    if not data_dir.is_dir():
        raise FileNotFoundError(f"Evaluation dataset is missing: {data_dir}")
    if not 0.0 < threshold < 1.0:
        raise ValueError("Threshold must be between 0 and 1.")
    if batch_size < 1:
        raise ValueError("Batch size must be at least 1.")

    samples = list(iter_samples(data_dir))
    labels = np.asarray([label for _, label in samples], dtype=np.int32)

    if not np.any(labels == 0) or not np.any(labels == 1):
        raise ValueError("Evaluation dataset must contain both real and fake images.")

    # Import TensorFlow only when inference is requested. Metric helpers and
    # dataset validation can then be tested without loading the ML runtime.
    import tensorflow as tf

    model = tf.keras.models.load_model(model_path)
    score_batches = []
    for batch_start in range(0, len(samples), batch_size):
        batch_samples = samples[batch_start:batch_start + batch_size]
        images = np.stack([load_image(path) for path, _ in batch_samples])
        batch_scores = np.asarray(
            model.predict(images, batch_size=batch_size, verbose=0)
        ).reshape(-1)
        if len(batch_scores) != len(batch_samples):
            raise ValueError("Model returned an unexpected number of predictions.")
        if not np.all(np.isfinite(batch_scores)):
            raise ValueError("Model returned non-finite prediction scores.")
        score_batches.append(batch_scores)

    scores = np.concatenate(score_batches)
    if np.any((scores < 0.0) | (scores > 1.0)):
        raise ValueError("Model scores must be probabilities between 0 and 1.")
    predictions = (scores >= threshold).astype(np.int32)

    metrics = binary_metrics(labels, predictions)
    metrics.update(
        {
            "roc_auc": roc_auc(labels, scores),
            "threshold": threshold,
            "model_path": str(model_path),
            "dataset_path": str(data_dir),
        }
    )

    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "metrics.json").write_text(
        json.dumps(metrics, indent=2), encoding="utf-8"
    )
    (output_dir / "confusion_matrix.csv").write_text(
        "actual,predicted,count\n"
        f"real,real,{metrics['true_negative']}\n"
        f"real,fake,{metrics['false_positive']}\n"
        f"fake,real,{metrics['false_negative']}\n"
        f"fake,fake,{metrics['true_positive']}\n",
        encoding="utf-8",
    )
    (output_dir / "classification_report.json").write_text(
        json.dumps(
            {
                "real": _class_metrics(labels, predictions, 0),
                "fake": _class_metrics(labels, predictions, 1),
                "macro_f1": (
                    _class_metrics(labels, predictions, 0)["f1"]
                    + _class_metrics(labels, predictions, 1)["f1"]
                ) / 2.0,
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    with (output_dir / "predictions.csv").open(
        "w", newline="", encoding="utf-8"
    ) as file:
        writer = csv.writer(file)
        writer.writerow(["path", "actual", "score_fake", "predicted"])
        for (path, label), score, prediction in zip(
            samples, scores, predictions
        ):
            writer.writerow(
                [
                    str(path),
                    "fake" if label else "real",
                    f"{float(score):.8f}",
                    "fake" if prediction else "real",
                ]
            )

    return metrics


def _class_metrics(
    labels: np.ndarray, predictions: np.ndarray, class_label: int
) -> dict[str, float | int]:
    """Return precision, recall, F1, and support for one class."""
    true_positive = int(
        np.sum((labels == class_label) & (predictions == class_label))
    )
    false_positive = int(
        np.sum((labels != class_label) & (predictions == class_label))
    )
    false_negative = int(
        np.sum((labels == class_label) & (predictions != class_label))
    )
    precision = (
        true_positive / (true_positive + false_positive)
        if true_positive + false_positive else 0.0
    )
    recall = (
        true_positive / (true_positive + false_negative)
        if true_positive + false_negative else 0.0
    )
    f1 = (
        2 * precision * recall / (precision + recall)
        if precision + recall else 0.0
    )
    return {
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "support": int(np.sum(labels == class_label)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        required=True,
        type=Path,
        help="Directory containing real/ and fake/ subdirectories.",
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=Path(__file__).parent / "src" / "deepfake_model.h5",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).parent / "evaluation",
    )
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--batch-size", type=int, default=16)
    args = parser.parse_args()

    metrics = evaluate(
        model_path=args.model,
        data_dir=args.data_dir,
        output_dir=args.output_dir,
        threshold=args.threshold,
        batch_size=args.batch_size,
    )
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()