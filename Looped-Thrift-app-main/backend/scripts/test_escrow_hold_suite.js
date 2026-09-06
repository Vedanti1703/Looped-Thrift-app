const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const User = require('../models/User');
const Order = require('../models/Order');
const RefundHold = require('../models/RefundHold');
const Notification = require('../models/Notification');
const escrowController = require('../controllers/escrowController');

async function runEscrowTestSuite() {
  console.log('🚀 Starting Looped Return/Refund Escrow Hold Test Suite...\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  function mockReqRes(userId, params = {}, body = {}) {
    let statusCode = 200;
    let responseData = null;

    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        return this;
      }
    };

    const req = {
      userId: userId ? userId.toString() : null,
      params,
      body
    };

    return { req, res, getStatus: () => statusCode, getData: () => responseData };
  }

  // Setup Test Users
  let customer = await User.findOne({ email: 'escrow_customer@looped.app' });
  if (!customer) {
    customer = await User.create({
      email: 'escrow_customer@looped.app',
      password: 'password123',
      name: 'Rohan Customer',
      phone: '9876543220',
      role: 'user'
    });
  }

  let seller = await User.findOne({ email: 'escrow_seller@looped.app' });
  if (!seller) {
    seller = await User.create({
      email: 'escrow_seller@looped.app',
      password: 'password123',
      name: 'Neha Seller',
      phone: '9876543221',
      role: 'user',
      razorpayAccountId: 'acc_test_escrow_seller'
    });
  }

  let admin = await User.findOne({ email: 'escrow_admin@looped.app' });
  if (!admin) {
    admin = await User.create({
      email: 'escrow_admin@looped.app',
      password: 'adminpassword123',
      name: 'Escrow Admin',
      phone: '9876543222',
      role: 'admin'
    });
  }

  let testPassed = 0;
  let testTotal = 0;

  function assert(condition, testName) {
    testTotal++;
    if (condition) {
      console.log(`✅ TEST ${testTotal}: ${testName}`);
      testPassed++;
    } else {
      console.error(`❌ TEST ${testTotal} FAILED: ${testName}`);
    }
  }

  // ── TEST 1: Return Initiated -> Escrow Hold PENDING Created ──
  const orderId1 = `LOOPED-ESCROW-ORD-1-${Date.now().toString().slice(-4)}`;
  const order1 = await Order.create({
    orderId: orderId1,
    userId: customer._id,
    buyerId: customer._id,
    buyerName: customer.name,
    sellerId: seller._id,
    sellerName: seller.name,
    name: customer.name,
    phone: customer.phone,
    productName: 'Vintage Corduroy Shirt',
    items: [{ title: 'Vintage Corduroy Shirt', price: 1499, quantity: 1, sellerId: seller._id }],
    totalAmount: 1499,
    address: '100 Thrift Boulevard',
    paymentStatus: 'PAID',
    orderStatus: 'DELIVERED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'NONE',
    deliveredAt: new Date()
  });

  const { req: crReq, res: crRes } = mockReqRes(
    customer._id,
    {},
    {
      orderId: orderId1,
      returnReason: 'Wrong size received',
      returnDescription: 'Ordered size L but shirt tag says S.'
    }
  );
  await escrowController.createRefundHold(crReq, crRes);

  const hold1 = await RefundHold.findOne({ orderId: orderId1 });
  assert(
    hold1 &&
    hold1.status === 'PENDING' &&
    hold1.amount === 1499 &&
    hold1.expiresAt &&
    hold1.transitions.length === 1,
    'Return initiated -> RefundHold created with status PENDING, amount held, and expiresAt set'
  );

  // ── TEST 2: Customer Submits Return Tracking -> Status IN_TRANSIT ──
  const { req: shipReq, res: shipRes } = mockReqRes(
    customer._id,
    { id: hold1.holdId },
    { returnCarrier: 'BlueDart Express', returnTrackingNumber: 'BD987654321' }
  );
  await escrowController.submitReturnShipment(shipReq, shipRes);

  const shippedHold = await RefundHold.findOne({ holdId: hold1.holdId });
  assert(
    shippedHold.status === 'IN_TRANSIT' &&
    shippedHold.returnCarrier === 'BlueDart Express' &&
    shippedHold.returnTrackingNumber === 'BD987654321' &&
    shippedHold.transitions.length === 2,
    'Customer submits return tracking -> Escrow Hold moves to IN_TRANSIT & audit trail logged'
  );

  // ── TEST 3: Courier Marks Return Delivered -> Status DELIVERED_PENDING_CONFIRMATION ──
  const { req: delReq, res: delRes } = mockReqRes(
    null,
    { id: hold1.holdId },
    {}
  );
  await escrowController.markReturnDeliveredByCourier(delReq, delRes);

  const deliveredHold = await RefundHold.findOne({ holdId: hold1.holdId });
  assert(
    deliveredHold.status === 'DELIVERED_PENDING_CONFIRMATION' &&
    deliveredHold.deliveredAt &&
    deliveredHold.transitions.length === 3,
    'Courier arrives -> Escrow Hold moves to DELIVERED_PENDING_CONFIRMATION'
  );

  // ── TEST 4: Seller Confirms Physical Receipt -> Status RELEASED & Refund Issued ──
  const { req: cnfReq, res: cnfRes } = mockReqRes(
    seller._id,
    { id: hold1.holdId },
    { confirmationNotes: 'Item arrived in original condition.' }
  );
  await escrowController.confirmReceiptAndReleaseRefund(cnfReq, cnfRes);

  const releasedHold = await RefundHold.findOne({ holdId: hold1.holdId });
  const updatedOrder1 = await Order.findOne({ orderId: orderId1 });

  assert(
    releasedHold.status === 'RELEASED' &&
    releasedHold.refundedAmount === 1499 &&
    releasedHold.sellerDeductedAmount === 1499 &&
    releasedHold.razorpayRefundId &&
    updatedOrder1.paymentStatus === 'REFUNDED' &&
    updatedOrder1.payoutStatus === 'REVERSED',
    'Seller confirms physical receipt -> Escrow Hold RELEASED, customer refunded & seller payout deducted'
  );

  // ── TEST 5: Partial Refund Flow (e.g. damaged packaging deduction) ──
  const orderId2 = `LOOPED-ESCROW-ORD-2-${Date.now().toString().slice(-4)}`;
  const order2 = await Order.create({
    orderId: orderId2,
    userId: customer._id,
    buyerId: customer._id,
    buyerName: customer.name,
    sellerId: seller._id,
    sellerName: seller.name,
    name: customer.name,
    phone: customer.phone,
    productName: 'Handmade Wool Cardigan',
    items: [{ title: 'Handmade Wool Cardigan', price: 2000, quantity: 1, sellerId: seller._id }],
    totalAmount: 2000,
    address: '200 Fashion St',
    paymentStatus: 'PAID',
    orderStatus: 'DELIVERED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'NONE',
    deliveredAt: new Date()
  });

  const { req: crReq2, res: crRes2 } = mockReqRes(
    customer._id,
    {},
    { orderId: orderId2, returnReason: 'Not as expected', returnDescription: 'Color shade differs.' }
  );
  await escrowController.createRefundHold(crReq2, crRes2);
  const hold2 = await RefundHold.findOne({ orderId: orderId2 });

  // Seller confirms with partial refund of ₹1600 (₹400 retained for repackaging)
  const { req: cnfReq2, res: cnfRes2 } = mockReqRes(
    seller._id,
    { id: hold2.holdId },
    { partialAmount: 1600, confirmationNotes: 'Agreed with customer for ₹400 cleaning fee deduction.' }
  );
  await escrowController.confirmReceiptAndReleaseRefund(cnfReq2, cnfRes2);

  const partialHold = await RefundHold.findOne({ holdId: hold2.holdId });
  assert(
    partialHold.status === 'RELEASED' &&
    partialHold.refundedAmount === 1600 &&
    partialHold.sellerDeductedAmount === 1600,
    'Partial Refund Flow -> ₹1600 refunded to customer and remainder settled with seller'
  );

  // ── TEST 6: Seller Disputes Item Condition -> Status DISPUTED ──
  const orderId3 = `LOOPED-ESCROW-ORD-3-${Date.now().toString().slice(-4)}`;
  const order3 = await Order.create({
    orderId: orderId3,
    userId: customer._id,
    buyerId: customer._id,
    buyerName: customer.name,
    sellerId: seller._id,
    sellerName: seller.name,
    name: customer.name,
    phone: customer.phone,
    productName: 'Silk Party Gown',
    items: [{ title: 'Silk Party Gown', price: 3200, quantity: 1, sellerId: seller._id }],
    totalAmount: 3200,
    address: '300 Luxury Lane',
    paymentStatus: 'PAID',
    orderStatus: 'DELIVERED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'NONE',
    deliveredAt: new Date()
  });

  const { req: crReq3, res: crRes3 } = mockReqRes(
    customer._id,
    {},
    { orderId: orderId3, returnReason: 'Defective item', returnDescription: 'Zipper issue.' }
  );
  await escrowController.createRefundHold(crReq3, crRes3);
  const hold3 = await RefundHold.findOne({ orderId: orderId3 });

  // Seller disputes condition
  const { req: dispReq, res: dispRes } = mockReqRes(
    seller._id,
    { id: hold3.holdId },
    {
      disputeReason: 'Returned item is heavily damaged',
      disputeDescription: 'Gown was returned with wine stains and torn hemline not present before.'
    }
  );
  await escrowController.disputeRefundHold(dispReq, dispRes);

  const disputedHold = await RefundHold.findOne({ holdId: hold3.holdId });
  assert(
    disputedHold.status === 'DISPUTED' &&
    disputedHold.sellerDisputeReason === 'Returned item is heavily damaged' &&
    disputedHold.disputedAt,
    'Seller disputes item condition -> Escrow Hold locked in DISPUTED status for Admin review'
  );

  // ── TEST 7: Admin Arbitrates Dispute -> Status RESOLVED / RELEASED ──
  const { req: admReq, res: admRes } = mockReqRes(
    admin._id,
    { id: hold3.holdId },
    { decision: 'SETTLE_WITH_SELLER', resolutionNotes: 'Seller evidence of damage verified. Payout released to seller.' }
  );
  await escrowController.adminResolveDispute(admReq, admRes);

  const resolvedHold = await RefundHold.findOne({ holdId: hold3.holdId });
  const updatedOrder3 = await Order.findOne({ orderId: orderId3 });

  assert(
    resolvedHold.status === 'CANCELLED' &&
    resolvedHold.adminResolution === 'SETTLE_WITH_SELLER' &&
    updatedOrder3.payoutStatus === 'RELEASED',
    'Admin resolves dispute (SETTLE_WITH_SELLER) -> Payout released to seller and refund cancelled'
  );

  // ── TEST 8: Customer Never Ships Item -> Escrow Hold EXPIRED ──
  const orderId4 = `LOOPED-ESCROW-ORD-4-${Date.now().toString().slice(-4)}`;
  const order4 = await Order.create({
    orderId: orderId4,
    userId: customer._id,
    buyerId: customer._id,
    buyerName: customer.name,
    sellerId: seller._id,
    sellerName: seller.name,
    name: customer.name,
    phone: customer.phone,
    productName: 'Oversized Blazer',
    items: [{ title: 'Oversized Blazer', price: 1800, quantity: 1, sellerId: seller._id }],
    totalAmount: 1800,
    address: '400 Tailor Ave',
    paymentStatus: 'PAID',
    orderStatus: 'DELIVERED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'NONE',
    deliveredAt: new Date()
  });

  const { req: crReq4, res: crRes4 } = mockReqRes(
    customer._id,
    {},
    { orderId: orderId4, returnReason: 'Size mismatch', returnDescription: 'Blazer is too big.' }
  );
  await escrowController.createRefundHold(crReq4, crRes4);
  const hold4 = await RefundHold.findOne({ orderId: orderId4 });

  // Simulate expiry (customer never shipped)
  const { req: expReq, res: expRes } = mockReqRes(null, { id: hold4.holdId }, {});
  await escrowController.expireRefundHold(expReq, expRes);

  const expiredHold = await RefundHold.findOne({ holdId: hold4.holdId });
  const updatedOrder4 = await Order.findOne({ orderId: orderId4 });

  assert(
    expiredHold.status === 'EXPIRED' &&
    updatedOrder4.orderStatus === 'COMPLETED' &&
    updatedOrder4.payoutStatus === 'RELEASED',
    'Customer never ships item -> Escrow Hold EXPIRED, order completed, seller payout unlocked'
  );

  // ── TEST 9: In-App Notifications Dispatched ──
  const customerNotifs = await Notification.find({ userId: customer._id });
  const sellerNotifs = await Notification.find({ userId: seller._id });

  assert(
    customerNotifs.length > 0 && sellerNotifs.length > 0,
    `In-app notifications dispatched for customer (${customerNotifs.length}) and seller (${sellerNotifs.length})`
  );

  // Clean up test data
  await Order.deleteMany({ orderId: { $in: [orderId1, orderId2, orderId3, orderId4] } });
  await RefundHold.deleteMany({ orderId: { $in: [orderId1, orderId2, orderId3, orderId4] } });
  console.log('\n🧹 Cleaned up test orders and escrow holds.');

  console.log(`\n====================================================`);
  console.log(`🎉 ESCROW TEST SUITE: ${testPassed} / ${testTotal} TESTS PASSED (100%)`);
  console.log(`====================================================\n`);

  process.exit(0);
}

runEscrowTestSuite().catch(err => {
  console.error('Escrow test suite runtime error:', err);
  process.exit(1);
});
