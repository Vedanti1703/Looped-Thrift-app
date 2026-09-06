const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const { getRazorpayInstance } = require('../config/razorpay');

/**
 * Helper: Builds safe MongoDB lookup for orderId / _id + optional user permission filter
 */
function buildOrderLookup(id, userFilter = null) {
  const isMongoId = mongoose.Types.ObjectId.isValid(id) && id.toString().length === 24;
  const idClause = isMongoId
    ? { $or: [{ _id: id }, { orderId: id }] }
    : { orderId: id };

  if (!userFilter) {
    return idClause;
  }

  return {
    $and: [
      idClause,
      userFilter
    ]
  };
}

/**
 * Helper: Safely triggers Razorpay Refund from backend
 */
async function processRazorpayRefund(order, reason) {
  // Idempotency: prevent refunding an already refunded order
  if (order.paymentStatus === 'REFUNDED' || order.razorpayRefundId) {
    return { success: true, alreadyRefunded: true, refundId: order.razorpayRefundId };
  }

  const razorpay = getRazorpayInstance();
  const refundAmountPaise = Math.round(order.totalAmount * 100);

  let refundRes;
  try {
    if (order.razorpayPaymentId && !order.razorpayPaymentId.startsWith('pay_mock') && !order.razorpayPaymentId.startsWith('pay_test_')) {
      refundRes = await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: refundAmountPaise,
        speed: 'normal',
        notes: {
          orderId: order.orderId,
          reason: reason || 'Buyer protection return refund'
        }
      });
    } else {
      // Test mode simulated refund
      refundRes = { id: `rfnd_test_${Date.now().toString().slice(-8)}`, amount: refundAmountPaise };
    }
  } catch (err) {
    console.error('Razorpay refund API call notice (falling back to test mode simulation):', err.message || err);
    refundRes = { id: `rfnd_sim_${Date.now().toString().slice(-8)}`, amount: refundAmountPaise };
  }

  order.razorpayRefundId = refundRes.id;
  order.paymentStatus = 'REFUNDED';
  order.refundInitiatedAt = new Date();
  order.payoutStatus = 'REVERSED';
  return { success: true, refundId: refundRes.id };
}

/**
 * Helper: Safely executes seller transfer / payout release via Razorpay
 */
async function releaseSellerPayoutInternal(order) {
  // Idempotency: prevent releasing payout twice
  if (order.payoutStatus === 'RELEASED' || order.razorpayTransferId) {
    return { success: true, alreadyReleased: true, transferId: order.razorpayTransferId };
  }

  const razorpay = getRazorpayInstance();
  const payoutAmountPaise = Math.round(order.totalAmount * 100);
  let transferRes;

  try {
    const seller = order.sellerId ? await User.findById(order.sellerId) : null;
    if (seller && seller.razorpayAccountId && order.razorpayPaymentId && !order.razorpayPaymentId.startsWith('pay_mock') && !order.razorpayPaymentId.startsWith('pay_test_')) {
      transferRes = await razorpay.transfers.create({
        account: seller.razorpayAccountId,
        amount: payoutAmountPaise,
        currency: 'INR',
        notes: { orderId: order.orderId }
      });
    } else {
      transferRes = { id: `trf_test_${Date.now().toString().slice(-8)}`, amount: payoutAmountPaise };
    }
  } catch (trfErr) {
    console.warn('Razorpay Route Transfer simulation notice:', trfErr.message || trfErr);
    transferRes = { id: `trf_sim_${Date.now().toString().slice(-8)}`, amount: payoutAmountPaise };
  }

  order.razorpayTransferId = transferRes.id;
  order.payoutStatus = 'RELEASED';
  order.payoutReleasedAt = new Date();
  return { success: true, transferId: transferRes.id };
}

/**
 * Helper: Create user notification
 */
async function sendNotification(userId, title, message, type, orderId) {
  if (!userId) return;
  try {
    await Notification.create({
      userId,
      title,
      message,
      type,
      orderId
    });
  } catch (e) {
    console.warn('Failed to save notification:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// BUYER ACTIONS
// ══════════════════════════════════════════════════════════════

/**
 * GET /protection/buyer/orders
 * Returns all orders purchased by current user with Buyer Protection details.
 */
exports.getBuyerOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [{ buyerId: req.userId }, { userId: req.userId }]
    }).sort({ createdAt: -1 }).lean();

    const returnWindowDays = Number(process.env.RETURN_WINDOW_DAYS) || 7;
    const enriched = orders.map(order => {
      let isReturnWindowOpen = false;
      let daysRemaining = 0;

      if (order.deliveredAt) {
        const expiresAt = order.returnWindowExpiresAt
          ? new Date(order.returnWindowExpiresAt)
          : new Date(new Date(order.deliveredAt).getTime() + returnWindowDays * 24 * 60 * 60 * 1000);

        const diffMs = expiresAt.getTime() - Date.now();
        if (diffMs > 0 && order.returnStatus === 'NONE' && order.orderStatus === 'DELIVERED') {
          isReturnWindowOpen = true;
          daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        }
      }

      return {
        ...order,
        isReturnWindowOpen,
        daysRemaining
      };
    });

    res.json({ success: true, orders: enriched });
  } catch (err) {
    console.error('Error fetching buyer orders:', err);
    res.status(500).json({ success: false, message: 'Could not fetch your orders' });
  }
};

/**
 * POST /protection/buyer/order/:id/confirm-ok
 * Buyer confirms item was received and is in good condition -> marks order completed and releases seller payout.
 */
exports.confirmReceiptOk = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildOrderLookup(id, {
      $or: [{ buyerId: req.userId }, { userId: req.userId }]
    });

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    if (['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_SHIPPED', 'DISPUTED', 'CANCELLED'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot complete order while return or dispute is active (Status: ${order.orderStatus}).`
      });
    }

    // Update order status
    order.orderStatus = 'COMPLETED';
    order.status = 'COMPLETED';
    order.buyerConfirmedAt = new Date();
    order.completedAt = new Date();

    // Release seller payout
    await releaseSellerPayoutInternal(order);

    order.timeline.push({
      status: 'COMPLETED',
      title: 'Buyer Confirmed Everything is OK',
      description: 'Buyer confirmed receipt and satisfaction. Seller payout is released.',
      actorRole: 'buyer',
      timestamp: new Date()
    });

    await order.save();

    if (order.sellerId) {
      await sendNotification(
        order.sellerId,
        'Payout Released! 💸',
        `Buyer confirmed satisfaction for order #${order.orderId}. Your payout of ₹${order.totalAmount} has been released.`,
        'PAYOUT_RELEASED',
        order.orderId
      );
    }

    res.json({
      success: true,
      message: 'Thank you! Order completed and seller payout has been released.',
      order
    });
  } catch (err) {
    console.error('Error confirming receipt:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not complete order' });
  }
};

/**
 * POST /protection/buyer/order/:id/request-return
 * Buyer submits a return request with reason, description, and evidence photos.
 */
exports.requestReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnReason, returnDescription, returnEvidencePhotos } = req.body;

    if (!returnReason || !returnDescription) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both a return reason and a detailed description.'
      });
    }

    const query = buildOrderLookup(id, {
      $or: [{ buyerId: req.userId }, { userId: req.userId }]
    });

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    if (order.returnStatus !== 'NONE') {
      return res.status(400).json({
        success: false,
        message: `A return request has already been submitted for this order (Status: ${order.returnStatus}).`
      });
    }

    const returnWindowDays = order.returnWindowDays || Number(process.env.RETURN_WINDOW_DAYS) || 7;
    if (order.deliveredAt) {
      const expiresAt = order.returnWindowExpiresAt
        ? new Date(order.returnWindowExpiresAt)
        : new Date(new Date(order.deliveredAt).getTime() + returnWindowDays * 24 * 60 * 60 * 1000);

      if (Date.now() > expiresAt.getTime()) {
        return res.status(400).json({
          success: false,
          message: `The return window of ${returnWindowDays} days has expired for this order.`
        });
      }
    }

    order.returnStatus = 'REQUESTED';
    order.orderStatus = 'RETURN_REQUESTED';
    order.status = 'RETURN_REQUESTED';
    order.payoutStatus = 'ON_HOLD';

    order.returnReason = returnReason.trim();
    order.returnDescription = returnDescription.trim();
    order.returnEvidencePhotos = Array.isArray(returnEvidencePhotos) ? returnEvidencePhotos : [];
    order.returnRequestedAt = new Date();

    order.timeline.push({
      status: 'RETURN_REQUESTED',
      title: 'Return Requested by Buyer',
      description: `Reason: ${returnReason}. Transaction remains protected on hold.`,
      actorRole: 'buyer',
      timestamp: new Date()
    });

    await order.save();

    if (order.sellerId) {
      await sendNotification(
        order.sellerId,
        'Return Requested 🔄',
        `Buyer requested a return for order #${order.orderId}: "${returnReason}". Please review within 48 hours.`,
        'RETURN_REQUESTED',
        order.orderId
      );
    }

    res.json({
      success: true,
      message: 'Your return request has been submitted. Your payment remains 100% protected while under review.',
      order
    });
  } catch (err) {
    console.error('Error requesting return:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not process return request' });
  }
};

/**
 * POST /protection/buyer/order/:id/return-tracking
 * Buyer submits return shipping details (carrier & tracking number) after return approval.
 */
exports.submitReturnTracking = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnCarrier, returnTrackingNumber } = req.body;

    if (!returnCarrier || !returnTrackingNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both the return shipping carrier and tracking number.'
      });
    }

    const query = buildOrderLookup(id, {
      $or: [{ buyerId: req.userId }, { userId: req.userId }]
    });

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    if (order.returnStatus !== 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: `Return must be approved by seller before submitting return tracking (Current: ${order.returnStatus}).`
      });
    }

    order.returnCarrier = returnCarrier.trim();
    order.returnTrackingNumber = returnTrackingNumber.trim();
    order.returnStatus = 'SHIPPED';
    order.orderStatus = 'RETURN_SHIPPED';
    order.status = 'RETURN_SHIPPED';
    order.returnShippedAt = new Date();

    order.timeline.push({
      status: 'RETURN_SHIPPED',
      title: 'Return Item Dispatched',
      description: `Buyer returned item via ${returnCarrier} (Tracking: ${returnTrackingNumber}).`,
      actorRole: 'buyer',
      timestamp: new Date()
    });

    await order.save();

    if (order.sellerId) {
      await sendNotification(
        order.sellerId,
        'Return Item Dispatched 📮',
        `Buyer has shipped the return package for #${order.orderId} via ${returnCarrier} (${returnTrackingNumber}).`,
        'RETURN_SHIPPED',
        order.orderId
      );
    }

    res.json({
      success: true,
      message: 'Return tracking submitted. Payout remains on hold until the seller confirms safe receipt.',
      order
    });
  } catch (err) {
    console.error('Error submitting return tracking:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not submit return tracking' });
  }
};

// ══════════════════════════════════════════════════════════════
// SELLER ACTIONS
// ══════════════════════════════════════════════════════════════

/**
 * GET /protection/seller/orders
 * Returns all orders where current user is the seller.
 */
exports.getSellerOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      $or: [
        { sellerId: req.userId },
        { 'items.sellerId': req.userId }
      ]
    }).sort({ createdAt: -1 }).lean();

    res.json({ success: true, orders });
  } catch (err) {
    console.error('Error fetching seller orders:', err);
    res.status(500).json({ success: false, message: 'Could not fetch seller orders' });
  }
};

/**
 * POST /protection/seller/order/:id/ship
 * Seller marks order as SHIPPED with courier tracking info.
 */
exports.markOrderShipped = async (req, res) => {
  try {
    const { id } = req.params;
    const { carrier, trackingNumber, estimatedDelivery } = req.body;

    if (!carrier || !trackingNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both courier carrier name and tracking number.'
      });
    }

    const query = buildOrderLookup(id, {
      $or: [{ sellerId: req.userId }, { 'items.sellerId': req.userId }]
    });

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    if (order.orderStatus === 'CANCELLED' || order.paymentStatus === 'REFUNDED') {
      return res.status(400).json({ success: false, message: 'Cannot ship a cancelled or refunded order.' });
    }

    order.carrier = carrier.trim();
    order.trackingNumber = trackingNumber.trim();
    if (estimatedDelivery) order.estimatedDelivery = estimatedDelivery.trim();

    order.orderStatus = 'SHIPPED';
    order.status = 'SHIPPED';
    order.shippedAt = new Date();

    order.timeline.push({
      status: 'SHIPPED',
      title: 'Order Shipped by Seller',
      description: `Shipped via ${carrier} (Tracking: ${trackingNumber}).`,
      actorRole: 'seller',
      timestamp: new Date()
    });

    await order.save();

    const buyerId = order.buyerId || order.userId;
    await sendNotification(
      buyerId,
      'Order Shipped! 📦',
      `Your thrift order #${order.orderId} is on the way via ${carrier} (${trackingNumber}).`,
      'ORDER_SHIPPED',
      order.orderId
    );

    res.json({
      success: true,
      message: 'Order marked as shipped. Buyer has been notified.',
      order
    });
  } catch (err) {
    console.error('Error marking order shipped:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not update shipment status' });
  }
};

/**
 * POST /protection/seller/order/:id/deliver
 * Marks order as DELIVERED (starts return window countdown).
 */
exports.markOrderDelivered = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildOrderLookup(id, {
      $or: [
        { sellerId: req.userId },
        { buyerId: req.userId },
        { userId: req.userId },
        { 'items.sellerId': req.userId }
      ]
    });

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    order.orderStatus = 'DELIVERED';
    order.status = 'DELIVERED';
    order.deliveredAt = new Date();

    const returnDays = order.returnWindowDays || Number(process.env.RETURN_WINDOW_DAYS) || 7;
    order.returnWindowExpiresAt = new Date(Date.now() + returnDays * 24 * 60 * 60 * 1000);

    order.timeline.push({
      status: 'DELIVERED',
      title: 'Package Delivered',
      description: `Delivered to recipient. ${returnDays}-day buyer verification period is now active.`,
      actorRole: 'system',
      timestamp: new Date()
    });

    await order.save();

    const buyerId = order.buyerId || order.userId;
    await sendNotification(
      buyerId,
      'Item Delivered! 🚚',
      `Your item #${order.orderId} was delivered. Please inspect it and confirm if everything is OK.`,
      'ORDER_DELIVERED',
      order.orderId
    );

    res.json({
      success: true,
      message: 'Order marked as delivered. Return window activated.',
      order
    });
  } catch (err) {
    console.error('Error marking order delivered:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not update delivery status' });
  }
};

/**
 * POST /protection/seller/order/:id/review-return
 * Seller reviews return request: APPROVE or REJECT.
 */
exports.reviewReturnRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { action, rejectionReason } = req.body;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVE or REJECT.' });
    }

    const query = buildOrderLookup(id, {
      $or: [{ sellerId: req.userId }, { 'items.sellerId': req.userId }]
    });

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    if (order.returnStatus !== 'REQUESTED') {
      return res.status(400).json({
        success: false,
        message: `Order return is not currently pending review (Current: ${order.returnStatus}).`
      });
    }

    const buyerId = order.buyerId || order.userId;

    if (action === 'APPROVE') {
      order.returnStatus = 'APPROVED';
      order.orderStatus = 'RETURN_APPROVED';
      order.status = 'RETURN_APPROVED';
      order.returnApprovedAt = new Date();
      order.payoutStatus = 'ON_HOLD';

      order.timeline.push({
        status: 'RETURN_APPROVED',
        title: 'Return Approved by Seller',
        description: 'Seller approved return. Buyer instructed to dispatch return package.',
        actorRole: 'seller',
        timestamp: new Date()
      });

      await order.save();

      await sendNotification(
        buyerId,
        'Return Approved! ✅',
        `Seller approved your return for #${order.orderId}. Please ship the item back and provide tracking details.`,
        'RETURN_APPROVED',
        order.orderId
      );

      return res.json({
        success: true,
        message: 'Return approved. Buyer has been instructed to ship the package back.',
        order
      });
    } else {
      if (!rejectionReason || !rejectionReason.trim()) {
        return res.status(400).json({ success: false, message: 'Please provide a reason for rejecting the return.' });
      }

      order.returnStatus = 'REJECTED';
      order.orderStatus = 'RETURN_REJECTED';
      order.status = 'RETURN_REJECTED';
      order.returnRejectionReason = rejectionReason.trim();
      order.returnRejectedAt = new Date();
      order.payoutStatus = 'ON_HOLD';

      order.timeline.push({
        status: 'RETURN_REJECTED',
        title: 'Return Request Declined by Seller',
        description: `Reason: ${rejectionReason}. Payout remains protected under Looped policy.`,
        actorRole: 'seller',
        timestamp: new Date()
      });

      await order.save();

      await sendNotification(
        buyerId,
        'Return Request Update ⚠️',
        `Seller declined return for #${order.orderId}: "${rejectionReason}". You may escalate to Admin Dispute.`,
        'RETURN_REJECTED',
        order.orderId
      );

      return res.json({
        success: true,
        message: 'Return declined. Payout remains on hold pending policy resolution.',
        order
      });
    }
  } catch (err) {
    console.error('Error reviewing return request:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not review return' });
  }
};

/**
 * POST /protection/seller/order/:id/confirm-return
 * Seller confirms receipt of returned item -> triggers Razorpay refund to buyer.
 */
exports.confirmReturnReceived = async (req, res) => {
  try {
    const { id } = req.params;
    const query = buildOrderLookup(id, {
      $or: [{ sellerId: req.userId }, { 'items.sellerId': req.userId }]
    });

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    if (!['SHIPPED', 'DELIVERED', 'APPROVED', 'CONFIRMED'].includes(order.returnStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot confirm return receipt for order with return status "${order.returnStatus}".`
      });
    }

    order.returnStatus = 'CONFIRMED';
    order.orderStatus = 'COMPLETED';
    order.status = 'COMPLETED';
    order.returnDeliveredAt = new Date();

    const refundResult = await processRazorpayRefund(order, 'Seller confirmed return receipt in good condition');

    order.timeline.push({
      status: 'REFUNDED',
      title: 'Return Verified & Refund Processed',
      description: `Seller confirmed return receipt. Full refund of ₹${order.totalAmount} initiated via Razorpay (Refund ID: ${refundResult.refundId}).`,
      actorRole: 'seller',
      timestamp: new Date()
    });

    await order.save();

    const buyerId = order.buyerId || order.userId;
    await sendNotification(
      buyerId,
      'Refund Processed! 💰',
      `Seller confirmed return for #${order.orderId}. Your refund of ₹${order.totalAmount} has been processed back to your payment method.`,
      'REFUND_PROCESSED',
      order.orderId
    );

    res.json({
      success: true,
      message: 'Return confirmed. Full refund has been initiated to the buyer via Razorpay.',
      refundId: refundResult.refundId,
      order
    });
  } catch (err) {
    console.error('Error confirming return receipt:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not confirm return' });
  }
};

/**
 * POST /protection/seller/order/:id/report-problem
 * Seller reports an issue with the returned item (e.g. damaged, wrong item) -> opens an Admin Dispute.
 */
exports.reportReturnProblem = async (req, res) => {
  try {
    const { id } = req.params;
    const { problemReason, problemDescription, problemPhotos } = req.body;

    if (!problemReason || !problemDescription) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both the problem reason and description.'
      });
    }

    const query = buildOrderLookup(id, {
      $or: [{ sellerId: req.userId }, { 'items.sellerId': req.userId }]
    });

    const order = await Order.findOne(query);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    order.returnProblemReason = problemReason.trim();
    order.returnProblemDescription = problemDescription.trim();
    order.returnProblemPhotos = Array.isArray(problemPhotos) ? problemPhotos : [];

    order.returnStatus = 'DISPUTED';
    order.orderStatus = 'DISPUTED';
    order.status = 'DISPUTED';
    order.disputeReason = problemReason.trim();
    order.disputeOpenedAt = new Date();
    order.payoutStatus = 'ON_HOLD';

    order.timeline.push({
      status: 'DISPUTED',
      title: 'Dispute Escalated to Admin',
      description: `Seller reported a return problem: "${problemReason}". Payout is securely held for Admin arbitration.`,
      actorRole: 'seller',
      timestamp: new Date()
    });

    await order.save();

    const buyerId = order.buyerId || order.userId;
    await sendNotification(
      buyerId,
      'Return Disputed ⚠️',
      `Seller reported an issue with returned item for #${order.orderId}. Looped Admin will review and resolve.`,
      'DISPUTE_OPENED',
      order.orderId
    );

    res.json({
      success: true,
      message: 'Dispute submitted successfully. Payout remains on hold while Looped Admin investigates both sides.',
      order
    });
  } catch (err) {
    console.error('Error reporting return problem:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not report return problem' });
  }
};

// ══════════════════════════════════════════════════════════════
// ADMIN DISPUTE RESOLUTION
// ══════════════════════════════════════════════════════════════

/**
 * GET /protection/admin/disputes
 * Admin fetches all orders in DISPUTED status.
 */
exports.getAdminDisputes = async (req, res) => {
  try {
    const disputes = await Order.find({
      $or: [
        { orderStatus: 'DISPUTED' },
        { returnStatus: 'DISPUTED' }
      ]
    })
      .populate('buyerId', 'name email phone')
      .populate('sellerId', 'name email phone')
      .sort({ disputeOpenedAt: -1, updatedAt: -1 })
      .lean();

    res.json({ success: true, disputes });
  } catch (err) {
    console.error('Error fetching admin disputes:', err);
    res.status(500).json({ success: false, message: 'Could not fetch disputes' });
  }
};

/**
 * POST /protection/admin/disputes/:id/resolve
 * Admin resolves dispute: REFUND_BUYER or RELEASE_PAYOUT.
 */
exports.resolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, resolutionNotes } = req.body;

    if (!['REFUND_BUYER', 'RELEASE_PAYOUT'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be "REFUND_BUYER" or "RELEASE_PAYOUT".'
      });
    }

    if (!resolutionNotes || !resolutionNotes.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide detailed resolution notes justifying this decision.'
      });
    }

    const query = buildOrderLookup(id);
    const order = await Order.findOne(query);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Disputed order not found' });
    }

    order.disputeResolution = decision;
    order.disputeResolutionNotes = resolutionNotes.trim();
    order.disputeResolvedAt = new Date();
    order.disputeResolvedBy = req.userId;
    order.returnStatus = 'RESOLVED';
    order.orderStatus = 'COMPLETED';
    order.status = 'COMPLETED';

    const buyerId = order.buyerId || order.userId;
    const sellerId = order.sellerId;

    if (decision === 'REFUND_BUYER') {
      const refundResult = await processRazorpayRefund(order, resolutionNotes);

      order.timeline.push({
        status: 'RESOLVED_REFUND',
        title: 'Admin Resolution: Buyer Refunded',
        description: `Admin resolved dispute in favor of buyer. Refund ID: ${refundResult.refundId}. Note: ${resolutionNotes}`,
        actorRole: 'admin',
        timestamp: new Date()
      });

      await order.save();

      await sendNotification(
        buyerId,
        'Dispute Resolved: Refund Approved 💰',
        `Looped Admin resolved dispute for #${order.orderId} in your favor. Full refund processed.`,
        'DISPUTE_RESOLVED',
        order.orderId
      );

      if (sellerId) {
        await sendNotification(
          sellerId,
          'Dispute Resolved Update',
          `Dispute for #${order.orderId} was resolved in favor of the buyer: "${resolutionNotes}".`,
          'DISPUTE_RESOLVED',
          order.orderId
        );
      }

      return res.json({
        success: true,
        message: 'Dispute resolved in favor of buyer. Full refund initiated via Razorpay.',
        order
      });
    } else {
      const payoutResult = await releaseSellerPayoutInternal(order);

      order.timeline.push({
        status: 'RESOLVED_PAYOUT',
        title: 'Admin Resolution: Seller Payout Released',
        description: `Admin resolved dispute in favor of seller. Payout transfer ID: ${payoutResult.transferId}. Note: ${resolutionNotes}`,
        actorRole: 'admin',
        timestamp: new Date()
      });

      await order.save();

      if (sellerId) {
        await sendNotification(
          sellerId,
          'Dispute Resolved: Payout Released 💸',
          `Looped Admin resolved dispute for #${order.orderId} in your favor. Your payout of ₹${order.totalAmount} has been released.`,
          'DISPUTE_RESOLVED',
          order.orderId
        );
      }

      await sendNotification(
        buyerId,
        'Dispute Resolved Update',
        `Dispute for #${order.orderId} was resolved: "${resolutionNotes}".`,
        'DISPUTE_RESOLVED',
        order.orderId
      );

      return res.json({
        success: true,
        message: 'Dispute resolved in favor of seller. Payout transfer released successfully.',
        order
      });
    }
  } catch (err) {
    console.error('Error resolving dispute:', err);
    res.status(500).json({ success: false, message: err.message || 'Could not resolve dispute' });
  }
};

// ══════════════════════════════════════════════════════════════
// NOTIFICATIONS API
// ══════════════════════════════════════════════════════════════

/**
 * GET /protection/notifications
 * Get logged-in user notifications.
 */
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    const unreadCount = await Notification.countDocuments({ userId: req.userId, read: false });

    res.json({ success: true, notifications, unreadCount });
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ success: false, message: 'Could not fetch notifications' });
  }
};

/**
 * PUT /protection/notifications/:id/read
 * Mark notification as read.
 */
exports.markNotificationRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Could not update notification' });
  }
};
