/**
 * test_recommendation_2users.js
 * Automated Test Suite verifying AI Recommendation System for 2 distinct users
 * based on Right Swipes (Likes) and Left Swipes (Dislikes).
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
const { swipeItem } = require('../controllers/userController');
const { getProducts } = require('../controllers/productController');

// Mock Express response object for direct controller testing
function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.data = data;
      return this;
    }
  };
}

async function runRecommendationTest() {
  console.log('🤖 Starting AI Recommendation Test Suite for 2 Users...\n');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // 1. Prepare 2 Test Users
  const user1Email = 'test.user1.streetwear@looped.app';
  const user2Email = 'test.user2.ethnic@looped.app';
  const passwordHash = await bcrypt.hash('password123', 10);

  let user1 = await User.findOne({ email: user1Email });
  if (!user1) {
    user1 = await User.create({
      email: user1Email,
      password: passwordHash,
      name: 'Alex (Streetwear & Y2K Fan)',
      likedItems: [],
      likedTags: [],
      dislikedItems: [],
      dislikedTags: [],
      swipedRight: [],
      swipedLeft: []
    });
  } else {
    // Reset preferences for clean test run
    user1.likedItems = [];
    user1.likedTags = [];
    user1.dislikedItems = [];
    user1.dislikedTags = [];
    user1.swipedRight = [];
    user1.swipedLeft = [];
    await user1.save();
  }

  let user2 = await User.findOne({ email: user2Email });
  if (!user2) {
    user2 = await User.create({
      email: user2Email,
      password: passwordHash,
      name: 'Priya (Ethnic & Saree Fan)',
      likedItems: [],
      likedTags: [],
      dislikedItems: [],
      dislikedTags: [],
      swipedRight: [],
      swipedLeft: []
    });
  } else {
    // Reset preferences for clean test run
    user2.likedItems = [];
    user2.likedTags = [];
    user2.dislikedItems = [];
    user2.dislikedTags = [];
    user2.swipedRight = [];
    user2.swipedLeft = [];
    await user2.save();
  }

  console.log(`👤 User 1 Created/Reset: ${user1.name} (ID: ${user1._id})`);
  console.log(`👤 User 2 Created/Reset: ${user2.name} (ID: ${user2._id})\n`);

  // 2. Fetch products to swipe on
  const allProducts = await Product.find({}).lean();
  console.log(`📦 Catalog loaded: ${allProducts.length} seed products available.\n`);

  const streetwearProducts = allProducts.filter(p => p.tags.some(t => ['streetwear', 'y2k', 'hoodie', 'joggers', 'crop-top'].includes(t)));
  const ethnicProducts = allProducts.filter(p => p.tags.some(t => ['ethnic', 'saree', 'lehenga', 'choli', 'traditional'].includes(t)));

  console.log(`🏷️ Found ${streetwearProducts.length} Streetwear/Y2K seed products.`);
  console.log(`🏷️ Found ${ethnicProducts.length} Ethnic/Saree seed products.\n`);

  // 3. User 1 Swiping Behavior:
  // User 1 Swipes RIGHT (Likes) on Streetwear, Swipes LEFT (Dislikes) on Ethnic
  console.log('--- ⚡ Simulating User 1 (Alex) Swipes ---');
  for (const prod of streetwearProducts.slice(0, 3)) {
    const req = { body: { userId: user1._id.toString(), productId: prod._id.toString(), action: 'right' } };
    const res = createMockRes();
    await swipeItem(req, res);
    console.log(`  👉 Swiped RIGHT on: "${prod.title}" (${prod.tags.slice(0, 3).join(', ')})`);
  }
  for (const prod of ethnicProducts.slice(0, 2)) {
    const req = { body: { userId: user1._id.toString(), productId: prod._id.toString(), action: 'left' } };
    const res = createMockRes();
    await swipeItem(req, res);
    console.log(`  👈 Swiped LEFT on: "${prod.title}" (${prod.tags.slice(0, 3).join(', ')})`);
  }

  // 4. User 2 Swiping Behavior:
  // User 2 Swipes RIGHT (Likes) on Ethnic, Swipes LEFT (Dislikes) on Streetwear
  console.log('\n--- ⚡ Simulating User 2 (Priya) Swipes ---');
  for (const prod of ethnicProducts.slice(0, 3)) {
    const req = { body: { userId: user2._id.toString(), productId: prod._id.toString(), action: 'right' } };
    const res = createMockRes();
    await swipeItem(req, res);
    console.log(`  👉 Swiped RIGHT on: "${prod.title}" (${prod.tags.slice(0, 3).join(', ')})`);
  }
  for (const prod of streetwearProducts.slice(0, 2)) {
    const req = { body: { userId: user2._id.toString(), productId: prod._id.toString(), action: 'left' } };
    const res = createMockRes();
    await swipeItem(req, res);
    console.log(`  👈 Swiped LEFT on: "${prod.title}" (${prod.tags.slice(0, 3).join(', ')})`);
  }

  // 5. Generate AI Personalized Feed for User 1
  console.log('\n========================================');
  console.log(`🎯 AI Personalised Home Feed for User 1: ${user1.name}`);
  console.log('========================================');
  const req1 = { query: { userId: user1._id.toString() } };
  const res1 = createMockRes();
  await getProducts(req1, res1);
  const feed1 = res1.data || [];

  console.log(`Top 5 AI Recommended Items for ${user1.name}:`);
  feed1.slice(0, 5).forEach((p, idx) => {
    console.log(`  ${idx + 1}. [Score: ${p.matchScore}] ${p.title} | Tags: ${p.tags.join(', ')}`);
  });

  // 6. Generate AI Personalized Feed for User 2
  console.log('\n========================================');
  console.log(`🎯 AI Personalised Home Feed for User 2: ${user2.name}`);
  console.log('========================================');
  const req2 = { query: { userId: user2._id.toString() } };
  const res2 = createMockRes();
  await getProducts(req2, res2);
  const feed2 = res2.data || [];

  console.log(`Top 5 AI Recommended Items for ${user2.name}:`);
  feed2.slice(0, 5).forEach((p, idx) => {
    console.log(`  ${idx + 1}. [Score: ${p.matchScore}] ${p.title} | Tags: ${p.tags.join(', ')}`);
  });

  // 7. Verification Assertions
  console.log('\n========================================');
  console.log('🧪 Verification Analysis');
  console.log('========================================');

  const u1TopTags = feed1.slice(0, 3).flatMap(p => p.tags);
  const u2TopTags = feed2.slice(0, 3).flatMap(p => p.tags);

  const u1HasStreetwear = u1TopTags.some(t => ['streetwear', 'y2k', 'hoodie', 'flannel', 'joggers'].includes(t));
  const u2HasEthnic = u2TopTags.some(t => ['ethnic', 'saree', 'lehenga', 'choli', 'traditional'].includes(t));

  if (u1HasStreetwear && u2HasEthnic) {
    console.log('✅ PASS: AI Recommendation successfully personalized feeds!');
    console.log(`   - User 1's top feed correctly prioritises Streetwear/Y2K style.`);
    console.log(`   - User 2's top feed correctly prioritises Ethnic/Saree style.`);
  } else {
    console.warn('⚠️ WARNING: Personalization check did not match expected tags.');
  }

  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from MongoDB. Test complete!');
}

if (require.main === module) {
  runRecommendationTest().catch(err => {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  });
}

module.exports = runRecommendationTest;
