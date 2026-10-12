# Visual model evaluation images

Place independently labelled image files in these folders:

```text
real/  authentic images
fake/  deepfake or manipulated images
```

Supported extensions are `.jpg`, `.jpeg`, `.png`, `.bmp`, and `.webp`.
The evaluator requires at least one readable image in both classes.

Use a lawful dataset source and keep its license and attribution requirements.
Do not use training images in this test set. For video datasets, keep every
frame from a source video in one split; do not mix frames from one video
between training and testing.

Run the evaluator from the repository root after adding the test images:

```powershell
& '.\.venv\Scripts\python.exe' `
    '.\deepfake-detector-backend\evaluate_model.py' `
    --data-dir '.\deepfake-detector-backend\datasets\test'
```

The evaluator writes metrics and predictions under
`deepfake-detector-backend/evaluation/`. Empty folders do not produce
evaluation results.
