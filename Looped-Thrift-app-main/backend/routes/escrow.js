const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  createRefundHold,
  submitReturnShipment,
  markReturnDeliveredByCourier,
  confirmReceiptAndReleaseRefund,
  disputeRefundHold,
  expireRefundHold,
  adminResolveDispute,
  getHoldByOrderId,
  getCustomerHolds,
  getSellerHolds,
  getAdminDisputedHolds
} = require('../controllers/escrowController');

// Customer Endpoints
router.post('/hold/create', auth, createRefundHold);
router.post('/hold/:id/ship', auth, submitReturnShipment);
router.get('/holds/customer', auth, getCustomerHolds);

// Seller Endpoints
router.post('/hold/:id/confirm-receipt', auth, confirmReceiptAndReleaseRefund);
router.post('/hold/:id/dispute', auth, disputeRefundHold);
router.get('/holds/seller', auth, getSellerHolds);

// Shared / Courier Endpoints
router.post('/hold/:id/courier-delivered', auth, markReturnDeliveredByCourier);
router.post('/hold/:id/expire', auth, expireRefundHold);
router.get('/hold/order/:orderId', auth, getHoldByOrderId);

// Admin Dispute Endpoints
router.get('/admin/disputes', auth, admin, getAdminDisputedHolds);
router.post('/admin/hold/:id/resolve', auth, admin, adminResolveDispute);

module.exports = router;
