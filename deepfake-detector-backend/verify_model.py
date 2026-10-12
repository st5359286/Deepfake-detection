import os
import sys
os.chdir('C:\\Users\\DELL\\OneDrive\\Desktop\\demo project\\deepfake-detector-backend')
sys.path.insert(0, 'src')

try:
    import tensorflow as tf
    print("Testing model loading...")
    model_path = 'src/deepfake_model.h5'
    
    if os.path.exists(model_path):
        print(f"Model file exists: {os.path.getsize(model_path)} bytes")
        model = tf.keras.models.load_model(model_path)
        print("SUCCESS! Model loaded successfully!")
        print(f"Model type: {type(model)}")
        print(f"Input shape: {model.input_shape}")
        print(f"Output shape: {model.output_shape}")
    else:
        print(f"ERROR: Model file not found at {model_path}")
        
except Exception as e:
    print(f"ERROR loading model: {e}")
    import traceback
    traceback.print_exc()
