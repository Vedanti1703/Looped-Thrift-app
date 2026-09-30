/**
 * test_style_me_suite.js
 * Tests the AI Style Me pipeline end-to-end against a live MongoDB + OpenAI
 *
 * Run: node scripts/test_style_me_suite.js
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
const path     = require('path');
const dotenv   = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env'), override: true });

const Product = require('../models/Product');

// ── Import controller internals ────────────────────────────────────────────
// We'll call the exported HTTP handler with mock req/res objects
const styleMeController = require('../controllers/styleMeController');

function mockReqRes(body = {}) {
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) { statusCode = code; return this; },
    json(data)   { responseData = data; return this; }
  };

  const req = { body };

  return {
    req, res,
    getStatus: () => statusCode,
    getData:   () => responseData
  };
}

const SAMPLE_QUERIES = [
  {
    label:       'Casual summer under ₹1200',
    query:       'Give me a casual summer outfit under ₹1200.',
    expectedBudget: 1200
  },
  {
    label:       'Y2K college party pink/white',
    query:       'I want a Y2K outfit for a college party, preferably pink or white.',
    expectedKeywords: ['y2k', 'party', 'pink', 'white']
  },
  {
    label:       'Streetwear oversized under ₹1800',
    query:       'I want a streetwear outfit for college under ₹1800. I like oversized clothes.',
    expectedBudget: 1800,
    expectedKeywords: ['oversized', 'streetwear']
  }
];

async function runTestSuite() {
  console.log('🚀 Starting AI Style Me Test Suite...\n');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB\n');

  const productCount = await Product.countDocuments();
  console.log(`📦 Products in DB: ${productCount}\n`);

  let passed = 0;
  let total  = 0;

  function assert(condition, name) {
    total++;
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${name}`);
    }
  }

  // Collect all real product IDs for hallucination check
  const realProducts = await Product.find({}, '_id').lean();
  const realIds = new Set(realProducts.map(p => p._id.toString()));

  for (const sample of SAMPLE_QUERIES) {
    console.log(`\n🎯 QUERY: "${sample.query}"`);
    console.log('─'.repeat(60));

    const { req, res, getData, getStatus } = mockReqRes({ query: sample.query });

    const startMs = Date.now();
    await styleMeController.styleMeQuery(req, res);
    const elapsedMs = Date.now() - startMs;

    const data    = getData();
    const status  = getStatus();

    console.log(`   HTTP status: ${status} | Time: ${elapsedMs}ms`);

    // ── Test 1: Status is 200 ──────────────────────────────────────────────
    assert(status === 200, 'Response status is 200');

    // ── Test 2: Valid preference JSON extracted ────────────────────────────
    const prefs = data?.preferences;
    assert(
      prefs && typeof prefs === 'object' && Object.keys(prefs).length >= 4,
      `Valid JSON preferences extracted: ${JSON.stringify(prefs)}`
    );

    // ── Test 3: Budget extraction (if expected) ────────────────────────────
    if (sample.expectedBudget) {
      assert(
        prefs?.budget === sample.expectedBudget,
        `Budget correctly extracted as ${sample.expectedBudget} (got: ${prefs?.budget})`
      );
    }

    // ── Test 4: Keywords / colors extracted (if expected) ─────────────────
    if (sample.expectedKeywords) {
      const allExtracted = [
        ...(prefs?.keywords || []),
        ...(prefs?.colors || []),
        prefs?.style || '',
        prefs?.occasion || ''
      ].map(s => s.toLowerCase());

      const matched = sample.expectedKeywords.some(kw =>
        allExtracted.some(ex => ex.includes(kw.toLowerCase()))
      );
      assert(
        matched,
        `At least one expected keyword matched in preferences (looking for: ${sample.expectedKeywords.join(', ')})`
      );
    }

    // ── Test 5: Outfits returned ───────────────────────────────────────────
    const outfits = data?.outfits || [];
    assert(outfits.length >= 1, `At least 1 outfit returned (got: ${outfits.length})`);

    if (outfits.length > 0) {
      // ── Test 6: All product IDs are REAL (no hallucinations) ──────────────
      let allReal = true;
      let hallucinatedIds = [];
      for (const outfit of outfits) {
        for (const item of outfit.items || []) {
          if (!realIds.has(item._id)) {
            allReal = false;
            hallucinatedIds.push(item._id);
          }
        }
      }
      assert(
        allReal,
        `All product IDs are real DB IDs (no hallucinations)${hallucinatedIds.length > 0 ? ` — HALLUCINATED: ${hallucinatedIds.join(', ')}` : ''}`
      );

      // ── Test 7: Correct total price calculation ────────────────────────────
      let priceCalcCorrect = true;
      for (const outfit of outfits) {
        const sum = (outfit.items || []).reduce((s, i) => s + i.price, 0);
        if (Math.abs(sum - outfit.totalPrice) > 1) {
          priceCalcCorrect = false;
          console.log(`   ⚠️  Price mismatch: items sum to ${sum} but totalPrice=${outfit.totalPrice}`);
        }
      }
      assert(priceCalcCorrect, 'Total price for each outfit matches sum of item prices');

      // ── Test 8: Non-empty AI explanation ──────────────────────────────────
      const allHaveExplanations = outfits.every(o => o.explanation && o.explanation.trim().length > 5);
      assert(allHaveExplanations, 'All outfits have non-empty AI explanations');

      // ── Test 9: Style match % is in valid range ────────────────────────────
      const allMatchValid = outfits.every(o => o.styleMatch >= 50 && o.styleMatch <= 100);
      assert(allMatchValid, 'All style match scores are in range 50–100%');

      // ── Test 10: Budget not exceeded (if set) ──────────────────────────────
      if (sample.expectedBudget) {
        const allUnderBudget = outfits.every(o => o.totalPrice <= sample.expectedBudget);
        assert(
          allUnderBudget,
          `All outfits are within budget of ₹${sample.expectedBudget} (got: ${outfits.map(o => o.totalPrice).join(', ')})`
        );
      }

      // Print outfit summary
      console.log(`\n   📊 Outfit Summary:`);
      outfits.forEach((o, idx) => {
        const itemList = o.items.map(i => `${i.title} (${i.category}) ₹${i.price}`).join(' | ');
        console.log(`   Look ${idx + 1}: ₹${o.totalPrice} | ${o.styleMatch}% match`);
        console.log(`   Items: ${itemList}`);
        console.log(`   Explanation: "${o.explanation}"`);
      });
    }
  }

  // ── Test: Error handling for empty query ───────────────────────────────
  console.log('\n🛑 Testing error handling...');
  const { req: emptyReq, res: emptyRes, getData: emptyData, getStatus: emptyStatus } = mockReqRes({ query: '' });
  await styleMeController.styleMeQuery(emptyReq, emptyRes);
  total++;
  if (emptyStatus() === 400) {
    console.log('  ✅ Empty query correctly returns 400');
    passed++;
  } else {
    console.error(`  ❌ Expected 400 for empty query, got ${emptyStatus()}`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`🎉 AI STYLE ME TEST SUITE: ${passed} / ${total} TESTS PASSED`);
  console.log('═'.repeat(60) + '\n');

  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
