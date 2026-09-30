const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  name: { type: String, default: '' },
  phone: { type: String, unique: true, sparse: true },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  razorpayAccountId: { type: String, default: '' }, // Razorpay Route linked account ID for seller transfers
  otp: { type: String },
  otpExpiry: { type: Date },
  isVerified: { type: Boolean, default: false },
  likedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  likedTags: [{ type: String }], // aggregated tags from liked items for recommendations
  dislikedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  dislikedTags: [{ type: String }], // aggregated tags from disliked items for filtering/demotions
  swipedRight: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  swipedLeft: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  tasteVector: [{ type: Number }], // 1536-dimensional composite taste vector
  tasteVectorUpdatedAt: { type: Date },
  interactionStats: {
    likesCount: { type: Number, default: 0 },
    dislikesCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    dwellTimeTotalMs: { type: Number, default: 0 },
    cartAddsCount: { type: Number, default: 0 }
  },
  uploadedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  soldItems: { type: Number, default: 0 },
  sellerRisk: {
    riskScore: { type: Number, default: 20 },
    riskTier: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
    disputeRate: { type: Number, default: 0 },
    cancellationRate: { type: Number, default: 0 },
    problemReturnRate: { type: Number, default: 0 },
    escrowDays: { type: Number, default: 7 },
    payoutHoldPolicy: { type: String, default: 'EXPEDITED_HOLD_7D' },
    requireManualRelease: { type: Boolean, default: false },
    policyReason: { type: String, default: '' },
    lastEvaluatedAt: { type: Date }
  },
  sustainabilityStats: {
    totalCo2SavedKg:       { type: Number, default: 0 },
    totalWaterSavedLitres: { type: Number, default: 0 },
    totalItemsCirculated:  { type: Number, default: 0 },
    sustainabilityScore:   { type: Number, default: 0 },  // 0-100
    tier: { type: String, default: 'Seedling' } // Seedling → Sprout → Leaf → Tree → Forest Guardian
  }
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);
