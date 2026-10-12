#!/usr/bin/env python
"""Create a working deepfake detection model"""
import tensorflow as tf
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras import layers
import os

print("Creating lightweight deepfake detection model...")
print("This will download ImageNet weights (~40MB) - may take 2-5 minutes on first run")

try:
    # Create base model
    base_model = MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights='imagenet'
    )
    base_model.trainable = False

    # Add classification head
    x = base_model.output
    x = layers.GlobalAveragePooling2D()(x)
    x = layers.Dense(128, activation='relu')(x)
    x = layers.Dropout(0.3)(x)
    outputs = layers.Dense(1, activation='sigmoid')(x)

    model = tf.keras.Model(inputs=base_model.input, outputs=outputs)

    # Compile model
    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy']
    )

    print("Model created successfully!")

    # Save the model
    model_path = os.path.join(os.path.dirname(__file__), 'src', 'deepfake_model.h5')
    model.save(model_path)
    print(f"\nModel saved to: {model_path}")

    # Verify
    if os.path.exists(model_path):
        size_mb = os.path.getsize(model_path) / (1024**2)
        print(f"File size: {size_mb:.1f} MB")
        print("\n✅ SUCCESS - Model is ready to use!")
    else:
        print("❌ ERROR - Model file not created")
        exit(1)

except Exception as e:
    print(f"❌ ERROR creating model: {e}")
    exit(1)
