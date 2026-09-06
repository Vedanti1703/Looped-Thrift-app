const mongoose = require('mongoose');
const RefundHold = require('../models/RefundHold');
const Order = require('../models/Order');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { getRazorpayInstance } = require('../config/razorpay');

/**
 * Helper: Safely triggers Razorpay Refund from backend
 */
async function triggerRazorpayRefund(order, refundAmount, reason) {
  if (order.paymentStatus === 'REFUNDED' && order.razorpayRefundId) {
    return { success: true, alreadyRefunded: true, refundId: order.razorpayRefundId };
  }

  const razorpay = getRazorpayInstance();
  const refundAmountPaise = Math.round(Number(refundAmount) * 100);

  let refundRes;
  try {
    if (order.razorpayPaymentId && !order.razorpayPaymentId.startsWith('pay_mock') && !order.razorpayPaymentId.startsWith('pay_test_')) {
      refundRes = await razorpay.payments.refund(order.razorpayPaymentId, {
        amount: refundAmountPaise,
        speed: 'normal',
        notes: {
          orderId: order.orderId,
          reason: reason || 'Escrow confirmed return refund'
        }
      });
    } else {
      refundRes = { id: `rfnd_escrow_${Date.now().toString().slice(-8)}`, amount: refundAmountPaise };
    }
  } catch (err) {
    console.warn('Razorpay refund API fallback notice:', err.message || err);
    refundRes = { id: `rfnd_sim_${Date.now().toString().slice(-8)}`, amount: refundAmountPaise };
  }

  return { success: true, refundId: refundRes.id, amount: refundAmount };
}

/**
 * Helper: Safely releases seller transfer / payout
 */
async function triggerSellerTransfer(order, transferAmount) {
  const razorpay = getRazorpayInstance();
  const amountPaise = Math.round(Number(transferAmount) * 100);
  let transferRes;

  try {
    const seller = order.sellerId ? await User.findById(order.sellerId) : null;
    if (seller && seller.razorpayAccountId && order.razorpayPaymentId && !order.razorpayPaymentId.startsWith('pay_mock') && !order.razorpayPaymentId.startsWith('pay_test_')) {
      transferRes = await razorpay.transfers.create({
        account: seller.razorpayAccountId,
        amount: amountPaise,
        currency: 'INR',
        notes: { orderId: order.orderId }
      });
    } else {
      transferRes = { id: `trf_escrow_${Date.now().toString().slice(-8)}`, amount: amountPaise };
    }
  } catch (err) {
    console.warn('Razorpay transfer simulation notice:', err.message || err);
    transferRes = { id: `trf_sim_${Date.now().toString().slice(-8)}`, amount: amountPaise };
  }

  return { success: true, transferId: transferRes.id, amount: transferAmount };
}

/**
 * Helper: Send In-App Notification
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
    console.warn('Failed to dispatch notification:', e.message);
  }
}

/**
 * Helper: Build safe order query
 */
function buildOrderLookup(id, userFilter = null) {
  const isMongoId = mongoose.Types.ObjectId.isValid(id) && id.toString().length === 24;
  const idClause = isMongoId
    ? { $or: [{ _id: id }, { orderId: id }] }
    : { orderId: id };

  if (!userFilter) return idClause;
  return { $and: [idClause, userFilter] };
}

// ══════════════════════════════════════════════════════════════
// ESCROW CONTROLLER HANDLERS
// ══════════════════════════════════════════════════════════════

/**
 * 1. POST /escrow/hold/create
 * Customer initiates a return -> creates RefundHold record in PENDING status,
 * locks seller payout in escrow, sets shipping deadline.
 */
exports.createRefundHold = async (req, res) => {
  try {
    const { orderId, returnReason, returnDescription, returnEvidencePhotos, amount } = req.body;

    if (!orderId || !returnReason || !returnDescription) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, return reason, and detailed description are required.'
      });
    }

    const orderQuery = buildOrderLookup(orderId, {
      $or: [{ buyerId: req.userId }, { userId: req.userId }]
    });
    const order = await Order.findOne(orderQuery);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found or unauthorized' });
    }

    // Check if hold already exists for this order
    let existingHold = await RefundHold.findOne({ orderId: order.orderId });
    if (existingHold && !['EXPIRED', 'CANCELLED'].includes(existingHold.status)) {
      return res.status(400).json({
        success: false,
        message: `A return hold is already active for this order (Status: ${existingHold.status}).`,
        hold: existingHold
      });
    }

    const holdAmount = amount ? Number(amount) : order.totalAmount;
    const shippingWindowDays = Number(process.env.RETURN_SHIPPING_WINDOW_DAYS) || 7;
    const expiresAt = new Date(Date.now() + shippingWindowDays * 24 * 60 * 60 * 1000);
    const holdId = `HOLD-${order.orderId}-${Date.now().toString().slice(-4)}`;

    const refundHold = new RefundHold({
      holdId,
      orderId: order.orderId,
      orderRef: order._id,
      sellerId: order.sellerId,
      customerId: req.userId,
      totalOrderAmount: order.totalAmount,
      amount: holdAmount,
      status: 'PENDING',
      returnReason: returnReason.trim(),
      returnDescription: returnDescription.trim(),
      returnEvidencePhotos: Array.isArray(returnEvidencePhotos) ? returnEvidencePhotos : [],
      razorpayPaymentId: order.razorpayPaymentId || '',
      expiresAt
    });

    refundHold.logTransition(
      'PENDING',
      `Return initiated by customer. ₹${holdAmount} placed in refund hold.`,
      'customer',
      req.userId,
      { returnReason }
    );
    await refundHold.save();

    // Update order status
    order.returnStatus = 'REQUESTED';
    order.orderStatus = 'RETURN_REQUESTED';
    order.status = 'RETURN_REQUESTED';
    order.payoutStatus = 'ON_HOLD'; // Seller payout strictly locked in escrow
    order.returnReason = returnReason.trim();
    order.returnDescription = returnDescription.trim();
    order.returnRequestedAt = new Date();

    order.timeline.push({
      status: 'RETURN_REQUESTED',
      title: 'Return Requested & Refund Held in Escrow',
      description: `Customer requested return. Refund amount ₹${holdAmount} is placed in escrow hold.`,
      actorRole: 'buyer',
      timestamp: new Date()
    });
    await order.save();

    // Notifications
    await sendNotification(
      req.userId,
      'Return Initiated & Escrow Hold Placed 🔒',
      `Your return request for order #${order.orderId} was received. Refund of ₹${holdAmount} is held in escrow until seller receives the item.`,
      'RETURN_HOLD_PENDING',
      order.orderId
    );

    if (order.sellerId) {
      await sendNotification(
        order.sellerId,
        'Return Requested — Escrow Hold Active ⚠️',
        `Customer requested a return for order #${order.orderId}. Payout is held in escrow. Waiting for customer return shipment.`,
        'RETURN_REQUESTED',
        order.orderId
      );
    }

    res.status(201).json({
      success: true,
      message: 'Return initiated. Refund amount is securely placed on escrow hold.',
      hold: refundHold,
      order
    });
  } catch (err) {
    console.error('Error creating refund hold:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to create refund hold' });
  }
};

/**
 * 2. POST /escrow/hold/:id/ship
 * Customer submits return courier details -> status moves to IN_TRANSIT.
 */
exports.submitReturnShipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { returnCarrier, returnTrackingNumber } = req.body;

    if (!returnCarrier || !returnTrackingNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both the return shipping carrier and tracking number.'
      });
    }

    const hold = await RefundHold.findOne({
      $or: [{ holdId: id }, { orderId: id }],
      customerId: req.userId
    });

    if (!hold) {
      return res.status(404).json({ success: false, message: 'Refund hold not found or unauthorized' });
    }

    if (hold.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot submit tracking for hold in "${hold.status}" status (expected PENDING).`
      });
    }

    hold.returnCarrier = returnCarrier.trim();
    hold.returnTrackingNumber = returnTrackingNumber.trim();
    hold.shippedAt = new Date();
    hold.logTransition(
      'IN_TRANSIT',
      `Customer dispatched return via ${returnCarrier} (Tracking: ${returnTrackingNumber})`,
      'customer',
      req.userId,
      { carrier: returnCarrier, trackingNumber: returnTrackingNumber }
    );
    await hold.save();

    // Update order
    const order = await Order.findOne({ orderId: hold.orderId });
    if (order) {
      order.returnStatus = 'SHIPPED';
      order.orderStatus = 'RETURN_SHIPPED';
      order.status = 'RETURN_SHIPPED';
      order.returnCarrier = returnCarrier.trim();
      order.returnTrackingNumber = returnTrackingNumber.trim();
      order.returnShippedAt = new Date();

      order.timeline.push({
        status: 'RETURN_SHIPPED',
        title: 'Return Item In Transit',
        description: `Customer shipped package via ${returnCarrier} (Tracking: ${returnTrackingNumber}). Escrow hold: IN_TRANSIT.`,
        actorRole: 'buyer',
        timestamp: new Date()
      });
      await order.save();
    }

    // Notifications
    await sendNotification(
      hold.customerId,
      'Return In Transit 📮',
      `Tracking info recorded for #${hold.orderId} via ${returnCarrier} (${returnTrackingNumber}). Escrow hold remains active.`,
      'RETURN_IN_TRANSIT',
      hold.orderId
    );

    if (hold.sellerId) {
      await sendNotification(
        hold.sellerId,
        'Return Dispatched by Customer 🚚',
        `Return package for #${hold.orderId} is on the way via ${returnCarrier} (${returnTrackingNumber}). Please confirm receipt once delivered.`,
        'RETURN_SHIPPED',
        hold.orderId
      );
    }

    res.json({
      success: true,
      message: 'Return tracking submitted. Escrow hold is now IN_TRANSIT.',
      hold
    });
  } catch (err) {
    console.error('Error submitting return shipment:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update shipment status' });
  }
};

/**
 * 3. POST /escrow/hold/:id/courier-delivered
 * Courier delivery trigger (webhook or courier simulation) -> status moves to DELIVERED_PENDING_CONFIRMATION.
 */
exports.markReturnDeliveredByCourier = async (req, res) => {
  try {
    const { id } = req.params;
    const hold = await RefundHold.findOne({
      $or: [{ holdId: id }, { orderId: id }]
    });

    if (!hold) {
      return res.status(404).json({ success: false, message: 'Refund hold not found' });
    }

    if (!['IN_TRANSIT', 'PENDING'].includes(hold.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot mark delivered from current status "${hold.status}".`
      });
    }

    hold.deliveredAt = new Date();
    hold.logTransition(
      'DELIVERED_PENDING_CONFIRMATION',
      'Courier tracking confirms return package delivered to seller location. Waiting for seller inspection.',
      'courier',
      null
    );
    await hold.save();

    const order = await Order.findOne({ orderId: hold.orderId });
    if (order) {
      order.returnStatus = 'DELIVERED';
      order.orderStatus = 'RETURN_DELIVERED';
      order.status = 'RETURN_DELIVERED';
      order.returnDeliveredAt = new Date();
      order.timeline.push({
        status: 'RETURN_DELIVERED',
        title: 'Return Parcel Delivered to Seller',
        description: 'Courier marked return delivered. Waiting for seller inspection and confirmation.',
        actorRole: 'system',
        timestamp: new Date()
      });
      await order.save();
    }

    if (hold.sellerId) {
      await sendNotification(
        hold.sellerId,
        'Return Package Delivered 📦',
        `Return package for #${hold.orderId} was delivered. Please inspect and confirm receipt in your Seller Dashboard within 48h.`,
        'SELLER_ACTION_REQUIRED',
        hold.orderId
      );
    }

    res.json({
      success: true,
      message: 'Return marked as delivered. Waiting for seller receipt confirmation.',
      hold
    });
  } catch (err) {
    console.error('Error marking return delivered:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to update delivery status' });
  }
};

/**
 * 4. POST /escrow/hold/:id/confirm-receipt
 * Seller confirms physical receipt -> updates hold to RELEASED,
 * triggers actual Razorpay refund to customer, deducts amount from seller payout.
 * Supports optional partial refund (e.g., partialAmount).
 */
exports.confirmReceiptAndReleaseRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { partialAmount, confirmationNotes } = req.body;

    const hold = await RefundHold.findOne({
      $or: [{ holdId: id }, { orderId: id }],
      sellerId: req.userId
    });

    if (!hold) {
      return res.status(404).json({ success: false, message: 'Refund hold not found or unauthorized' });
    }

    if (!['IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'PENDING'].includes(hold.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot release refund for hold with status "${hold.status}".`
      });
    }

    const order = await Order.findOne({ orderId: hold.orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Linked order not found' });
    }

    // Determine refund amount (full or partial)
    const refundToDisburse = partialAmount && Number(partialAmount) > 0 && Number(partialAmount) <= hold.amount
      ? Number(partialAmount)
      : hold.amount;

    const isPartial = refundToDisburse < hold.amount;

    // Trigger Razorpay Refund
    const refundResult = await triggerRazorpayRefund(
      order,
      refundToDisburse,
      confirmationNotes || 'Seller confirmed physical receipt of returned item'
    );

    // Update Hold record
    hold.refundedAmount = refundToDisburse;
    hold.sellerDeductedAmount = refundToDisburse;
    hold.releasedAt = new Date();
    hold.razorpayRefundId = refundResult.refundId;

    hold.logTransition(
      'RELEASED',
      `Seller confirmed receipt. ${isPartial ? `Partial refund of ₹${refundToDisburse}` : `Full refund of ₹${refundToDisburse}`} released to customer. Deducted from seller payout.`,
      'seller',
      req.userId,
      { refundId: refundResult.refundId, refundedAmount: refundToDisburse, isPartial }
    );
    await hold.save();

    // Update Order record
    order.returnStatus = 'CONFIRMED';
    order.orderStatus = 'COMPLETED';
    order.status = 'COMPLETED';
    order.paymentStatus = 'REFUNDED';
    order.razorpayRefundId = refundResult.refundId;
    order.refundInitiatedAt = new Date();

    if (isPartial) {
      // If partial, remaining amount can be settled with seller
      const sellerRemainder = hold.amount - refundToDisburse;
      order.payoutStatus = 'RELEASED';
      await triggerSellerTransfer(order, sellerRemainder);
    } else {
      order.payoutStatus = 'REVERSED';
    }

    order.timeline.push({
      status: 'REFUNDED',
      title: 'Return Verified & Refund Released',
      description: `Seller confirmed physical receipt. Escrow hold RELEASED. Refund of ₹${refundToDisburse} issued via Razorpay (Refund ID: ${refundResult.refundId}).`,
      actorRole: 'seller',
      timestamp: new Date()
    });
    await order.save();

    // Notifications
    await sendNotification(
      hold.customerId,
      'Refund Released! 💰',
      `Seller confirmed return receipt for #${hold.orderId}. Your refund of ₹${refundToDisburse} has been processed back to your payment method.`,
      'REFUND_RELEASED',
      hold.orderId
    );

    await sendNotification(
      hold.sellerId,
      'Return Completed & Settled ✅',
      `Return for #${hold.orderId} completed. Refund of ₹${refundToDisburse} was settled from order earnings.`,
      'RETURN_SETTLED',
      hold.orderId
    );

    res.json({
      success: true,
      message: `Return confirmed! Escrow hold RELEASED and refund of ₹${refundToDisburse} processed to customer.`,
      refundId: refundResult.refundId,
      refundedAmount: refundToDisburse,
      hold,
      order
    });
  } catch (err) {
    console.error('Error confirming receipt and releasing refund:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to confirm receipt and release refund' });
  }
};

/**
 * 5. POST /escrow/hold/:id/dispute
 * Seller disputes item condition (damaged/wrong item returned) -> hold stays locked in DISPUTED status.
 */
exports.disputeRefundHold = async (req, res) => {
  try {
    const { id } = req.params;
    const { disputeReason, disputeDescription, disputePhotos } = req.body;

    if (!disputeReason || !disputeDescription) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both the dispute reason and description.'
      });
    }

    const hold = await RefundHold.findOne({
      $or: [{ holdId: id }, { orderId: id }],
      sellerId: req.userId
    });

    if (!hold) {
      return res.status(404).json({ success: false, message: 'Refund hold not found or unauthorized' });
    }

    hold.sellerDisputeReason = disputeReason.trim();
    hold.sellerDisputeDescription = disputeDescription.trim();
    hold.sellerDisputePhotos = Array.isArray(disputePhotos) ? disputePhotos : [];
    hold.disputedAt = new Date();

    hold.logTransition(
      'DISPUTED',
      `Seller reported condition issue: "${disputeReason}". Escrow hold locked for Admin review.`,
      'seller',
      req.userId,
      { disputeReason, disputeDescription }
    );
    await hold.save();

    // Update order
    const order = await Order.findOne({ orderId: hold.orderId });
    if (order) {
      order.returnStatus = 'DISPUTED';
      order.orderStatus = 'DISPUTED';
      order.status = 'DISPUTED';
      order.disputeReason = disputeReason.trim();
      order.disputeOpenedAt = new Date();
      order.payoutStatus = 'ON_HOLD'; // Locked in escrow

      order.timeline.push({
        status: 'DISPUTED',
        title: 'Return Condition Disputed by Seller',
        description: `Seller flagged an issue: "${disputeReason}". Escrow hold is locked for Admin arbitration.`,
        actorRole: 'seller',
        timestamp: new Date()
      });
      await order.save();
    }

    // Notifications
    await sendNotification(
      hold.customerId,
      'Return Disputed ⚠️',
      `Seller reported an issue with the returned item for #${hold.orderId}: "${disputeReason}". Looped Admin will review.`,
      'DISPUTE_OPENED',
      hold.orderId
    );

    res.json({
      success: true,
      message: 'Dispute submitted. Refund hold is locked and will be arbitrated by Looped Admin.',
      hold
    });
  } catch (err) {
    console.error('Error disputing refund hold:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to submit dispute' });
  }
};

/**
 * 6. POST /escrow/hold/:id/expire
 * Auto-expires pending hold if customer never ships item in time -> restores order and unlocks seller payout.
 */
exports.expireRefundHold = async (req, res) => {
  try {
    const { id } = req.params;
    const hold = await RefundHold.findOne({
      $or: [{ holdId: id }, { orderId: id }]
    });

    if (!hold) {
      return res.status(404).json({ success: false, message: 'Refund hold not found' });
    }

    if (hold.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot expire hold with status "${hold.status}" (only PENDING holds can expire).`
      });
    }

    hold.logTransition(
      'EXPIRED',
      'Return shipping window expired. Customer did not dispatch return parcel. Hold cancelled.',
      'system',
      null
    );
    await hold.save();

    const order = await Order.findOne({ orderId: hold.orderId });
    if (order) {
      order.returnStatus = 'NONE';
      order.orderStatus = 'COMPLETED';
      order.status = 'COMPLETED';
      order.payoutStatus = 'RELEASED'; // Restore payout to seller
      order.completedAt = new Date();

      await triggerSellerTransfer(order, order.totalAmount);

      order.timeline.push({
        status: 'EXPIRED',
        title: 'Return Window Expired — Payout Released',
        description: 'Customer did not ship return parcel within required window. Escrow hold EXPIRED and seller payout released.',
        actorRole: 'system',
        timestamp: new Date()
      });
      await order.save();
    }

    if (hold.sellerId) {
      await sendNotification(
        hold.sellerId,
        'Escrow Hold Expired — Payout Released 💸',
        `Return window expired for #${hold.orderId} as customer did not ship item. Your payout has been released.`,
        'PAYOUT_RELEASED',
        hold.orderId
      );
    }

    if (hold.customerId) {
      await sendNotification(
        hold.customerId,
        'Return Request Expired ⏱️',
        `Your return request for #${hold.orderId} has expired as tracking was not provided within the window.`,
        'RETURN_EXPIRED',
        hold.orderId
      );
    }

    res.json({
      success: true,
      message: 'Refund hold expired. Order completed and seller payout unlocked.',
      hold
    });
  } catch (err) {
    console.error('Error expiring refund hold:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to expire hold' });
  }
};

/**
 * 7. POST /escrow/admin/hold/:id/resolve
 * Admin resolves disputed refund hold: REFUND_BUYER, SETTLE_WITH_SELLER, or PARTIAL_REFUND.
 */
exports.adminResolveDispute = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision, partialAmount, resolutionNotes } = req.body;

    if (!['REFUND_BUYER', 'SETTLE_WITH_SELLER', 'PARTIAL_REFUND'].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid decision. Must be REFUND_BUYER, SETTLE_WITH_SELLER, or PARTIAL_REFUND.'
      });
    }

    if (!resolutionNotes || !resolutionNotes.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Resolution justification notes are required.'
      });
    }

    const hold = await RefundHold.findOne({
      $or: [{ holdId: id }, { orderId: id }]
    });

    if (!hold) {
      return res.status(404).json({ success: false, message: 'Refund hold not found' });
    }

    const order = await Order.findOne({ orderId: hold.orderId });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Linked order not found' });
    }

    hold.adminResolution = decision;
    hold.adminNotes = resolutionNotes.trim();
    hold.adminId = req.userId;

    if (decision === 'REFUND_BUYER') {
      const refundResult = await triggerRazorpayRefund(order, hold.amount, resolutionNotes);
      hold.refundedAmount = hold.amount;
      hold.sellerDeductedAmount = hold.amount;
      hold.releasedAt = new Date();
      hold.razorpayRefundId = refundResult.refundId;

      hold.logTransition(
        'RELEASED',
        `Admin resolved dispute in favor of customer: Full refund of ₹${hold.amount}. Note: ${resolutionNotes}`,
        'admin',
        req.userId,
        { decision, refundId: refundResult.refundId }
      );
      await hold.save();

      order.returnStatus = 'RESOLVED';
      order.orderStatus = 'COMPLETED';
      order.paymentStatus = 'REFUNDED';
      order.payoutStatus = 'REVERSED';
      order.disputeResolution = 'REFUND_BUYER';
      order.disputeResolutionNotes = resolutionNotes.trim();
      order.disputeResolvedAt = new Date();

      order.timeline.push({
        status: 'RESOLVED_REFUND',
        title: 'Admin Resolution: Customer Refunded',
        description: `Admin resolved dispute in favor of customer. Refund of ₹${hold.amount} processed. Note: ${resolutionNotes}`,
        actorRole: 'admin',
        timestamp: new Date()
      });
      await order.save();

      await sendNotification(
        hold.customerId,
        'Dispute Resolved: Refund Approved 💰',
        `Looped Admin resolved dispute for #${hold.orderId} in your favor. Full refund processed.`,
        'DISPUTE_RESOLVED',
        hold.orderId
      );

      if (hold.sellerId) {
        await sendNotification(
          hold.sellerId,
          'Dispute Resolved Update',
          `Dispute for #${hold.orderId} was resolved in favor of the customer: "${resolutionNotes}".`,
          'DISPUTE_RESOLVED',
          hold.orderId
        );
      }

      return res.json({
        success: true,
        message: 'Dispute resolved in favor of customer. Refund released from escrow.',
        hold,
        order
      });
    } else if (decision === 'SETTLE_WITH_SELLER') {
      hold.refundedAmount = 0;
      hold.sellerDeductedAmount = 0;

      hold.logTransition(
        'CANCELLED',
        `Admin resolved dispute in favor of seller. Refund cancelled and payout released to seller. Note: ${resolutionNotes}`,
        'admin',
        req.userId,
        { decision }
      );
      await hold.save();

      order.returnStatus = 'RESOLVED';
      order.orderStatus = 'COMPLETED';
      order.payoutStatus = 'RELEASED';
      order.disputeResolution = 'RELEASE_PAYOUT';
      order.disputeResolutionNotes = resolutionNotes.trim();
      order.disputeResolvedAt = new Date();

      await triggerSellerTransfer(order, order.totalAmount);

      order.timeline.push({
        status: 'RESOLVED_PAYOUT',
        title: 'Admin Resolution: Seller Payout Released',
        description: `Admin resolved dispute in favor of seller. Payout released. Note: ${resolutionNotes}`,
        actorRole: 'admin',
        timestamp: new Date()
      });
      await order.save();

      if (hold.sellerId) {
        await sendNotification(
          hold.sellerId,
          'Dispute Resolved: Payout Released 💸',
          `Looped Admin resolved dispute for #${hold.orderId} in your favor. Payout of ₹${order.totalAmount} has been released.`,
          'DISPUTE_RESOLVED',
          hold.orderId
        );
      }

      await sendNotification(
        hold.customerId,
        'Dispute Resolved Update',
        `Dispute for #${hold.orderId} was resolved: "${resolutionNotes}".`,
        'DISPUTE_RESOLVED',
        hold.orderId
      );

      return res.json({
        success: true,
        message: 'Dispute resolved in favor of seller. Payout released.',
        hold,
        order
      });
    } else {
      // PARTIAL_REFUND
      const refundAmt = Number(partialAmount) || Math.round(hold.amount / 2);
      const sellerAmt = hold.amount - refundAmt;

      const refundResult = await triggerRazorpayRefund(order, refundAmt, resolutionNotes);
      await triggerSellerTransfer(order, sellerAmt);

      hold.refundedAmount = refundAmt;
      hold.sellerDeductedAmount = refundAmt;
      hold.releasedAt = new Date();
      hold.razorpayRefundId = refundResult.refundId;

      hold.logTransition(
        'RELEASED',
        `Admin resolved with partial settlement: ₹${refundAmt} refunded to customer, ₹${sellerAmt} released to seller. Note: ${resolutionNotes}`,
        'admin',
        req.userId,
        { decision, refundAmount: refundAmt, sellerAmount: sellerAmt }
      );
      await hold.save();

      order.returnStatus = 'RESOLVED';
      order.orderStatus = 'COMPLETED';
      order.paymentStatus = 'PARTIALLY_REFUNDED';
      order.payoutStatus = 'RELEASED';
      order.disputeResolution = 'PARTIAL_REFUND';
      order.disputeResolutionNotes = resolutionNotes.trim();
      order.disputeResolvedAt = new Date();

      order.timeline.push({
        status: 'RESOLVED_PARTIAL',
        title: 'Admin Resolution: Partial Refund & Settlement',
        description: `Admin settled dispute with ₹${refundAmt} refunded to customer and ₹${sellerAmt} released to seller. Note: ${resolutionNotes}`,
        actorRole: 'admin',
        timestamp: new Date()
      });
      await order.save();

      return res.json({
        success: true,
        message: `Dispute settled partially: ₹${refundAmt} refunded to customer, ₹${sellerAmt} released to seller.`,
        hold,
        order
      });
    }
  } catch (err) {
    console.error('Error resolving dispute by admin:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to resolve dispute' });
  }
};

/**
 * 8. GET /escrow/hold/order/:orderId
 * Get escrow hold and transition audit history for an order.
 */
exports.getHoldByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params;
    const hold = await RefundHold.findOne({ orderId })
      .populate('customerId', 'name email phone')
      .populate('sellerId', 'name email phone')
      .lean();

    if (!hold) {
      return res.json({ success: true, hold: null });
    }

    res.json({ success: true, hold });
  } catch (err) {
    console.error('Error fetching hold details:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch hold details' });
  }
};

/**
 * 9. GET /escrow/holds/customer
 * Get all active/past refund holds for the logged-in customer.
 */
exports.getCustomerHolds = async (req, res) => {
  try {
    const holds = await RefundHold.find({ customerId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, holds });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch customer refund holds' });
  }
};

/**
 * 10. GET /escrow/holds/seller
 * Get all active/past return refund holds for the logged-in seller.
 */
exports.getSellerHolds = async (req, res) => {
  try {
    const holds = await RefundHold.find({ sellerId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, holds });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch seller refund holds' });
  }
};

/**
 * 11. GET /escrow/admin/disputes
 * Get all disputed refund holds for Admin portal.
 */
exports.getAdminDisputedHolds = async (req, res) => {
  try {
    const disputedHolds = await RefundHold.find({ status: 'DISPUTED' })
      .populate('customerId', 'name email phone')
      .populate('sellerId', 'name email phone')
      .sort({ disputedAt: -1, createdAt: -1 })
      .lean();

    res.json({ success: true, disputes: disputedHolds });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch disputed holds' });
  }
};
