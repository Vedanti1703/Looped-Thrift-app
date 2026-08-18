"""
train_model.py — Looped Price Prediction Model
===============================================
Run this yourself:
    cd looped/ml-service
    python train_model.py

What it does:
    1. Loads data/training_data.csv (5000 rows)
    2. Engineers 7 features from raw columns
    3. Trains a Random Forest Regressor (300 trees)
    4. Evaluates with R2, MAE, 5-fold cross-validation
    5. Saves model/price_model.pkl
    6. Saves model/encoders.pkl
    7. Saves model/metrics.json

Run once. Re-run only if you update training_data.csv.
"""

import pandas as pd
import numpy as np
import pickle
import json
import os
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import r2_score, mean_absolute_error

os.makedirs('model', exist_ok=True)

print("=" * 58)
print("  Looped — Price Prediction Model Training")
print("=" * 58)

df = pd.read_csv('data/training_data.csv')
print(f"\n  Dataset        : {len(df)} rows")
print(f"  Unique brands  : {df['brand'].nunique()}")
print(f"  Categories     : {df['category'].nunique()}")
print(f"  Price range    : Rs.{df['resale_price'].min():,} - Rs.{df['resale_price'].max():,}")

BRAND_TIER = {
    'Sabyasachi': 5, 'Manish Malhotra': 5, 'Tarun Tahiliani': 5,
    'Abu Jani Sandeep Khosla': 5, 'Rohit Bal': 5, 'JJ Valaya': 5,
    'Rahul Mishra': 5, 'Anita Dongre': 4, 'Ritu Kumar': 4,
    'Masaba Gupta': 4, 'Payal Singhal': 4, 'Anju Modi': 4,
    'Shantanu & Nikhil': 4, 'Rajesh Pratap Singh': 4, 'Anamika Khanna': 4,
    'COS': 4, 'ARKET': 4, '& Other Stories': 4, 'Acne Studios': 5,
    'Toteme': 4, 'Reformation': 4, 'Nanushka': 4, 'Hidesign': 4,
    'Ralph Lauren': 4, 'Amrapali': 3, 'Tribe Amrapali': 3, 'Jaypore': 3,
    'Marks & Spencer': 3, 'Clarks': 3, 'Steve Madden': 3,
    'Charles & Keith': 3, 'Aldo': 3, 'Nine West': 3,
    'Zara': 3, 'Mango': 3, 'Uniqlo': 3, "Levi's": 3,
    'Nike': 3, 'Adidas': 3, 'New Balance': 3, 'Converse': 3,
    'Vans': 3, 'Tommy Hilfiger': 3, 'Calvin Klein': 3,
    'Lacoste': 3, 'AND': 3, 'Global Desi': 3, 'FabIndia': 3,
    'Ritu Wear': 3, 'Louis Philippe': 3,
    'H&M': 2, 'Only': 2, 'Vero Moda': 2, 'Forever 21': 2,
    'ASOS': 2, 'Biba': 2, 'W': 2, 'Pantaloons': 2,
    'Westside': 2, 'Accessorize': 2, 'Baggit': 2,
    'Puma': 2, 'Reebok': 2, 'Skechers': 2, 'Anatomy': 2,
    'Chemistry': 2, 'Van Heusen': 2, 'Allen Solly': 2,
    'Park Avenue': 2, 'Arrow': 2, 'Aurelia': 2, 'Sangria': 2,
    'Vintage': 2, 'Max': 1, 'Thrift': 1, 'No Brand': 1, 'Local Brand': 1,
}

CONDITION_SCORE = {
    'New with tags': 5, 'Like New': 4,
    'Good': 3, 'Fair': 2, 'Well Loved': 1,
}

print("\n  Engineering features...")

df['brand_tier']       = df['brand'].map(BRAND_TIER).fillna(2)
df['condition_score']  = df['condition'].map(CONDITION_SCORE).fillna(3)
df['orig_filled']      = df['original_price'].replace(0, 1500)
df['log_orig']         = np.log1p(df['orig_filled'])
df['sqrt_orig']        = np.sqrt(df['orig_filled'])
df['tier_x_condition'] = df['brand_tier'] * df['condition_score']

cat_encoder = LabelEncoder()
df['cat_encoded'] = cat_encoder.fit_transform(df['category'])

FEATURE_COLS = [
    'brand_tier', 'condition_score', 'log_orig',
    'sqrt_orig', 'orig_filled', 'cat_encoded', 'tier_x_condition',
]

X = df[FEATURE_COLS].values
y = df['resale_price'].values

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
print(f"  Train: {len(X_train)} | Test: {len(X_test)}")

print("\n  Training Random Forest (300 trees) — takes ~30 seconds...")

model = RandomForestRegressor(
    n_estimators=300, max_depth=15, min_samples_leaf=2,
    max_features='sqrt', random_state=42, n_jobs=-1,
)
model.fit(X_train, y_train)
print("  Done!")

y_pred = model.predict(X_test)
r2  = r2_score(y_test, y_pred)
mae = mean_absolute_error(y_test, y_pred)

print("\n  Running 5-fold cross validation...")
cv = cross_val_score(model, X, y, cv=5, scoring='r2', n_jobs=-1)

print(f"\n{'=' * 58}")
print(f"  MODEL RESULTS")
print(f"{'=' * 58}")
print(f"  R2 score (test)      : {r2:.4f}  ({r2*100:.1f}% variance explained)")
print(f"  Mean Absolute Error  : Rs.{mae:,.0f}")
print(f"  CV R2 mean (5-fold)  : {cv.mean():.4f}")
print(f"  CV R2 std            : {cv.std():.4f}")

importance = dict(zip(FEATURE_COLS, model.feature_importances_))
imp_sorted = sorted(importance.items(), key=lambda x: x[1], reverse=True)
print(f"\n  FEATURE IMPORTANCE:")
for feat, imp in imp_sorted:
    bar = 'X' * int(imp * 50)
    print(f"    {feat:<22} {imp:.4f}  {bar}")

print(f"\n  SAMPLE PREDICTIONS:")
print(f"    {'Actual':>10}  {'Predicted':>10}  {'%Off':>7}")
idx = np.random.RandomState(0).choice(len(y_test), 10, replace=False)
for i in idx:
    pct = abs(y_pred[i] - y_test[i]) / y_test[i] * 100
    print(f"    Rs.{y_test[i]:>7,.0f}  Rs.{y_pred[i]:>7,.0f}  {pct:>6.1f}%")

with open('model/price_model.pkl', 'wb') as f: pickle.dump(model, f)
with open('model/encoders.pkl', 'wb') as f:
    pickle.dump({'cat_encoder': cat_encoder, 'brand_tier_map': BRAND_TIER,
                 'condition_map': CONDITION_SCORE, 'feature_cols': FEATURE_COLS}, f)

metrics = {
    'r2_score': round(float(r2), 4), 'mae_inr': round(float(mae), 2),
    'cv_r2_mean': round(float(cv.mean()), 4), 'cv_r2_std': round(float(cv.std()), 4),
    'training_rows': len(df), 'test_rows': len(X_test),
    'feature_cols': FEATURE_COLS, 'n_estimators': 300,
    'algorithm': 'Random Forest Regressor',
    'feature_importance': {k: round(float(v), 4) for k, v in imp_sorted},
}
with open('model/metrics.json', 'w') as f: json.dump(metrics, f, indent=2)

print(f"\n{'=' * 58}")
print(f"  SAVED: model/price_model.pkl")
print(f"  SAVED: model/encoders.pkl")
print(f"  SAVED: model/metrics.json")
print(f"\n  Now run:  python app.py")
print(f"{'=' * 58}")
