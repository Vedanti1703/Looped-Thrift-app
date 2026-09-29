/**
 * seedDemoSeller.js
 * Creates or reuses a demo seller user (email: demo.seller@looped.app)
 * and updates every product in MongoDB lacking a sellerId to use this demo seller.
 * Idempotent: can be safely executed multiple times.
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const User = require('../models/User');
const Product = require('../models/Product');

const DEMO_SELLER_EMAIL = 'demo.seller@looped.app';
const DEMO_SELLER_PASSWORD = 'password123';
const DEMO_SELLER_NAME = 'Looped Studio Vintage';

async function seedDemoSeller() {
  console.log('🌱 Starting Demo Seller Seed Script...');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // 1. Find or create demo seller user
  let demoSeller = await User.findOne({ email: DEMO_SELLER_EMAIL });

  if (!demoSeller) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(DEMO_SELLER_PASSWORD, salt);

    demoSeller = new User({
      email: DEMO_SELLER_EMAIL,
      password: hashedPassword,
      name: DEMO_SELLER_NAME,
      isVerified: true,
      role: 'user',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      sustainabilityStats: {
        totalCo2SavedKg: 42,
        totalWaterSavedLitres: 12000,
        totalItemsCirculated: 18,
        sustainabilityScore: 85,
        tier: 'Tree'
      }
    });

    await demoSeller.save();
    console.log(`✨ Created new demo seller user: ${DEMO_SELLER_EMAIL} (ID: ${demoSeller._id})`);
  } else {
    console.log(`ℹ️ Reusing existing demo seller user: ${DEMO_SELLER_EMAIL} (ID: ${demoSeller._id})`);
  }

  // 2. Set sellerId and sellerName on every Product that lacks sellerId
  const filter = {
    $or: [
      { sellerId: { $exists: false } },
      { sellerId: null }
    ]
  };

  const countMissing = await Product.countDocuments(filter);
  console.log(`🔍 Found ${countMissing} products without sellerId.`);

  if (countMissing > 0) {
    const updateResult = await Product.updateMany(
      filter,
      {
        $set: {
          sellerId: demoSeller._id,
          sellerName: DEMO_SELLER_NAME
        }
      }
    );
    console.log(`✅ Updated ${updateResult.modifiedCount} products with demo seller info.`);
  } else {
    console.log('👍 All products already have a sellerId assigned.');
  }

  const totalProducts = await Product.countDocuments();
  const totalWithSeller = await Product.countDocuments({ sellerId: { $exists: true, $ne: null } });
  console.log(`📊 Products with sellerId: ${totalWithSeller}/${totalProducts}`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB. Demo seller seed complete!');
}

if (require.main === module) {
  seedDemoSeller().catch(err => {
    console.error('❌ seedDemoSeller error:', err);
    process.exit(1);
  });
}

module.exports = seedDemoSeller;
