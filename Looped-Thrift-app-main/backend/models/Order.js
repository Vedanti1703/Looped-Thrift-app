const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  title: { type: String, default: '' },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 1 },
  image: { type: String, default: '' },
  condition: { type: String, default: '' },
  size: { type: String, default: '' },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sellerName: { type: String, default: 'Seller' },
}, { _id: false });

const timelineEventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  actorRole: { type: String, enum: ['system', 'buyer', 'seller', 'admin'], default: 'system' },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Alias for buyerId
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  buyerName: { type: String, default: '' },
  buyerEmail: { type: String, default: '' },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sellerName: { type: String, default: 'Seller' },

  name: { type: String, required: true }, // Recipient name
  phone: { type: String, required: true },
  productName: { type: String, default: '' }, // Retained for backwards compatibility with WhatsApp bot
  items: [orderItemSchema],                  // Multi-item cart support for web app
  size: { type: String, default: '' },
  color: { type: String, default: '' },
  quantity: { type: Number, default: 1 },

  address: { type: String, required: true },
  city: { type: String, default: '' },
  state: { type: String, default: '' },
  pincode: { type: String, default: '' },

  totalAmount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },

  // Razorpay Gateway Identifiers
  razorpayOrderId: { type: String, default: '' },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '' },
  razorpayTransferId: { type: String, default: '' },
  razorpayRefundId: { type: String, default: '' },

  // State Management Enums
  paymentStatus: {
    type: String,
    enum: [
      'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED',
      'pending', 'paid', 'failed', 'refunded'
    ],
    default: 'PAID'
  },
  orderStatus: {
    type: String,
    enum: [
      'PROCESSING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'COMPLETED',
      'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED',
      'RETURN_SHIPPED', 'RETURN_DELIVERED', 'DISPUTED', 'CANCELLED',
      'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'
    ],
    default: 'CONFIRMED'
  },
  // status is synced with orderStatus for backwards compatibility
  status: {
    type: String,
    default: 'CONFIRMED'
  },
  payoutStatus: {
    type: String,
    enum: ['ON_HOLD', 'ELIGIBLE_FOR_RELEASE', 'RELEASED', 'REVERSED', 'FAILED'],
    default: 'ON_HOLD'
  },
  returnStatus: {
    type: String,
    enum: [
      'NONE', 'REQUESTED', 'APPROVED', 'REJECTED',
      'SHIPPED', 'DELIVERED', 'CONFIRMED', 'DISPUTED', 'RESOLVED'
    ],
    default: 'NONE'
  },

  // Outbound Shipping Information
  carrier: { type: String, default: '' },
  trackingNumber: { type: String, default: '' },
  estimatedDelivery: { type: String, default: '3-5 business days' },

  // Return Process Information
  returnReason: { type: String, default: '' },
  returnDescription: { type: String, default: '' },
  returnEvidencePhotos: [{ type: String }],
  returnCarrier: { type: String, default: '' },
  returnTrackingNumber: { type: String, default: '' },
  returnRejectionReason: { type: String, default: '' },
  returnProblemReason: { type: String, default: '' },
  returnProblemDescription: { type: String, default: '' },
  returnProblemPhotos: [{ type: String }],

  // Dispute & Resolution Information
  disputeReason: { type: String, default: '' },
  disputeOpenedAt: { type: Date },
  disputeResolvedAt: { type: Date },
  disputeResolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  disputeResolution: { type: String, enum: ['', 'REFUND_BUYER', 'RELEASE_PAYOUT'], default: '' },
  disputeResolutionNotes: { type: String, default: '' },

  // Return Window Policy
  returnWindowDays: { type: Number, default: 7 },
  returnWindowExpiresAt: { type: Date },

  // Timestamps for each lifecycle milestone
  paidAt: { type: Date, default: Date.now },
  shippedAt: { type: Date },
  deliveredAt: { type: Date },
  buyerConfirmedAt: { type: Date },
  completedAt: { type: Date },
  returnRequestedAt: { type: Date },
  returnApprovedAt: { type: Date },
  returnRejectedAt: { type: Date },
  returnShippedAt: { type: Date },
  returnDeliveredAt: { type: Date },
  refundInitiatedAt: { type: Date },
  payoutReleasedAt: { type: Date },

  // Audit timeline events
  timeline: [timelineEventSchema]
}, { timestamps: true });

// Pre-save hook to ensure status and orderStatus stay in sync
orderSchema.pre('save', function (next) {
  if (this.isModified('orderStatus')) {
    this.status = this.orderStatus;
  } else if (this.isModified('status')) {
    this.orderStatus = this.status;
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
