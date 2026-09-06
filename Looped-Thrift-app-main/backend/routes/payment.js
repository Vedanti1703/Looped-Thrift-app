const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createOrder,
  verifyPayment,
  recordPaymentFailure,
  getOrderById,
  getMyOrders,
  getRazorpayKey
} = require('../controllers/paymentController');

// Public route to get Razorpay public key ID
router.get('/key', getRazorpayKey);

// Authenticated routes
router.post('/create-order', auth, createOrder);
router.post('/verify', auth, verifyPayment);
router.post('/failure', auth, recordPaymentFailure);
router.get('/my-orders', auth, getMyOrders);
router.get('/order/:id', auth, getOrderById);

module.exports = router;
