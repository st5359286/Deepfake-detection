import requests
import json
from pathlib import Path

image_path = Path(r"C:\Users\DELL\OneDrive\Desktop\demo project\deepfake-detector-backend\test_face_image.jpg")
api_url = "http://localhost:5000/predict"

print("="*60)
print("Testing ML Deepfake Detection API with Face Image")
print("="*60)
print("Image: {0}".format(image_path.name))
print("Image size: {0} bytes".format(image_path.stat().st_size))
print()

try:
    with open(image_path, 'rb') as f:
        files = {'media': (str(image_path.name), f, 'image/jpeg')}
        response = requests.post(api_url, files=files, timeout=60)
    
    if response.status_code == 200:
        result = response.json()
        
        print("RESPONSE:")
        print("-" * 60)
        for key, value in result.items():
            if key != 'heatmap_url' and key != 'frame_heatmap_urls':
                print("{0}: {1}".format(key, value))
        
        print("\nHeatmap URL: {0}".format(result.get('heatmap_url', 'None')))
        
        print("\n" + "="*60)
        inference_source = result.get('inference_source', 'unknown')
        used_ml = result.get('used_ml', False)
        
        if inference_source == 'image_ml' and used_ml:
            print("SUCCESS! Using REAL ML MODEL!")
            print("- Deepfake prediction is AI-based")
            print("- Confidence score is from actual detection")
            print("- Heatmap shows Grad-CAM visualization")
        else:
            print("WARNING: Using fallback mode")
            print("Inference source: {0}".format(inference_source))
    else:
        print("ERROR: Status code {0}".format(response.status_code))
        print(response.text)

except FileNotFoundError as e:
    print("ERROR: Image file not found: {0}".format(e))
except requests.exceptions.ConnectionError:
    print("ERROR: Could not connect to API at http://localhost:5000")
    print("Is Flask server running?")
except Exception as e:
    print("ERROR: {0}".format(e))
    import traceback
    traceback.print_exc()
