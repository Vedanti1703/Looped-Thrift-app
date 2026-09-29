const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  bidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bidderName: { type: String, default: 'Bidder' },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  isWinning: { type: Boolean, default: false }
}, { _id: true });

const proofDocSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['bill', 'certificate', 'serial_tag', 'dustbag_box', 'other'],
    required: true
  },
  url: { type: String, required: true },
  originalName: { type: String, default: '' }
}, { _id: true });

const auctionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, default: 'Seller' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  brand: { type: String, required: true },
  category: {
    type: String,
    enum: [
      'Designer Wear',
      'Bridal & Couture',
      'Luxury Bags',
      'Designer Footwear',
      'Watches',
      'Fine Jewelry',
      'Designer Outerwear'
    ],
    required: true
  },
  condition: {
    type: String,
    enum: ['New with tags', 'Like New', 'Good', 'Fair', 'Well Loved'],
    required: true
  },
  size: { type: String, default: '' },
  purchaseYear: { type: String, default: '' },
  declaredValue: { type: Number, required: true }, // Must be >= 5000 INR for luxury drop

  image: { type: String, required: true }, // Main display image
  images: [{ type: String }], // Array of 3-8 gallery images

  proofDocs: [proofDocSchema], // Confidential proof documents (bills, authenticity tags)

  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verificationNote: { type: String, default: '' },
  verifiedAt: { type: Date },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  aiFraudHint: { type: mongoose.Schema.Types.Mixed },

  startingPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  reservePrice: { type: Number, default: 0 },
  incrementAmount: { type: Number, default: 250 },
  startTime: { type: Date, required: true },
  endTime: { type: Date, required: true },
  status: {
    type: String,
    enum: ['upcoming', 'live', 'ending', 'closed', 'settled', 'cancelled'],
    default: 'upcoming'
  },
  bids: [bidSchema],
  winnerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  winnerName: { type: String, default: '' },
  winnerBid: { type: Number },
  totalBidders: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 }
}, { timestamps: true, versionKey: '__v' });

module.exports = mongoose.model('Auction', auctionSchema);
