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
  uploadedItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  soldItems: { type: Number, default: 0 },
  sustainabilityStats: {
    totalCo2SavedKg:       { type: Number, default: 0 },
    totalWaterSavedLitres: { type: Number, default: 0 },
    totalItemsCirculated:  { type: Number, default: 0 },
    sustainabilityScore:   { type: Number, default: 0 },  // 0-100
    tier: { type: String, default: 'Seedling' } // Seedling → Sprout → Leaf → Tree → Forest Guardian
  }
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);
