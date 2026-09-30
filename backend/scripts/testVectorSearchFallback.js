const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const mongoose = require('mongoose');
const { executeTool } = require('../services/agentTools');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';

async function testSearchTool() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.');

  try {
    console.log('\n--- Test 1: Semantic Search query ---');
    const res1 = await executeTool('searchProducts', { search: 'cute clothes for a Japan trip' }, 'web', 'test_convo');
    console.log('Search Result 1 Success:', res1.success);
    console.log('Search Type:', res1.searchType);
    console.log('Found Products Count:', res1.products?.length);
    (res1.products || []).slice(0, 3).forEach((p, i) => {
      console.log(` ${i + 1}. ${p.title} (₹${p.price}) - Score: ${p.score || 'N/A'}`);
    });

    console.log('\n--- Test 2: Fallback / Keyword query ---');
    const res2 = await executeTool('searchProducts', { search: 'hoodie' }, 'web', 'test_convo');
    console.log('Search Result 2 Success:', res2.success);
    console.log('Search Type:', res2.searchType);
    console.log('Found Products Count:', res2.products?.length);

  } catch (err) {
    console.error('❌ Test error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

testSearchTool();
