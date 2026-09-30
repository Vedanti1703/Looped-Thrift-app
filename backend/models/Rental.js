const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productTitle: { type: String, default: '' },
  productImage: { type: String, default: '' },
  renterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  renterName: { type: String, default: 'Anonymous' },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sellerName: { type: String, default: 'Anonymous' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  totalAmount: { type: Number, default: 0 },
  rentPricePerDay: { type: Number, default: 0 },
  securityDeposit: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['requested', 'approved', 'active', 'return_requested', 'returned', 'disputed', 'cancelled'],
    default: 'requested'
  },
  conditionImagesAfter: [{ type: String }],
  conditionNotesAfter: { type: String, default: '' },
  disputeReason: { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Rental', rentalSchema);
