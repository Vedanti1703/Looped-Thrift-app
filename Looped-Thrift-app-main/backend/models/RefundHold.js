const mongoose = require('mongoose');

const statusTransitionSchema = new mongoose.Schema({
  fromStatus: { type: String, required: true },
  toStatus: { type: String, required: true },
  reason: { type: String, default: '' },
  actorRole: { type: String, enum: ['system', 'customer', 'seller', 'admin', 'courier'], required: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const refundHoldSchema = new mongoose.Schema({
  holdId: { type: String, required: true, unique: true },
  orderId: { type: String, required: true },
  orderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  totalOrderAmount: { type: Number, required: true },
  amount: { type: Number, required: true }, // Amount held in escrow
  refundedAmount: { type: Number, default: 0 }, // Amount disbursed back to customer
  sellerDeductedAmount: { type: Number, default: 0 }, // Amount deducted from seller payout balance

  status: {
    type: String,
    enum: [
      'PENDING',                          // Hold placed, waiting for customer to ship return
      'IN_TRANSIT',                       // Customer dispatched courier, tracking recorded
      'DELIVERED_PENDING_CONFIRMATION',   // Return package physically reached seller location
      'RELEASED',                         // Seller confirmed receipt (or admin approved) -> refund issued
      'DISPUTED',                         // Seller reported damaged/wrong item -> hold locked for admin
      'EXPIRED',                          // Customer never shipped item in window -> hold cancelled, payout restored
      'CANCELLED'                         // Customer or admin cancelled return
    ],
    default: 'PENDING'
  },

  // Return shipment info
  returnReason: { type: String, default: '' },
  returnDescription: { type: String, default: '' },
  returnEvidencePhotos: [{ type: String }],
  returnCarrier: { type: String, default: '' },
  returnTrackingNumber: { type: String, default: '' },

  // Seller dispute info
  sellerDisputeReason: { type: String, default: '' },
  sellerDisputeDescription: { type: String, default: '' },
  sellerDisputePhotos: [{ type: String }],

  // Admin arbitration info
  adminResolution: {
    type: String,
    enum: ['', 'REFUND_BUYER', 'SETTLE_WITH_SELLER', 'PARTIAL_REFUND'],
    default: ''
  },
  adminNotes: { type: String, default: '' },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // Razorpay Gateway Identifiers
  razorpayPaymentId: { type: String, default: '' },
  razorpayRefundId: { type: String, default: '' },
  razorpayTransferId: { type: String, default: '' },

  // Milestones and Timers
  expiresAt: { type: Date }, // Deadline for customer to ship return before hold auto-expires
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  releasedAt: { type: Date },
  disputedAt: { type: Date },

  // Immutable audit trail of state transitions
  transitions: [statusTransitionSchema]
}, { timestamps: true });

// Helper to log state transitions
refundHoldSchema.methods.logTransition = function (toStatus, reason, actorRole, actorId, metadata = {}) {
  const fromStatus = this.status;
  this.status = toStatus;
  this.transitions.push({
    fromStatus,
    toStatus,
    reason: reason || `Transitioned from ${fromStatus} to ${toStatus}`,
    actorRole,
    actorId: actorId || null,
    metadata,
    timestamp: new Date()
  });
};

module.exports = mongoose.model('RefundHold', refundHoldSchema);
