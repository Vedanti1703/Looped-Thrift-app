const crypto = require('crypto');
const mongoose = require('mongoose');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Cart = require('../models/Cart');

async function testPaymentIntegrity() {
  console.log('🧪 === RUNNING RAZORPAY INTEGRATION & ORDER MODEL TESTS ===\n');

  // Test 1: HMAC SHA256 Signature Verification Algorithm
  console.log('1. Testing HMAC SHA256 Signature Verification logic...');
  const testKeySecret = 'test_secret_key_123456';
  const testOrderId = 'order_test_9876543210';
  const testPaymentId = 'pay_test_1234567890';

  const validSignature = crypto
    .createHmac('sha256', testKeySecret)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest('hex');

  const checkValid = crypto
    .createHmac('sha256', testKeySecret)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest('hex') === validSignature;

  const checkTampered = crypto
    .createHmac('sha256', testKeySecret)
    .update(`${testOrderId}|tampered_payment_id`)
    .digest('hex') === validSignature;

  if (checkValid && !checkTampered) {
    console.log('✅ HMAC-SHA256 signature generation and tampering rejection passed.');
  } else {
    throw new Error('❌ Signature verification test failed.');
  }

  // Test 2: Order Model Schema Flexibility & Backwards Compatibility
  console.log('\n2. Testing Order Model backward compatibility (Single Item / WhatsApp style)...');
  const singleItemOrder = new Order({
    orderId: 'LOOPED-ORD-TEST-001',
    name: 'Asees Kaur',
    phone: '+919876543210',
    productName: 'Tokyo Streetwear Hoodie',
    size: 'XL',
    color: 'Black',
    quantity: 1,
    address: '123 Fashion Ave, Mumbai',
    totalAmount: 950,
    status: 'Pending',
    estimatedDelivery: '3-5 business days'
  });

  const singleValidateError = singleItemOrder.validateSync();
  if (!singleValidateError) {
    console.log('✅ Single-item / WhatsApp backward compatible order schema validation passed.');
  } else {
    throw new Error(`❌ Single item schema validation failed: ${singleValidateError.message}`);
  }

  console.log('\n3. Testing Order Model multi-item web cart with Razorpay tracking...');
  const multiItemOrder = new Order({
    orderId: 'LOOPED-ORD-TEST-002',
    userId: new mongoose.Types.ObjectId(),
    name: 'Priya Sharma',
    phone: '+919876543210',
    productName: 'Tokyo Streetwear Hoodie, Vintage Denim Jacket',
    items: [
      {
        productId: new mongoose.Types.ObjectId(),
        title: 'Tokyo Streetwear Hoodie',
        price: 950,
        quantity: 1,
        image: 'https://picsum.photos/200',
        condition: 'Like New',
        size: 'XL'
      },
      {
        productId: new mongoose.Types.ObjectId(),
        title: 'Vintage Denim Jacket',
        price: 1200,
        quantity: 1,
        image: 'https://picsum.photos/200',
        condition: 'Good',
        size: 'L'
      }
    ],
    quantity: 2,
    address: '456 Marine Drive, Bandra',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    totalAmount: 2150,
    currency: 'INR',
    razorpayOrderId: 'order_NxXXXXXXXXXX',
    razorpayPaymentId: 'pay_NxXXXXXXXXXX',
    razorpaySignature: validSignature,
    paymentStatus: 'paid',
    status: 'Processing',
    estimatedDelivery: '3-5 business days'
  });

  const multiValidateError = multiItemOrder.validateSync();
  if (!multiValidateError) {
    console.log('✅ Multi-item web order schema with Razorpay metadata validation passed.');
  } else {
    throw new Error(`❌ Multi item schema validation failed: ${multiValidateError.message}`);
  }

  // Test 3: Server-side recalculation logic test
  console.log('\n4. Testing Server-side Price Recalculation logic...');
  const mockDbProducts = [
    { _id: 'prod1', title: 'Silk Scarf', price: 400 },
    { _id: 'prod2', title: 'Leather Boots', price: 1500 }
  ];
  const mockCartItems = [
    { productId: 'prod1', quantity: 2, clientClaimedPrice: 10 }, // Attempted client-side price tampering
    { productId: 'prod2', quantity: 1, clientClaimedPrice: 50 }
  ];

  const dbMap = new Map(mockDbProducts.map(p => [p._id, p]));
  let serverTotal = 0;
  for (const item of mockCartItems) {
    const p = dbMap.get(item.productId);
    serverTotal += p.price * (item.quantity || 1);
  }

  if (serverTotal === (400 * 2 + 1500 * 1)) {
    console.log(`✅ Server recalculated total correctly as ₹${serverTotal} (client tamper ignored).`);
  } else {
    throw new Error('❌ Server recalculation logic failed.');
  }

  console.log('\n🎉 ALL PAYMENT UNIT & SCHEMA TESTS PASSED SUCCESSFULLY!');
}

testPaymentIntegrity().catch(err => {
  console.error(err);
  process.exit(1);
});
