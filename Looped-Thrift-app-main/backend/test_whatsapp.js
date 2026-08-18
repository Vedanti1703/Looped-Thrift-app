const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';

const Product = require('./models/Product');
const Order = require('./models/Order');
const Rental = require('./models/Rental');
const User = require('./models/User');
const { WhatsAppConversation, WhatsAppMessage } = require('./models/WhatsAppConversation');

const productController = require('./controllers/productController');
const aiService = require('./services/aiService');

async function runTests() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.');

  console.log('\n🌱 Seeding database...');
  const req = {};
  const res = {
    json: (data) => console.log('   Seed result:', data.message),
    status: (code) => ({ json: (data) => console.error('   Seed failed:', code, data) })
  };
  await productController.seedProducts(req, res);

  const phone = '+1234567890';
  const name = 'Aditi';

  async function simulateMessage(text) {
    console.log(`\n👤 User: "${text}"`);
    await aiService.processIncomingMessage(phone, text, name);
  }

  async function showLastAiReply() {
    const lastMsg = await WhatsAppMessage.findOne({ phone, sender: 'ai' }).sort({ createdAt: -1 });
    if (lastMsg) {
      console.log(`🤖 AI: "${lastMsg.text.replace(/\n/g, '\n      ')}"`);
    } else {
      console.log('🤖 AI: [No reply sent]');
    }
  }

  await WhatsAppConversation.deleteMany({ phone });
  await WhatsAppMessage.deleteMany({ phone });

  // Test 1: Greeting
  await simulateMessage('Hi');
  await showLastAiReply();

  // Test 2: Product Search under price
  await simulateMessage('Show me hoodies under 1000');
  await showLastAiReply();

  // Test 3: Product Details
  await simulateMessage('Is Harajuku Patchwork Jacket available?');
  await showLastAiReply();

  // Test 4: Rental Inquiry
  await simulateMessage('Can I rent this product?');
  await showLastAiReply();

  // Test 5: Order tracking by ID
  await simulateMessage('Track my order LOOPED-ORD-123456');
  await showLastAiReply();

  // Test 6: Order tracking by phone
  await simulateMessage('Track my order');
  await showLastAiReply();

  // Test 7: Selling inquiry
  await simulateMessage('I want to sell clothes');
  await showLastAiReply();

  // Test 8: Return policy
  await simulateMessage('What is your return policy?');
  await showLastAiReply();

  // Test 9: Human support escalation
  await simulateMessage('I want to talk to a human');
  await showLastAiReply();

  // Test 10: Verify human support blocks AI replies
  console.log('\n[Verifying Human Flag Blocks AI]');
  await simulateMessage('Hello? Are you there?');
  const countBefore = await WhatsAppMessage.countDocuments({ phone, sender: 'ai' });
  const countAfter = await WhatsAppMessage.countDocuments({ phone, sender: 'ai' });
  if (countBefore === countAfter) {
    console.log('✅ Verification passed: AI stopped responding after human escalation.');
  } else {
    console.error('❌ Verification failed: AI responded after human escalation.');
  }

  // Test 11: Multi-step checkout order creation via WhatsApp State Machine
  console.log('\n[Testing Checkout State Machine & Order Creation]');
  const orderPhone = '+9876543210';
  await WhatsAppConversation.deleteMany({ phone: orderPhone });
  await WhatsAppMessage.deleteMany({ phone: orderPhone });

  async function simulateOrderMessage(text) {
    console.log(`👤 User (${orderPhone}): "${text}"`);
    await aiService.processIncomingMessage(orderPhone, text, 'TestBuyer');
    const lastMsg = await WhatsAppMessage.findOne({ phone: orderPhone, sender: 'ai' }).sort({ createdAt: -1 });
    console.log(`🤖 AI: "${lastMsg?.text.replace(/\n/g, '\n      ')}"`);
  }

  await simulateOrderMessage('buy Tokyo Streetwear Hoodie');
  await simulateOrderMessage('Tokyo Streetwear Hoodie');
  await simulateOrderMessage('XL');
  await simulateOrderMessage('Black');
  await simulateOrderMessage('1');
  await simulateOrderMessage('David');
  await simulateOrderMessage('+9876543210');
  await simulateOrderMessage('456 Oak Lane, Mumbai');
  await simulateOrderMessage('YES');

  const createdOrder = await Order.findOne({ phone: orderPhone });
  if (createdOrder) {
    console.log('\n✅ Verification passed: Order successfully created in MongoDB!');
    console.log(JSON.stringify(createdOrder, null, 2));
  } else {
    console.error('\n❌ Verification failed: Order was not found in MongoDB.');
  }

  console.log('\n🏁 Tests completed.');
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  mongoose.disconnect();
});
