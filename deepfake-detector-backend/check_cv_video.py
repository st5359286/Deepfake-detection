import cv2
cap = cv2.VideoCapture('test_video.mp4')
print('isOpened:', cap.isOpened())
if cap.isOpened():
    print('FPS', cap.get(cv2.CAP_PROP_FPS), 'frames', cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
else:
    print('Cannot open video')
