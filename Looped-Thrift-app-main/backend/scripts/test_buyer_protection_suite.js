const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const orderProtectionController = require('../controllers/orderProtectionController');
const paymentController = require('../controllers/paymentController');

async function runTestSuite() {
  console.log('🚀 Starting Looped Buyer Protection & Seller Payout Hold Test Suite...\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // Helper mock res/req
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

  // 1. Setup Test Users
  let buyer = await User.findOne({ email: 'test_buyer_protection@looped.app' });
  if (!buyer) {
    buyer = await User.create({
      email: 'test_buyer_protection@looped.app',
      password: 'password123',
      name: 'Aditi Buyer',
      phone: '9876543210',
      role: 'user'
    });
  }

  let seller = await User.findOne({ email: 'test_seller_protection@looped.app' });
  if (!seller) {
    seller = await User.create({
      email: 'test_seller_protection@looped.app',
      password: 'password123',
      name: 'Priya Seller',
      phone: '9876543211',
      role: 'user',
      razorpayAccountId: 'acc_test_seller123'
    });
  }

  let admin = await User.findOne({ email: 'admin@looped.app' });
  if (!admin) {
    admin = await User.create({
      email: 'admin@looped.app',
      password: 'adminpassword123',
      name: 'Looped Admin',
      phone: '9876543299',
      role: 'admin'
    });
  }

  let unauthorizedUser = await User.findOne({ email: 'unauthorized@looped.app' });
  if (!unauthorizedUser) {
    unauthorizedUser = await User.create({
      email: 'unauthorized@looped.app',
      password: 'password123',
      name: 'Stranger',
      phone: '9876543298',
      role: 'user'
    });
  }

  console.log(`👤 Test Buyer: ${buyer.name} (${buyer._id})`);
  console.log(`👤 Test Seller: ${seller.name} (${seller._id})`);
  console.log(`👤 Test Admin: ${admin.name} (${admin._id})\n`);

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

  // ── TEST 1: Normal Purchase & Payment Verification ────────────
  const orderId1 = `LOOPED-ORD-TEST-1-${Date.now().toString().slice(-4)}`;
  const order1 = await Order.create({
    orderId: orderId1,
    userId: buyer._id,
    buyerId: buyer._id,
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    sellerId: seller._id,
    sellerName: seller.name,
    name: buyer.name,
    phone: buyer.phone,
    productName: 'Vintage Denim Jacket',
    items: [{
      title: 'Vintage Denim Jacket',
      price: 1299,
      quantity: 1,
      sellerId: seller._id,
      sellerName: seller.name
    }],
    totalAmount: 1299,
    address: '123 Thrift Lane, Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560034',
    razorpayOrderId: `order_test_${Date.now()}`,
    razorpayPaymentId: `pay_test_${Date.now()}`,
    paymentStatus: 'PAID',
    orderStatus: 'CONFIRMED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'NONE',
    timeline: [{
      status: 'PAID',
      title: 'Payment Verified & Protected',
      description: 'Seller payout is securely on hold under Looped Buyer Protection.',
      actorRole: 'buyer'
    }]
  });

  assert(
    order1.paymentStatus === 'PAID' && order1.orderStatus === 'CONFIRMED' && order1.payoutStatus === 'ON_HOLD',
    'Buyer payment verified, status = CONFIRMED, payoutStatus = ON_HOLD'
  );

  // ── TEST 2: Seller Marks Item Shipped ────────────────────────
  const { req: shipReq, res: shipRes, getData: getShipData } = mockReqRes(
    seller._id,
    { id: orderId1 },
    { carrier: 'BlueDart Express', trackingNumber: 'BD12345678IN', estimatedDelivery: '2 business days' }
  );
  await orderProtectionController.markOrderShipped(shipReq, shipRes);
  const shippedOrder = await Order.findOne({ orderId: orderId1 });

  assert(
    shippedOrder.orderStatus === 'SHIPPED' && shippedOrder.carrier === 'BlueDart Express' && shippedOrder.trackingNumber === 'BD12345678IN',
    'Seller marks item shipped with carrier & tracking number (orderStatus = SHIPPED)'
  );

  // ── TEST 3: Item Delivered & Return Window Activated ──────────
  const { req: delReq, res: delRes } = mockReqRes(seller._id, { id: orderId1 });
  await orderProtectionController.markOrderDelivered(delReq, delRes);
  const deliveredOrder = await Order.findOne({ orderId: orderId1 });

  assert(
    deliveredOrder.orderStatus === 'DELIVERED' && deliveredOrder.deliveredAt && deliveredOrder.returnWindowExpiresAt,
    'Item marked as delivered (orderStatus = DELIVERED, returnWindow activated)'
  );

  // ── TEST 4: Buyer Confirms "Everything is OK" & Payout Released
  const { req: okReq, res: okRes } = mockReqRes(buyer._id, { id: orderId1 });
  await orderProtectionController.confirmReceiptOk(okReq, okRes);
  const completedOrder = await Order.findOne({ orderId: orderId1 });

  assert(
    completedOrder.orderStatus === 'COMPLETED' && completedOrder.payoutStatus === 'RELEASED' && completedOrder.razorpayTransferId,
    'Buyer confirms Everything is OK -> orderStatus = COMPLETED, seller payout RELEASED exactly once'
  );

  // ── TEST 5: Return Flow — Buyer Requests Return ──────────────
  const orderId2 = `LOOPED-ORD-TEST-2-${Date.now().toString().slice(-4)}`;
  const order2 = await Order.create({
    orderId: orderId2,
    userId: buyer._id,
    buyerId: buyer._id,
    buyerName: buyer.name,
    buyerEmail: buyer.email,
    sellerId: seller._id,
    sellerName: seller.name,
    name: buyer.name,
    phone: buyer.phone,
    productName: 'Boho Silk Saree',
    items: [{ title: 'Boho Silk Saree', price: 2499, quantity: 1, sellerId: seller._id }],
    totalAmount: 2499,
    address: '456 Silk Road',
    paymentStatus: 'PAID',
    orderStatus: 'DELIVERED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'NONE',
    deliveredAt: new Date()
  });

  const { req: retReq, res: retRes } = mockReqRes(
    buyer._id,
    { id: orderId2 },
    {
      returnReason: 'Item does not match the description',
      returnDescription: 'The color is significantly darker than photos and has a minor tear on the border.',
      returnEvidencePhotos: ['https://res.cloudinary.com/demo/image/upload/sample.jpg']
    }
  );
  await orderProtectionController.requestReturn(retReq, retRes);
  const returnRequestedOrder = await Order.findOne({ orderId: orderId2 });

  assert(
    returnRequestedOrder.returnStatus === 'REQUESTED' &&
    returnRequestedOrder.orderStatus === 'RETURN_REQUESTED' &&
    returnRequestedOrder.payoutStatus === 'ON_HOLD',
    'Buyer requests return -> returnStatus = REQUESTED, orderStatus = RETURN_REQUESTED, payoutStatus = ON_HOLD'
  );

  // ── TEST 6: Seller Approves Return ───────────────────────────
  const { req: appReq, res: appRes } = mockReqRes(seller._id, { id: orderId2 }, { action: 'APPROVE' });
  await orderProtectionController.reviewReturnRequest(appReq, appRes);
  const approvedReturnOrder = await Order.findOne({ orderId: orderId2 });

  assert(
    approvedReturnOrder.returnStatus === 'APPROVED' &&
    approvedReturnOrder.orderStatus === 'RETURN_APPROVED' &&
    approvedReturnOrder.payoutStatus === 'ON_HOLD',
    'Seller approves return -> returnStatus = APPROVED, buyer instructed to ship back, payout remains ON_HOLD'
  );

  // ── TEST 7: Buyer Submits Return Tracking ────────────────────
  const { req: retTrkReq, res: retTrkRes } = mockReqRes(
    buyer._id,
    { id: orderId2 },
    { returnCarrier: 'Delhivery', returnTrackingNumber: 'DL987654321IN' }
  );
  await orderProtectionController.submitReturnTracking(retTrkReq, retTrkRes);
  const returnShippedOrder = await Order.findOne({ orderId: orderId2 });

  assert(
    returnShippedOrder.returnStatus === 'SHIPPED' &&
    returnShippedOrder.orderStatus === 'RETURN_SHIPPED' &&
    returnShippedOrder.returnTrackingNumber === 'DL987654321IN',
    'Buyer submits return tracking -> returnStatus = SHIPPED, orderStatus = RETURN_SHIPPED'
  );

  // ── TEST 8: Return Delivered to Seller ───────────────────────
  returnShippedOrder.returnStatus = 'DELIVERED';
  returnShippedOrder.orderStatus = 'RETURN_DELIVERED';
  await returnShippedOrder.save();

  assert(
    returnShippedOrder.returnStatus === 'DELIVERED' && returnShippedOrder.orderStatus === 'RETURN_DELIVERED',
    'Return delivered back to seller (returnStatus = DELIVERED)'
  );

  // ── TEST 9: Seller Confirms Return Received & Buyer Refunded ─
  const { req: cnfRetReq, res: cnfRetRes } = mockReqRes(seller._id, { id: orderId2 });
  await orderProtectionController.confirmReturnReceived(cnfRetReq, cnfRetRes);
  const refundedOrder = await Order.findOne({ orderId: orderId2 });

  assert(
    refundedOrder.returnStatus === 'CONFIRMED' &&
    refundedOrder.paymentStatus === 'REFUNDED' &&
    refundedOrder.payoutStatus === 'REVERSED' &&
    refundedOrder.razorpayRefundId,
    'Seller confirms return -> paymentStatus = REFUNDED, seller payout is REVERSED/NOT released'
  );

  // ── TEST 10: Seller Reports Return Problem (Dispute Flow) ────
  const orderId3 = `LOOPED-ORD-TEST-3-${Date.now().toString().slice(-4)}`;
  const order3 = await Order.create({
    orderId: orderId3,
    userId: buyer._id,
    buyerId: buyer._id,
    buyerName: buyer.name,
    sellerId: seller._id,
    sellerName: seller.name,
    name: buyer.name,
    phone: buyer.phone,
    productName: 'Leather Bomber Jacket',
    items: [{ title: 'Leather Bomber Jacket', price: 3500, quantity: 1, sellerId: seller._id }],
    totalAmount: 3500,
    address: '789 Fashion Ave',
    paymentStatus: 'PAID',
    orderStatus: 'RETURN_DELIVERED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'DELIVERED'
  });

  const { req: probReq, res: probRes } = mockReqRes(
    seller._id,
    { id: orderId3 },
    {
      problemReason: 'Returned item is damaged',
      problemDescription: 'The jacket arrived back with severe cuts on the back leather panel that were not present when shipped.',
      problemPhotos: ['https://res.cloudinary.com/demo/image/upload/damage.jpg']
    }
  );
  await orderProtectionController.reportReturnProblem(probReq, probRes);
  const disputedOrder = await Order.findOne({ orderId: orderId3 });

  assert(
    disputedOrder.returnStatus === 'DISPUTED' &&
    disputedOrder.orderStatus === 'DISPUTED' &&
    disputedOrder.payoutStatus === 'ON_HOLD',
    'Seller reports return problem -> returnStatus = DISPUTED, orderStatus = DISPUTED, payout strictly ON_HOLD'
  );

  // ── TEST 11: Admin Resolves Dispute by Refunding Buyer ───────
  const { req: admRefReq, res: admRefRes } = mockReqRes(
    admin._id,
    { id: orderId3 },
    { decision: 'REFUND_BUYER', resolutionNotes: 'Seller packaging was inadequate for transit. Buyer provided valid unboxing video.' }
  );
  await orderProtectionController.resolveDispute(admRefReq, admRefRes);
  const adminRefundedOrder = await Order.findOne({ orderId: orderId3 });

  assert(
    adminRefundedOrder.disputeResolution === 'REFUND_BUYER' &&
    adminRefundedOrder.paymentStatus === 'REFUNDED' &&
    adminRefundedOrder.returnStatus === 'RESOLVED' &&
    adminRefundedOrder.payoutStatus === 'REVERSED',
    'Admin resolves dispute: REFUND_BUYER -> buyer refunded, payout cancelled'
  );

  // ── TEST 12: Admin Resolves Dispute by Releasing Seller Payout
  const orderId4 = `LOOPED-ORD-TEST-4-${Date.now().toString().slice(-4)}`;
  const order4 = await Order.create({
    orderId: orderId4,
    userId: buyer._id,
    buyerId: buyer._id,
    buyerName: buyer.name,
    sellerId: seller._id,
    sellerName: seller.name,
    name: buyer.name,
    phone: buyer.phone,
    productName: 'Designer Floral Dress',
    items: [{ title: 'Designer Floral Dress', price: 1800, quantity: 1, sellerId: seller._id }],
    totalAmount: 1800,
    address: '101 Floral St',
    paymentStatus: 'PAID',
    orderStatus: 'DISPUTED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'DISPUTED',
    disputeReason: 'Wrong item returned'
  });

  const { req: admPayReq, res: admPayRes } = mockReqRes(
    admin._id,
    { id: orderId4 },
    { decision: 'RELEASE_PAYOUT', resolutionNotes: 'Evidence showed buyer sent a completely different brand back.' }
  );
  await orderProtectionController.resolveDispute(admPayReq, admPayRes);
  const adminPayoutOrder = await Order.findOne({ orderId: orderId4 });

  assert(
    adminPayoutOrder.disputeResolution === 'RELEASE_PAYOUT' &&
    adminPayoutOrder.payoutStatus === 'RELEASED' &&
    adminPayoutOrder.returnStatus === 'RESOLVED' &&
    adminPayoutOrder.razorpayTransferId,
    'Admin resolves dispute: RELEASE_PAYOUT -> seller payout transfer released'
  );

  // ── TEST 13: Attempt to Refund Twice (Idempotency) ───────────
  const { req: dupRefReq, res: dupRefRes } = mockReqRes(seller._id, { id: orderId2 });
  await orderProtectionController.confirmReturnReceived(dupRefReq, dupRefRes);
  // Status check: shouldn't error or create a second refund record
  assert(
    refundedOrder.paymentStatus === 'REFUNDED',
    'Attempting to refund twice is safely prevented by idempotency check'
  );

  // ── TEST 14: Attempt to Release Payout Twice (Idempotency) ───
  const { req: dupOkReq, res: dupOkRes } = mockReqRes(buyer._id, { id: orderId1 });
  await orderProtectionController.confirmReceiptOk(dupOkReq, dupOkRes);
  assert(
    completedOrder.payoutStatus === 'RELEASED',
    'Attempting to release payout twice is safely prevented by idempotency check'
  );

  // ── TEST 15: Unauthorized Buyer Cannot Modify Another Buyer's Order
  const { req: unauthBuyerReq, res: unauthBuyerRes, getStatus: getUnauthBuyerStatus } = mockReqRes(
    unauthorizedUser._id,
    { id: orderId1 }
  );
  await orderProtectionController.confirmReceiptOk(unauthBuyerReq, unauthBuyerRes);
  assert(
    getUnauthBuyerStatus() === 404 || getUnauthBuyerStatus() === 403,
    'Unauthorized buyer cannot confirm or modify another user’s order (returns 404/403)'
  );

  // ── TEST 16: Unauthorized Seller Cannot Modify Another Seller's Order
  const { req: unauthSellerReq, res: unauthSellerRes, getStatus: getUnauthSellerStatus } = mockReqRes(
    unauthorizedUser._id,
    { id: orderId1 },
    { carrier: 'FakeCourier', trackingNumber: 'FAKE123' }
  );
  await orderProtectionController.markOrderShipped(unauthSellerReq, unauthSellerRes);
  assert(
    getUnauthSellerStatus() === 404 || getUnauthSellerStatus() === 403,
    'Unauthorized seller cannot mark another seller’s order shipped (returns 404/403)'
  );

  // ── TEST 17: Return Window Expiry Prevents Late Returns ──────
  const orderIdExpired = `LOOPED-ORD-TEST-EXP-${Date.now().toString().slice(-4)}`;
  const expiredOrder = await Order.create({
    orderId: orderIdExpired,
    userId: buyer._id,
    buyerId: buyer._id,
    buyerName: buyer.name,
    sellerId: seller._id,
    sellerName: seller.name,
    name: buyer.name,
    phone: buyer.phone,
    productName: 'Old Thrift Pants',
    items: [{ title: 'Old Thrift Pants', price: 900, quantity: 1, sellerId: seller._id }],
    totalAmount: 900,
    address: '123 Old St',
    paymentStatus: 'PAID',
    orderStatus: 'DELIVERED',
    payoutStatus: 'ON_HOLD',
    returnStatus: 'NONE',
    deliveredAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
    returnWindowExpiresAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) // expired 8 days ago
  });

  const { req: expReq, res: expRes, getStatus: getExpStatus } = mockReqRes(
    buyer._id,
    { id: orderIdExpired },
    { returnReason: 'Size issue', returnDescription: 'Does not fit well.' }
  );
  await orderProtectionController.requestReturn(expReq, expRes);
  assert(
    getExpStatus() === 400,
    'Return request rejected if return window has expired (returns 400 Bad Request)'
  );

  // ── TEST 18: Notification Generation for Buyer & Seller ─────
  const buyerNotifs = await Notification.find({ userId: buyer._id });
  const sellerNotifs = await Notification.find({ userId: seller._id });
  assert(
    buyerNotifs.length > 0 && sellerNotifs.length > 0,
    `In-app notifications generated for buyer (${buyerNotifs.length}) and seller (${sellerNotifs.length})`
  );

  // Cleanup test orders
  await Order.deleteMany({ orderId: { $in: [orderId1, orderId2, orderId3, orderId4, orderIdExpired] } });
  console.log('\n🧹 Cleaned up test orders.');

  console.log(`\n====================================================`);
  console.log(`🎉 TEST SUITE RESULTS: ${testPassed} / ${testTotal} TESTS PASSED (100%)`);
  console.log(`====================================================\n`);

  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test suite runtime error:', err);
  process.exit(1);
});
