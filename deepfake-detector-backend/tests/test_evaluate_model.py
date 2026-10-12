import numpy as np
import pytest

from evaluate_model import binary_metrics, iter_samples, roc_auc


def test_binary_metrics_calculates_confusion_matrix_and_fake_scores():
    labels = np.asarray([0, 0, 1, 1])
    predictions = np.asarray([0, 1, 1, 1])

    metrics = binary_metrics(labels, predictions)

    assert metrics["true_negative"] == 1
    assert metrics["false_positive"] == 1
    assert metrics["false_negative"] == 0
    assert metrics["true_positive"] == 2
    assert metrics["accuracy"] == pytest.approx(0.75)
    assert metrics["precision_fake"] == pytest.approx(2 / 3)
    assert metrics["recall_fake"] == pytest.approx(1.0)
    assert metrics["f1_fake"] == pytest.approx(0.8)


def test_roc_auc_handles_tied_scores():
    labels = np.asarray([0, 0, 1, 1])
    scores = np.asarray([0.5, 0.5, 0.5, 0.5])

    assert roc_auc(labels, scores) == pytest.approx(0.5)


def test_roc_auc_returns_none_for_single_class():
    labels = np.asarray([1, 1, 1])
    scores = np.asarray([0.2, 0.6, 0.8])

    assert roc_auc(labels, scores) is None


def test_iter_samples_requires_both_class_directories(tmp_path):
    real_dir = tmp_path / "real"
    real_dir.mkdir()
    (real_dir / "real.jpg").write_bytes(b"placeholder")

    with pytest.raises(FileNotFoundError, match="fake"):
        list(iter_samples(tmp_path))


def test_iter_samples_rejects_empty_class(tmp_path):
    (tmp_path / "real").mkdir()
    (tmp_path / "fake").mkdir()
    (tmp_path / "real" / "real.jpg").write_bytes(b"placeholder")

    with pytest.raises(ValueError, match="No supported images"):
        list(iter_samples(tmp_path))
