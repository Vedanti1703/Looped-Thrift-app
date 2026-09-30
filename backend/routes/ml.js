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

// GET /ml/recommend/status
router.get('/recommend/status', async (req, res) => {
  try {
    const response = await axios.get(`${ML_URL}/recommend/status`, { timeout: 3000 })
    res.json(response.data)
  } catch {
    res.json({ cf_model_loaded: false, status: 'offline' })
  }
})

// POST /ml/recommend/train — triggers training in Flask service
router.post('/recommend/train', async (req, res) => {
  try {
    const InteractionEvent = require('../models/InteractionEvent')
    const events = await InteractionEvent.find({ userId: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean()

    const eventWeights = {
      purchase: 5.0,
      cart_add: 3.5,
      swipe_right: 2.5,
      like: 2.0,
      dwell: 1.2,
      view: 0.5,
      swipe_left: -1.0,
      unlike: -0.5
    }

    const interactions = events.map(e => ({
      userId: e.userId.toString(),
      productId: e.productId.toString(),
      weight: eventWeights[e.eventType] || 1.0
    }))

    const response = await axios.post(`${ML_URL}/recommend/train`, { interactions }, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' }
    })
    res.json(response.data)
  } catch (err) {
    res.status(503).json({ error: 'Failed to train ML recommendation service', message: err.message })
  }
})

// POST /ml/recommend/user
router.post('/recommend/user', async (req, res) => {
  try {
    const response = await axios.post(`${ML_URL}/recommend/user`, req.body, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    })
    res.json(response.data)
  } catch (err) {
    res.status(503).json({ error: 'ML service recommendation offline' })
  }
})

module.exports = router
