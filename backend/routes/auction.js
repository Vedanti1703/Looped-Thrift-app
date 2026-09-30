const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const auctionController = require('../controllers/auctionController');

// Admin verification routes
router.get('/admin/pending', auth, admin, auctionController.getAdminAuctions);
router.post('/admin/:id/verify', auth, admin, auctionController.verifyAuction);

// User and public routes
router.get('/mine', auth, auctionController.getMyAuctions);
router.get('/', auctionController.getAuctions);
router.get('/:id', auctionController.getAuction);
router.post('/', auth, auctionController.createAuction);
router.post('/:auctionId/bid', auth, auctionController.placeBid);

module.exports = router;
