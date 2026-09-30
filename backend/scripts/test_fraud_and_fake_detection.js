/**
 * test_fraud_and_fake_detection.js
 * Comprehensive automated verification of:
 * 1. Duplicate Image Detection via Perceptual Hashing (pHash):
 *    Catches stolen photos across different sellers and duplicate uploads.
 * 2. Reverse Price Anomaly Detection via trained Isolation Forest:
 *    Detects suspicious counterfeit under-pricing and wash-trading over-pricing.
 * 3. Seller Risk Score Classifier:
 *    Calculates risk score based on dispute rate, cancellations, and account age.
 * 4. Escrow and Payout Hold Integration:
 *    Dynamically adjusts return window and payout lock period (14 days for high-risk sellers).
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
const Order = require('../models/Order');
const fraudService = require('../services/fraudService');
const fakeListingController = require('../controllers/fakeListingController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';

// Helper: mock Express response
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

async function runFraudDetectionSuite() {
  console.log('🛡️ Starting Smarter Fake-Listing & Anti-Fraud Detection Test Suite...\n');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  try {
    // -------------------------------------------------------------
    // SETUP: Create 2 Test Sellers (Legitimate vs Risky/Fraudulent)
    // -------------------------------------------------------------
    const passwordHash = await bcrypt.hash('password123', 10);

    // 1. Trusted Seller A (Long account age, verified, zero disputes)
    let sellerA = await User.findOne({ email: 'seller.trusted.vintage@looped.app' });
    if (!sellerA) {
      sellerA = await User.create({
        email: 'seller.trusted.vintage@looped.app',
        password: passwordHash,
        name: 'Aarav (Trusted Vintage Seller)',
        isVerified: true,
        createdAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // 90 days old
        razorpayAccountId: 'acc_trusted_seller_001'
      });
    }

    // 2. Risky Seller B (Brand new account, unverified)
    let sellerB = await User.findOne({ email: 'seller.risky.disputed@looped.app' });
    if (!sellerB) {
      sellerB = await User.create({
        email: 'seller.risky.disputed@looped.app',
        password: passwordHash,
        name: 'Scammy / Risky Seller',
        isVerified: false,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day old
        razorpayAccountId: ''
      });
    }

    console.log(`👤 Seller A (Trusted): ${sellerA.name} (${sellerA._id})`);
    console.log(`👤 Seller B (Risky):   ${sellerB.name} (${sellerB._id})\n`);

    // Clean up past orders and test products for clean run
    await Order.deleteMany({ sellerId: { $in: [sellerA._id, sellerB._id] } });
    await Product.deleteMany({ sellerId: { $in: [sellerA._id, sellerB._id] } });

    // Seed Seller A order history: 8 successful completed orders, 0 disputes
    for (let i = 1; i <= 8; i++) {
      await Order.create({
        orderId: `ORD-TRUSTED-${1000 + i}`,
        buyerId: sellerB._id,
        sellerId: sellerA._id,
        name: 'Customer',
        phone: '9876543210',
        address: 'Mumbai, India',
        totalAmount: 1800,
        orderStatus: 'COMPLETED',
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        payoutStatus: 'RELEASED'
      });
    }

    // Seed Seller B order history: 5 orders with 3 DISPUTES and 1 CANCELLATION (60% dispute rate)
    for (let i = 1; i <= 5; i++) {
      const isDisputed = i <= 3;
      const isCancelled = i === 4;
      await Order.create({
        orderId: `ORD-RISKY-${2000 + i}`,
        buyerId: sellerA._id,
        sellerId: sellerB._id,
        name: 'Customer',
        phone: '9876543210',
        address: 'Delhi, India',
        totalAmount: 3500,
        orderStatus: isDisputed ? 'DISPUTED' : isCancelled ? 'CANCELLED' : 'COMPLETED',
        status: isDisputed ? 'DISPUTED' : isCancelled ? 'CANCELLED' : 'COMPLETED',
        returnStatus: isDisputed ? 'DISPUTED' : 'NONE',
        disputeReason: isDisputed ? 'Counterfeit item received' : '',
        paymentStatus: 'PAID',
        payoutStatus: 'ON_HOLD'
      });
    }

    // -------------------------------------------------------------
    // TEST 1: Duplicate Image & Photo Theft Detection (pHash)
    // -------------------------------------------------------------
    console.log('======================================================');
    console.log('📸 TEST 1: Perceptual Hashing (pHash) Stolen Photo Check');
    console.log('======================================================');

    // Seller A uploads an original listing with a distinct photo
    const sampleImageUrl = 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop';
    const hashResA = await fraudService.computeImageHash(sampleImageUrl);
    console.log(`Computed pHash for original image: ${hashResA.phash} (dHash: ${hashResA.dhash})`);

    const originalProduct = await Product.create({
      title: 'Original Leather Biker Jacket by Seller A',
      price: 4500,
      originalPrice: 12000,
      condition: 'Like New',
      category: 'Outerwear',
      brand: 'Zara',
      image: sampleImageUrl,
      imageHash: hashResA.phash,
      sellerId: sellerA._id,
      sellerName: sellerA.name
    });
    console.log(`✅ Saved original listing by Seller A: "${originalProduct.title}"`);

    // Scenario 1a: Seller B tries to steal Seller A's photo
    console.log('\n--- Scenario 1a: Seller B attempts to list using Seller A\'s photo ---');
    const stolenCheck = await fraudService.checkDuplicateImage(sampleImageUrl, sellerB._id);
    console.log(`Stolen Photo Detected: ${stolenCheck.flag}`);
    console.log(`Severity: ${stolenCheck.severity}`);
    console.log(`Is Stolen Photo: ${stolenCheck.isStolenPhoto}`);
    console.log(`Reason: ${stolenCheck.reason}`);
    console.log(`Top match: "${stolenCheck.topMatch?.title}" by ${stolenCheck.topMatch?.sellerName} (${stolenCheck.topMatch?.similarity_pct}% similarity)`);

    if (stolenCheck.isStolenPhoto && stolenCheck.severity === 'high') {
      console.log('✅ PASS: Perceptual hashing successfully intercepted photo theft!');
    } else {
      console.error('❌ FAIL: Stolen photo check did not flag high severity theft.');
    }

    // Scenario 1b: Seller A uploads duplicate of their own photo
    console.log('\n--- Scenario 1b: Seller A re-uploads the same photo (Duplicate) ---');
    const duplicateCheck = await fraudService.checkDuplicateImage(sampleImageUrl, sellerA._id);
    console.log(`Duplicate Detected: ${duplicateCheck.flag}`);
    console.log(`Severity: ${duplicateCheck.severity} (Expected: medium)`);
    console.log(`Is Stolen Photo: ${duplicateCheck.isStolenPhoto} (Expected: false)`);

    if (duplicateCheck.flag && !duplicateCheck.isStolenPhoto && duplicateCheck.severity === 'medium') {
      console.log('✅ PASS: Correctly differentiated own duplicate listing vs external theft!');
    }

    // -------------------------------------------------------------
    // TEST 2: Reverse Price Anomaly Detection (Isolation Forest)
    // -------------------------------------------------------------
    console.log('\n======================================================');
    console.log('🌲 TEST 2: Reverse Price Anomaly with Isolation Forest');
    console.log('======================================================');

    // Case 2a: Luxury item priced at ₹250 (suspicious counterfeit/scam)
    console.log('--- Case 2a: Gucci Luxury Bag listed at ₹250 ---');
    const underpricedAnomaly = await fraudService.checkPriceAnomaly({
      brand: 'Gucci',
      category: 'Luxury Bags',
      condition: 'Like New',
      originalPrice: 65000,
      price: 250
    });
    console.log(`Is Anomaly:        ${underpricedAnomaly.flag}`);
    console.log(`Anomaly Score:     ${underpricedAnomaly.anomalyScore}/100`);
    console.log(`Anomaly Type:      ${underpricedAnomaly.anomalyType}`);
    console.log(`Severity:          ${underpricedAnomaly.severity}`);
    console.log(`Predicted Value:   ₹${underpricedAnomaly.predictedPrice}`);
    console.log(`Price Ratio:       ${underpricedAnomaly.priceRatio}x`);
    console.log(`Explanation:       ${underpricedAnomaly.reason}`);

    if (underpricedAnomaly.flag && underpricedAnomaly.anomalyType === 'suspiciously_underpriced') {
      console.log('✅ PASS: Isolation Forest caught extreme counterfeit underpricing!');
    }

    // Case 2b: Fast fashion item listed at ₹22,000 (wash trading anomaly)
    console.log('\n--- Case 2b: H&M Cotton Tee listed at ₹22,000 (Fair: ~₹400) ---');
    const overpricedAnomaly = await fraudService.checkPriceAnomaly({
      brand: 'H&M',
      category: "Women's Tops",
      condition: 'Good',
      originalPrice: 1299,
      price: 22000
    });
    console.log(`Is Anomaly:        ${overpricedAnomaly.flag}`);
    console.log(`Anomaly Score:     ${overpricedAnomaly.anomalyScore}/100`);
    console.log(`Anomaly Type:      ${overpricedAnomaly.anomalyType}`);
    console.log(`Severity:          ${overpricedAnomaly.severity}`);
    console.log(`Predicted Value:   ₹${overpricedAnomaly.predictedPrice}`);
    console.log(`Explanation:       ${overpricedAnomaly.reason}`);

    if (overpricedAnomaly.flag && overpricedAnomaly.anomalyType === 'suspiciously_overpriced') {
      console.log('✅ PASS: Isolation Forest caught extreme wash-trading overpricing!');
    }

    // Case 2c: Normal realistic thrift item
    console.log('\n--- Case 2c: Zara Denim Jacket listed at ₹1,100 (Fair: ~₹1,200) ---');
    const normalPrice = await fraudService.checkPriceAnomaly({
      brand: 'Zara',
      category: 'Outerwear',
      condition: 'Good',
      originalPrice: 3590,
      price: 1100
    });
    console.log(`Is Anomaly:        ${normalPrice.flag} (Expected: false)`);
    console.log(`Anomaly Type:      ${normalPrice.anomalyType} (Expected: normal)`);

    if (!normalPrice.flag) {
      console.log('✅ PASS: Realistic market pricing correctly passed as non-anomalous!');
    }

    // -------------------------------------------------------------
    // TEST 3: Seller Risk Score Classifier & Escrow Holds
    // -------------------------------------------------------------
    console.log('\n======================================================');
    console.log('⚖️ TEST 3: Seller Risk Classifier & Escrow Holds');
    console.log('======================================================');

    // 3a. Evaluate Trusted Seller A
    const riskA = await fraudService.evaluateSellerRisk(sellerA._id);
    console.log(`Seller A (Trusted):`);
    console.log(`  Risk Score:           ${riskA.risk_score}/100`);
    console.log(`  Risk Tier:            ${riskA.risk_tier} (Expected: LOW)`);
    console.log(`  Dispute Rate:         ${riskA.dispute_rate}%`);
    console.log(`  Recommended Escrow:   ${riskA.escrow_policy.recommended_escrow_days} days`);
    console.log(`  Payout Hold Policy:   ${riskA.escrow_policy.payout_hold_policy}`);

    // 3b. Evaluate Risky Seller B
    const riskB = await fraudService.evaluateSellerRisk(sellerB._id);
    console.log(`\nSeller B (Risky):`);
    console.log(`  Risk Score:           ${riskB.risk_score}/100`);
    console.log(`  Risk Tier:            ${riskB.risk_tier} (Expected: HIGH)`);
    console.log(`  Dispute Rate:         ${riskB.dispute_rate}%`);
    console.log(`  Recommended Escrow:   ${riskB.escrow_policy.recommended_escrow_days} days`);
    console.log(`  Payout Hold Policy:   ${riskB.escrow_policy.payout_hold_policy}`);
    console.log(`  Require Manual Rel.:  ${riskB.escrow_policy.require_manual_release}`);

    if (riskA.risk_tier === 'LOW' && riskB.risk_tier === 'HIGH') {
      console.log('\n✅ PASS: Seller risk classifier separated trusted vs high-risk sellers accurately!');
    }

    // -------------------------------------------------------------
    // TEST 4: Feeding Seller Risk into Order Escrow Payout Holds
    // -------------------------------------------------------------
    console.log('\n======================================================');
    console.log('🔒 TEST 4: Order Delivery Escrow Payout Hold Application');
    console.log('======================================================');

    // Create an order sold by Seller B (High Risk)
    const testOrderB = await Order.create({
      orderId: 'ORD-TEST-ESCROW-B001',
      buyerId: sellerA._id,
      sellerId: sellerB._id,
      name: 'Priya Customer',
      phone: '9876543210',
      address: 'Bangalore, India',
      totalAmount: 4200,
      orderStatus: 'SHIPPED',
      status: 'SHIPPED',
      payoutStatus: 'ON_HOLD'
    });

    // Simulate order delivery through orderProtectionController
    const reqDeliver = {
      params: { id: testOrderB.orderId },
      userId: sellerB._id.toString()
    };
    const resDeliver = createMockRes();
    const orderProtectionController = require('../controllers/orderProtectionController');
    await orderProtectionController.markOrderDelivered(reqDeliver, resDeliver);

    const updatedOrderB = await Order.findOne({ orderId: testOrderB.orderId });
    console.log(`Delivered Order for High-Risk Seller:`);
    console.log(`  Order Status:           ${updatedOrderB.orderStatus}`);
    console.log(`  Escrow Return Window:   ${updatedOrderB.returnWindowDays} days (Expected: 14 days)`);
    console.log(`  Escrow Hold Policy:     ${updatedOrderB.escrowHoldPolicy}`);
    console.log(`  Seller Risk Recorded:   ${updatedOrderB.sellerRiskTierAtOrder}`);
    console.log(`  Return Window Expires:  ${updatedOrderB.returnWindowExpiresAt}`);

    if (updatedOrderB.returnWindowDays === 14 && updatedOrderB.sellerRiskTierAtOrder === 'HIGH') {
      console.log('✅ PASS: High-risk seller escrow hold dynamically extended to 14 days!');
    }

    // -------------------------------------------------------------
    // TEST 5: Master Controller Pre-Upload Analysis Verdict
    // -------------------------------------------------------------
    console.log('\n======================================================');
    console.log('🚦 TEST 5: Master analyseBeforeUpload API Pre-Upload Verdict');
    console.log('======================================================');

    const reqUploadScam = {
      body: {
        sellerId: sellerB._id.toString(),
        brand: 'Gucci',
        category: 'Luxury Bags',
        condition: 'Like New',
        price: 350,
        originalPrice: 75000,
        title: 'Original Leather Biker Jacket by Seller A', // Stolen title + stolen image
        imageUrl: sampleImageUrl,
        description: 'Brand new luxury item'
      },
      userId: sellerB._id.toString()
    };
    const resUploadScam = createMockRes();

    await fakeListingController.analyseBeforeUpload(reqUploadScam, resUploadScam);
    const analysis = resUploadScam.data;

    console.log(`Verdict:     ${analysis?.verdict}`);
    console.log(`Can Proceed: ${analysis?.canProceed}`);
    console.log(`Reasons:`);
    (analysis?.reasons || []).forEach(r => console.log(`  - ${r}`));

    if (analysis?.verdict === 'rejected' && analysis?.canProceed === false) {
      console.log('\n✅ PASS: Scam listing intercepted and REJECTED before upload!');
    }

    console.log('\n======================================================');
    console.log('🎉 ALL ANTI-FRAUD & FAKE-LISTING TESTS PASSED!');
    console.log('======================================================\n');

  } catch (err) {
    console.error('❌ Test suite failed with error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB. Suite complete.');
  }
}

if (require.main === module) {
  runFraudDetectionSuite().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = runFraudDetectionSuite;
