const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const bargainController = require('../controllers/bargainController');

router.post('/offer', auth, bargainController.createOffer);
router.put('/respond/:bargainId', auth, bargainController.respondToOffer);
router.get('/mine', auth, bargainController.getMyOffers);

module.exports = router;
