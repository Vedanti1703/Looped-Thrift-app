const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// GET /webhook - Meta webhook verification
router.get('/webhook', webhookController.verifyWebhook);

// POST /webhook - Receive incoming messages
router.post('/webhook', webhookController.handleWebhook);

module.exports = router;
