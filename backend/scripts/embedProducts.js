const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const mongoose = require('mongoose');
const Product = require('../models/Product');
const { getEmbedding } = require('../utils/embeddings');

// Safety check for OPENAI_API_KEY
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey || apiKey.toLowerCase().includes('your_') || apiKey.toLowerCase().includes('placeholder')) {
  console.error('❌ OPENAI_API_KEY not found in environment — check your backend/.env file');
  process.exit(1);
}

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';

async function embedProducts() {
  console.log('🚀 Starting product embedding batch process...');

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB connected');

    const products = await Product.find({ $or: [{ embedding: { $exists: false } }, { embedding: null }] });
    console.log(`Found ${products.length} products to process.`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];

      // Build composite text representation from product metadata
      const textParts = [
        product.title,
        product.description,
        product.category,
        Array.isArray(product.tags) ? product.tags.join(' ') : product.tags,
        product.condition,
        product.brand,
      ].filter(Boolean);

      const textToEmbed = textParts.join(' ').trim();

      if (!textToEmbed) {
        console.log(`[${i + 1}/${products.length}] Skipping product ${product._id}: No textual fields present`);
        continue;
      }

      try {
        const embedding = await getEmbedding(textToEmbed);
        product.embedding = embedding;
        await product.save();
        successCount++;
        console.log(`Embedded ${i + 1}/${products.length} products (${product.title})`);
      } catch (err) {
        failCount++;
        console.error(`❌ Failed embedding product ${product._id} (${product.title}):`, err.message);
      }

      // Small delay (~100ms) to respect OpenAI rate limits
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n========================================');
    console.log('🎉 Product Embedding Batch Complete');
    console.log(`- Total products scanned: ${products.length}`);
    console.log(`- Successfully embedded:   ${successCount}`);
    console.log(`- Failed:                 ${failCount}`);
    console.log('========================================\n');

  } catch (err) {
    console.error('❌ Fatal error in embedProducts script:', err.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

embedProducts();
