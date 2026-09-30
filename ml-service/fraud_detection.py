"""
fraud_detection.py — Looped AI Anti-Fraud & Risk Detection Engine
Provides:
1. Duplicate Image Detection via Perceptual Hashing (pHash & dHash).
   Catches stolen photos across different sellers and duplicate uploads.
2. Reverse Price Anomaly Detection via trained Isolation Forest.
   Detects suspicious under-pricing (counterfeit/scam) and over-pricing (wash trading).
3. Seller Risk Score Classifier.
   Predicts seller risk from disputes, cancellations, account age, and feeds into Escrow & Payout hold policies.
"""

import io
import os
import pickle
import urllib.request
import numpy as np
from PIL import Image
import imagehash
from sklearn.ensemble import IsolationForest

MODEL_DIR = os.path.join(os.path.dirname(__file__), 'model')
os.makedirs(MODEL_DIR, exist_ok=True)


# =====================================================================
# 1. PERCEPTUAL HASHING & DUPLICATE IMAGE DETECTION
# =====================================================================

def load_image_from_source(source):
    """
    Loads PIL Image from URL, local path, or base64 data URI.
    """
    if not source:
        return None

    try:
        if source.startswith('data:image/'):
            import base64
            header, encoded = source.split(',', 1)
            img_bytes = base64.b64decode(encoded)
            return Image.open(io.BytesIO(img_bytes)).convert('RGB')
        elif source.startswith('http://') or source.startswith('https://'):
            req = urllib.request.Request(
                source,
                headers={'User-Agent': 'Looped-Fraud-Detector/1.0'}
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                img_bytes = response.read()
            return Image.open(io.BytesIO(img_bytes)).convert('RGB')
        elif os.path.exists(source):
            return Image.open(source).convert('RGB')
    except Exception as e:
        print(f"[WARN] Error loading image from {str(source)[:60]}...: {e}")
        return None

    return None


def compute_image_hashes(source):
    """
    Computes 64-bit DCT pHash and difference dHash.
    Returns:
      {
        'phash': hex_str (16 chars),
        'dhash': hex_str (16 chars),
        'success': bool
      }
    """
    img = load_image_from_source(source)
    if img is None:
        return {'phash': None, 'dhash': None, 'success': False}

    try:
        ph = str(imagehash.phash(img))
        dh = str(imagehash.dhash(img))
        return {
            'phash': ph,
            'dhash': dh,
            'success': True
        }
    except Exception as e:
        print(f"Error computing hash: {e}")
        return {'phash': None, 'dhash': None, 'success': False}


def calculate_hamming_distance(hash1_str, hash2_str):
    """
    Calculates Hamming distance between two hex hashes (0 to 64).
    Distance <= 8 indicates stolen/reused duplicate image.
    """
    if not hash1_str or not hash2_str:
        return 64
    try:
        h1 = imagehash.hex_to_hash(hash1_str)
        h2 = imagehash.hex_to_hash(hash2_str)
        return int(h1 - h2)
    except Exception:
        return 64


def detect_duplicate_images(query_source_or_hash, candidates, threshold=8, current_seller_id=None):
    """
    Scans candidates against query image hash.
    candidates: list of dicts { 'productId', 'sellerId', 'sellerName', 'imageHash', 'image', 'title' }
    threshold: max Hamming distance for a duplicate match (default: 8 bits out of 64).
    """
    # Resolve query hash
    if len(str(query_source_or_hash)) == 16 and all(c in '0123456789abcdefABCDEF' for c in str(query_source_or_hash)):
        query_hash = str(query_source_or_hash).lower()
    else:
        res = compute_image_hashes(query_source_or_hash)
        if not res['success']:
            return {'has_duplicate': False, 'matches': [], 'error': 'Could not process query image'}
        query_hash = res['phash']

    matches = []
    has_photo_theft = False
    has_same_seller_duplicate = False

    for c in candidates:
        cand_hash = c.get('imageHash')
        # If candidate doesn't have precomputed hash but has image url, compute if needed
        if not cand_hash and c.get('image'):
            # Can be matched on exact URL as fallback
            if c.get('image') == query_source_or_hash:
                dist = 0
            else:
                continue
        elif cand_hash:
            dist = calculate_hamming_distance(query_hash, cand_hash)
        else:
            continue

        if dist <= threshold:
            is_different_seller = False
            if current_seller_id and c.get('sellerId'):
                is_different_seller = str(c.get('sellerId')) != str(current_seller_id)

            if is_different_seller:
                has_photo_theft = True
            else:
                has_same_seller_duplicate = True

            similarity_pct = round((1.0 - (dist / 64.0)) * 100, 1)
            matches.append({
                'productId': str(c.get('productId') or c.get('_id')),
                'title': c.get('title'),
                'sellerId': str(c.get('sellerId')),
                'sellerName': c.get('sellerName', 'Other Seller'),
                'image': c.get('image'),
                'hamming_distance': dist,
                'similarity_pct': similarity_pct,
                'is_stolen_photo': is_different_seller
            })

    matches.sort(key=lambda x: x['hamming_distance'])

    severity = 'none'
    reason = ''
    if has_photo_theft:
        severity = 'high'
        reason = f"Stolen photo alert: Image matches an existing listing by another seller with {matches[0]['similarity_pct']}% visual match."
    elif has_same_seller_duplicate:
        severity = 'medium'
        reason = f"Duplicate listing: You have already uploaded this exact or near-identical photo."

    return {
        'query_phash': query_hash,
        'has_duplicate': len(matches) > 0,
        'has_photo_theft': has_photo_theft,
        'severity': severity,
        'reason': reason,
        'match_count': len(matches),
        'top_match': matches[0] if matches else None,
        'all_matches': matches[:5]
    }


# =====================================================================
# 2. REVERSE PRICE ANOMALY DETECTION VIA ISOLATION FOREST
# =====================================================================

class PriceAnomalyDetector:
    """
    Unsupervised Anomaly Detector using Isolation Forest on listing price vs price model predictions.
    Detects counterfeit/scam under-pricing and wash-trading over-pricing.
    """

    MODEL_FILE = os.path.join(MODEL_DIR, 'price_anomaly_isolation_forest.pkl')

    def __init__(self, contamination=0.06, random_state=42):
        self.contamination = contamination
        self.random_state = random_state
        self.model = None
        self.load()

    def _extract_features(self, listing_price, predicted_price, original_price=0, brand_tier=2):
        l_price = float(max(10.0, listing_price))
        p_price = float(max(10.0, predicted_price))
        orig = float(original_price) if original_price and float(original_price) > 0 else (p_price * 1.8)

        ratio = l_price / p_price
        price_diff = l_price - p_price
        abs_log_ratio = abs(float(np.log((l_price + 1.0) / (p_price + 1.0))))
        discount_from_orig = (orig - l_price) / max(1.0, orig)
        pct_diff = abs(l_price - p_price) / p_price

        return np.array([
            l_price,
            p_price,
            ratio,
            price_diff,
            abs_log_ratio,
            discount_from_orig,
            float(brand_tier),
            pct_diff
        ], dtype=np.float32)

    def train_baseline_model(self):
        """
        Trains Isolation Forest across normal thrift pricing behaviors:
        - Typical thrift discount: 40% - 80% off original price.
        - Typical variance from predicted price: within 0.65x to 1.45x.
        Plus injected edge-case anomalies to anchor isolation bounds.
        """
        rng = np.random.RandomState(self.random_state)
        n_samples = 3000

        # Normal thrift distributions
        pred_prices = rng.uniform(250, 8000, size=n_samples)
        brand_tiers = rng.choice([1, 2, 3, 4, 5], size=n_samples, p=[0.25, 0.40, 0.20, 0.10, 0.05])
        
        # Normal ratio around 1.0 (mean=1.0, std=0.18, clipped to 0.6 - 1.5)
        ratios = np.clip(rng.normal(1.0, 0.18, size=n_samples), 0.55, 1.55)
        listed_prices = pred_prices * ratios
        orig_prices = pred_prices * rng.uniform(1.4, 3.2, size=n_samples)

        X = []
        for lp, pp, op, bt in zip(listed_prices, pred_prices, orig_prices, brand_tiers):
            X.append(self._extract_features(lp, pp, op, bt))

        # Synthetic anomalies (underpriced luxury, extreme overpriced basics)
        # 1. Extreme underpricing (luxury items at fast-fashion junk price)
        for _ in range(80):
            pp = rng.uniform(6000, 35000)
            lp = rng.uniform(100, 450) # suspicious counterfeit
            X.append(self._extract_features(lp, pp, pp * 2.5, brand_tier=5))

        # 2. Extreme overpricing (basic items priced 10x fair value)
        for _ in range(80):
            pp = rng.uniform(300, 900)
            lp = rng.uniform(6000, 25000) # wash-trading / money laundering
            X.append(self._extract_features(lp, pp, pp * 1.5, brand_tier=1))

        X = np.array(X)

        iso_forest = IsolationForest(
            n_estimators=120,
            contamination=self.contamination,
            random_state=self.random_state,
            n_jobs=-1
        )
        iso_forest.fit(X)
        self.model = iso_forest
        self.save()
        print(f"[OK] Isolation Forest Price Anomaly Model trained on {len(X)} samples.")
        return True

    def predict(self, listing_price, predicted_price, original_price=0, brand_tier=2):
        if self.model is None:
            self.train_baseline_model()

        listing_price = float(listing_price)
        predicted_price = float(predicted_price)
        ratio = listing_price / max(1.0, predicted_price)

        feat = self._extract_features(listing_price, predicted_price, original_price, brand_tier).reshape(1, -1)
        pred = self.model.predict(feat)[0] # 1 = normal, -1 = anomaly
        raw_score = float(self.model.decision_function(feat)[0])

        # Anomaly score mapped to 0 (normal) - 100 (extreme anomaly)
        # raw_score typically spans ~ [-0.3, +0.25]
        anomaly_index = max(0.0, min(100.0, (0.15 - raw_score) * 220.0))
        is_anomaly = (pred == -1) or (ratio < 0.35) or (ratio > 2.8) or (anomaly_index > 50.0)

        anomaly_type = 'normal'
        severity = 'none'
        reason = 'Listing price aligns with model market valuation.'

        if is_anomaly:
            if ratio < 0.40:
                anomaly_type = 'suspiciously_underpriced'
                severity = 'high' if (brand_tier >= 4 or ratio < 0.25) else 'medium'
                reason = (
                    f"Price anomaly detected: Rs.{int(listing_price)} is {round((1 - ratio) * 100)}% "
                    f"below predicted market value (Rs.{int(predicted_price)}). High risk of counterfeit or counterfeit listing."
                )
            elif ratio > 2.20:
                anomaly_type = 'suspiciously_overpriced'
                severity = 'high' if ratio > 3.5 else 'medium'
                reason = (
                    f"Price anomaly detected: Rs.{int(listing_price)} is {round(ratio, 1)}x "
                    f"higher than market valuation (Rs.{int(predicted_price)}). Risk of price gouging or wash trading."
                )
            else:
                anomaly_type = 'irregular_pricing'
                severity = 'low'
                reason = f"Price deviates from typical resale distribution for {condition_tier_label(brand_tier)} items."

        return {
            'is_anomaly': bool(is_anomaly),
            'anomaly_score': round(anomaly_index, 1),
            'raw_decision_score': round(raw_score, 4),
            'anomaly_type': anomaly_type,
            'severity': severity,
            'reason': reason,
            'listing_price': int(listing_price),
            'predicted_price': int(predicted_price),
            'price_ratio': round(ratio, 2)
        }

    def save(self):
        with open(self.MODEL_FILE, 'wb') as f:
            pickle.dump(self.model, f)

    def load(self):
        if os.path.exists(self.MODEL_FILE):
            try:
                with open(self.MODEL_FILE, 'rb') as f:
                    self.model = pickle.load(f)
                return True
            except Exception as e:
                print(f"Could not load isolation forest: {e}")
        return False


def condition_tier_label(tier):
    labels = {1: 'Value', 2: 'High-Street', 3: 'Premium', 4: 'Accessible Luxury', 5: 'Luxury'}
    return labels.get(tier, 'Standard')


# =====================================================================
# 3. SELLER RISK SCORE CLASSIFIER & ESCROW POLICY ENGINE
# =====================================================================

class SellerRiskClassifier:
    """
    Computes holistic seller risk score (0-100) and feeds directly into Escrow & Payout hold requirements.
    Features: dispute rate, cancellation rate, problem return rate, account age, verification status.
    """

    @staticmethod
    def calculate_risk(seller_data):
        """
        seller_data: {
          'account_age_days': float,
          'total_orders': int,
          'completed_sales': int,
          'disputes_count': int,
          'cancellations_count': int,
          'problem_returns_count': int,
          'is_verified': bool,
          'has_bank_linked': bool,
          'avg_rating': float
        }
        """
        account_age = float(seller_data.get('account_age_days', 0))
        total_orders = int(seller_data.get('total_orders', 0))
        completed_sales = int(seller_data.get('completed_sales', 0))
        disputes = int(seller_data.get('disputes_count', 0))
        cancellations = int(seller_data.get('cancellations_count', 0))
        problem_returns = int(seller_data.get('problem_returns_count', 0))
        is_verified = bool(seller_data.get('is_verified', False))
        has_bank = bool(seller_data.get('has_bank_linked', False))
        avg_rating = float(seller_data.get('avg_rating', 5.0) or 5.0)

        # Baseline risk components
        dispute_rate = (disputes / max(1, total_orders)) if total_orders > 0 else 0.0
        cancellation_rate = (cancellations / max(1, total_orders)) if total_orders > 0 else 0.0
        return_rate = (problem_returns / max(1, total_orders)) if total_orders > 0 else 0.0

        risk_score = 15.0  # Base neutral risk

        # 1. Dispute component (high weight: disputes indicate serious item fraud)
        if dispute_rate > 0.20:
            risk_score += 40.0
        elif dispute_rate > 0.08:
            risk_score += 25.0
        elif dispute_rate > 0.02:
            risk_score += 12.0

        # 2. Cancellation component (flaky sellers or out-of-stock scams)
        if cancellation_rate > 0.30:
            risk_score += 30.0
        elif cancellation_rate > 0.15:
            risk_score += 18.0
        elif cancellation_rate > 0.05:
            risk_score += 8.0

        # 3. Problem return rate (item not as described)
        if return_rate > 0.25:
            risk_score += 25.0
        elif return_rate > 0.10:
            risk_score += 12.0

        # 4. Account Age & Cold Start
        if account_age < 2:
            risk_score += 22.0  # Brand new account requires protective escrow
        elif account_age < 7:
            risk_score += 12.0
        elif account_age < 30:
            risk_score += 5.0
        elif account_age > 180 and completed_sales >= 5:
            risk_score -= 15.0  # Long-standing verified reputation discount

        # 5. Verification & Banking KYC
        if not is_verified:
            risk_score += 14.0
        else:
            risk_score -= 10.0

        if not has_bank:
            risk_score += 8.0

        # 6. Sales Volume track record discount
        if completed_sales >= 15:
            risk_score -= 18.0
        elif completed_sales >= 5:
            risk_score -= 10.0
        elif completed_sales == 0 and total_orders == 0:
            risk_score += 6.0

        # 7. Customer Ratings
        if total_orders >= 3:
            if avg_rating < 3.2:
                risk_score += 20.0
            elif avg_rating > 4.6:
                risk_score -= 8.0

        # Clamp risk score
        risk_score = max(5.0, min(98.0, risk_score))

        # Risk Tier Classification
        if risk_score >= 65.0:
            risk_tier = 'HIGH'
            escrow_days = 14
            payout_hold_policy = 'STRICT_HOLD_14D'
            require_manual_release = True
            policy_reason = 'High seller risk due to disputes/cancellations or unverified status. Escrow hold extended to 14 days.'
        elif risk_score >= 35.0:
            risk_tier = 'MEDIUM'
            escrow_days = 10
            payout_hold_policy = 'STANDARD_HOLD_10D'
            require_manual_release = False
            policy_reason = 'Moderate risk profile. Standard 10-day buyer protection hold applied.'
        else:
            risk_tier = 'LOW'
            escrow_days = 7
            payout_hold_policy = 'EXPEDITED_HOLD_7D'
            require_manual_release = False
            policy_reason = 'Trusted seller with verified history and low dispute rate. Eligible for standard 7-day or fast-track escrow release.'

        return {
            'risk_score': round(risk_score, 1),
            'risk_tier': risk_tier,
            'dispute_rate': round(dispute_rate * 100, 1),
            'cancellation_rate': round(cancellation_rate * 100, 1),
            'problem_return_rate': round(return_rate * 100, 1),
            'account_age_days': round(account_age, 1),
            'completed_sales': completed_sales,
            'escrow_policy': {
                'recommended_escrow_days': escrow_days,
                'payout_hold_policy': payout_hold_policy,
                'require_manual_release': require_manual_release,
                'policy_reason': policy_reason
            }
        }
