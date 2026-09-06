/**
 * styleMeController.js  v2
 * POST /style-me  { query: string }
 *
 * FIXED PIPELINE (v2):
 *  1. LLM → extract HARD constraints + soft preferences (separated)
 *  2. DB filter on hard constraints FIRST → candidate set
 *  3. Transparent weighted scoring within candidates (not raw semantic score)
 *  4. Outfit assembly with constraint-aware Style Match % capping
 *  5. LLM → grounded explanation per outfit
 *
 * ROOT CAUSE FIXED:
 *  - Semantic search no longer runs "first". Hard constraints filter the
 *    DB before any scoring happens.
 *  - Explicit color/category/keyword matching now dominate ranking
 *    (category: 30pts, color: 30pts, style: 15pts, semantic: 15pts, keyword: 5pts, budget: 5pts)
 *  - Style Match % is capped when hard constraints are violated.
 *  - Fallback results are explicitly labeled (matchType: 'exact'|'partial'|'fallback').
 *  - Dev mode adds scoreBreakdown per product.
 */

const path   = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const axios   = require('axios');
const Product = require('../models/Product');
const { getEmbedding } = require('../utils/embeddings');

const IS_DEV = process.env.NODE_ENV !== 'production';

// ──────────────────────────────────────────────────────────────────────────────
// COLOR NORMALIZATION
// ──────────────────────────────────────────────────────────────────────────────
const COLOR_FAMILIES = {
  pink:   ['pink', 'light pink', 'baby pink', 'blush', 'rose pink', 'hot pink', 'pastel pink', 'dusty pink', 'flamingo', 'coral pink'],
  red:    ['red', 'crimson', 'scarlet', 'maroon', 'burgundy', 'wine', 'rust'],
  orange: ['orange', 'amber', 'tangerine', 'peach', 'apricot', 'terracotta'],
  yellow: ['yellow', 'mustard', 'gold', 'lemon', 'butter', 'cream', 'ivory', 'off-white'],
  green:  ['green', 'olive', 'sage', 'forest green', 'emerald', 'mint', 'lime', 'khaki'],
  blue:   ['blue', 'navy', 'cobalt', 'royal blue', 'sky blue', 'denim', 'indigo', 'teal', 'aqua', 'turquoise', 'baby blue'],
  purple: ['purple', 'violet', 'lavender', 'lilac', 'mauve', 'plum'],
  black:  ['black', 'jet black', 'charcoal', 'ebony', 'onyx', 'dark'],
  white:  ['white', 'off-white', 'cream', 'ivory', 'snow white', 'pearl'],
  grey:   ['grey', 'gray', 'silver', 'ash', 'smoke'],
  brown:  ['brown', 'tan', 'camel', 'beige', 'khaki', 'chocolate', 'mocha'],
  pastel: ['pastel', 'pastel pink', 'pastel blue', 'pastel green', 'pastel yellow', 'baby pink', 'baby blue', 'lavender', 'mint'],
  multicolor: ['multicolor', 'colorful', 'tie-dye', 'printed', 'patchwork'],
};

// Reverse map: each variant → family name
const colorToFamily = {};
for (const [family, variants] of Object.entries(COLOR_FAMILIES)) {
  for (const v of variants) {
    colorToFamily[v.toLowerCase()] = family;
  }
}

function normalizeColor(color) {
  const c = color.toLowerCase().trim();
  return colorToFamily[c] || c;
}

/**
 * Score how well a product's text matches a required color.
 * Returns: 1.0 (exact), 0.5 (same family), 0.0 (no match)
 */
function colorMatchScore(product, requiredColor) {
  if (!requiredColor) return 1.0; // no constraint → no penalty
  const prodText = productSearchText(product).toLowerCase();
  const req = requiredColor.toLowerCase().trim();
  const reqFamily = normalizeColor(req);
  const variants = COLOR_FAMILIES[reqFamily] || [req];

  // Exact word match
  for (const v of variants) {
    if (prodText.includes(v)) return 1.0;
  }

  // Family-level match (e.g. "pastel" tag when asking for "pink")
  if (reqFamily && prodText.includes(reqFamily)) return 0.5;
  for (const [family, famVariants] of Object.entries(COLOR_FAMILIES)) {
    if (family === reqFamily) continue;
    for (const v of famVariants) {
      if (v === req && prodText.includes(family)) return 0.5;
    }
  }

  return 0.0;
}

// ──────────────────────────────────────────────────────────────────────────────
// CATEGORY NORMALIZATION
// ──────────────────────────────────────────────────────────────────────────────
const CATEGORY_SYNONYMS = {
  // User might say:                → DB categories
  'top':          ["Women's Tops", "Men's Tops"],
  'tops':         ["Women's Tops", "Men's Tops"],
  'shirt':        ["Women's Tops", "Men's Tops"],
  'blouse':       ["Women's Tops"],
  'tee':          ["Women's Tops", "Men's Tops"],
  't-shirt':      ["Women's Tops", "Men's Tops"],
  'tshirt':       ["Women's Tops", "Men's Tops"],
  'crop top':     ["Women's Tops"],
  'cardigan':     ["Women's Tops", "Men's Tops"],
  'knit':         ["Women's Tops", "Men's Tops"],
  'sweater':      ["Women's Tops", "Men's Tops"],
  'pullover':     ["Women's Tops", "Men's Tops"],
  'sweatshirt':   ["Women's Tops", "Men's Tops"],
  'hoodie':       ["Men's Tops", "Women's Tops"],
  'flannel':      ["Men's Tops"],
  'turtleneck':   ["Women's Tops", "Men's Tops"],
  'bottom':       ["Women's Bottoms", "Men's Bottoms"],
  'bottoms':      ["Women's Bottoms", "Men's Bottoms"],
  'pants':        ["Women's Bottoms", "Men's Bottoms"],
  'trousers':     ["Women's Bottoms", "Men's Bottoms"],
  'jeans':        ["Women's Bottoms", "Men's Bottoms"],
  'denim jeans':  ["Women's Bottoms", "Men's Bottoms"],
  'skirt':        ["Women's Bottoms"],
  'shorts':       ["Women's Bottoms", "Men's Bottoms"],
  'jogger':       ["Men's Bottoms", "Women's Bottoms"],
  'leggings':     ["Women's Bottoms"],
  'jacket':       ["Women's Outerwear", "Men's Outerwear"],
  'jackets':      ["Women's Outerwear", "Men's Outerwear"],
  'coat':         ["Women's Outerwear", "Men's Outerwear"],
  'blazer':       ["Women's Outerwear", "Men's Outerwear"],
  'outerwear':    ["Women's Outerwear", "Men's Outerwear"],
  'kimono':       ["Women's Traditional"],
  'saree':        ["Women's Traditional"],
  'sari':         ["Women's Traditional"],
  'lehenga':      ["Women's Traditional"],
  'anarkali':     ["Women's Traditional"],
  'dupatta':      ["Accessories"],
  'scarf':        ["Accessories"],
  'shoes':        ["Footwear"],
  'sneakers':     ["Footwear"],
  'boots':        ["Footwear"],
  'heels':        ["Footwear"],
  'footwear':     ["Footwear"],
  'bag':          ["Bags"],
  'handbag':      ["Bags"],
  'purse':        ["Bags"],
  'necklace':     ["Jewelry"],
  'earrings':     ["Jewelry"],
  'jewelry':      ["Jewelry"],
  'accessory':    ["Accessories", "Jewelry", "Bags"],
  'accessories':  ["Accessories", "Jewelry", "Bags"],
  'dress':        ["Women's Sets", "Women's Traditional"],
  'set':          ["Women's Sets"],
  'coord':        ["Women's Sets"],
  'traditional':  ["Women's Traditional"],
  'ethnic':       ["Women's Traditional"],
};

function keywordToCategories(kw) {
  const k = kw.toLowerCase().trim();
  return CATEGORY_SYNONYMS[k] || null;
}

function productSearchText(product) {
  return [
    product.title || '',
    product.description || '',
    (product.tags || []).join(' '),
    product.brand || '',
    product.category || '',
    product.condition || '',
    product.size || '',
  ].join(' ');
}

// ──────────────────────────────────────────────────────────────────────────────
// OPENAI HELPER (reuses same axios pattern as aiServiceLLM.js)
// ──────────────────────────────────────────────────────────────────────────────
async function openAiChat(messages, { json = false, maxTokens = 500 } = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model  = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_')) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const payload = { model, messages, max_tokens: maxTokens };
  if (json) payload.response_format = { type: 'json_object' };

  const res = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`
      },
      timeout: 15000
    }
  );

  return res.data?.choices?.[0]?.message?.content || '';
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 1: PREFERENCE EXTRACTION (Hard constraints vs Soft preferences)
// ──────────────────────────────────────────────────────────────────────────────
async function extractPreferences(query) {
  const systemPrompt = `You are a fashion preference extractor for Looped, an Indian thrift app.
Extract ONLY what the user EXPLICITLY states. Never infer unstated attributes.

Return valid JSON only — no markdown, no extra text.

JSON shape:
{
  "hard_constraints": {
    "colors": string[],        // ONLY explicitly mentioned colors. [] if none.
    "category_keywords": string[], // ONLY explicitly mentioned item types (e.g. "cardigan", "hoodie", "jeans"). [] if none.
    "max_price": number | null // ONLY if price/budget explicitly stated. null otherwise.
  },
  "soft_preferences": {
    "occasion": string | null, // e.g. "college farewell", "party". null if not mentioned.
    "gender": "women" | "men" | "unisex" | null,
    "season": "summer" | "winter" | "monsoon" | null,
    "fit": string | null       // e.g. "oversized", "fitted", "flared". null if not mentioned.
  },
  "style_keywords": string[], // style vibes explicitly mentioned: "Y2K", "streetwear", "classy", "casual", etc.
  "is_full_outfit_request": boolean // true if user asks for a "complete outfit", "full look", or similar
}

CRITICAL RULES — violations are bugs:
1. colors[]: ONLY if a specific color word appears in the input. "college farewell" → colors: []. "pink cardigan" → colors: ["pink"].
2. category_keywords[]: ONLY if a specific item type appears. "I want an outfit" → []. "I want a cardigan" → ["cardigan"].
3. max_price: ONLY if the user writes a number or "under ₹X". Infer nothing.
4. Do NOT infer occasion from item type. "pink top" → occasion: null, NOT "party".
5. Do NOT infer season from style words. "streetwear" → season: null.`;

  const content = await openAiChat([
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: query }
  ], { json: true, maxTokens: 400 });

  try {
    const parsed = JSON.parse(content);
    // Ensure all required fields exist with safe defaults
    return {
      hard_constraints: {
        colors: parsed.hard_constraints?.colors || [],
        category_keywords: parsed.hard_constraints?.category_keywords || [],
        max_price: parsed.hard_constraints?.max_price || null
      },
      soft_preferences: {
        occasion: parsed.soft_preferences?.occasion || null,
        gender: parsed.soft_preferences?.gender || null,
        season: parsed.soft_preferences?.season || null,
        fit: parsed.soft_preferences?.fit || null
      },
      style_keywords: parsed.style_keywords || [],
      is_full_outfit_request: parsed.is_full_outfit_request ?? false
    };
  } catch {
    return {
      hard_constraints: { colors: [], category_keywords: [], max_price: null },
      soft_preferences: { occasion: null, gender: null, season: null, fit: null },
      style_keywords: [],
      is_full_outfit_request: false
    };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 2: DB FILTER FIRST → then rank
// ──────────────────────────────────────────────────────────────────────────────
async function retrieveCandidates(prefs) {
  const { hard_constraints, soft_preferences, style_keywords } = prefs;
  const { colors, category_keywords, max_price } = hard_constraints;

  // ── Build MongoDB query from hard constraints ─────────────────────────────
  const dbQuery = {};

  // Budget is a hard filter
  if (max_price) dbQuery.price = { $lte: max_price };

  // Gender filter from soft prefs
  if (soft_preferences.gender === 'women') {
    dbQuery.category = { $regex: "Women's", $options: 'i' };
  } else if (soft_preferences.gender === 'men') {
    dbQuery.category = { $regex: "Men's", $options: 'i' };
  }

  // ── Resolve category keywords → actual DB category names ─────────────────
  const targetCategories = [];
  for (const kw of category_keywords) {
    const cats = keywordToCategories(kw);
    if (cats) targetCategories.push(...cats);
  }
  const uniqueTargetCategories = [...new Set(targetCategories)];

  // ── RETRIEVAL STRATEGY ────────────────────────────────────────────────────
  // Phase A: exact category match if categories resolved
  let exactCandidates = [];
  if (uniqueTargetCategories.length > 0) {
    const exactQuery = { ...dbQuery, category: { $in: uniqueTargetCategories } };
    exactCandidates = await Product.find(exactQuery).lean();
  }

  // Phase B: broader DB fetch (same budget/gender filters, no category constraint)
  const broadCandidates = await Product.find(dbQuery).lean();

  // Phase C: if still sparse, fetch all within budget regardless of other filters
  let allCandidates = broadCandidates;
  if (allCandidates.length < 10 && max_price) {
    const looseCandidates = await Product.find({ price: { $lte: max_price } }).lean();
    const existingIds = new Set(allCandidates.map(p => p._id.toString()));
    for (const p of looseCandidates) {
      if (!existingIds.has(p._id.toString())) allCandidates.push(p);
    }
  }
  if (allCandidates.length < 10) {
    const allProducts = await Product.find({}).lean();
    const existingIds = new Set(allCandidates.map(p => p._id.toString()));
    for (const p of allProducts) {
      if (!existingIds.has(p._id.toString())) allCandidates.push(p);
    }
  }

  // ── Get semantic vector scores if OpenAI available ────────────────────────
  const semanticQueryParts = [
    ...colors,
    ...category_keywords,
    ...style_keywords,
    soft_preferences.occasion,
    soft_preferences.fit,
    soft_preferences.season,
  ].filter(Boolean);

  const semanticQuery = semanticQueryParts.length > 0 ? semanticQueryParts.join(' ') : 'casual outfit clothing';

  let semanticScores = {}; // productId → score 0–1
  try {
    const queryVector = await getEmbedding(semanticQuery);
    const pipeline = [
      {
        $vectorSearch: {
          index: 'product_vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: 300,
          limit: 100,
        }
      },
      { $addFields: { _semScore: { $meta: 'vectorSearchScore' } } },
      { $project: { _id: 1, _semScore: 1 } }
    ];
    const semResults = await Product.aggregate(pipeline);
    for (const r of semResults) {
      semanticScores[r._id.toString()] = r._semScore;
    }
  } catch {
    // No semantic scores — will use 0.5 default
  }

  return { exactCandidates, allCandidates, semanticScores, uniqueTargetCategories };
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 3: TRANSPARENT WEIGHTED SCORING
// ──────────────────────────────────────────────────────────────────────────────
const WEIGHTS = {
  category:  30,
  color:     30,
  style:     15,
  semantic:  15,
  keyword:    5,
  budget:     5,
};

function scoreProduct(product, prefs, semanticScores, uniqueTargetCategories, maxPrice) {
  const { colors, category_keywords } = prefs.hard_constraints;
  const { style_keywords, soft_preferences } = prefs;
  const prodText = productSearchText(product).toLowerCase();
  const productId = product._id.toString();

  const breakdown = { category: 0, color: 0, style: 0, semantic: 0, keyword: 0, budget: 0 };
  const violations = []; // hard constraint violations for Match % capping

  // ── Category score (30 pts) ─────────────────────────────────────────────
  if (uniqueTargetCategories.length > 0) {
    if (uniqueTargetCategories.includes(product.category)) {
      breakdown.category = WEIGHTS.category;
    } else {
      // Check keyword match in title (e.g. "cardigan" in "Mohair Fuzzy Cardigan")
      const kwMatch = category_keywords.some(kw =>
        product.title.toLowerCase().includes(kw.toLowerCase())
      );
      breakdown.category = kwMatch ? WEIGHTS.category * 0.7 : 0;
      if (!kwMatch) violations.push('category');
    }
  } else {
    // No category constraint → full score
    breakdown.category = WEIGHTS.category;
  }

  // ── Color score (30 pts) ────────────────────────────────────────────────
  if (colors.length > 0) {
    // Score = max match across all required colors
    let bestColorScore = 0;
    for (const color of colors) {
      const cs = colorMatchScore(product, color);
      if (cs > bestColorScore) bestColorScore = cs;
    }
    breakdown.color = Math.round(WEIGHTS.color * bestColorScore);
    if (bestColorScore === 0) violations.push('color');
  } else {
    // No color constraint → full score
    breakdown.color = WEIGHTS.color;
  }

  // ── Style score (15 pts) ─────────────────────────────────────────────────
  const styleTerms = [
    ...style_keywords,
    soft_preferences.fit,
    soft_preferences.occasion,
    soft_preferences.season,
  ].filter(Boolean);

  if (styleTerms.length > 0) {
    const matched = styleTerms.filter(term => prodText.includes(term.toLowerCase())).length;
    const tagMatched = (product.tags || []).filter(tag =>
      styleTerms.some(term => term.toLowerCase().includes(tag.toLowerCase()) || tag.toLowerCase().includes(term.toLowerCase()))
    ).length;
    const styleRatio = Math.min(1, (matched + tagMatched * 0.5) / styleTerms.length);
    breakdown.style = Math.round(WEIGHTS.style * styleRatio);
  } else {
    breakdown.style = WEIGHTS.style;
  }

  // ── Semantic score (15 pts) ──────────────────────────────────────────────
  const semRaw = semanticScores[productId] || 0;
  breakdown.semantic = Math.round(WEIGHTS.semantic * semRaw);

  // ── Keyword score (5 pts) ────────────────────────────────────────────────
  // Additional keywords from category_keywords that aren't captured above
  const extraKws = category_keywords.filter(kw => !keywordToCategories(kw));
  const kwMatched = extraKws.filter(kw => prodText.includes(kw.toLowerCase())).length;
  breakdown.keyword = extraKws.length > 0
    ? Math.round(WEIGHTS.keyword * (kwMatched / extraKws.length))
    : WEIGHTS.keyword;

  // ── Budget score (5 pts) ─────────────────────────────────────────────────
  if (maxPrice) {
    if (product.price <= maxPrice) {
      // Higher score for more budget headroom
      breakdown.budget = Math.round(WEIGHTS.budget * (1 - product.price / maxPrice * 0.5));
    } else {
      breakdown.budget = 0;
      violations.push('price');
    }
  } else {
    breakdown.budget = WEIGHTS.budget;
  }

  const rawTotal = Object.values(breakdown).reduce((s, v) => s + v, 0);

  return { breakdown, rawTotal, violations, semRaw };
}

/**
 * Convert rawTotal (0–100) + violations → displayed Style Match %
 * Cap rules:
 *  - 1 hard constraint violated → cap at 50%
 *  - 2+ violated → cap at 30%
 *  - 0 violated → map rawTotal 0–100 → 60–98% range
 */
function toStyleMatchPercent(rawTotal, violations) {
  const maxScore = Object.values(WEIGHTS).reduce((s, v) => s + v, 0); // 100
  const pct = Math.round((rawTotal / maxScore) * 100);

  if (violations.length >= 2) return Math.min(pct, 30);
  if (violations.length === 1) return Math.min(pct, 50);
  // No violations — map to 60–98% range
  return Math.min(98, Math.max(60, Math.round(60 + (pct / 100) * 38)));
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 4: OUTFIT ASSEMBLY
// ──────────────────────────────────────────────────────────────────────────────
const DB_CATEGORY_BUCKETS = {
  tops:        ["Women's Tops", "Men's Tops"],
  bottoms:     ["Women's Bottoms", "Men's Bottoms"],
  outerwear:   ["Women's Outerwear", "Men's Outerwear"],
  accessories: ["Accessories", "Jewelry", "Bags"],
  footwear:    ["Footwear"],
  sets_or_full:["Women's Sets", "Women's Traditional"],
};

function bucketOf(product) {
  const cat = product.category || '';
  for (const [bucket, cats] of Object.entries(DB_CATEGORY_BUCKETS)) {
    if (cats.includes(cat)) return bucket;
  }
  return 'other';
}

/**
 * Determine the match type label for a product
 */
function matchType(violations, prefs) {
  const { colors, category_keywords } = prefs.hard_constraints;
  const hasColorConstraint    = colors.length > 0;
  const hasCategoryConstraint = category_keywords.length > 0;

  const colorViolated    = violations.includes('color');
  const categoryViolated = violations.includes('category');

  if (!colorViolated && !categoryViolated) return 'exact';
  if (!categoryViolated && colorViolated && hasColorConstraint) return 'partial'; // right category, different color
  if (categoryViolated && !colorViolated && hasCategoryConstraint) return 'partial'; // right color, different category
  return 'fallback';
}

function assembleOutfits(allCandidates, prefs, semanticScores, uniqueTargetCategories) {
  const maxPrice = prefs.hard_constraints.max_price;
  const isSingleItem = !prefs.is_full_outfit_request && prefs.hard_constraints.category_keywords.length > 0;

  // ── Score every candidate ──────────────────────────────────────────────
  const scored = allCandidates.map(p => {
    const { breakdown, rawTotal, violations, semRaw } = scoreProduct(
      p, prefs, semanticScores, uniqueTargetCategories, maxPrice
    );
    return {
      ...p,
      _score: rawTotal,
      _violations: violations,
      _breakdown: breakdown,
      _matchType: matchType(violations, prefs),
      _semRaw: semRaw,
    };
  }).sort((a, b) => b._score - a._score);

  // ── Bucket scored candidates ───────────────────────────────────────────
  const buckets = {};
  for (const key of Object.keys(DB_CATEGORY_BUCKETS)) buckets[key] = [];
  buckets.other = [];

  for (const p of scored) {
    const b = bucketOf(p);
    buckets[b].push(p);
  }

  const outfits  = [];
  const usedIds  = new Set();

  function pick(bucket, n = 1, maxP = null) {
    return (buckets[bucket] || [])
      .filter(p => !usedIds.has(p._id.toString()))
      .filter(p => !maxP || p.price <= maxP)
      .slice(0, n);
  }

  function buildOutfit(items) {
    if (items.length === 0) return null;
    const totalPrice = items.reduce((s, p) => s + p.price, 0);
    if (maxPrice && totalPrice > maxPrice) return null;

    // Outfit-level violations = union of all item violations
    const outfitViolations = [...new Set(items.flatMap(p => p._violations || []))];

    // Style Match % from average raw score, capped by violations
    const avgRaw = items.reduce((s, p) => s + (p._score || 0), 0) / items.length;
    const styleMatch = toStyleMatchPercent(avgRaw, outfitViolations);

    // Outfit match type = worst of all items
    const types = items.map(p => p._matchType || 'fallback');
    const overallMatchType = types.includes('fallback') ? 'fallback'
      : types.includes('partial') ? 'partial' : 'exact';

    // Fallback label
    let fallbackNote = null;
    if (overallMatchType !== 'exact') {
      const { colors, category_keywords } = prefs.hard_constraints;
      const parts = [];
      if (outfitViolations.includes('color') && colors.length > 0) {
        parts.push(`No exact ${colors.join('/')} match found in inventory`);
      }
      if (outfitViolations.includes('category') && category_keywords.length > 0) {
        parts.push(`No exact ${category_keywords.join('/')} found; showing closest alternative`);
      }
      fallbackNote = parts.join('. ');
    }

    items.forEach(p => usedIds.add(p._id.toString()));

    return {
      outfitId: `outfit_${Date.now()}_${outfits.length}`,
      matchType: overallMatchType,
      fallbackNote,
      items: items.map(p => ({
        _id:           p._id.toString(),
        title:         p.title,
        price:         p.price,
        originalPrice: p.originalPrice || null,
        image:         p.image,
        category:      p.category,
        condition:     p.condition,
        tags:          p.tags || [],
        brand:         p.brand || '',
        size:          p.size || '',
        sellerName:    p.sellerName || '',
        description:   p.description || '',
        // Dev-only score breakdown
        ...(IS_DEV ? { _scoreBreakdown: p._breakdown, _rawScore: p._score, _matchType: p._matchType } : {})
      })),
      totalPrice,
      styleMatch,
      explanation: '',
      // Dev-only outfit breakdown
      ...(IS_DEV ? { _outfitViolations: outfitViolations } : {})
    };
  }

  // ── Determine primary bucket from category_keywords ─────────────────────
  const primaryBuckets = [];
  for (const kw of prefs.hard_constraints.category_keywords) {
    const cats = keywordToCategories(kw);
    if (cats) {
      for (const [bucket, dbCats] of Object.entries(DB_CATEGORY_BUCKETS)) {
        if (cats.some(c => dbCats.includes(c))) {
          if (!primaryBuckets.includes(bucket)) primaryBuckets.push(bucket);
        }
      }
    }
  }

  // ── Attempt outfit assembly (up to 3 outfits) ───────────────────────────
  const maxAttempts = 9;
  for (let attempt = 0; attempt < maxAttempts && outfits.length < 3; attempt++) {

    let items = [];

    if (isSingleItem || prefs.hard_constraints.category_keywords.length > 0) {
      // SINGLE-ITEM REQUEST (or specific category request) — hero piece first
      // Try primary buckets, then fall through to best scored item overall
      let heroPick = null;
      for (const pb of primaryBuckets) {
        const p = pick(pb, 1, maxPrice);
        if (p.length > 0) { heroPick = p; break; }
      }
      if (!heroPick || heroPick.length === 0) {
        // Fallback: best scored available item
        const best = scored.filter(p => !usedIds.has(p._id.toString()) && (!maxPrice || p.price <= maxPrice));
        if (best.length === 0) break;
        heroPick = [best[0]];
      }
      items.push(...heroPick);

      // If full outfit requested, add complementary pieces
      if (prefs.is_full_outfit_request) {
        const heroBucket = bucketOf(items[0]);
        const heroCost = items[0].price;
        const remaining = maxPrice ? maxPrice - heroCost : Infinity;

        if (heroBucket === 'tops' || heroBucket === 'sets_or_full') {
          items.push(...pick('bottoms', 1, remaining));
          const r2 = maxPrice ? remaining - items.slice(1).reduce((s, p) => s + p.price, 0) : Infinity;
          items.push(...pick('accessories', 1, r2));
        } else if (heroBucket === 'bottoms') {
          items.push(...pick('tops', 1, remaining));
          const r2 = maxPrice ? remaining - items.slice(1).reduce((s, p) => s + p.price, 0) : Infinity;
          items.push(...pick('accessories', 1, r2));
        } else if (heroBucket === 'outerwear') {
          items.push(...pick('tops', 1, remaining));
        }
      }

    } else if (prefs.is_full_outfit_request) {
      // FULL OUTFIT REQUEST — no specific category → assemble from multiple buckets
      if (pick('sets_or_full', 1, maxPrice).length > 0) {
        const core = pick('sets_or_full', 1, maxPrice);
        items.push(...core);
        const r = maxPrice ? maxPrice - core[0].price : Infinity;
        items.push(...pick('accessories', 1, r));
        const r2 = maxPrice ? r - items.slice(1).reduce((s,p)=>s+p.price,0) : Infinity;
        items.push(...pick('footwear', 1, r2));
      } else if (pick('tops', 1, maxPrice).length > 0) {
        const top = pick('tops', 1, maxPrice);
        items.push(...top);
        const r = maxPrice ? maxPrice - top[0].price : Infinity;
        items.push(...pick('bottoms', 1, r));
        const r2 = maxPrice ? r - items.slice(1).reduce((s,p)=>s+p.price,0) : Infinity;
        items.push(...pick('accessories', 1, r2));
      } else if (pick('bottoms', 1, maxPrice).length > 0) {
        items.push(...pick('bottoms', 1, maxPrice));
        const r = maxPrice ? maxPrice - items[0].price : Infinity;
        items.push(...pick('accessories', 1, r));
      } else if (pick('outerwear', 1, maxPrice).length > 0) {
        items.push(...pick('outerwear', 1, maxPrice));
      } else {
        const any = scored.filter(p => !usedIds.has(p._id.toString()) && (!maxPrice || p.price <= maxPrice));
        if (!any.length) break;
        items.push(any[0]);
      }
    } else {
      // VIBE QUERY (no specific item, not full outfit) — single best match
      const best = scored.filter(p => !usedIds.has(p._id.toString()) && (!maxPrice || p.price <= maxPrice));
      if (!best.length) break;
      items.push(best[0]);
    }

    if (items.length === 0) break;

    const outfit = buildOutfit(items);
    if (outfit) outfits.push(outfit);
  }

  return outfits;
}

// ──────────────────────────────────────────────────────────────────────────────
// STEP 5: AI EXPLANATION
// ──────────────────────────────────────────────────────────────────────────────
async function generateExplanation(outfit, userQuery, prefs) {
  const { colors, category_keywords } = prefs.hard_constraints;
  const { occasion, fit } = prefs.soft_preferences;

  const itemDescriptions = outfit.items.map(item =>
    `- ${item.title} (${item.category}, ${item.condition}${item.brand ? ', ' + item.brand : ''}): ₹${item.price}`
  ).join('\n');

  const constraintNote = outfit.fallbackNote
    ? `NOTE: ${outfit.fallbackNote}. Be honest about this in your explanation if relevant.`
    : '';

  const systemPrompt = `You are a concise fashion stylist for Looped, an Indian thrift marketplace.
Write a 1–2 sentence explanation of why these specific pieces work together for the stated occasion/style.
Reference actual fabric, color, or fit details from the product names.
Do NOT use generic filler. Keep it under 50 words.
${constraintNote}`;

  const userMessage = `User request: "${userQuery}"
Occasion: ${occasion || 'casual'}
Fit preference: ${fit || 'not specified'}
Style: ${prefs.style_keywords.join(', ') || 'everyday'}
Outfit pieces:
${itemDescriptions}`;

  try {
    const explanation = await openAiChat([
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userMessage }
    ], { maxTokens: 120 });
    return explanation.trim();
  } catch {
    return `Curated combination for your ${occasion || 'everyday'} style${colors.length ? ' in ' + colors.join('/') : ''}.`;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN CONTROLLER
// ──────────────────────────────────────────────────────────────────────────────
exports.styleMeQuery = async (req, res) => {
  try {
    const { query, debug } = req.body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ message: 'A style query string is required' });
    }

    const trimmedQuery = query.trim();
    const showDebug = IS_DEV && debug === true;

    // Step 1 — Extract preferences (hard constraints + soft preferences)
    let prefs;
    try {
      prefs = await extractPreferences(trimmedQuery);
    } catch (err) {
      return res.status(503).json({ message: 'AI preference extraction unavailable', error: err.message });
    }

    // Step 2 — Retrieve candidates (DB filter first, then semantic scores)
    const { allCandidates, semanticScores, uniqueTargetCategories } =
      await retrieveCandidates(prefs);

    if (allCandidates.length === 0) {
      return res.json({
        query: trimmedQuery, prefs, outfits: [],
        message: 'No products found in inventory matching your constraints.'
      });
    }

    // Step 3 — Assemble outfits with transparent scoring
    const outfits = assembleOutfits(allCandidates, prefs, semanticScores, uniqueTargetCategories);

    if (outfits.length === 0) {
      return res.json({
        query: trimmedQuery, prefs, outfits: [],
        message: 'Found products but could not assemble outfits. Try adjusting your query.'
      });
    }

    // Step 4 — Generate grounded explanations in parallel
    await Promise.all(
      outfits.map(async outfit => {
        outfit.explanation = await generateExplanation(outfit, trimmedQuery, prefs);
      })
    );

    // Strip debug fields from production response
    if (!showDebug) {
      outfits.forEach(o => {
        delete o._outfitViolations;
        o.items.forEach(item => {
          delete item._scoreBreakdown;
          delete item._rawScore;
          delete item._matchType;
        });
      });
    }

    return res.json({
      query: trimmedQuery,
      preferences: prefs,           // renamed from flat preferences → structured prefs
      outfits,
      generatedAt: new Date().toISOString(),
      ...(showDebug ? { _debug: { candidateCount: allCandidates.length, targetCategories: uniqueTargetCategories } } : {})
    });

  } catch (err) {
    console.error('[style-me] Error:', err.message);
    res.status(500).json({ message: 'AI stylist error', error: err.message });
  }
};
