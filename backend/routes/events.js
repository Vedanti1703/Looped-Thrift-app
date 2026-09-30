const express = require('express');
const router = express.Router();
const { logEvent, exportInteractions } = require('../controllers/eventController');
const optionalAuth = require('../middleware/optionalAuth');

// POST /events — log view/dwell/swipe/cart events (supports logged-in or guest users)
router.post('/', optionalAuth, logEvent);

// GET /events/export — export interactions for ML service collaborative filtering
router.get('/export', exportInteractions);

module.exports = router;
