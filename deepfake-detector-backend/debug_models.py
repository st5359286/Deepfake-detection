"""Debug why ML models aren't being used in the API"""
import os
import sys

os.chdir('C:\\Users\\DELL\\OneDrive\\Desktop\\demo project\\deepfake-detector-backend')
sys.path.insert(0, '.')

print("Debugging model initialization...\n")

# Test 1: Check if TensorFlow is available
try:
    import tensorflow as tf
    print("[OK] TensorFlow imported successfully")
except Exception as e:
    print("[FAIL] TensorFlow import failed: {0}".format(e))
    sys.exit(1)

# Test 2: Check if model files exist
model_paths = [
    'src/deepfake_model.h5',
    'src/audio_model.h5'
]

for path in model_paths:
    if os.path.exists(path):
        size = os.path.getsize(path) / (1024**2)
        print("[OK] {0} exists ({1:.1f} MB)".format(path, size))
    else:
        print("[MISSING] {0}".format(path))

# Test 3: Try to initialize models like the API does
print("\nAttempting to initialize models...")
try:
    from src.models import deepfake_model as model_helpers
    
    BASE_DIR = os.path.abspath('src')
    deepfake_model, audio_model, grad_model, last_conv = model_helpers.init_models(BASE_DIR)
    
    if deepfake_model is not None:
        print("[OK] Deepfake model loaded: {0}".format(type(deepfake_model)))
    else:
        print("[FAIL] Deepfake model is None")
        
    if audio_model is not None:
        print("[OK] Audio model loaded: {0}".format(type(audio_model)))
    else:
        print("[INFO] Audio model is None (optional)")
        
    if grad_model is not None:
        print("[OK] Grad model loaded: {0}".format(type(grad_model)))
    else:
        print("[INFO] Grad model is None (optional)")
        
except Exception as e:
    print("[FAIL] Error initializing models: {0}".format(e))
    import traceback
    traceback.print_exc()

# Test 4: Check MTCNN
print("\nChecking face detector...")
try:
    from mtcnn import MTCNN
    face_detector = MTCNN()
    print("[OK] MTCNN face detector initialized")
except Exception as e:
    print("[FAIL] MTCNN initialization failed: {0}".format(e))

print("\nDebug complete!")
