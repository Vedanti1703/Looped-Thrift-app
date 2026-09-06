const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {
  getBuyerOrders,
  confirmReceiptOk,
  requestReturn,
  submitReturnTracking,
  getSellerOrders,
  markOrderShipped,
  markOrderDelivered,
  reviewReturnRequest,
  confirmReturnReceived,
  reportReturnProblem,
  getAdminDisputes,
  resolveDispute,
  getNotifications,
  markNotificationRead
} = require('../controllers/orderProtectionController');

// All endpoints require authentication
router.use(auth);

// ── Buyer Endpoints ───────────────────────────────────────────
router.get('/buyer/orders', getBuyerOrders);
router.post('/buyer/order/:id/confirm-ok', confirmReceiptOk);
router.post('/buyer/order/:id/request-return', requestReturn);
router.post('/buyer/order/:id/return-tracking', submitReturnTracking);

// ── Seller Endpoints ──────────────────────────────────────────
router.get('/seller/orders', getSellerOrders);
router.post('/seller/order/:id/ship', markOrderShipped);
router.post('/seller/order/:id/deliver', markOrderDelivered);
router.post('/seller/order/:id/review-return', reviewReturnRequest);
router.post('/seller/order/:id/confirm-return', confirmReturnReceived);
router.post('/seller/order/:id/report-problem', reportReturnProblem);

// ── Admin Dispute Endpoints ───────────────────────────────────
router.get('/admin/disputes', admin, getAdminDisputes);
router.post('/admin/disputes/:id/resolve', admin, resolveDispute);

// ── Notifications Endpoints ───────────────────────────────────
router.get('/notifications', getNotifications);
router.put('/notifications/:id/read', markNotificationRead);

module.exports = router;
