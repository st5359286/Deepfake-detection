import requests
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
image_path = BASE_DIR / "test_face_image.jpg"
api_url = "http://localhost:5000/predict"

print("Testing deepfake detection API with ML model...")
print(f"Image: {image_path}")
print(f"Image exists: {image_path.exists()}")
print(f"Image size: {image_path.stat().st_size if image_path.exists() else 0} bytes\n")

try:
    with open(image_path, 'rb') as f:
        files = {'media': ('test_face_image.jpg', f, 'image/jpeg')}
        response = requests.post(api_url, files=files, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print("SUCCESS! API Response:")
        print(json.dumps(result, indent=2))
        
        print("\n" + "="*60)
        inference_source = result.get('inference_source', 'unknown')
        media_type = result.get('media_type', 'unknown')
        used_ml = result.get('used_ml', False)
        
        print(f"Media Type Detected: {media_type}")
        print(f"Inference Source: {inference_source}")
        print(f"Used ML: {used_ml}")
        
        if used_ml or inference_source in ['trained_model', 'untrained_fallback', 'image_ml']:
            print("\n[SUCCESS] Using REAL ML MODEL!")
        else:
            print("\n[WARNING] Still using fallback/mock predictions")
    else:
        print(f"ERROR: Status code {response.status_code}")
        print(response.text)

except FileNotFoundError as e:
    print(f"ERROR: Image file not found: {e}")
except requests.exceptions.ConnectionError:
    print("ERROR: Could not connect to API at http://localhost:5000")
    print("Is Flask server running?")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
