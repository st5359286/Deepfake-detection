import os
import sys
from pathlib import Path

# Ensure src is importable
ROOT = Path(__file__).resolve().parent
# Put project root on path so we can import as package 'src'
sys.path.insert(0, str(ROOT))

print('Running local ML analysis test')

try:
    from src.services import analysis as analysis_service
    from src.services import heatmap as heatmap_service
    print('Imported analysis and heatmap services')
except Exception as e:
    print('Failed to import services:', e)
    raise

image_path = ROOT / 'test_face_image.jpg'
print('Image path:', image_path)
if not image_path.exists():
    print('Image not found; aborting')
    sys.exit(1)

with open(image_path, 'rb') as f:
    file_bytes = f.read()

print('Calling analyze_image_bytes...')
try:
    res = analysis_service.analyze_image_bytes(file_bytes)
    print('analyze_image_bytes returned:', res)
except Exception as e:
    print('analyze_image_bytes raised exception:')
    import traceback
    traceback.print_exc()

print('\nChecking models via ensure_models_loaded()')
try:
    deepfake_model, audio_model, grad_model, last_conv = analysis_service.ensure_models_loaded()
    print('deepfake_model is None?', deepfake_model is None)
    print('audio_model is None?', audio_model is None)
    print('grad_model is None?', grad_model is None)
    print('last_conv_layer:', last_conv)
except Exception as e:
    print('ensure_models_loaded failed:')
    import traceback
    traceback.print_exc()

print('\nChecking face detector from heatmap service')
try:
    fd = heatmap_service.face_detector
    print('face_detector is None?', fd is None)
    if fd is not None:
        # try a detection
        import cv2
        import numpy as np
        np_arr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        print('Image shape:', None if img is None else img.shape)
        faces = fd.detect_faces(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        print('Detected faces:', faces)
except Exception as e:
    print('Face detector check failed:')
    import traceback
    traceback.print_exc()

print('\nLocal analysis test complete')
