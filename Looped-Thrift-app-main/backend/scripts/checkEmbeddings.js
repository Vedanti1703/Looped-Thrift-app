const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const mongoose = require('mongoose');
const Product = require('../models/Product');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';

async function checkEmbeddings() {
  try {
    await mongoose.connect(MONGO_URI);
    const totalCount = await Product.countDocuments({});
    const embeddedCount = await Product.countDocuments({ embedding: { $exists: true, $ne: null, $not: { $size: 0 } } });

    console.log(`TOTAL_PRODUCTS: ${totalCount}`);
    console.log(`EMBEDDED_PRODUCTS: ${embeddedCount}`);
  } catch (err) {
    console.error('Check failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkEmbeddings();
