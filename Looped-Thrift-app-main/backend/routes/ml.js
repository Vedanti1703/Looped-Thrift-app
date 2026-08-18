// ml.js — proxies price prediction requests to Flask ML service
// Uses axios instead of fetch — more reliable on Windows/Node.js

const router = require('express').Router()
const axios  = require('axios')

const ML_URL = process.env.ML_SERVICE_URL || 'http://127.0.0.1:5001'  // explicit IPv4, not localhost

// POST /ml/predict-price
router.post('/predict-price', async (req, res) => {
  try {
    const response = await axios.post(`${ML_URL}/predict`, req.body, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    })
    res.json(response.data)
  } catch (err) {
    console.warn('ML service unreachable:', err.message)
    res.status(503).json({ error: 'Price prediction service offline', offline: true })
  }
})

// GET /ml/metrics
router.get('/metrics', async (req, res) => {
  try {
    const response = await axios.get(`${ML_URL}/metrics`, { timeout: 3000 })
    res.json(response.data)
  } catch {
    res.status(503).json({ error: 'ML service offline' })
  }
})

// GET /ml/brands
router.get('/brands', async (req, res) => {
  try {
    const response = await axios.get(`${ML_URL}/brands`, { timeout: 3000 })
    res.json(response.data)
  } catch {
    res.json({ brands: [] })
  }
})

module.exports = router
