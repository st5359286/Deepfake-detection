from flask import Flask, request, jsonify
from flask_cors import CORS
import hashlib
import os

from .services import analysis as analysis_service
from .services import heatmap as heatmap_service
from .models import deepfake_model as model_helpers


def create_app():
    app = Flask(__name__)
    CORS(app)

    # ---------------------------------------------------------
    # Model Status
    # ---------------------------------------------------------
    @app.route('/model-status', methods=['GET'])
    def get_status():
        status = model_helpers.get_model_status(
            analysis_service.BASE_DIR
        )
        return jsonify(status)

    # ---------------------------------------------------------
    # Prediction API
    # ---------------------------------------------------------
    @app.route('/predict', methods=['POST'])
    def predict():
        try:
            # -------------------------------------------------
            # Check uploaded file
            # -------------------------------------------------
            if 'media' not in request.files:
                return jsonify({
                    'error': 'No media file provided'
                }), 400

            file = request.files['media']

            file_bytes = file.read()

            if not file_bytes:
                return jsonify({
                    'error': 'Empty file provided'
                }), 400

            # -------------------------------------------------
            # Basic file information
            # -------------------------------------------------
            mimetype = file.content_type or ''

            # MD5 is only being used here as an internal
            # deterministic identifier for this API.
            file_hash = hashlib.md5(file_bytes).hexdigest()

            # -------------------------------------------------
            # Default prediction values
            # -------------------------------------------------
            is_fake = False
            confidence = 0

            heatmap_url = None

            frame_heatmap_urls = []
            frame_scores = []

            audio_confidence = 0

            # IMPORTANT:
            # False until an actual ML analysis successfully
            # returns a prediction.
            used_ml = False

            # Default source
            inference_source = 'mock'

            # -------------------------------------------------
            # IMAGE ANALYSIS
            # -------------------------------------------------
            if mimetype.startswith('image/'):

                try:
                    (
                        is_fake_ml,
                        conf_ml,
                        heatmap_ml,
                        is_trained
                    ) = analysis_service.analyze_image_bytes(
                        file_bytes
                    )

                    if conf_ml is not None:

                        is_fake = bool(is_fake_ml)
                        confidence = int(conf_ml)

                        heatmap_url = heatmap_ml

                        used_ml = True

                        # Tell frontend exactly which model path
                        # was used.
                        if is_trained:
                            inference_source = 'trained_model'
                        else:
                            inference_source = 'untrained_fallback'

                except Exception as ml_error:

                    print(
                        f"[ML ERROR] Image analysis failed: "
                        f"{ml_error}"
                    )

                    used_ml = False
                    inference_source = 'mock'

            # -------------------------------------------------
            # VIDEO ANALYSIS
            # -------------------------------------------------
            elif mimetype.startswith('video/'):

                try:
                    (
                        is_fake_ml,
                        conf_ml,
                        video_frame_scores,
                        frame_heatmaps,
                        is_trained
                    ) = analysis_service.analyze_video_bytes(
                        file_bytes
                    )

                    if conf_ml is not None:

                        is_fake = bool(is_fake_ml)
                        confidence = int(conf_ml)

                        frame_scores = video_frame_scores or []
                        frame_heatmap_urls = frame_heatmaps or []

                        used_ml = True

                        if is_trained:
                            inference_source = 'trained_model'
                        else:
                            inference_source = 'untrained_fallback'

                except Exception as ml_error:

                    print(
                        f"[ML ERROR] Video analysis failed: "
                        f"{ml_error}"
                    )

                    used_ml = False
                    inference_source = 'mock'

            # -------------------------------------------------
            # AUDIO ANALYSIS
            # -------------------------------------------------
            elif mimetype.startswith('audio/'):

                try:
                    (
                        is_fake_ml,
                        conf_ml,
                        audio_heatmap,
                        is_trained
                    ) = analysis_service.analyze_audio_bytes(
                        file_bytes
                    )

                    if conf_ml is not None:

                        is_fake = bool(is_fake_ml)
                        confidence = int(conf_ml)

                        heatmap_url = audio_heatmap

                        audio_confidence = int(conf_ml)

                        used_ml = True

                        if is_trained:
                            inference_source = 'trained_model'
                        else:
                            inference_source = 'untrained_fallback'

                except Exception as ml_error:

                    print(
                        f"[ML ERROR] Audio analysis failed: "
                        f"{ml_error}"
                    )

                    used_ml = False
                    inference_source = 'mock'

            # -------------------------------------------------
            # FALLBACK MOCK LOGIC
            # -------------------------------------------------
            #
            # IMPORTANT:
            #
            # The mock prediction is ONLY used when ML analysis
            # was unavailable.
            #
            # It will NEVER overwrite a successful ML result.
            #
            # -------------------------------------------------
            if not used_ml:

                seed = file_hash

                hash_val = 0

                for char in seed:
                    hash_val = (
                        ((hash_val << 5) - hash_val)
                        + ord(char)
                    )

                    hash_val &= 0xFFFFFFFF

                if hash_val & 0x80000000:
                    hash_val -= 0x100000000

                x = (hash_val % 1000) / 1000.0

                is_fake = bool(x < 0.4)

                confidence = int(x * 29) + 70

                inference_source = 'mock'

                print(
                    "[WARNING] ML analysis unavailable. "
                    "Using MOCK prediction."
                )

            # -------------------------------------------------
            # Generate visualization if ML did not provide one
            # -------------------------------------------------
            if heatmap_url is None:

                if mimetype.startswith('image/'):

                    heatmap_url = (
                        heatmap_service.generate_mock_heatmap(
                            file_bytes
                        )
                    )

                elif mimetype.startswith('audio/'):

                    heatmap_url = (
                        analysis_service.save_audio_spectrogram(
                            file_bytes
                        )
                    )

                elif mimetype.startswith('video/'):

                    heatmap_url = (
                        heatmap_service.generate_mock_spectrogram(
                            file_bytes
                        )
                    )

            # -------------------------------------------------
            # Normalize values
            # -------------------------------------------------
            is_fake = bool(is_fake)

            confidence = int(confidence)

            # Keep confidence inside 0-100
            confidence = max(
                0,
                min(100, confidence)
            )

            # -------------------------------------------------
            # Media type
            # -------------------------------------------------
            if mimetype.startswith('image/'):

                media_type = 'Image'

            elif mimetype.startswith('video/'):

                media_type = 'Video'

            elif mimetype.startswith('audio/'):

                media_type = 'Audio'

            else:

                media_type = 'Unknown'

            # -------------------------------------------------
            # Get current model information
            # -------------------------------------------------
            model_info = model_helpers.get_model_status(
                analysis_service.BASE_DIR
            )

            reasoning = model_helpers.generate_scan_reasoning(
                is_fake=is_fake,
                confidence=confidence,
                media_type=media_type,
                used_ml=used_ml,
                inference_source=inference_source
            )

            # -------------------------------------------------
            # Final API response
            # -------------------------------------------------
            result = {
                'app': 'SynthShield',
                'file_hash': file_hash,
                'is_deepfake': is_fake,
                'confidence': confidence,
                'media_type': media_type,
                'heatmap_url': heatmap_url,
                'frame_heatmap_urls': frame_heatmap_urls,
                'frame_scores': frame_scores,
                'audio_confidence': audio_confidence,
                'used_ml': used_ml,
                'inference_source': inference_source,
                'model_info': model_info,
                'reasoning': reasoning
            }

            # -------------------------------------------------
            # Debug information
            # -------------------------------------------------
            print("\n" + "=" * 60)
            print("DEEPFAKE DETECTION RESULT")
            print("=" * 60)

            print(f"Media Type       : {media_type}")
            print(f"Used ML          : {used_ml}")
            print(f"Inference Source : {inference_source}")
            print(f"Prediction       : {'DEEPFAKE' if is_fake else 'AUTHENTIC'}")
            print(f"Confidence       : {confidence}%")

            if is_trained:
                print("Model Status     : TRAINED MODEL")
            elif used_ml:
                print("Model Status     : UNTRAINED / FALLBACK MODEL")
            else:
                print("Model Status     : MOCK FALLBACK")

            print("=" * 60 + "\n")

            return jsonify(result)

        except Exception as e:

            print(
                f"[API ERROR] /predict failed: {e}"
            )

            return jsonify({
                'error': str(e)
            }), 500

    # ---------------------------------------------------------
    # Alias endpoint
    # ---------------------------------------------------------
    @app.route('/api/analyze', methods=['POST'])
    def analyze():
        return predict()

    return app


# -------------------------------------------------------------
# Run Flask server
# -------------------------------------------------------------
if __name__ == '__main__':

    app = create_app()

    app.run(
        host='0.0.0.0',
        port=5000
    )
