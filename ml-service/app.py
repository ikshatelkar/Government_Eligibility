"""
Flask REST API for the Government Eligibility ML model (India).
Start with: python app.py
"""

import os
import numpy as np
import joblib
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

MODEL_PATH = os.getenv("MODEL_PATH", "model/eligibility_model.pkl")
ENCODER_DIR = "model/encoders"

model = None
emp_encoder = None
gender_encoder = None
caste_encoder = None

def safe_encode(encoder, value, default):
    try:
        return int(encoder.transform([value])[0])
    except Exception:
        try:
            return int(encoder.transform([default])[0])
        except Exception:
            return 0

def load_model():
    global model, emp_encoder, gender_encoder, caste_encoder
    if os.path.exists(MODEL_PATH):
        model = joblib.load(MODEL_PATH)
        emp_encoder = joblib.load(os.path.join(ENCODER_DIR, 'emp_encoder.pkl'))
        gender_encoder = joblib.load(os.path.join(ENCODER_DIR, 'gender_encoder.pkl'))
        caste_encoder = joblib.load(os.path.join(ENCODER_DIR, 'caste_encoder.pkl'))
        print("ML model and encoders loaded successfully.")
    else:
        print(f"WARNING: Model not found at {MODEL_PATH}. Run train.py first.")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "OK", "model_loaded": model is not None})


@app.route("/predict", methods=["POST"])
def predict():
    if model is None:
        return jsonify({"error": "Model not loaded. Run train.py first."}), 503

    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided."}), 400

    required = ["age", "income"]
    for field in required:
        if field not in data:
            return jsonify({"error": f"Missing required field: {field}"}), 400

    try:
        emp_enc = safe_encode(emp_encoder, data.get("employment_status", "unemployed"), "unemployed")
        prog_emp_enc = safe_encode(emp_encoder, data.get("program_employment_status", "any"), "any")
        gender_enc = safe_encode(gender_encoder, data.get("gender", "male"), "male")
        prog_gender_enc = safe_encode(gender_encoder, data.get("program_gender", "any"), "any")
        caste_enc = safe_encode(caste_encoder, data.get("caste", "General"), "General")
        prog_caste_enc = safe_encode(caste_encoder, data.get("program_caste", "any"), "any")

        features = np.array([[
            int(data.get("age", 0)),
            float(data.get("income", 0)),
            emp_enc,
            int(data.get("has_disability", 0)),
            int(data.get("is_citizen", 1)),
            gender_enc,
            caste_enc,
            int(data.get("min_age", 0)),
            int(data.get("max_age", 120)),
            float(data.get("min_income", 0)),
            float(data.get("max_income", 9999999)),
            prog_emp_enc,
            int(data.get("disability_required", 0)),
            int(data.get("citizenship_required", 1)),
            prog_gender_enc,
            prog_caste_enc,
        ]])

        prediction = model.predict(features)[0]
        probabilities = model.predict_proba(features)[0]
        score = float(probabilities[1])

        return jsonify({
            "eligible": bool(prediction == 1),
            "score": round(score, 4),
            "confidence": round(float(max(probabilities)), 4),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/predict-batch", methods=["POST"])
def predict_batch():
    if model is None:
        return jsonify({"error": "Model not loaded."}), 503

    data = request.get_json()
    if not data or "records" not in data:
        return jsonify({"error": "Expected JSON with 'records' array."}), 400

    results = []
    for record in data["records"]:
        try:
            emp_enc = safe_encode(emp_encoder, record.get("employment_status", "unemployed"), "unemployed")
            prog_emp_enc = safe_encode(emp_encoder, record.get("program_employment_status", "any"), "any")
            gender_enc = safe_encode(gender_encoder, record.get("gender", "male"), "male")
            prog_gender_enc = safe_encode(gender_encoder, record.get("program_gender", "any"), "any")
            caste_enc = safe_encode(caste_encoder, record.get("caste", "General"), "General")
            prog_caste_enc = safe_encode(caste_encoder, record.get("program_caste", "any"), "any")

            features = np.array([[
                int(record.get("age", 0)),
                float(record.get("income", 0)),
                emp_enc,
                int(record.get("has_disability", 0)),
                int(record.get("is_citizen", 1)),
                gender_enc,
                caste_enc,
                int(record.get("min_age", 0)),
                int(record.get("max_age", 120)),
                float(record.get("min_income", 0)),
                float(record.get("max_income", 9999999)),
                prog_emp_enc,
                int(record.get("disability_required", 0)),
                int(record.get("citizenship_required", 1)),
                prog_gender_enc,
                prog_caste_enc,
            ]])
            prediction = model.predict(features)[0]
            probabilities = model.predict_proba(features)[0]
            results.append({
                "program_id": record.get("program_id"),
                "eligible": bool(prediction == 1),
                "score": round(float(probabilities[1]), 4),
            })
        except Exception as e:
            results.append({"program_id": record.get("program_id"), "error": str(e)})

    return jsonify({"results": results})


if __name__ == "__main__":
    load_model()
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
