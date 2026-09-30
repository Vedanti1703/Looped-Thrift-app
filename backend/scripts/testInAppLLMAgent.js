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

async function testInAppLLMAgent() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.');

  try {
    const assistant = await loopedAi.getOrCreateAssistantUser();
    let testUser = await User.findOne({});
    if (!testUser) {
      console.log('No user found to test with.');
      return;
    }

    // Create a dummy conversation
    let convo = await Conversation.create({
      buyerId: testUser._id,
      buyerName: testUser.name || 'Test User',
      sellerId: assistant._id,
      sellerName: 'Looped AI',
      lastMessage: 'Hi',
      lastMessageAt: new Date(),
    });

    console.log('\n--- Test 1: Product Search query via generateResponse ---');
    const reply1 = await loopedAi.generateResponse('Can you show me hoodies under 1500?', convo, testUser._id.toString());
    console.log('🤖 AI Reply 1:\n', reply1);

    console.log('\n--- Test 2: Return Policy query via generateResponse ---');
    const reply2 = await loopedAi.generateResponse('What is your return policy?', convo, testUser._id.toString());
    console.log('🤖 AI Reply 2:\n', reply2);

    // Cleanup test conversation & messages
    await Message.deleteMany({ conversationId: convo._id });
    await Conversation.deleteOne({ _id: convo._id });
    console.log('\n✅ Cleaned up test conversation.');

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testInAppLLMAgent();
