const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'PAYMENT_SUCCESS', 'ORDER_SHIPPED', 'ORDER_DELIVERED',
      'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED',
      'RETURN_SHIPPED', 'RETURN_DELIVERED', 'REFUND_PROCESSED',
      'PAYOUT_RELEASED', 'DISPUTE_OPENED', 'DISPUTE_RESOLVED',
      'RETURN_HOLD_PENDING', 'RETURN_IN_TRANSIT', 'SELLER_ACTION_REQUIRED',
      'REFUND_RELEASED', 'RETURN_SETTLED', 'RETURN_EXPIRED', 'GENERAL'
    ],
    default: 'GENERAL'
  },
  orderId: { type: String, default: '' },
  read: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
