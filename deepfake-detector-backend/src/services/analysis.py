"""Deepfake analysis service.

This module handles:
- Image analysis
- Video analysis
- Audio analysis

The visual model is loaded from:
    src/deepfake_model.h5

The service reports whether the actual trained model was used.
"""

from typing import List, Optional, Tuple

import os
import uuid
import tempfile

import numpy as np
import cv2

from . import heatmap as heatmap_service
from ..models import deepfake_model as model_helpers


# ============================================================
# TensorFlow
# ============================================================

try:
    import tensorflow as tf

    from tensorflow.keras.applications.mobilenet_v2 import (
        preprocess_input
    )

    from tensorflow.keras.preprocessing.image import (
        img_to_array
    )

    TF_AVAILABLE = True

    print("[INFO] TensorFlow available:", tf.__version__)
except Exception as e:
    tf = None
    TF_AVAILABLE = False

    print("[ERROR] TensorFlow unavailable:", e)


# ============================================================
# Base directory
# ============================================================

BASE_DIR = os.path.abspath(
    os.path.join(
        os.path.dirname(__file__),
        '..'
    )
)

MODEL_PATH = os.path.join(
    BASE_DIR,
    'deepfake_model.h5'
)

print("[INFO] Analysis BASE_DIR:", BASE_DIR)
print("[INFO] Expected model path:", MODEL_PATH)
print("[INFO] Model exists:", os.path.exists(MODEL_PATH))


# ============================================================
# Model loading
# ============================================================

def ensure_models_loaded():
    """Load all models lazily."""

    try:

        deepfake, audio, grad, last_conv, model_status = (
            model_helpers.init_models(BASE_DIR)
        )

        if deepfake is not None:

            print(
                "[INFO] Deepfake visual model loaded successfully."
            )

            print(
                "[INFO] Visual model input shape:",
                getattr(deepfake, "input_shape", "unknown")
            )

        else:

            print(
                "[ERROR] Deepfake visual model is None."
            )

        if audio is not None:

            print(
                "[INFO] Audio model loaded successfully."
            )

        return (
            deepfake,
            audio,
            grad,
            last_conv,
            model_status
        )

    except Exception as e:

        print(
            "[ERROR] Error loading models:",
            repr(e)
        )

        return (
            None,
            None,
            None,
            None,
            None
        )


# ============================================================
# Audio decoding
# ============================================================

def decode_audio_wav(
    file_bytes: bytes,
    desired_samples: int = 16000,
    desired_sample_rate: int = 16000
) -> Tuple[
    Optional[np.ndarray],
    Optional[int]
]:

    if not TF_AVAILABLE:
        return None, None

    try:

        wav_tensor = tf.audio.decode_wav(
            tf.constant(file_bytes),
            desired_channels=1
        )

        audio = tf.squeeze(
            wav_tensor.audio,
            axis=-1
        ).numpy()

        sample_rate = int(
            wav_tensor.sample_rate.numpy()
        )

        # Resample
        if (
            sample_rate != desired_sample_rate
            and audio is not None
            and audio.size > 0
        ):

            duration = (
                audio.shape[0] /
                float(sample_rate)
            )

            desired_length = int(
                round(
                    duration *
                    desired_sample_rate
                )
            )

            if desired_length > 0:

                orig_times = np.linspace(
                    0.0,
                    duration,
                    num=audio.shape[0],
                    endpoint=False
                )

                new_times = np.linspace(
                    0.0,
                    duration,
                    num=desired_length,
                    endpoint=False
                )

                audio = np.interp(
                    new_times,
                    orig_times,
                    audio
                ).astype(np.float32)

                sample_rate = desired_sample_rate

        # Pad / trim
        if audio.shape[0] < desired_samples:

            pad = (
                desired_samples -
                audio.shape[0]
            )

            audio = np.pad(
                audio,
                (0, pad),
                mode='constant'
            )

        else:

            audio = audio[:desired_samples]

        return audio, sample_rate

    except Exception as e:

        print(
            "[ERROR] Audio decoding failed:",
            repr(e)
        )

        return None, None


# ============================================================
# Mel spectrogram
# ============================================================

def extract_mel_spectrogram(
    audio: np.ndarray,
    sample_rate: int,
    n_mels: int = 128,
    frame_length: int = 512,
    frame_step: int = 256
) -> Optional[np.ndarray]:

    if not TF_AVAILABLE:
        return None

    try:

        waveform = tf.convert_to_tensor(
            audio,
            dtype=tf.float32
        )

        stfts = tf.signal.stft(
            waveform,
            frame_length=frame_length,
            frame_step=frame_step,
            fft_length=frame_length
        )

        spectrogram = tf.abs(stfts)

        num_spectrogram_bins = (
            spectrogram.shape[-1]
        )

        mel_weight_matrix = (
            tf.signal.linear_to_mel_weight_matrix(
                num_mel_bins=n_mels,
                num_spectrogram_bins=num_spectrogram_bins,
                sample_rate=sample_rate,
                lower_edge_hz=80.0,
                upper_edge_hz=sample_rate / 2.0
            )
        )

        mel_spectrogram = tf.tensordot(
            spectrogram,
            mel_weight_matrix,
            1
        )

        mel_spectrogram.set_shape(
            spectrogram.shape[:-1].concatenate(
                mel_weight_matrix.shape[-1:]
            )
        )

        log_mel_spectrogram = tf.math.log(
            mel_spectrogram + 1e-6
        )

        resized = tf.image.resize(
            tf.expand_dims(
                log_mel_spectrogram,
                -1
            ),
            [128, 128]
        )

        normalized = (
            resized -
            tf.reduce_min(resized)
        )

        normalized = normalized / (
            tf.reduce_max(normalized) +
            1e-9
        )

        return normalized.numpy()

    except Exception as e:

        print(
            "[ERROR] Mel spectrogram failed:",
            repr(e)
        )

        return None


# ============================================================
# Save audio spectrogram
# ============================================================

def save_audio_spectrogram(
    file_bytes: bytes
) -> Optional[str]:

    audio, sample_rate = decode_audio_wav(
        file_bytes
    )

    if audio is None:
        return None

    spec = extract_mel_spectrogram(
        audio,
        sample_rate
    )

    if spec is None:
        return None

    spec_gray = np.uint8(
        np.clip(
            spec[:, :, 0] * 255,
            0,
            255
        )
    )

    spec_colored = cv2.applyColorMap(
        spec_gray,
        cv2.COLORMAP_INFERNO
    )

    os.makedirs(
        heatmap_service.RESULTS_DIR,
        exist_ok=True
    )

    filename = (
        f"audio_spectrogram_"
        f"{uuid.uuid4().hex}.png"
    )

    filepath = os.path.join(
        heatmap_service.RESULTS_DIR,
        filename
    )

    cv2.imwrite(
        filepath,
        spec_colored
    )

    return f"/results/{filename}"


# ============================================================
# Analyze single frame
# ============================================================

def analyze_frame_ml(
    frame: np.ndarray
) -> Optional[float]:

    (
        deepfake_model,
        audio_model,
        grad_model,
        last_conv,
        model_status
    ) = ensure_models_loaded()

    # --------------------------------------------------------
    # Check TensorFlow
    # --------------------------------------------------------

    if not TF_AVAILABLE:

        print(
            "[ERROR] TensorFlow is not available."
        )

        return None

    # --------------------------------------------------------
    # Check model
    # --------------------------------------------------------

    if deepfake_model is None:

        print(
            "[ERROR] Visual deepfake model was not loaded."
        )

        return None

    # --------------------------------------------------------
    # Face detector
    # --------------------------------------------------------

    if heatmap_service.face_detector is None:

        print(
            "[WARNING] Face detector unavailable."
        )

        # IMPORTANT:
        # Do NOT immediately fail.
        #
        # We can run the model on the entire image.
        #
        use_full_image = True

    else:

        use_full_image = False

    try:

        # ----------------------------------------------------
        # Convert BGR -> RGB
        # ----------------------------------------------------

        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB
        )

        # ----------------------------------------------------
        # Resize large image
        # ----------------------------------------------------

        max_dim = 800

        h, w = rgb_frame.shape[:2]

        if max(h, w) > max_dim:

            scale = (
                max_dim /
                max(h, w)
            )

            rgb_frame = cv2.resize(
                rgb_frame,
                (
                    int(w * scale),
                    int(h * scale)
                )
            )

        # ----------------------------------------------------
        # Face detection
        # ----------------------------------------------------

        face_crop = None

        if not use_full_image:

            try:

                faces = (
                    heatmap_service
                    .face_detector
                    .detect_faces(
                        rgb_frame
                    )
                )

            except Exception as e:

                print(
                    "[WARNING] Face detection failed:",
                    repr(e)
                )

                faces = []

            if faces:

                largest_face = max(
                    faces,
                    key=lambda f:
                    f['box'][2] *
                    f['box'][3]
                )

                x, y, fw, fh = (
                    largest_face['box']
                )

                pad_y = int(fh * 0.2)
                pad_x = int(fw * 0.2)

                y1 = max(
                    0,
                    y - pad_y
                )

                y2 = min(
                    rgb_frame.shape[0],
                    y + fh + pad_y
                )

                x1 = max(
                    0,
                    x - pad_x
                )

                x2 = min(
                    rgb_frame.shape[1],
                    x + fw + pad_x
                )

                face_crop = (
                    rgb_frame[
                        y1:y2,
                        x1:x2
                    ]
                )

                print(
                    "[INFO] Face detected. "
                    "Running model on face crop."
                )

            else:

                print(
                    "[WARNING] No face detected. "
                    "Running model on full image."
                )

        # ----------------------------------------------------
        # Full image fallback
        # ----------------------------------------------------

        if (
            face_crop is None
            or face_crop.size == 0
        ):

            face_crop = rgb_frame

        # ----------------------------------------------------
        # Resize to MobileNetV2 input
        # ----------------------------------------------------

        face_resized = cv2.resize(
            face_crop,
            (224, 224)
        )

        face_array = img_to_array(
            face_resized
        )

        input_tensor = np.expand_dims(
            face_array,
            axis=0
        )

        input_tensor = preprocess_input(
            input_tensor
        )

        # ----------------------------------------------------
        # REAL MODEL INFERENCE
        # ----------------------------------------------------

        print(
            "[INFO] Running deepfake_model.h5 prediction..."
        )

        prediction = deepfake_model.predict(
            input_tensor,
            verbose=0
        )

        print(
            "[INFO] Raw model prediction:",
            prediction
        )

        probability = float(
            np.asarray(prediction).reshape(-1)[0]
        )

        probability = max(
            0.0,
            min(1.0, probability)
        )

        print(
            f"[INFO] Model probability: "
            f"{probability:.6f}"
        )

        return probability

    except Exception as e:

        print(
            "[ERROR] Model inference failed:",
            repr(e)
        )

        return None


# ============================================================
# Image analysis
# ============================================================

def analyze_image_bytes(
    file_bytes: bytes
) -> Tuple[
    Optional[bool],
    Optional[int],
    Optional[str],
    Optional[bool]
]:

    np_arr = np.frombuffer(
        file_bytes,
        np.uint8
    )

    frame = cv2.imdecode(
        np_arr,
        cv2.IMREAD_COLOR
    )

    if frame is None:

        print(
            "[ERROR] Could not decode image."
        )

        return None, None, None, None

    # --------------------------------------------------------
    # REAL ML PREDICTION
    # --------------------------------------------------------

    score = analyze_frame_ml(
        frame
    )

    if score is None:

        print(
            "[ERROR] ML analysis returned no score."
        )

        return None, None, None, None

    # --------------------------------------------------------
    # Prediction
    # --------------------------------------------------------

    is_fake = score >= 0.5

    if is_fake:

        confidence = int(
            score * 100
        )

    else:

        confidence = int(
            (1.0 - score) * 100
        )

    confidence = max(
        1,
        min(99, confidence)
    )

    # --------------------------------------------------------
    # Heatmap
    # --------------------------------------------------------

    try:

        heatmap_url = (
            heatmap_service
            .save_heatmap_overlay(
                frame,
                intensity=0.75
            )
        )

    except Exception as e:

        print(
            "[WARNING] Heatmap generation failed:",
            repr(e)
        )

        heatmap_url = None

    # --------------------------------------------------------
    # Determine trained state
    # --------------------------------------------------------

    try:

        (
            _deepfake,
            _audio,
            _grad,
            _last_conv,
            model_status
        ) = ensure_models_loaded()

        is_trained = bool(
            model_status
            and model_status
            .get('visual_model', {})
            .get('trained', False)
        )

    except Exception:

        is_trained = False

    # --------------------------------------------------------
    # Debug
    # --------------------------------------------------------

    print("\n" + "=" * 60)
    print("IMAGE ML ANALYSIS")
    print("=" * 60)
    print("Model prediction :", score)
    print("Is deepfake      :", is_fake)
    print("Confidence       :", confidence)
    print("Trained model    :", is_trained)
    print("=" * 60 + "\n")

    return (
        is_fake,
        confidence,
        heatmap_url,
        is_trained
    )


# ============================================================
# Video analysis
# ============================================================

def analyze_video_bytes(
    file_bytes: bytes
) -> Tuple[
    Optional[bool],
    Optional[int],
    List[int],
    List[str],
    Optional[bool]
]:

    frame_scores = []
    frame_heatmap_urls = []

    with tempfile.NamedTemporaryFile(
        delete=False,
        suffix='.mp4'
    ) as temp_video:

        temp_video.write(
            file_bytes
        )

        temp_path = temp_video.name

    try:

        cap = cv2.VideoCapture(
            temp_path
        )

        if not cap.isOpened():

            print(
                "[ERROR] Could not open video."
            )

            return None, None, [], [], None

        fps = cap.get(
            cv2.CAP_PROP_FPS
        )

        if fps == 0 or np.isnan(fps):

            fps = 30

        frame_interval = max(
            int(fps),
            1
        )

        frame_idx = 0

        while cap.isOpened():

            ret, frame = cap.read()

            if not ret:
                break

            if frame_idx % frame_interval == 0:

                score = analyze_frame_ml(
                    frame
                )

                if score is not None:

                    frame_scores.append(
                        score
                    )

            frame_idx += 1

        cap.release()

        if not frame_scores:

            return None, None, [], [], None

        mean_probability = float(
            np.mean(frame_scores)
        )

        is_fake = (
            mean_probability >= 0.5
        )

        if is_fake:

            confidence = int(
                mean_probability * 100
            )

        else:

            confidence = int(
                (1 - mean_probability) * 100
            )

        confidence = max(
            1,
            min(99, confidence)
        )

        mapped_scores = [
            int(
                max(
                    1,
                    min(
                        99,
                        score * 100
                    )
                )
            )
            for score in frame_scores
        ]

        # ----------------------------------------------------
        # Model status
        # ----------------------------------------------------

        (
            deepfake_model,
            audio_model,
            grad_model,
            last_conv,
            model_status
        ) = ensure_models_loaded()

        is_trained = bool(
            model_status
            and model_status
            .get('visual_model', {})
            .get('trained', False)
        )

        # ----------------------------------------------------
        # Heatmaps
        # ----------------------------------------------------

        try:

            frame_heatmap_urls = (
                heatmap_service
                .generate_video_frame_heatmaps(
                    file_bytes,
                    sample_count=min(
                        8,
                        len(mapped_scores)
                    ),
                    grad_model=grad_model,
                    deepfake_model=deepfake_model
                )
            )

        except Exception as e:

            print(
                "[WARNING] Video heatmap error:",
                repr(e)
            )

            frame_heatmap_urls = []

        return (
            is_fake,
            confidence,
            mapped_scores,
            frame_heatmap_urls,
            is_trained
        )

    finally:

        try:

            if os.path.exists(
                temp_path
            ):

                os.remove(
                    temp_path
                )

        except Exception:
            pass


# ============================================================
# Audio analysis
# ============================================================

def analyze_audio_bytes(
    file_bytes: bytes
) -> Tuple[
    Optional[bool],
    Optional[int],
    Optional[str],
    Optional[bool]
]:

    (
        deepfake_model,
        audio_model,
        grad_model,
        last_conv,
        model_status
    ) = ensure_models_loaded()

    if not TF_AVAILABLE:

        return None, None, None, None

    if audio_model is None:

        print(
            "[ERROR] Audio model unavailable."
        )

        return None, None, None, None

    audio, sample_rate = (
        decode_audio_wav(
            file_bytes
        )
    )

    if audio is None:

        return None, None, None, None

    spec = extract_mel_spectrogram(
        audio,
        sample_rate
    )

    if spec is None:

        return None, None, None, None

    try:

        input_tensor = (
            np.expand_dims(
                spec,
                axis=0
            )
            .astype(np.float32)
        )

        prediction = (
            audio_model.predict(
                input_tensor,
                verbose=0
            )
        )

        probability = float(
            np.asarray(
                prediction
            ).reshape(-1)[0]
        )

        probability = max(
            0.0,
            min(1.0, probability)
        )

        is_fake = (
            probability >= 0.5
        )

        if is_fake:

            confidence = int(
                probability * 100
            )

        else:

            confidence = int(
                (1 - probability) * 100
            )

        confidence = max(
            1,
            min(99, confidence)
        )

        audio_spec_url = (
            save_audio_spectrogram(
                file_bytes
            )
        )

        is_trained = bool(
            model_status
            and model_status
            .get('audio_model', {})
            .get('trained', False)
        )

        return (
            is_fake,
            confidence,
            audio_spec_url,
            is_trained
        )

    except Exception as e:

        print(
            "[ERROR] Audio model inference failed:",
            repr(e)
        )

        return None, None, None, None

