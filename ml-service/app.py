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

# ==========================================
# Collaborative Filtering & Ranking Services
# ==========================================
from collaborative_filtering import ImplicitALS

cf_model = ImplicitALS.load('model/cf_model.pkl')

@app.route('/recommend/status', methods=['GET'])
def recommend_status():
    return jsonify({
        'cf_model_loaded': cf_model is not None,
        'users_count': len(cf_model.user_to_idx) if cf_model else 0,
        'items_count': len(cf_model.item_to_idx) if cf_model else 0,
    })

@app.route('/recommend/train', methods=['POST'])
def train_cf():
    global cf_model
    data = request.get_json() or {}
    interactions = data.get('interactions', [])

    if not interactions:
        return jsonify({'error': 'No interactions provided. Pass { "interactions": [...] }'}), 400

    try:
        model = ImplicitALS(factors=32, regularization=0.08, iterations=15)
        metrics = model.fit(interactions)
        model.save('model/cf_model.pkl')
        cf_model = model
        return jsonify({
            'success': True,
            'message': 'Implicit ALS Collaborative Filtering model trained successfully',
            'metrics': metrics
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/recommend/user', methods=['POST'])
def recommend_for_user():
    if cf_model is None:
        return jsonify({'error': 'Collaborative filtering model not trained yet. Call /recommend/train first.'}), 503

    data = request.get_json() or {}
    user_id = data.get('user_id')
    n = int(data.get('n', 10))

    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400

    recs = cf_model.recommend(str(user_id), n=n)
    return jsonify({
        'user_id': user_id,
        'recommendations': recs
    })

@app.route('/recommend/rank', methods=['POST'])
def rank_candidates():
    if cf_model is None:
        return jsonify({'error': 'Collaborative filtering model not trained yet'}), 503

    data = request.get_json() or {}
    user_id = data.get('user_id')
    candidate_ids = data.get('candidate_ids', [])

    if not user_id or not candidate_ids:
        return jsonify({'error': 'user_id and candidate_ids are required'}), 400

    ranked = cf_model.rank_items(str(user_id), candidate_ids)
    return jsonify({
        'user_id': user_id,
        'ranked_items': [{'productId': it, 'cf_score': score} for it, score in ranked]
    })


# ==========================================
# Smarter Fake-Listing & Fraud Detection Engine
# ==========================================
from fraud_detection import (
    compute_image_hashes,
    detect_duplicate_images,
    PriceAnomalyDetector,
    SellerRiskClassifier
)

anomaly_detector = PriceAnomalyDetector()

@app.route('/fraud/status', methods=['GET'])
def fraud_status():
    return jsonify({
        'status': 'ok',
        'isolation_forest_loaded': anomaly_detector.model is not None,
        'imagehash_available': True,
        'seller_risk_classifier_available': True
    })

@app.route('/fraud/image-hash', methods=['POST'])
def get_image_hash():
    data = request.get_json() or {}
    source = data.get('imageUrl') or data.get('image') or data.get('image_data')
    if not source:
        return jsonify({'error': 'imageUrl or image is required'}), 400

    res = compute_image_hashes(source)
    return jsonify(res)

@app.route('/fraud/check-duplicates', methods=['POST'])
def check_image_duplicates():
    data = request.get_json() or {}
    source = data.get('imageUrl') or data.get('query_phash') or data.get('image')
    candidates = data.get('candidates', [])
    threshold = int(data.get('threshold', 8))
    seller_id = data.get('sellerId') or data.get('seller_id')

    if not source:
        return jsonify({'error': 'imageUrl or query_phash is required'}), 400

    result = detect_duplicate_images(
        source,
        candidates,
        threshold=threshold,
        current_seller_id=seller_id
    )
    return jsonify(result)

@app.route('/fraud/price-anomaly', methods=['POST'])
def detect_price_anomaly():
    data = request.get_json() or {}
    listing_price = data.get('price') or data.get('listing_price')
    if listing_price is None:
        return jsonify({'error': 'price is required'}), 400

    brand = data.get('brand', 'Unknown')
    category = data.get('category', "Women's Tops")
    condition = data.get('condition', 'Good')
    original_price = data.get('original_price') or data.get('originalPrice') or 0

    # If predicted_price is not provided, predict it using our trained price model
    predicted_price = data.get('predicted_price')
    if predicted_price is None and model is not None:
        try:
            X = build_features(brand, category, condition, original_price)
            predicted_price = float(model.predict(X)[0])
        except Exception as e:
            predicted_price = float(original_price) * 0.5 if original_price else float(listing_price)
    elif predicted_price is None:
        predicted_price = float(listing_price)

    brand_tier = 2
    if encoders and 'brand_tier_map' in encoders:
        brand_tier = encoders['brand_tier_map'].get(brand, 2)

    anomaly_result = anomaly_detector.predict(
        listing_price=float(listing_price),
        predicted_price=float(predicted_price),
        original_price=float(original_price or 0),
        brand_tier=brand_tier
    )

    return jsonify(anomaly_result)

@app.route('/fraud/seller-risk', methods=['POST'])
def evaluate_seller_risk():
    data = request.get_json() or {}
    seller_data = data.get('seller_data') or data

    risk_result = SellerRiskClassifier.calculate_risk(seller_data)
    return jsonify(risk_result)

if __name__ == '__main__':
    print("\nLooped ML Price Prediction, Recommendations & Fraud Detection Service")
    print("Running on http://localhost:5001\n")
    app.run(port=5001, debug=False)

