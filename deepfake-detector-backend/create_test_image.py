import numpy as np
from PIL import Image, ImageDraw

print("Creating test image...")

# Create a simple test image with a face-like pattern
img_array = np.random.randint(50, 150, (480, 640, 3), dtype=np.uint8)
img = Image.fromarray(img_array)

# Add some simple "face-like" features with PIL
draw = ImageDraw.Draw(img)

# Draw a simple face outline
draw.ellipse([200, 100, 440, 380], outline=(200, 150, 100), width=3)

# Draw simple eyes
draw.ellipse([250, 150, 290, 190], fill=(0, 0, 0), outline=(255, 255, 255))
draw.ellipse([350, 150, 390, 190], fill=(0, 0, 0), outline=(255, 255, 255))

# Draw simple mouth
draw.rectangle([280, 280, 360, 300], outline=(200, 50, 50), width=2)

img.save('test_image.jpg')
print("Test image saved to: C:\\Users\\DELL\\Downloads\\test_image.jpg")
