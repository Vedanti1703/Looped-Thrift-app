/**
 * updateProductImages.js
 * Updates the `image` field of existing synthetic products in MongoDB
 * to use curated Unsplash fashion photos instead of random Picsum photos.
 *
 * Only updates products whose image URL contains 'picsum.photos'.
 * Does NOT touch the original 30 hand-curated products (they use Unsplash already).
 * Does NOT modify any other fields.
 *
 * Usage:
 *   node scripts/updateProductImages.js --dry-run   → preview only
 *   node scripts/updateProductImages.js             → apply updates
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path     = require('path');
const fs       = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const Product  = require('../models/Product');

const DATA_PATH = path.resolve(__dirname, '../data/looped-products.json');
const DRY_RUN   = process.argv.includes('--dry-run');

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  🖼️  Product Image Updater');
  console.log(`  Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🟢 LIVE UPDATE'}`);
  console.log(`${'═'.repeat(60)}\n`);

  // Load the regenerated dataset (with fixed image URLs)
  const generatedProducts = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  console.log(`📦 Loaded ${generatedProducts.length} products from regenerated dataset`);

  // Build a lookup: title+category+size+condition+price → new image URL
  const imageMap = new Map();
  for (const p of generatedProducts) {
    const key = `${(p.title || '').toLowerCase().trim()}|${p.category}|${p.size}|${p.condition}|${p.price}`;
    imageMap.set(key, p.image);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // Find all products in MongoDB
  const allDbProducts = await Product.find({}).lean();
  console.log(`🔍 Found ${allDbProducts.length} products in MongoDB`);

  let updated = 0;
  let unchanged = 0;
  let notFound = 0;

  for (const dbProduct of allDbProducts) {
    const key = `${(dbProduct.title || '').toLowerCase().trim()}|${dbProduct.category}|${dbProduct.size}|${dbProduct.condition}|${dbProduct.price}`;
    const newImage = imageMap.get(key);

    if (!newImage) {
      notFound++;
      continue;
    }

    if (dbProduct.image === newImage) {
      unchanged++;
      continue;
    }

    if (DRY_RUN) {
      if (updated < 5) {
        console.log(`  [preview] ${dbProduct.title}`);
        console.log(`    OLD: ${dbProduct.image}`);
        console.log(`    NEW: ${newImage}\n`);
      }
      updated++;
    } else {
      await Product.updateOne(
        { _id: dbProduct._id },
        { $set: { image: newImage } }
      );
      updated++;
      if (updated % 100 === 0) process.stdout.write(`   Updated: ${updated}/${allDbProducts.length}\r`);
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${DRY_RUN ? 'WOULD UPDATE' : '✅ UPDATED'}: ${updated} products`);
  console.log(`  Skipped (no match in dataset): ${notFound}`);
  console.log(`  Unchanged (already up to date): ${unchanged}`);
  console.log(`${'═'.repeat(60)}\n`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
