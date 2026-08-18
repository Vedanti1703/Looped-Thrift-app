const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, default: 'Anonymous' },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Review', reviewSchema);
