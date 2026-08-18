const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true },
  originalPrice: { type: Number },
  condition: {
    type: String,
    enum: ['New with tags', 'Like New', 'Good', 'Fair', 'Well Loved'],
    required: true
  },
  category: { type: String, required: true },
  // tags drive all recommendations — e.g. ["japan", "winter", "streetwear"]
  tags: [{ type: String }],
  image: { type: String, required: true },
  images: [{ type: String }],
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sellerName: { type: String, default: 'Anonymous' },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  size: { type: String, default: '' },
  brand: { type: String, default: '' },
  avgRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  listingType: { type: String, enum: ['sell', 'rent', 'both'], default: 'sell' },
  rentPricePerDay: { type: Number },
  securityDeposit: { type: Number },
  rentAvailable: { type: Boolean, default: true },
  conditionImages: [{ type: String }],
  conditionNotes: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
