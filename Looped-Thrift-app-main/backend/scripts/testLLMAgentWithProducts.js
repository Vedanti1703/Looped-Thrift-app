const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const mongoose = require('mongoose');
const loopedAi = require('../controllers/loopedAiController');
const { Conversation, Message } = require('../models/Message');
const User = require('../models/User');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';

async function testAgent() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.');

  try {
    const assistant = await loopedAi.getOrCreateAssistantUser();
    const testUser = await User.findOne({});
    if (!testUser) return;

    const convo = await Conversation.create({
      buyerId: testUser._id,
      buyerName: testUser.name || 'Test User',
      sellerId: assistant._id,
      sellerName: 'Looped AI',
      lastMessage: 'Hi',
    });

    console.log('\n--- Testing Product Recommendation Query ---');
    const result = await loopedAi.generateResponse('Show me hoodies or coats under 2500', convo, testUser._id.toString());

    console.log('Response Text:\n', result.text);
    console.log('\nSuggested Products Count:', result.suggestedProducts?.length);
    (result.suggestedProducts || []).forEach((p, i) => {
      console.log(`${i + 1}. ${p.title} (₹${p.price}) - Image: ${p.image}`);
    });

    // Cleanup
    await Message.deleteMany({ conversationId: convo._id });
    await Conversation.deleteOne({ _id: convo._id });
    console.log('\n✅ Test complete and cleaned up.');
  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await mongoose.disconnect();
  }
}

testAgent();
