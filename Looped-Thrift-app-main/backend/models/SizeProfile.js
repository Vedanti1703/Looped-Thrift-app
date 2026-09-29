const mongoose = require('mongoose');

const sizeProfileSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  gender: { type: String, enum: ['women', 'men', 'unisex'], default: 'unisex' },
  measurements: {
    chest: { type: Number },     // cm
    waist: { type: Number },     // cm
    hips: { type: Number },      // cm
    height: { type: Number },    // cm
    weight: { type: Number },    // kg
    shoulder: { type: Number },  // cm
    inseam: { type: Number },    // cm (bottoms)
    footLength: { type: Number } // cm (shoes)
  },
  preferredFit: {
    type: String,
    enum: ['slim', 'regular', 'relaxed', 'oversized'],
    default: 'regular'
  }
}, { timestamps: true });

module.exports = mongoose.model('SizeProfile', sizeProfileSchema);
