const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const reviewController = require('../controllers/reviewController');

router.get('/product/:productId', reviewController.getProductReviews);
router.get('/seller/:sellerId', reviewController.getSellerReviews);
router.post('/', auth, reviewController.createReview);
router.delete('/:reviewId', auth, reviewController.deleteReview);

module.exports = router;
