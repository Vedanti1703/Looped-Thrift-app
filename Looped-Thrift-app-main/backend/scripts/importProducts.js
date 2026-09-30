/**
 * importProducts.js
 * Safely imports data/looped-products.json into MongoDB — ADDITIVE ONLY.
 * Never deletes, overwrites, or resets existing products.
 *
 * Usage:
 *   node scripts/importProducts.js --dry-run          → preview only
 *   node scripts/importProducts.js                    → real import
 *   node scripts/importProducts.js --count 500        → import only first N
 *
 * Reuses the existing DB connection pattern from backend/.env / MONGO_URI.
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const path     = require('path');
const fs       = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const Product  = require('../models/Product');

const INPUT_PATH = path.resolve(__dirname, '../data/looped-products.json');

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const cIdx    = args.indexOf('--count');
const LIMIT   = cIdx !== -1 ? parseInt(args[cIdx + 1], 10) || Infinity : Infinity;

// ── Duplicate detection: same title+category+size+condition+price ─────────────
function dedupKey(p) {
  return `${(p.title || '').toLowerCase().trim()}|${p.category}|${p.size}|${p.condition}|${p.price}`;
}

async function run() {
  console.log(`\n${'═'.repeat(60)}`);
  console.log('  🚀 Looped Product Importer');
  console.log(`  Mode:    ${DRY_RUN ? '🔍 DRY RUN (no writes)' : '🟢 LIVE IMPORT'}`);
  console.log(`  Input:   ${INPUT_PATH}`);
  console.log(`  Data:    SYNTHETIC / DEMO ONLY — not real scraped inventory`);
  console.log(`${'═'.repeat(60)}\n`);

  if (!fs.existsSync(INPUT_PATH)) {
    console.error('❌ Input file not found. Run: node scripts/generateProducts.js first');
    process.exit(1);
  }

  // ── Load generated products ─────────────────────────────────────────────────
  let generated;
  try {
    generated = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  } catch(e) {
    console.error('❌ JSON parse error:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(generated) || generated.length === 0) {
    console.error('❌ Input file is empty or not an array');
    process.exit(1);
  }

  // Apply --count limit
  const toImport = LIMIT < Infinity ? generated.slice(0, LIMIT) : generated;
  console.log(`📦 Loaded ${generated.length} generated products`);
  if (LIMIT < Infinity) console.log(`   Using first ${toImport.length} (--count ${LIMIT})`);

  // ── Connect to MongoDB ──────────────────────────────────────────────────────
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  // ── Count existing ──────────────────────────────────────────────────────────
  const existingCount = await Product.countDocuments();
  console.log(`📊 Existing products in DB: ${existingCount}`);

  // Build duplicate key set from existing products
  const existingProducts = await Product.find({}, 'title category size condition price').lean();
  const existingKeys = new Set(existingProducts.map(p => dedupKey(p)));
  console.log(`🔑 Loaded ${existingKeys.size} duplicate-detection keys from existing DB`);

  // Also build duplicate set from generated batch itself
  const generatedKeys = new Set();

  // ── Filter: valid, non-duplicate products ────────────────────────────────────
  const toInsert    = [];
  const skippedDup  = [];
  const skippedInvalid = [];
  const VALID_CONDITIONS = ['New with tags', 'Like New', 'Good', 'Fair', 'Well Loved'];

  for (const p of toImport) {
    // Basic validation
    if (!p.title || !p.price || !p.condition || !p.category || !p.image) {
      skippedInvalid.push(p.title || '(no title)');
      continue;
    }
    if (!VALID_CONDITIONS.includes(p.condition)) {
      skippedInvalid.push(`${p.title} (bad condition: ${p.condition})`);
      continue;
    }
    if (typeof p.price !== 'number' || p.price <= 0) {
      skippedInvalid.push(`${p.title} (bad price: ${p.price})`);
      continue;
    }

    const key = dedupKey(p);

    // Skip if already in DB
    if (existingKeys.has(key)) {
      skippedDup.push(p.title);
      continue;
    }
    // Skip intra-batch duplicates
    if (generatedKeys.has(key)) {
      skippedDup.push(p.title);
      continue;
    }

    generatedKeys.add(key);

    // Build the clean document (no _id — MongoDB generates it)
    toInsert.push({
      title:         p.title,
      description:   p.description   || '',
      price:         p.price,
      originalPrice: p.originalPrice  || undefined,
      condition:     p.condition,
      category:      p.category,
      tags:          Array.isArray(p.tags) ? p.tags : [],
      image:         p.image,
      images:        Array.isArray(p.images) ? p.images : [],
      sellerName:    p.sellerName     || 'Looped Member',
      size:          p.size           || '',
      brand:         p.brand          || '',
      listingType:   p.listingType    || 'sell',
      views:         p.views          || 0,
      likes:         p.likes          || 0,
      avgRating:     p.avgRating      || 0,
      reviewCount:   p.reviewCount    || 0,
      // embedding: left undefined — embedProducts.js will fill it after import
    });
  }

  const expectedFinal = existingCount + toInsert.length;

  // ── Pre-import summary ──────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  PRE-IMPORT SUMMARY');
  console.log(`${'─'.repeat(60)}`);
  console.log(`  Existing products:      ${existingCount}`);
  console.log(`  Generated products:     ${toImport.length}`);
  console.log(`  Potential duplicates:   ${skippedDup.length}`);
  console.log(`  Invalid products:       ${skippedInvalid.length}`);
  console.log(`  To insert:              ${toInsert.length}`);
  console.log(`  Expected final count:   ${expectedFinal}`);
  console.log(`${'─'.repeat(60)}\n`);

  if (skippedInvalid.length > 0) {
    console.log('⚠️  Invalid products (skipped):');
    skippedInvalid.slice(0, 5).forEach(n => console.log(`    - ${n}`));
    if (skippedInvalid.length > 5) console.log(`    ... and ${skippedInvalid.length - 5} more`);
    console.log('');
  }

  if (DRY_RUN) {
    console.log('🔍 DRY RUN — no data written to MongoDB.');
    console.log(`   Would insert ${toInsert.length} new products.`);
    console.log('\n   Sample of first 3 to-insert:');
    toInsert.slice(0, 3).forEach((p, i) => {
      console.log(`   [${i+1}] ${p.title} | ${p.category} | ${p.condition} | ₹${p.price}`);
      console.log(`        Tags: ${p.tags.join(', ')}`);
    });
    console.log('\n   To run real import: node scripts/importProducts.js\n');
    await mongoose.disconnect();
    process.exit(0);
  }

  if (toInsert.length === 0) {
    console.log('ℹ️  Nothing to insert (all products already exist or are invalid).');
    await mongoose.disconnect();
    process.exit(0);
  }

  // ── Batch insert ────────────────────────────────────────────────────────────
  console.log(`⬆️  Inserting ${toInsert.length} products in batches of 100...`);
  const BATCH_SIZE = 100;
  let insertedTotal = 0;

  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const batch = toInsert.slice(i, i + BATCH_SIZE);
    try {
      const result = await Product.insertMany(batch, { ordered: false });
      insertedTotal += result.length;
      process.stdout.write(`   Progress: ${insertedTotal}/${toInsert.length}\r`);
    } catch(e) {
      if (e.writeErrors) {
        // Partial success — count successful writes
        const successful = batch.length - (e.writeErrors?.length || 0);
        insertedTotal += successful;
        console.warn(`\n   ⚠️ Batch write partial: ${e.writeErrors.length} errors in batch starting at ${i}`);
      } else {
        console.error(`\n   ❌ Batch insert error at index ${i}:`, e.message);
      }
    }
  }

  const finalCount = await Product.countDocuments();
  const actuallyInserted = finalCount - existingCount;

  console.log(`\n\n${'═'.repeat(60)}`);
  console.log('  ✅ IMPORT COMPLETE');
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Products before:        ${existingCount}`);
  console.log(`  Products inserted:      ${actuallyInserted}`);
  console.log(`  Products after:         ${finalCount}`);
  console.log(`  Duplicates skipped:     ${skippedDup.length}`);
  console.log(`  Invalid skipped:        ${skippedInvalid.length}`);
  console.log(`${'═'.repeat(60)}\n`);

  console.log('🔄 Next step: generate embeddings for new products:');
  console.log('   node scripts/embedProducts.js\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Import error:', err.message);
  process.exit(1);
});
