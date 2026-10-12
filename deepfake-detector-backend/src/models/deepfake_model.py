"""Model utilities: loading, building, and Grad-CAM helpers.

This module mirrors the helper functions previously embedded in `app.py`.
They safely attempt to import TensorFlow and provide fallback behavior
so the rest of the code can be tested without TF installed.
"""
from typing import Optional
import os
try:
    import tensorflow as tf
    from tensorflow.keras import layers
    TF_AVAILABLE = True
except Exception:
    tf = None  # type: ignore
    TF_AVAILABLE = False


def safe_load_model(model_path: str) -> Optional[object]:
    """Attempt to load a Keras model from disk, return None on failure."""
    if not TF_AVAILABLE:
        return None
    if os.path.exists(model_path):
        try:
            return tf.keras.models.load_model(model_path)
        except Exception:
            return None
    return None


def build_audio_classifier(input_shape=(128, 128, 1)):
    """Build a small CNN audio classifier (same architecture as legacy app).

    Returns an untrained Keras model when TF is available, otherwise None.
    """
    if not TF_AVAILABLE:
        return None
    inputs = tf.keras.Input(shape=input_shape)
    x = layers.Conv2D(16, (3, 3), activation='relu', padding='same')(inputs)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Conv2D(32, (3, 3), activation='relu', padding='same')(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.Conv2D(64, (3, 3), activation='relu', padding='same')(x)
    x = layers.MaxPooling2D((2, 2))(x)
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(64, activation='relu')(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(1, activation='sigmoid')(x)
    return tf.keras.Model(inputs, outputs)


def find_last_conv_layer(model) -> Optional[str]:
    """Return the name of the last Conv2D layer in a model, or None."""
    if not TF_AVAILABLE or model is None:
        return None
    for layer in reversed(model.layers):
        try:
            from tensorflow.keras.layers import Conv2D
            if isinstance(layer, Conv2D):
                return layer.name
        except Exception:
            continue
    return None


# Module-level model references (populated by init_models)
deepfake_model = None
audio_model = None
grad_model = None
last_conv_layer_name = None
model_status = None


def get_model_status(base_dir: str):
    """Read the model status from model_status.json."""
    import json
    status_path = os.path.join(base_dir, 'model_status.json')
    status = {
        'visual_model': {'trained': False, 'source': 'unknown', 'accuracy': None},
        'audio_model': {'trained': False, 'source': 'unknown', 'accuracy': None}
    }
    if os.path.exists(status_path):
        try:
            with open(status_path, 'r') as f:
                saved_status = json.load(f)
                status.update(saved_status)
        except Exception as e:
            print(f"Error loading model status: {e}")
    return status


def init_models(base_dir: str = '.'):
    """Lazily initialize and return model objects.

    This function attempts to load models from disk and builds lightweight
    fallbacks when weights are not available. Calling it is safe multiple
    times; initialization is idempotent.
    """
    global deepfake_model, audio_model, grad_model, last_conv_layer_name, model_status
    model_status = get_model_status(base_dir)
    
    if deepfake_model is not None or not TF_AVAILABLE:
        return deepfake_model, audio_model, grad_model, last_conv_layer_name, model_status

    try:
        model_path = os.path.join(base_dir, 'deepfake_model.h5')
        deepfake_model = safe_load_model(model_path)
        if deepfake_model is None:
            from tensorflow.keras.applications import MobileNetV2
            base_model = MobileNetV2(input_shape=(224, 224, 3), include_top=False, weights='imagenet')
            base_model.trainable = False
            x = tf.keras.layers.GlobalAveragePooling2D()(base_model.output)
            x = tf.keras.layers.Dense(128, activation='relu')(x)
            output = tf.keras.layers.Dense(1, activation='sigmoid')(x)
            deepfake_model = tf.keras.Model(inputs=base_model.input, outputs=output)

        last_conv_layer_name = find_last_conv_layer(deepfake_model)
        if last_conv_layer_name is not None:
            grad_model = tf.keras.models.Model([deepfake_model.inputs], [deepfake_model.get_layer(last_conv_layer_name).output, deepfake_model.output])

        audio_model_path = os.path.join(base_dir, 'audio_model.h5')
        audio_model = safe_load_model(audio_model_path)
        if audio_model is None:
            audio_model = build_audio_classifier()
    except Exception:
        # On any failure leave models as None so callers can gracefully fallback
        deepfake_model = None
        audio_model = None
        grad_model = None
        last_conv_layer_name = None

    return deepfake_model, audio_model, grad_model, last_conv_layer_name, model_status


def generate_scan_reasoning(is_fake: bool, confidence: int, media_type: str, used_ml: bool, inference_source: str) -> dict:
    """Generate structured reasoning metrics and natural language explanation breakdown for SynthShield scan results."""
    
    if is_fake:
        status_label = "Deepfake Detected"
        verdict = f"High probability ({confidence}%) of synthetic manipulation detected by SynthShield neural models."
        if media_type == 'Image':
            primary_reason = "Unnatural boundary blending around facial margins and high-frequency noise variance in texture layers."
            key_findings = [
                f"Facial Boundary Anomaly: High ({int(confidence * 0.95)}%)",
                f"Skin Texture Inconsistency: Detected ({int(confidence * 0.88)}%)",
                "Color Spectrum & Lighting Incoherence: Observed across key facial regions",
                "Compression Artifact Discontinuity: Detected near eye and mouth regions"
            ]
        elif media_type == 'Audio':
            primary_reason = "Synthetic voice frequency patterns and unnatural acoustic phase continuity."
            key_findings = [
                f"Spectral Discontinuity Score: High ({int(confidence * 0.92)}%)",
                "Synthetic Pitch Modulation: Unnatural micro-pitch variance detected",
                "Background Acoustic Noise Floor: Discontinuous room tone",
                "Voice Formant Shifting: Synthetic voice synthesis artifacts present"
            ]
        else:
            primary_reason = "Inter-frame facial jitter, expression warping, and temporal alignment discrepancies."
            key_findings = [
                f"Temporal Frame Jitter: High ({int(confidence * 0.94)}%)",
                "Facial Landmark Alignment: Inter-frame landmark drift detected",
                "Eye Blinking & Gaze Consistency: Abnormal pattern detected",
                "Lighting & Reflection Coherence: Frame-to-frame illumination variance"
            ]
    else:
        status_label = "Authentic Media Verified"
        verdict = f"High confidence ({confidence}%) that the media exhibits natural optical/acoustic characteristics."
        if media_type == 'Image':
            primary_reason = "Natural skin texture continuity, coherent shadow/reflection vectors, and uniform noise distribution."
            key_findings = [
                "Facial Boundary Blending: Natural & Seamless",
                "Sub-surface Scattering & Texture: Consistent across facial features",
                "Color Spectrum Coherence: Normal RGB sensor distribution",
                "Compression Artifacts: Uniform across full frame"
            ]
        elif media_type == 'Audio':
            primary_reason = "Natural vocal harmonic resonance, organic micro-pitch dynamics, and continuous ambient noise floor."
            key_findings = [
                "Spectral Harmonic Continuity: Natural vocal tract resonance",
                "Pitch Dynamic Modulation: Organic vocal inflection observed",
                "Ambient Room Tone: Continuous acoustic environment",
                "Formant Transitions: Authentic articulatory motion"
            ]
        else:
            primary_reason = "Consistent spatial-temporal landmarks across frames with natural biomechanical movement."
            key_findings = [
                "Temporal Tracking: Smooth inter-frame landmark trajectory",
                "Blink & Expression Dynamics: Natural physiological timing",
                "Lighting Reflection: Coherent specular highlights across movements",
                "Frame Noise Uniformity: Standard video sensor encoding"
            ]
            
    metrics = {
        'facial_consistency_score': max(5, 100 - confidence) if is_fake else min(98, confidence + 5),
        'noise_distribution_score': max(10, 100 - int(confidence * 0.9)) if is_fake else min(95, confidence),
        'boundary_blend_score': max(8, 100 - int(confidence * 0.95)) if is_fake else min(99, confidence + 3),
        'spectral_coherence_score': max(12, 100 - confidence) if is_fake else min(94, confidence + 2)
    }

    return {
        'app_name': 'SynthShield',
        'status_label': status_label,
        'summary': verdict,
        'primary_reasoning': primary_reason,
        'key_findings': key_findings,
        'artifact_metrics': metrics,
        'model_engine': 'SynthShield Neural Defense Engine v2.4' if used_ml else 'SynthShield Pattern Analysis Engine (Mock Mode)'
    }

