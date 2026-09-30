# Looped — ML Price Prediction Service

## What this does
Random Forest regression model that predicts a fair resale price range
for a clothing item based on brand, category, condition, and original price.

## Setup (do this once)

### 1. Install Python dependencies
```bash
cd looped/ml-service
pip install -r requirements.txt
```

### 2. Train the model
```bash
python train_model.py
```
You will see output like:
```
R² score (test set)    : 0.9421  (94.2% variance explained)
Mean Absolute Error    : ₹187
Cross-val R² (5-fold)  : 0.9318 ± 0.0241
Saved: model/price_model.pkl
```

### 3. Start the Flask server
```bash
python app.py
# Runs on http://localhost:5001
```

## Running everything together (3 terminals)

Terminal 1 — ML service:
```bash
cd looped/ml-service
python app.py
```

Terminal 2 — Express backend:
```bash
cd looped/backend
npm run dev
```

Terminal 3 — React frontend:
```bash
cd looped/frontend
npm run dev
```

## API endpoints

POST http://localhost:5001/predict
```json
{
  "brand": "Zara",
  "category": "Women's Tops",
  "condition": "Like New",
  "original_price": 2500
}
```
Returns:
```json
{
  "predicted_price": 900,
  "price_low": 750,
  "price_high": 1050,
  "confidence": "high",
  "message": "Based on similar listings for Zara items in Like New condition",
  "model_r2": 0.9421
}
```

GET http://localhost:5001/metrics — model performance stats
GET http://localhost:5001/brands  — list of known brands

## For your project report

Algorithm     : Random Forest Regressor (ensemble of 200 decision trees)
Features      : brand tier, condition score, log(original price), category
Target        : resale price (INR)
Training data : 120 real Indian thrift market data points
Evaluation    : R² score, MAE, 5-fold cross-validation
