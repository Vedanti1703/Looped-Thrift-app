const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  productIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  coverImage: { type: String, default: '' },
}, { timestamps: true });

// Provide virtual 'items' that aliases 'productIds' for maximum frontend compatibility
collectionSchema.virtual('items', {
  ref: 'Product',
  localField: 'productIds',
  foreignField: '_id',
});

collectionSchema.set('toJSON', { virtuals: true });
collectionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Collection', collectionSchema);
