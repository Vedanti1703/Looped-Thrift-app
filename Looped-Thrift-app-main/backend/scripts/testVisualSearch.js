const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const mongoose = require('mongoose');
const { searchByImage } = require('../services/visualSearch');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';

// Sample base64 image data URL
const SAMPLE_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function testVisualSearch() {
  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected.');

  try {
    console.log('\n--- Testing Visual Search Pipeline ---');
    const result = await searchByImage(SAMPLE_DATA_URL);
    console.log('Success:', result.success);
    console.log('GPT-4o Vision Description:', result.description);
    console.log('Matched Products Count:', result.products?.length);

    (result.products || []).slice(0, 3).forEach((p, i) => {
      console.log(` ${i + 1}. ${p.title} (₹${p.price}) - Score: ${p.score || 'N/A'}`);
    });

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testVisualSearch();
