# Deepfake Detector Backend (Refactor)

This repository contains a modular refactor scaffold for the deepfake detection backend.

Next steps:
- Migrate functions from the legacy `app.py` into `src/services` and `src/models`.
- Implement proper Grad-CAM and audio feature extraction modules.
- Add unit tests and CI.

Running locally
-----------------
Install dependencies and run tests:

```bash
python -m pip install -r requirements.txt
pytest tests -q
```

Run the Flask app locally:

```bash
export FLASK_APP=src.api:create_app
flask run --host=0.0.0.0 --port=5000
```

Docker
------
Build and run the container:

```bash
docker build -t deepfake-detector-backend .
docker run -p 5000:5000 deepfake-detector-backend
```
