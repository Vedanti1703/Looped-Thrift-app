const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  bidderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  bidderName: { type: String, default: 'Bidder' },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  isWinning: { type: Boolean, default: false }
}, { _id: true });

const auctionSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, default: 'Seller' },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  image: { type: String, required: true },
  startingPrice: { type: Number, required: true },
  currentPrice: { type: Number, required: true },
  reservePrice: { type: Number, default: 0 },
  incrementAmount: { type: Number, default: 50 },
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
