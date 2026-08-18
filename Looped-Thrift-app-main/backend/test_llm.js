const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';

// Import models
const Product = require('./models/Product');
const Order = require('./models/Order');
const Rental = require('./models/Rental');
const User = require('./models/User');
const { WhatsAppConversation, WhatsAppMessage } = require('./models/WhatsAppConversation');

const productController = require('./controllers/productController');
const aiService = require('./services/aiService');
const aiServiceLLM = require('./services/aiServiceLLM');

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

  console.log('\n--- 1. Testing Search Products Tool ---');
  const searchRes = await aiServiceLLM.executeTool('searchProducts', { category: "Men's Tops", maxPrice: 1000 }, phone);
  console.log('Search Result Status:', searchRes.success);
  console.log('Products Found:', searchRes.products.length);
  if (searchRes.products.length > 0) {
    console.log('✅ Found product:', searchRes.products[0].title, '- Price:', searchRes.products[0].price);
  }

  console.log('\n--- 2. Testing Plural Stemming in Product Search Tool ---');
  const pluralRes = await aiServiceLLM.executeTool('searchProducts', { search: 'hoodies' }, phone);
  if (pluralRes.products.length > 0) {
    console.log('✅ Plural matching passed: "hoodies" correctly resolved to product title:', pluralRes.products[0].title);
  } else {
    console.error('❌ Plural matching failed.');
  }

  console.log('\n--- 3. Testing Get Product Details Tool ---');
  const detailsRes = await aiServiceLLM.executeTool('getProductDetails', { title: 'Harajuku Patchwork Jacket' }, phone);
  if (detailsRes.success && detailsRes.product) {
    console.log('✅ Details match passed: price is', detailsRes.product.price);
  } else {
    console.error('❌ Details match failed:', detailsRes.message);
  }

  console.log('\n--- 4. Testing Order Tracking Tool (Specific ID) ---');
  const trackRes = await aiServiceLLM.executeTool('trackOrder', { orderId: 'LOOPED-ORD-123456' }, phone);
  if (trackRes.success && trackRes.order) {
    console.log('✅ Track order passed: customer name is', trackRes.order.name, '- Status:', trackRes.order.status);
  } else {
    console.error('❌ Track order failed:', trackRes.message);
  }

  console.log('\n--- 5. Testing Orders by Phone Tool ---');
  const phoneOrdersRes = await aiServiceLLM.executeTool('getOrdersByPhone', { phone: '+1234567890' }, phone);
  if (phoneOrdersRes.success && phoneOrdersRes.orders.length > 0) {
    console.log('✅ Orders by phone passed: found', phoneOrdersRes.orders.length, 'orders.');
  } else {
    console.error('❌ Orders by phone failed.');
  }

  console.log('\n--- 6. Testing Rentals Query Tool ---');
  const rentalsRes = await aiServiceLLM.executeTool('checkRental', { phone: '+1234567890' }, phone);
  if (rentalsRes.success && rentalsRes.rentals.length > 0) {
    console.log('✅ Rentals query passed: found active rental for', rentalsRes.rentals[0].productTitle);
  } else {
    console.error('❌ Rentals query failed.');
  }

  console.log('\n--- 7. Testing Policies Query Tool ---');
  const policyRes = await aiServiceLLM.executeTool('getPolicies', { policyType: 'returns' }, phone);
  if (policyRes.success && policyRes.policy.includes('7 days')) {
    console.log('✅ Policy retrieval passed: returned returns template.');
  } else {
    console.error('❌ Policy retrieval failed.');
  }

  console.log('\n--- 8. Testing Human Handoff Tool ---');
  await WhatsAppConversation.updateOne({ phone }, { humanSupportRequired: false });
  const handoffRes = await aiServiceLLM.executeTool('handoffToHuman', {}, phone);
  const updatedConvo = await WhatsAppConversation.findOne({ phone });
  if (handoffRes.success && updatedConvo.humanSupportRequired) {
    console.log('✅ Human support handoff passed: humanSupportRequired is true.');
  } else {
    console.error('❌ Human support handoff failed.');
  }

  console.log('\n--- 9. Testing Start Checkout Tool ---');
  const checkoutRes = await aiServiceLLM.executeTool('startCheckout', { productName: 'Tokyo Streetwear Hoodie' }, phone);
  const checkoutConvo = await WhatsAppConversation.findOne({ phone });
  if (checkoutRes.success && checkoutConvo.loopedAiState.step === 'collecting_size') {
    console.log('✅ Start checkout passed: step changed to collecting_size for product:', checkoutConvo.loopedAiState.orderData.productName);
  } else {
    console.error('❌ Start checkout failed:', checkoutRes.message);
  }

  console.log('\n--- 10. Testing Direct Order Creation Tool ---');
  const directOrderRes = await aiServiceLLM.executeTool('createOrder', {
    productName: 'Tokyo Streetwear Hoodie',
    name: 'David',
    phone: '+9876543210',
    address: '456 Oak Lane, Mumbai',
    size: 'XL',
    color: 'Black',
    quantity: 2
  }, phone);
  if (directOrderRes.success && directOrderRes.orderId) {
    console.log('✅ Direct order creation passed: Created order with ID', directOrderRes.orderId, 'total amount:', directOrderRes.order.totalAmount);
  } else {
    console.error('❌ Direct order creation failed.');
  }

  console.log('\n--- 11. Testing API Key Fallback Routing ---');
  // Set key to invalid placeholder to force rule-based fallback
  const originalKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'your_openai_api_key';

  await WhatsAppConversation.updateOne({ phone }, { humanSupportRequired: false, loopedAiState: { step: 'idle', orderData: {} } });
  await WhatsAppMessage.deleteMany({ phone });

  console.log('Simulating incoming message "Hi" (should fallback cleanly to rule-based conversation)...');
  await aiService.processIncomingMessage(phone, 'Hi', 'Aditi');
  const lastMsg = await WhatsAppMessage.findOne({ phone, sender: 'ai' }).sort({ createdAt: -1 });
  if (lastMsg && lastMsg.text.includes('Welcome to Looped')) {
    console.log('✅ Fallback routing passed: rule-based AI reply received:');
    console.log('   Reply:', lastMsg.text);
  } else {
    console.error('❌ Fallback routing failed.');
  }

  // Restore API key
  process.env.OPENAI_API_KEY = originalKey;

  console.log('\n🏁 Tests completed.');
  await mongoose.disconnect();
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  mongoose.disconnect();
});
