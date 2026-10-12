import io
from PIL import Image
from src.api import create_app


def make_png_bytes():
    im = Image.new('RGB', (32, 32), color=(73, 109, 137))
    b = io.BytesIO()
    im.save(b, format='PNG')
    return b.getvalue()


def test_predict_image_endpoint():
    app = create_app()
    client = app.test_client()
    data = {
        'media': (io.BytesIO(make_png_bytes()), 'test.png')
    }
    resp = client.post('/predict', data=data, content_type='multipart/form-data')
    assert resp.status_code == 200
    j = resp.get_json()
    assert 'is_deepfake' in j
    assert 'confidence' in j
