const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const axios = require('axios');

async function runTests() {
  const queries = [
    'cute clothes for a Japan trip',
    'warm winter coat for cold weather',
    'traditional wedding attire'
  ];

  for (const q of queries) {
    console.log(`\n========================================`);
    console.log(`Query: "${q}"`);
    console.log(`========================================`);
    const res = await axios.post('http://localhost:5000/products/search-natural', {
      query: q,
      limit: 3,
    });
    res.data.forEach((p, i) => {
      console.log(`${i + 1}. [Score: ${p.score?.toFixed(4)}] ${p.title} (${p.category})`);
    });
  }
}

runTests();
