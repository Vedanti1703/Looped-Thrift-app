const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const auctionController = require('../controllers/auctionController');

router.get('/mine', auth, auctionController.getMyAuctions);
router.get('/', auctionController.getAuctions);
router.get('/:id', auctionController.getAuction);
router.post('/', auth, auctionController.createAuction);
router.post('/:auctionId/bid', auth, auctionController.placeBid);

module.exports = router;
