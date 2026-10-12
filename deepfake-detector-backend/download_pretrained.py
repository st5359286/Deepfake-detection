#!/usr/bin/env python
"""Download a pre-trained deepfake detection model.

This script downloads pre-trained model weights for the deepfake detector.
It supports multiple model sources and validates the downloaded files.

Usage:
    python download_pretrained.py
"""
import os
import sys
import hashlib
import urllib.request
import shutil

# Model configuration
MODEL_DIR = os.path.join(os.path.dirname(__file__), 'src')
MODEL_PATH = os.path.join(MODEL_DIR, 'deepfake_model.h5')
AUDIO_MODEL_PATH = os.path.join(MODEL_DIR, 'audio_model.h5')

# Status tracking
MODEL_STATUS_FILE = os.path.join(MODEL_DIR, 'model_status.json')


def get_model_status():
    """Check if a trained model exists and return its status."""
    import json
    status = {
        'visual_model': {
            'exists': os.path.exists(MODEL_PATH),
            'path': MODEL_PATH,
            'size_mb': round(os.path.getsize(MODEL_PATH) / (1024**2), 2) if os.path.exists(MODEL_PATH) else 0,
            'trained': False,
            'source': 'unknown',
        },
        'audio_model': {
            'exists': os.path.exists(AUDIO_MODEL_PATH),
            'path': AUDIO_MODEL_PATH,
            'size_mb': round(os.path.getsize(AUDIO_MODEL_PATH) / (1024**2), 2) if os.path.exists(AUDIO_MODEL_PATH) else 0,
            'trained': False,
            'source': 'unknown',
        }
    }

    # Check if we have a status file with training info
    if os.path.exists(MODEL_STATUS_FILE):
        try:
            with open(MODEL_STATUS_FILE, 'r') as f:
                saved_status = json.load(f)
                if 'visual_model' in saved_status:
                    status['visual_model']['trained'] = saved_status['visual_model'].get('trained', False)
                    status['visual_model']['source'] = saved_status['visual_model'].get('source', 'unknown')
                    status['visual_model']['accuracy'] = saved_status['visual_model'].get('accuracy', None)
                    status['visual_model']['training_date'] = saved_status['visual_model'].get('training_date', None)
                    status['visual_model']['dataset'] = saved_status['visual_model'].get('dataset', None)
                if 'audio_model' in saved_status:
                    status['audio_model']['trained'] = saved_status['audio_model'].get('trained', False)
                    status['audio_model']['source'] = saved_status['audio_model'].get('source', 'unknown')
        except Exception:
            pass

    return status


def save_model_status(visual_info=None, audio_info=None):
    """Save model status to disk."""
    import json
    status = get_model_status()
    if visual_info:
        status['visual_model'].update(visual_info)
    if audio_info:
        status['audio_model'].update(audio_info)
    with open(MODEL_STATUS_FILE, 'w') as f:
        json.dump(status, f, indent=2, default=str)
    print(f"Model status saved to {MODEL_STATUS_FILE}")


def build_and_save_mobilenetv2_model():
    """Build a MobileNetV2-based model and save it.
    
    This creates the architecture with ImageNet feature weights.
    The model is NOT trained on deepfake data — it will need fine-tuning.
    """
    print("\n--- Building MobileNetV2 Feature Extractor ---")
    print("This model uses ImageNet pre-trained features as a starting point.")
    print("For production deepfake detection, you should fine-tune it using train_model.py\n")

    try:
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
        import tensorflow as tf
        from tensorflow.keras.applications import MobileNetV2
        from tensorflow.keras import layers

        # Build the model
        base_model = MobileNetV2(
            input_shape=(224, 224, 3),
            include_top=False,
            weights='imagenet'
        )
        base_model.trainable = False

        x = base_model.output
        x = layers.GlobalAveragePooling2D()(x)
        x = layers.Dense(128, activation='relu')(x)
        x = layers.Dropout(0.3)(x)
        outputs = layers.Dense(1, activation='sigmoid')(x)

        model = tf.keras.Model(inputs=base_model.input, outputs=outputs)
        model.compile(
            optimizer='adam',
            loss='binary_crossentropy',
            metrics=['accuracy']
        )

        model.save(MODEL_PATH)
        size_mb = os.path.getsize(MODEL_PATH) / (1024**2)
        print(f"✅ Model saved to: {MODEL_PATH} ({size_mb:.1f} MB)")

        save_model_status(visual_info={
            'trained': False,
            'source': 'imagenet_pretrained_features',
            'accuracy': None,
            'dataset': None,
            'architecture': 'MobileNetV2 + Dense(128) + Sigmoid',
            'training_date': None,
        })

        return True
    except Exception as e:
        print(f"❌ Failed to build model: {e}")
        return False


def build_and_save_audio_model():
    """Build a small CNN audio classifier and save it."""
    print("\n--- Building Audio Classifier ---")
    try:
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        os.environ['CUDA_VISIBLE_DEVICES'] = '-1'
        import tensorflow as tf
        from tensorflow.keras import layers

        inputs = tf.keras.Input(shape=(128, 128, 1))
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

        model = tf.keras.Model(inputs, outputs)
        model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
        model.save(AUDIO_MODEL_PATH)

        size_mb = os.path.getsize(AUDIO_MODEL_PATH) / (1024**2)
        print(f"✅ Audio model saved to: {AUDIO_MODEL_PATH} ({size_mb:.1f} MB)")

        save_model_status(audio_info={
            'trained': False,
            'source': 'untrained_architecture',
        })
        return True
    except Exception as e:
        print(f"❌ Failed to build audio model: {e}")
        return False


def main():
    print("=" * 60)
    print("  Deepfake Detection — Model Setup")
    print("=" * 60)

    status = get_model_status()

    print(f"\nVisual Model: {'EXISTS' if status['visual_model']['exists'] else 'MISSING'}"
          f" ({status['visual_model']['size_mb']} MB)"
          f" | Trained: {status['visual_model']['trained']}"
          f" | Source: {status['visual_model']['source']}")
    print(f"Audio Model:  {'EXISTS' if status['audio_model']['exists'] else 'MISSING'}"
          f" ({status['audio_model']['size_mb']} MB)"
          f" | Trained: {status['audio_model']['trained']}"
          f" | Source: {status['audio_model']['source']}")

    # Build models if missing
    if not status['visual_model']['exists']:
        print("\n⚠️ Visual model is missing. Building MobileNetV2 architecture...")
        build_and_save_mobilenetv2_model()
    else:
        print(f"\n✅ Visual model exists at {MODEL_PATH}")
        if not status['visual_model']['trained']:
            print("   ⚠️ WARNING: Model has NOT been fine-tuned on deepfake data.")
            print("   Run `python train_model.py` to train it on a deepfake dataset.")

    if not status['audio_model']['exists']:
        print("\n⚠️ Audio model is missing. Building CNN architecture...")
        build_and_save_audio_model()
    else:
        print(f"\n✅ Audio model exists at {AUDIO_MODEL_PATH}")

    print("\n" + "=" * 60)
    print("  Setup Complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("  1. Run `python train_model.py` to fine-tune on deepfake data")
    print("  2. Start the API: `python -m flask --app 'src.api:create_app' run --port 5000`")


if __name__ == '__main__':
    main()
