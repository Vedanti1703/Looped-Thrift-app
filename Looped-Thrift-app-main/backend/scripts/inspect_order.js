const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const Order = require('../models/Order');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');

  const orders = await Order.find({
    $or: [
      { orderId: 'LOOPED-ORD-434985694' },
      { razorpayPaymentId: 'pay_TX9q4uiXv5fc1' }
    ]
  }).lean();

  console.log('Orders found matching target:', orders.length);
  orders.forEach(o => {
    console.log('--- ORDER DUMP ---');
    console.log('_id:', o._id);
    console.log('orderId:', o.orderId);
    console.log('paymentStatus:', o.paymentStatus);
    console.log('orderStatus:', o.orderStatus);
    console.log('status:', o.status);
    console.log('payoutStatus:', o.payoutStatus);
    console.log('razorpayOrderId:', o.razorpayOrderId);
    console.log('razorpayPaymentId:', o.razorpayPaymentId);
    console.log('razorpaySignature:', o.razorpaySignature ? 'PRESENT' : 'EMPTY');
    console.log('paidAt:', o.paidAt);
    console.log('timeline:', o.timeline);
  });

  // Also let's check recent orders (last 5)
  console.log('\n--- 5 MOST RECENT ORDERS IN DB ---');
  const recents = await Order.find().sort({ createdAt: -1 }).limit(5).lean();
  recents.forEach(r => {
    console.log(`ID: ${r.orderId} | pymtStatus: ${r.paymentStatus} | ordStatus: ${r.orderStatus} | rzpPayId: ${r.razorpayPaymentId} | rzpOrdId: ${r.razorpayOrderId} | created: ${r.createdAt}`);
  });

  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
