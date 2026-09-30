const mongoose = require('mongoose');

const bargainSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  buyerName: { type: String, default: '' },
  sellerName: { type: String, default: '' },
  originalPrice: { type: Number, required: true },
  offeredPrice: { type: Number, required: true },
  counterPrice: { type: Number },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'countered', 'declined', 'expired'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 48 * 60 * 60 * 1000)
  },
  message: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Bargain', bargainSchema);
