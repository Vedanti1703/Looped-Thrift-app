/**
 * validateProducts.js
 * Validates data/looped-products.json against the real Product schema.
 * Prints a full pass/fail report. Does NOT touch the database.
 *
 * Usage: node scripts/validateProducts.js
 */

const fs   = require('fs');
const path = require('path');

const INPUT_PATH = path.resolve(__dirname, '../data/looped-products.json');

// ── Schema constants (from backend/models/Product.js) ─────────────────────────
const VALID_CONDITIONS = ['New with tags', 'Like New', 'Good', 'Fair', 'Well Loved'];
const VALID_LISTING_TYPES = ['sell', 'rent', 'both'];

// ── Color family lookup (must match titles/tags) ────────────────────────────────
const ALL_KNOWN_COLORS = [
  'black','jet black','charcoal',
  'white','off-white','cream','ivory',
  'pink','baby pink','hot pink','rose pink','dusty pink',
  'red','maroon','burgundy','crimson',
  'blue','navy','sky blue','cobalt','denim blue',
  'green','olive','sage','forest green','mint',
  'yellow','mustard','lemon',
  'orange','rust','terracotta',
  'brown','tan','camel','mocha',
  'beige','nude','sand',
  'grey','silver','ash grey',
  'purple','lavender','lilac','violet','plum',
  'multicolor','colorful','patchwork','printed','tie-dye',
];

const VALID_CATEGORIES = [
  "Women's Tops","Men's Tops",
  "Women's Outerwear","Men's Outerwear",
  "Women's Bottoms","Men's Bottoms",
  "Women's Sets","Women's Traditional",
  "Footwear","Accessories","Bags","Jewelry",
];

function validate(products) {
  let passed = 0;
  let failed  = 0;
  const errors = {};

  function fail(idx, reason) {
    failed++;
    if (!errors[reason]) errors[reason] = [];
    errors[reason].push(idx);
  }

  const seenKeys = new Set();
  const seenImageUrls = new Map();

  for (let i = 0; i < products.length; i++) {
    const p   = products[i];
    let ok    = true;
    const pfx = `[${i}] ${p.title || '(no title)'}`;

    // Required fields
    if (!p.title || typeof p.title !== 'string' || !p.title.trim()) {
      fail(i, 'Missing/invalid title'); ok = false;
    }
    if (typeof p.price !== 'number' || p.price <= 0) {
      fail(i, 'Invalid price (must be positive number)'); ok = false;
    }
    if (!p.condition || !VALID_CONDITIONS.includes(p.condition)) {
      fail(i, `Invalid condition: "${p.condition}"`); ok = false;
    }
    if (!p.category || !VALID_CATEGORIES.includes(p.category)) {
      fail(i, `Invalid/unknown category: "${p.category}"`); ok = false;
    }
    if (!p.image || typeof p.image !== 'string' || !p.image.startsWith('http')) {
      fail(i, 'Missing or invalid image URL'); ok = false;
    } else {
      // 1. Duplicate Image Check Across Entire Dataset
      if (seenImageUrls.has(p.image)) {
        fail(i, `Duplicate image URL: "${p.image}" already used by product #${seenImageUrls.get(p.image)}`); ok = false;
      } else {
        seenImageUrls.set(p.image, i);
      }

      // 2. Reject Raw Text Placeholders / Color Blocks with Text
      if (p.image.includes('placehold.co') && p.image.includes('text=')) {
        fail(i, `Raw text block placeholder rejected as production image: "${p.image}"`); ok = false;
      }
    }

    // Price consistency
    if (p.originalPrice !== undefined && p.originalPrice !== null) {
      if (typeof p.originalPrice !== 'number') {
        fail(i, 'originalPrice must be a number'); ok = false;
      } else if (p.originalPrice <= p.price) {
        fail(i, `originalPrice (${p.originalPrice}) must be > price (${p.price})`); ok = false;
      }
    }

    // Tags
    if (!Array.isArray(p.tags)) {
      fail(i, 'tags must be an array'); ok = false;
    } else {
      // Check color tag is present
      const hasColorTag = p.tags.some(t => ALL_KNOWN_COLORS.includes(t));
      if (!hasColorTag) {
        fail(i, `No recognizable color tag in tags: [${p.tags.join(',')}]`); ok = false;
      }
      // No duplicate tags
      const tagSet = new Set(p.tags);
      if (tagSet.size !== p.tags.length) {
        fail(i, 'Duplicate tags found'); ok = false;
      }
      // Tags should be lowercase
      const hasUppercase = p.tags.some(t => t !== t.toLowerCase());
      if (hasUppercase) {
        fail(i, 'All tags must be lowercase'); ok = false;
      }
    }

    // Title/tag color agreement
    if (Array.isArray(p.tags) && p.title) {
      const titleLower = p.title.toLowerCase();
      const colorTagsOnProduct = p.tags.filter(t => ALL_KNOWN_COLORS.includes(t));
      // At least one color in title should appear in tags (or vice versa)
      const colorInTitle = ALL_KNOWN_COLORS.some(c => titleLower.includes(c));
      const colorInTags  = colorTagsOnProduct.length > 0;
      if (colorInTitle && !colorInTags) {
        fail(i, `Color in title not reflected in tags: "${p.title}"`); ok = false;
      }
    }

    // listingType
    if (p.listingType && !VALID_LISTING_TYPES.includes(p.listingType)) {
      fail(i, `Invalid listingType: "${p.listingType}"`); ok = false;
    }

    // Size should be a string
    if (p.size !== undefined && typeof p.size !== 'string') {
      fail(i, 'size must be a string'); ok = false;
    }

    // Brand
    if (p.brand !== undefined && typeof p.brand !== 'string') {
      fail(i, 'brand must be a string'); ok = false;
    }

    // Description agreement: color from title should appear in description
    if (p.title && p.description) {
      const titleLower = p.title.toLowerCase();
      const descLower  = p.description.toLowerCase();
      const titleColors = ALL_KNOWN_COLORS.filter(c => titleLower.includes(c));
      if (titleColors.length > 0) {
        const descHasColor = titleColors.some(c => descLower.includes(c));
        if (!descHasColor) {
          fail(i, `Color in title not in description: "${p.title}"`); ok = false;
        }
      }
    }

    // Duplicate detection: same title+category+size+condition+price
    const key = `${p.title}|${p.category}|${p.size}|${p.condition}|${p.price}`;
    if (seenKeys.has(key)) {
      fail(i, `Logical duplicate: ${key}`);
    } else {
      seenKeys.add(key);
    }

    // Numbers should be numbers
    for (const numField of ['views','likes','avgRating','reviewCount']) {
      if (p[numField] !== undefined && typeof p[numField] !== 'number') {
        fail(i, `${numField} must be a number`); ok = false;
      }
    }

    if (ok) passed++;
  }

  return { passed, failed, errors, total: products.length };
}

// ── Run ───────────────────────────────────────────────────────────────────────
if (!fs.existsSync(INPUT_PATH)) {
  console.error(`❌ File not found: ${INPUT_PATH}`);
  console.error('   Run: node scripts/generateProducts.js first');
  process.exit(1);
}

console.log(`\n🔍 Validating ${INPUT_PATH}...\n`);
const raw = fs.readFileSync(INPUT_PATH, 'utf8');
let products;
try {
  products = JSON.parse(raw);
} catch(e) {
  console.error('❌ JSON parse error:', e.message);
  process.exit(1);
}

if (!Array.isArray(products)) {
  console.error('❌ Expected JSON array at root');
  process.exit(1);
}

const result = validate(products);

console.log('═'.repeat(60));
console.log(`  Total products:     ${result.total}`);
console.log(`  ✅ Valid:            ${result.passed}`);
console.log(`  ❌ Invalid:          ${result.failed}`);
console.log('═'.repeat(60));

if (Object.keys(result.errors).length > 0) {
  console.log('\n⚠️  VALIDATION ERRORS:');
  for (const [reason, indices] of Object.entries(result.errors)) {
    console.log(`   [${indices.length}x] ${reason}`);
    if (indices.length <= 3) console.log(`        → indices: ${indices.join(', ')}`);
  }
  if (result.failed > 0) {
    console.log('\n❌ Validation FAILED — fix errors before importing.');
    process.exit(1);
  }
} else {
  console.log('\n✅ All products are valid. Ready for import.');
  console.log('   Next step: node scripts/importProducts.js --dry-run\n');
}

// Coverage report for AI Style Me test queries
console.log('\n📊 AI Style Me Coverage Report:');
const checks = [
  { label: 'pink top (Women\'s Tops + pink tag)',           fn: p => p.category === "Women's Tops" && p.tags.includes('pink') },
  { label: 'pink cardigan (Women\'s Outerwear + pink tag)',  fn: p => p.category === "Women's Outerwear" && p.tags.includes('pink') },
  { label: 'black oversized hoodie (hoodie + black + oversized)', fn: p => p.tags.includes('hoodie') && p.tags.includes('black') && p.tags.includes('oversized') },
  { label: 'white crop top (Women\'s Tops + white)',         fn: p => p.category === "Women's Tops" && (p.tags.includes('white') || p.tags.includes('off-white') || p.tags.includes('cream')) },
  { label: 'blue jeans (Bottoms + blue tag)',                fn: p => (p.category === "Women's Bottoms" || p.category === "Men's Bottoms") && (p.tags.includes('blue') || p.tags.includes('denim-blue') || p.tags.includes('navy')) },
  { label: 'red dress/set (red tag + set/traditional)',      fn: p => (p.category === "Women's Sets" || p.category === "Women's Traditional") && (p.tags.includes('red') || p.tags.includes('maroon') || p.tags.includes('burgundy')) },
  { label: 'Y2K pink outfit (y2k + pink)',                   fn: p => p.tags.includes('y2k') && p.tags.includes('pink') },
  { label: 'classy black (classy + black)',                  fn: p => p.tags.includes('classy') && p.tags.includes('black') },
  { label: 'oversized streetwear (oversized + streetwear)',  fn: p => p.tags.includes('oversized') && p.tags.includes('streetwear') },
  { label: 'casual summer under ₹1200 (summer + price ≤1200)', fn: p => p.tags.includes('summer') && p.price <= 1200 },
];

for (const check of checks) {
  const matching = products.filter(check.fn).length;
  const status   = matching >= 3 ? '✅' : matching >= 1 ? '⚠️ ' : '❌';
  console.log(`  ${status} ${check.label.padEnd(55)} ${matching} products`);
}
console.log('');
