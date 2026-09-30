const mongoose = require('mongoose');

const interactionEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  sessionId: {
    type: String,
    index: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  eventType: {
    type: String,
    enum: ['swipe_right', 'swipe_left', 'view', 'dwell', 'like', 'cart_add', 'purchase'],
    required: true,
    index: true
  },
  dwellTimeMs: {
    type: Number,
    default: 0
  },
  page: {
    type: String,
    default: 'feed'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

interactionEventSchema.index({ userId: 1, eventType: 1, createdAt: -1 });
interactionEventSchema.index({ productId: 1, eventType: 1 });

module.exports = mongoose.model('InteractionEvent', interactionEventSchema);
