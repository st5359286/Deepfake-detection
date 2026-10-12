# Implementation Plan - SynthShield Rebranding, Scan Reasoning Enhancement & In-Memory Heatmaps

Transform the application identity to **SynthShield**, enhance scan result explainability with deep reasoning metrics, and deliver heatmap visualizations directly as in-memory Base64 data URLs without persisting snapshot files to local disk.

## User Review Required

> [!IMPORTANT]
> - **In-Memory Heatmap Snapshot Delivery**: Heatmaps will no longer generate files in `src/public/results/` or any local disk path. Instead, heatmaps and spectrograms will be encoded directly into `data:image/png;base64,...` data URIs and transmitted inside the API JSON payload.
> - **Rebranding to SynthShield**: All user-facing UI elements, titles, navigation headers, sidebars, footers, and metadata across HTML and JavaScript files will be updated to reflect **SynthShield**.
> - **Detailed Scan Reasoning**: API scan results will include an expanded `reasoning` object containing natural language explanations and granular artifact metrics (facial boundary warp, spectral consistency, noise variance).

## Proposed Changes

---

### Backend Service (`deepfake-detector-backend`)

#### [MODIFY] [`heatmap.py`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/deepfake-detector-backend/src/services/heatmap.py)
- Replace file disk-writing (`cv2.imwrite`) in `generate_mock_heatmap`, `generate_mock_spectrogram`, `save_heatmap_overlay`, and `apply_gradcam_overlay` with in-memory buffer encoding (`cv2.imencode('.png', image)`).
- Convert image buffers directly to Base64 strings: `data:image/png;base64,<base64_encoded_string>`.
- Eliminate `RESULTS_DIR` file creation.

#### [MODIFY] [`analysis.py`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/deepfake-detector-backend/src/services/analysis.py)
- Update image, audio, and video analysis functions to return in-memory Base64 data URIs for heatmaps and spectrograms.
- Generate enhanced reasoning metrics and natural language explanation breakdowns based on model predictions and facial/frequency characteristics.

#### [MODIFY] [`api.py`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/deepfake-detector-backend/src/api.py)
- Incorporate structured `reasoning` data into `/predict` response payload (`reasoning_summary`, `key_findings`, `facial_consistency_score`, `noise_distribution_score`, `audio_spectral_score`).
- Return inline Base64 heatmaps directly to the client without referencing local static files.

---

### Frontend Components (`frontend`)

#### [MODIFY] Branding Updates to **SynthShield** Across All Views
- Update application title, header, sidebar logo, and footers across:
  - [`index.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/index.html)
  - [`result.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/result.html)
  - [`scanner_with_viz.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/scanner_with_viz.html)
  - [`dashboard.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/dashboard.html)
  - [`code-scanner.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/code-scanner.html)
  - [`live-detection.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/live-detection.html)
  - [`document-verify.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/document-verify.html)
  - [`metadata-analyzer.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/metadata-analyzer.html)
  - [`settings.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/settings.html)
  - [`help.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/help.html)
  - [`login.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/login.html)
  - [`register.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/register.html)
  - [`components/header.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/components/header.html)
  - [`components/footer.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/components/footer.html)

#### [MODIFY] [`result.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/result.html) & [`scanner_with_viz.html`](file:///c:/Users/DELL/OneDrive/Desktop/demo%20project/frontend/scanner_with_viz.html)
- Display enhanced reasoning section on scan results: key findings, detailed breakdown of facial/audio artifact scores, and contextual explanation cards.
- Render heatmaps directly using inline Base64 data URIs without loading external disk URL paths.

---

## Verification Plan

### Automated Verification
- Execute `test_api.py` to confirm API `/predict` returns `SynthShield` response metadata, structured `reasoning` object, and Base64-formatted `heatmap_url` starting with `data:image/png;base64,`.
- Verify no new `.png` files are created in `src/public/results/` or anywhere on local disk during analysis.

### Manual Verification
- Upload test media on `scanner_with_viz.html` and verify the app branding displays **SynthShield**.
- Confirm scan results show rich reasoning and metric breakdown cards.
- Verify heatmap snapshot displays correctly on the result view purely from in-memory Base64 data.
