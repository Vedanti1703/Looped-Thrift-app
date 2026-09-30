const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  createOrder,
  verifyPayment,
  recordPaymentFailure,
  getOrderById,
  getMyOrders,
  getRazorpayKey,
  createUpiQr,
  getUpiQrStatus,
  handleRazorpayWebhook
} = require('../controllers/paymentController');

// Public routes
router.get('/key', getRazorpayKey);
router.post('/webhook', handleRazorpayWebhook);

// Authenticated routes
router.post('/create-order', auth, createOrder);
router.post('/verify', auth, verifyPayment);
router.post('/failure', auth, recordPaymentFailure);
router.post('/upi-qr', auth, createUpiQr);
router.get('/upi-qr/:qrId/status', auth, getUpiQrStatus);
router.get('/my-orders', auth, getMyOrders);
router.get('/order/:id', auth, getOrderById);

module.exports = router;
