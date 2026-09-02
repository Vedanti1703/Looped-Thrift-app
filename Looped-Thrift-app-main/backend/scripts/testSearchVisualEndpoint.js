const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const axios = require('axios');

async function testVisualSearchEndpoint() {
  console.log('🚀 Testing POST /products/search-visual endpoint...');
  try {
    const sampleDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const res = await axios.post('http://localhost:5000/products/search-visual', {
      imageUrl: sampleDataUrl
    });

    console.log('✅ Status:', res.status);
    console.log('Description:', res.data.description);
    console.log('Matched Products Count:', res.data.products?.length);
  } catch (err) {
    console.error('❌ Endpoint test failed:', err.response?.data || err.message);
  }
}

testVisualSearchEndpoint();
