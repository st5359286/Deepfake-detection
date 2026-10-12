import cv2
import numpy as np
from pathlib import Path

img_path = Path('test_face_image.jpg')
out_path = Path('test_video.mp4')

img = cv2.imread(str(img_path))
if img is None:
    raise SystemExit('test_face_image.jpg not found')

h, w = img.shape[:2]
# resize to 640x480 for video
w_out = 640
h_out = 480
frame = cv2.resize(img, (w_out, h_out))

fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(str(out_path), fourcc, 10.0, (w_out, h_out))
for i in range(30):
    # add slight translation to simulate motion
    M = np.float32([[1, 0, (i-15)*1],[0, 1, 0]])
    moved = cv2.warpAffine(frame, M, (w_out, h_out))
    out.write(moved)
out.release()
print('Wrote', out_path)
