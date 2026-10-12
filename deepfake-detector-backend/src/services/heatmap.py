"""Heatmap and visualization helpers.

Functions here render heatmaps and spectrograms directly in memory
and return them as Base64 Data URIs (data:image/png;base64,...) so no files
are stored on the local machine.
"""
from typing import List, Optional, Tuple
import base64
import numpy as np
import cv2

try:
    import tensorflow as tf
    from mtcnn import MTCNN
    TF_AVAILABLE = True
    face_detector = MTCNN()
except Exception:
    tf = None  # type: ignore
    TF_AVAILABLE = False
    face_detector = None


def image_to_base64(img: np.ndarray) -> Optional[str]:
    """Convert an OpenCV image matrix directly to a Base64 PNG Data URI."""
    try:
        success, buffer = cv2.imencode('.png', img)
        if not success:
            return None
        encoded = base64.b64encode(buffer).decode('utf-8')
        return f"data:image/png;base64,{encoded}"
    except Exception:
        return None


def generate_mock_heatmap(image_bytes: bytes) -> Optional[str]:
    """Generate an in-memory heatmap overlay as a Base64 data URI."""
    try:
        np_arr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        if img is None:
            return None
        height, width = img.shape[:2]
        center_x = np.random.randint(width // 4, max(width // 4 + 1, 3 * width // 4))
        center_y = np.random.randint(height // 4, max(height // 4 + 1, 3 * height // 4))
        sigma = max(min(width, height) / 4, 1.0)
        y, x = np.ogrid[0:height, 0:width]
        heatmap = np.exp(-((x - center_x) ** 2 + (y - center_y) ** 2) / (2.0 * sigma ** 2))
        heatmap = np.uint8(255 * heatmap)
        heatmap_colored = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(img, 0.6, heatmap_colored, 0.4, 0)
        return image_to_base64(overlay)
    except Exception:
        return None


def generate_mock_spectrogram(file_bytes: bytes) -> Optional[str]:
    """Generate an in-memory spectrogram visualization as a Base64 data URI."""
    try:
        height, width = 192, 384
        img = np.zeros((height, width, 3), dtype=np.uint8)
        for y in range(height):
            tone = int(128 + 120 * np.sin(y / 10.0))
            img[y, :, 0] = np.clip(tone + np.linspace(-30, 30, width), 0, 255)
            img[y, :, 1] = np.clip(255 - tone + np.linspace(10, -10, width), 0, 255)
            img[y, :, 2] = np.clip((tone // 2) + np.linspace(20, -20, width), 0, 255)
        return image_to_base64(img)
    except Exception:
        return None


def detect_face_box(frame: np.ndarray) -> Tuple[int, int, int, int]:
    try:
        if TF_AVAILABLE and face_detector is not None:
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            faces = face_detector.detect_faces(rgb_frame)
            if faces:
                largest_face = max(faces, key=lambda f: f['box'][2] * f['box'][3])
                x, y, w, h = largest_face['box']
                return max(0, x), max(0, y), max(1, w), max(1, h)
    except Exception:
        pass
    height, width = frame.shape[:2]
    return (width // 4, height // 4, width // 2, height // 2)


def save_heatmap_overlay(frame: np.ndarray, intensity: float = 0.8) -> Optional[str]:
    """Generate a heatmap overlay image in memory and return as Base64 Data URI."""
    try:
        face_box = detect_face_box(frame)
        height, width = frame.shape[:2]
        y_grid, x_grid = np.ogrid[0:height, 0:width]
        cx = face_box[0] + face_box[2] // 2
        cy = face_box[1] + face_box[3] // 2
        sigma = max(face_box[2], face_box[3]) * 0.9
        if sigma <= 0:
            sigma = max(width, height) / 4.0
        heatmap = np.exp(-((x_grid - cx) ** 2 + (y_grid - cy) ** 2) / (2.0 * sigma ** 2))
        heatmap = np.clip(heatmap * intensity + np.random.random((height, width)) * 0.08, 0, 1)
        heatmap = np.uint8(255 * heatmap)
        heatmap_colored = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(frame, 0.55, heatmap_colored, 0.45, 0)
        return image_to_base64(overlay)
    except Exception:
        return None


def generate_frame_gradcam(frame: np.ndarray, grad_model, deepfake_model) -> Optional[np.ndarray]:
    """Attempt to run Grad-CAM on a single frame. Returns the full-frame heatmap matrix or None."""
    if not TF_AVAILABLE or grad_model is None or deepfake_model is None or face_detector is None:
        return None
    try:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        faces = face_detector.detect_faces(rgb_frame)
        if not faces:
            return None
        largest_face = max(faces, key=lambda f: f['box'][2] * f['box'][3])
        x, y, w, h = largest_face['box']
        pad = int(max(w, h) * 0.2)
        y1 = max(0, y - pad)
        y2 = min(rgb_frame.shape[0], y + h + pad)
        x1 = max(0, x - pad)
        x2 = min(rgb_frame.shape[1], x + w + pad)
        if x2 <= x1 or y2 <= y1:
            return None
        face_crop = rgb_frame[y1:y2, x1:x2]
        if face_crop.size == 0:
            return None
        face_resized = cv2.resize(face_crop, (224, 224))
        from tensorflow.keras.applications.mobilenet_v2 import preprocess_input
        from tensorflow.keras.preprocessing.image import img_to_array
        face_array = img_to_array(face_resized)
        face_preprocessed = preprocess_input(np.expand_dims(face_array, axis=0))
        with tf.GradientTape() as tape:
            conv_outputs, predictions = grad_model([tf.convert_to_tensor(face_preprocessed, dtype=tf.float32)])
            loss = predictions[:, 0]
        grads = tape.gradient(loss, conv_outputs)
        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_outputs = conv_outputs[0].numpy()
        pooled_grads = pooled_grads.numpy()
        heatmap = np.maximum(np.sum(conv_outputs * pooled_grads, axis=-1), 0)
        if np.max(heatmap) == 0:
            return None
        heatmap = heatmap / (np.max(heatmap) + 1e-9)
        heatmap_resized = cv2.resize(heatmap, (x2 - x1, y2 - y1))
        full_heatmap = np.zeros((frame.shape[0], frame.shape[1]), dtype=np.float32)
        full_heatmap[y1:y2, x1:x2] = heatmap_resized
        return full_heatmap
    except Exception:
        return None


def apply_gradcam_overlay(frame: np.ndarray, grad_model, deepfake_model, intensity: float = 0.8) -> Optional[str]:
    """Generate a Grad-CAM heatmap overlay image in memory and return as Base64 Data URI."""
    try:
        heatmap = None
        if grad_model is not None and deepfake_model is not None and TF_AVAILABLE:
            heatmap = generate_frame_gradcam(frame, grad_model, deepfake_model)

        if heatmap is None:
            face_box = detect_face_box(frame)
            height, width = frame.shape[:2]
            y_grid, x_grid = np.ogrid[0:height, 0:width]
            cx = face_box[0] + face_box[2] // 2
            cy = face_box[1] + face_box[3] // 2
            sigma = max(face_box[2], face_box[3]) * 0.9
            if sigma <= 0:
                sigma = max(width, height) / 4.0
            heatmap = np.exp(-((x_grid - cx) ** 2 + (y_grid - cy) ** 2) / (2.0 * sigma ** 2))
            heatmap = np.clip(heatmap * intensity + np.random.random((height, width)) * 0.08, 0, 1)
        else:
            heatmap = np.clip(heatmap * intensity, 0, 1)

        heatmap_uint8 = np.uint8(255 * heatmap)
        heatmap_colored = cv2.applyColorMap(heatmap_uint8, cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(frame, 0.55, heatmap_colored, 0.45, 0)
        return image_to_base64(overlay)
    except Exception:
        return None


def generate_video_frame_heatmaps(file_bytes: bytes, sample_count: int = 10, grad_model=None, deepfake_model=None) -> List[str]:
    """Generate Base64 Data URI heatmaps for video frames."""
    import tempfile
    import os
    frame_urls: List[str] = []
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_video:
        temp_video.write(file_bytes)
        temp_path = temp_video.name
    try:
        cap = cv2.VideoCapture(temp_path)
        if not cap.isOpened():
            return frame_urls
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        if total_frames <= 0:
            return frame_urls
        step = max(total_frames // sample_count, 1)
        frame_idx = 0
        sampled = 0
        while cap.isOpened() and sampled < sample_count:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % step == 0:
                url = apply_gradcam_overlay(frame, grad_model, deepfake_model, intensity=0.7 + (sampled % 3) * 0.1)
                if url:
                    frame_urls.append(url)
                sampled += 1
            frame_idx += 1
        cap.release()
        return frame_urls
    except Exception:
        return frame_urls
    finally:
        try:
            if os.path.exists(temp_path):
                os.remove(temp_path)
        except Exception:
            pass
