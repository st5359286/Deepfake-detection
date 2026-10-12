#!/usr/bin/env python
"""Download a test face image from a public source"""
import urllib.request
import os

print("Downloading test face image...")

# Use a simple publicly available face image
urls = [
    'https://upload.wikimedia.org/wikipedia/commons/a/a7/Camponotus_flavomarginatus_ant.jpg',  # Fallback
]

# Try to get a simple public face image
test_urls = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg/402px-Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/RosaParks.jpg/440px-RosaParks.jpg',
]

output_path = os.path.join(
    'C:\\Users\\DELL\\OneDrive\\Desktop\\demo project\\deepfake-detector-backend',
    'test_face_image.jpg'
)

for url in test_urls:
    try:
        print(f"Trying: {url[:50]}...")
        urllib.request.urlretrieve(url, output_path, timeout=10)
        
        # Verify file was created
        size = os.path.getsize(output_path)
        if size > 5000:  # Should be at least 5KB
            print(f"SUCCESS! Downloaded {size} bytes to {output_path}")
            break
    except Exception as e:
        print(f"Failed: {e}")
        continue

if not os.path.exists(output_path) or os.path.getsize(output_path) < 5000:
    print("\nCould not download test image. Creating synthetic face image instead...")
    
    try:
        import numpy as np
        from PIL import Image, ImageDraw
        
        # Create a more realistic test image with a face-like pattern
        img = Image.new('RGB', (300, 400), color='tan')
        draw = ImageDraw.Draw(img, 'RGBA')
        
        # Face oval (light skin tone)
        draw.ellipse([50, 60, 250, 360], fill='wheat', outline='brown', width=3)
        
        # Eyes
        draw.ellipse([90, 130, 130, 170], fill='white', outline='black', width=2)
        draw.ellipse([170, 130, 210, 170], fill='white', outline='black', width=2)
        
        # Pupils
        draw.ellipse([105, 145, 115, 155], fill='black')
        draw.ellipse([185, 145, 195, 155], fill='black')
        
        # Eyebrows
        draw.arc([85, 110, 135, 140], 0, 180, fill='brown', width=2)
        draw.arc([165, 110, 215, 140], 0, 180, fill='brown', width=2)
        
        # Nose
        draw.polygon([(150, 170), (145, 220), (155, 220)], fill='lightyellow', outline='brown')
        
        # Mouth
        draw.arc([110, 250, 190, 290], 0, 180, fill='red', width=3)
        
        # Ears
        draw.ellipse([30, 150, 60, 220], fill='peachpuff', outline='brown', width=2)
        draw.ellipse([240, 150, 270, 220], fill='peachpuff', outline='brown', width=2)
        
        img.save(output_path)
        print(f"Created synthetic face image: {output_path}")
        print("Note: The ML model will work better with real face photos")
        
    except Exception as e:
        print(f"Error creating synthetic face: {e}")

print(f"\nTest image ready at: {output_path}")
