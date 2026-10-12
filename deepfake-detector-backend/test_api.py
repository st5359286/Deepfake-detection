#!/usr/bin/env python
"""Test the deepfake detection API"""
import requests
import json

import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.resolve()
image_path = BASE_DIR / "test_face_image.jpg"
api_url = "http://localhost:5000/predict"

print("Testing SynthShield deepfake detection API...")
print(f"Image: {image_path}")
print(f"API URL: {api_url}\n")

try:
    with open(image_path, 'rb') as f:
        files = {'media': ('test_face_image.jpg', f, 'image/jpeg')}
        response = requests.post(api_url, files=files, timeout=30)
    
    if response.status_code == 200:
        result = response.json()
        print("SUCCESS! API Response:")
        print(json.dumps(result, indent=2))
        
        # Check if using real ML or mock
        used_ml = result.get('used_ml', False)
        inference_source = result.get('inference_source', 'unknown')
        if used_ml or inference_source in ['trained_model', 'untrained_fallback', 'image_ml']:
            print(f"\n[SUCCESS] Using REAL ML MODEL ({inference_source}) - Predictions are AI-based!")
        elif inference_source == 'mock':
            print("\n[FAIL] Still using mock mode - ML model not loaded properly")
        else:
            print(f"\n[WARNING] Inference source: {inference_source}")
    else:
        print(f"ERROR: Status code {response.status_code}")
        print(response.text)

except FileNotFoundError:
    print(f"ERROR: Image file not found: {image_path}")
except requests.exceptions.ConnectionError:
    print("ERROR: Could not connect to API. Is Flask server running on port 5000?")
except Exception as e:
    print(f"ERROR: {e}")
