"""
app.py — Looped ML Price Prediction Service
Runs on port 5001. Matches the 7-feature model from train_model.py
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pickle
import json
import numpy as np
import os

app = Flask(__name__)
CORS(app)

model    = None
encoders = None
metrics  = {}

def load_model():
    global model, encoders, metrics
    if not os.path.exists('model/price_model.pkl'):
        print("Model not found. Run: python train_model.py first.")
        return False
    with open('model/price_model.pkl', 'rb') as f: model    = pickle.load(f)
    with open('model/encoders.pkl',    'rb') as f: encoders = pickle.load(f)
    with open('model/metrics.json',    'r')  as f: metrics  = json.load(f)
    print(f"Model loaded. R2 = {metrics.get('r2_score', 'N/A')}")
    return True

load_model()

def build_features(brand, category, condition, original_price):
    """Build the SAME 7 features used in train_model.py"""
    brand_tier_map = encoders['brand_tier_map']
    condition_map  = encoders['condition_map']
    cat_encoder    = encoders['cat_encoder']

    brand_tier      = brand_tier_map.get(brand, 2)
    condition_score = condition_map.get(condition, 3)

    orig = float(original_price) if float(original_price) > 0 else 1500
    log_orig  = np.log1p(orig)
    sqrt_orig = np.sqrt(orig)
    tier_x_condition = brand_tier * condition_score

    try:
        cat_encoded = cat_encoder.transform([category])[0]
    except ValueError:
        cat_encoded = 0

    # MUST match FEATURE_COLS order in train_model.py exactly:
    # ['brand_tier', 'condition_score', 'log_orig', 'sqrt_orig',
    #  'orig_filled', 'cat_encoded', 'tier_x_condition']
    return np.array([[
        brand_tier,
        condition_score,
        log_orig,
        sqrt_orig,
        orig,
        cat_encoded,
        tier_x_condition,
    ]])

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'model_loaded': model is not None,
        'r2_score': metrics.get('r2_score'),
    })

@app.route('/predict', methods=['POST'])
def predict():
    if model is None:
        return jsonify({'error': 'Model not loaded. Run python train_model.py first.'}), 503

    data = request.get_json()
    if not data:
        return jsonify({'error': 'No JSON body'}), 400

    brand          = data.get('brand',          'Unknown')
    category       = data.get('category',       "Women's Tops")
    condition      = data.get('condition',      'Good')
    original_price = data.get('original_price', 0)

    try:
        original_price = float(original_price)
    except (ValueError, TypeError):
        original_price = 0

    X         = build_features(brand, category, condition, original_price)
    predicted = float(model.predict(X)[0])

    predicted_rounded = round(predicted / 50) * 50
    price_low         = round((predicted * 0.85) / 50) * 50
    price_high        = round((predicted * 1.15) / 50) * 50

    known_brand = brand in encoders['brand_tier_map']
    confidence  = 'high' if known_brand else 'medium'

    if known_brand:
        message = f"Based on similar {brand} {category} listings in {condition} condition"
    else:
        message = f"Based on similar {category} listings in {condition} condition"

    return jsonify({
        'predicted_price': int(predicted_rounded),
        'price_low':       int(price_low),
        'price_high':      int(price_high),
        'confidence':      confidence,
        'message':         message,
        'model_r2':        metrics.get('r2_score'),
    })

@app.route('/metrics', methods=['GET'])
def get_metrics():
    return jsonify(metrics)

@app.route('/brands', methods=['GET'])
def get_brands():
    if encoders is None:
        return jsonify({'brands': []})
    return jsonify({'brands': sorted(encoders['brand_tier_map'].keys())})

if __name__ == '__main__':
    print("\nLooped ML Price Prediction Service")
    print("Running on http://localhost:5001\n")
    app.run(port=5001, debug=False)
