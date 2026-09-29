/**
 * backend/scripts/seedRentals.js
 * ---------------------------------------------------------------------------
 * Seeds 12 premium occasion-wear products that PASS the rental eligibility
 * rule in backend/config/rentalRules.js exactly.
 *
 * Eligibility requires ALL of:
 *   1. originalPrice (or price) >= 3000 INR
 *   2. category OR title OR tags includes a keyword from
 *      ALLOWED_CATEGORIES_OR_KEYWORDS  (case-insensitive substring match)
 *   3. listingType = 'rent'  (so feed query picks it up)
 *   4. rentPricePerDay > 0   (so feed query picks it up)
 *
 * Safe to run multiple times — upserts by title, never deletes anything.
 * ONLY touches the products collection.
 * ---------------------------------------------------------------------------
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product  = require('../models/Product');
const User     = require('../models/User');
const { checkRentalEligibility } = require('../config/rentalRules');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) { console.error('MONGO_URI not in .env'); process.exit(1); }

// ---------------------------------------------------------------------------
// Image sets — Unsplash CDN URLs (reliably return HTTP 200, no auth needed)
// ---------------------------------------------------------------------------
const lehenga1Main   = 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop';
const lehenga2Main   = 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop';
const sareeMain      = 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop';
const sherwaniMain   = 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop';
const tuxedoMain     = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop';
const suitMain       = 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&fit=crop';
const blazerMain     = 'https://images.unsplash.com/photo-1490367532201-b9bc1dc483f6?w=800&auto=format&fit=crop';
const gown1Main      = 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=800&auto=format&fit=crop';
const gown2Main      = 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop';
const cocktailMain   = 'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800&auto=format&fit=crop';
const anarkaliMain   = 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop';
const sareeAlt       = 'https://images.unsplash.com/photo-1594736797933-d0501ba2fe65?w=800&auto=format&fit=crop';
const ethnicAlt      = 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=800&auto=format&fit=crop';
const manAlt         = 'https://images.unsplash.com/photo-1490367532201-b9bc1dc483f6?w=800&auto=format&fit=crop';

// ---------------------------------------------------------------------------
// Build product list  (sellerId & sellerName injected at runtime)
// ---------------------------------------------------------------------------
function buildProducts(sellerId, sellerName) {
  return [
    // 1 — Bridal Lehenga #1
    {
      title: 'Manish Malhotra Bridal Lehenga — Crimson Embroidered',
      description: 'Opulent crimson silk lehenga with gold zari embroidery. Includes dupatta and blouse. Dry-cleaned before/after each rental.',
      price: 12000,
      originalPrice: 85000,
      condition: 'Like New',
      category: 'Wedding & Bridal Wear',
      tags: ['bridal', 'lehenga', 'wedding', 'reception', 'embroidered'],
      size: 'S-M (adjustable)',
      brand: 'Manish Malhotra',
      occasion: 'Wedding & Bridal',
      listingType: 'rent',
      rentPricePerDay: 4500,
      securityDeposit: 30000,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: lehenga1Main,
      images: [lehenga1Main, lehenga2Main, sareeAlt],
      sellerId, sellerName,
    },
    // 2 — Bridal Lehenga #2
    {
      title: 'Sabyasachi Bridal Lehenga — Dusty Rose Gota Patti',
      description: 'Authentic pre-owned Sabyasachi lehenga in dusty rose with gota patti work. Includes blouse, dupatta, and branded storage bag.',
      price: 18000,
      originalPrice: 140000,
      condition: 'Like New',
      category: 'Wedding & Bridal Wear',
      tags: ['bridal', 'lehenga', 'sabyasachi', 'wedding', 'pink', 'couture'],
      size: 'M',
      brand: 'Sabyasachi',
      occasion: 'Wedding & Bridal',
      listingType: 'rent',
      rentPricePerDay: 7000,
      securityDeposit: 50000,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: lehenga2Main,
      images: [lehenga2Main, lehenga1Main, sareeAlt],
      sellerId, sellerName,
    },
    // 3 — Banarasi Wedding Saree
    {
      title: 'Pure Banarasi Silk Wedding Saree — Gold Zari Weavework',
      description: 'Heirloom Banarasi silk saree in deep burgundy with intricate gold zari. Ideal for brides and mothers-of-the-bride. Worn once, stored with care.',
      price: 5000,
      originalPrice: 28000,
      condition: 'Like New',
      category: 'Designer Saree',
      tags: ['saree', 'banarasi', 'wedding', 'silk', 'festive'],
      size: 'Free Size (6 m)',
      brand: 'Meena Bazaar',
      occasion: 'Wedding & Bridal',
      listingType: 'rent',
      rentPricePerDay: 1500,
      securityDeposit: 8000,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: sareeMain,
      images: [sareeMain, sareeAlt, ethnicAlt],
      sellerId, sellerName,
    },
    // 4 — Sherwani
    {
      title: 'Manyavar Royal Sherwani — Ivory with Gold Brocade',
      description: 'Grand ivory sherwani with gold brocade and embroidered collar. Includes churidar and stole. Perfect for grooms and wedding functions.',
      price: 4500,
      originalPrice: 25000,
      condition: 'Like New',
      category: 'Sherwani',
      tags: ['sherwani', 'wedding', 'groom', 'ethnic', 'baraat'],
      size: '40 (M-L)',
      brand: 'Manyavar',
      occasion: 'Wedding & Bridal',
      listingType: 'rent',
      rentPricePerDay: 1200,
      securityDeposit: 7500,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: sherwaniMain,
      images: [sherwaniMain, tuxedoMain, suitMain],
      sellerId, sellerName,
    },
    // 5 — Tuxedo
    {
      title: 'Slim-Fit Midnight Tuxedo — Black Tie Formal',
      description: 'Italian-fabric slim-fit tuxedo in midnight black with satin lapels. Ideal for black-tie galas, corporate dinners, and award nights.',
      price: 3500,
      originalPrice: 22000,
      condition: 'Like New',
      category: 'Blazer/Suit/Tuxedo',
      tags: ['tuxedo', 'black tie', 'formal', 'suit', 'gala'],
      size: '40 (M)',
      brand: 'Raymond',
      occasion: 'Formal & Black Tie',
      listingType: 'rent',
      rentPricePerDay: 1800,
      securityDeposit: 7000,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: tuxedoMain,
      images: [tuxedoMain, suitMain, manAlt],
      sellerId, sellerName,
    },
    // 6 — 3-Piece Suit
    {
      title: 'Premium Wool 3-Piece Suit — Charcoal Pinstripe',
      description: 'Tailored charcoal pinstripe 3-piece suit (jacket, trousers, waistcoat) in premium wool blend. Perfect for corporate events and formal occasions.',
      price: 3000,
      originalPrice: 18000,
      condition: 'Good',
      category: 'Blazer/Suit/Tuxedo',
      tags: ['suit', '3-piece', 'formal', 'office', 'premium'],
      size: '38 (S-M)',
      brand: 'Van Heusen',
      occasion: 'Formal & Black Tie',
      listingType: 'rent',
      rentPricePerDay: 1000,
      securityDeposit: 5500,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: suitMain,
      images: [suitMain, tuxedoMain, manAlt],
      sellerId, sellerName,
    },
    // 7 — Designer Blazer
    {
      title: 'Zara Limited Edition Oversized Blazer — Ivory Crepe',
      description: 'Structured oversized blazer in ivory crepe with gold button details. Elevates any party or cocktail look effortlessly.',
      price: 1500,
      originalPrice: 9500,
      condition: 'Like New',
      category: 'Blazer/Suit/Tuxedo',
      tags: ['blazer', 'designer', 'party wear', 'cocktail', 'formal'],
      size: 'S/M',
      brand: 'Zara',
      occasion: 'Party & Cocktail',
      listingType: 'rent',
      rentPricePerDay: 800,
      securityDeposit: 3000,
      rentAvailable: true,
      dryCleaningIncluded: false,
      image: blazerMain,
      images: [blazerMain, suitMain, manAlt],
      sellerId, sellerName,
    },
    // 8 — Evening Gown #1
    {
      title: 'Floor-Length Velvet Evening Gown — Midnight Blue',
      description: 'Dramatic floor-length velvet gown in midnight blue with cowl neckline. Perfect for award nights, gala dinners, and destination weddings.',
      price: 4000,
      originalPrice: 32000,
      condition: 'Like New',
      category: 'Gown/Evening Wear',
      tags: ['gown', 'evening wear', 'velvet', 'formal', 'party wear'],
      size: 'S (UK 8)',
      brand: 'Masaba Gupta',
      occasion: 'Formal & Black Tie',
      listingType: 'rent',
      rentPricePerDay: 2500,
      securityDeposit: 10000,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: gown1Main,
      images: [gown1Main, gown2Main, cocktailMain],
      sellerId, sellerName,
    },
    // 9 — Evening Gown #2
    {
      title: 'Backless Satin Evening Gown — Champagne Gold',
      description: 'Ethereal champagne gold satin gown with cowl back and train. Worn once to an awards night. Comes with matching belt.',
      price: 5000,
      originalPrice: 45000,
      condition: 'Like New',
      category: 'Gown/Evening Wear',
      tags: ['gown', 'evening wear', 'satin', 'backless', 'couture', 'wedding'],
      size: 'M (UK 10)',
      brand: 'Tarun Tahiliani',
      occasion: 'Formal & Black Tie',
      listingType: 'rent',
      rentPricePerDay: 3000,
      securityDeposit: 15000,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: gown2Main,
      images: [gown2Main, gown1Main, cocktailMain],
      sellerId, sellerName,
    },
    // 10 — Cocktail Dress
    {
      title: 'Sequin Mini Cocktail Dress — Rose Gold',
      description: 'Head-turning rose gold sequin mini dress. Perfect for cocktail parties, birthdays, and NYE celebrations. Fully lined for comfort.',
      price: 1800,
      originalPrice: 12000,
      condition: 'Like New',
      category: 'Party/Cocktail Wear',
      tags: ['cocktail', 'party wear', 'sequin', 'mini dress', 'glam'],
      size: 'XS-S (UK 6-8)',
      brand: 'Aza Fashions',
      occasion: 'Party & Cocktail',
      listingType: 'rent',
      rentPricePerDay: 900,
      securityDeposit: 4000,
      rentAvailable: true,
      dryCleaningIncluded: false,
      image: cocktailMain,
      images: [cocktailMain, gown1Main, gown2Main],
      sellerId, sellerName,
    },
    // 11 — Anarkali
    {
      title: 'Embroidered Anarkali Suit — Emerald Green with Dupatta',
      description: 'Stunning emerald green anarkali with thread and mirror embroidery. Paired with silk dupatta and palazzo. Ideal for wedding receptions and festive functions.',
      price: 2500,
      originalPrice: 15000,
      condition: 'Good',
      category: 'Party/Cocktail Wear',
      tags: ['anarkali', 'ethnic', 'party wear', 'festive', 'embroidered'],
      size: 'M (38)',
      brand: 'Biba',
      occasion: 'Party & Cocktail',
      listingType: 'rent',
      rentPricePerDay: 1100,
      securityDeposit: 4500,
      rentAvailable: true,
      dryCleaningIncluded: true,
      image: anarkaliMain,
      images: [anarkaliMain, sareeAlt, ethnicAlt],
      sellerId, sellerName,
    },
    // 12 — Designer Jewellery Set
    {
      title: 'Polki Bridal Jewellery Set — Kundan and Meenakari',
      description: 'Statement bridal jewellery set — necklace, earrings, matha patti, and haath phool. Polki stones in sterling silver with meenakari. Stored in velvet box.',
      price: 3500,
      originalPrice: 35000,
      condition: 'Like New',
      category: 'Designer Jewellery Sets',
      tags: ['jewellery', 'bridal', 'polki', 'kundan', 'wedding', 'accessories'],
      size: 'Adjustable',
      brand: 'Amrapali',
      occasion: 'Wedding & Bridal',
      listingType: 'rent',
      rentPricePerDay: 2000,
      securityDeposit: 12000,
      rentAvailable: true,
      dryCleaningIncluded: false,
      image: anarkaliMain,
      images: [anarkaliMain, sareeMain, ethnicAlt],
      sellerId, sellerName,
    },
  ];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Connecting to MongoDB Atlas…');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.\n');

  // Find demo seller, fallback to any user
  let seller = await User.findOne({ email: 'demo.seller@looped.app' }).lean();
  if (!seller) {
    console.warn('demo.seller@looped.app not found — using first available user as fallback seller.');
    seller = await User.findOne({}).lean();
  }
  if (!seller) {
    console.error('No users in DB. Run the main app seed first to create users.');
    process.exit(1);
  }
  console.log(`Seller: ${seller.email} (${seller._id})\n`);

  const products = buildProducts(seller._id, seller.name || seller.email.split('@')[0]);

  let inserted = 0, updated = 0;
  for (const p of products) {
    // Verify it will pass the eligibility rule before writing
    const check = checkRentalEligibility(p);
    if (!check.eligible) {
      console.error(`BUG in seed data for "${p.title}": ${check.reason}`);
      process.exit(1);
    }

    const existing = await Product.findOne({ title: p.title });
    if (existing) {
      await Product.findByIdAndUpdate(existing._id, { $set: p });
      updated++;
      console.log(`  ↺ updated  | ${p.title.slice(0, 65)}`);
    } else {
      await Product.create(p);
      inserted++;
      console.log(`  + inserted | ${p.title.slice(0, 65)}`);
    }
  }

  console.log(`\nDone! ${inserted} inserted, ${updated} updated out of ${products.length} items.\n`);

  // Quick verification — mirrors getRentableFeed query
  const feed = await Product.find({
    listingType: { $in: ['rent', 'both'] },
    rentPricePerDay: { $gt: 0 },
    $or: [{ originalPrice: { $gte: 3000 } }, { price: { $gte: 3000 } }]
  }).lean();
  const passing = feed.filter(p => checkRentalEligibility(p).eligible);
  console.log(`GET /rental/feed would now return ${passing.length} product(s).`);
  passing.forEach(p => console.log(`  ✔ [${p.occasion || p.category}] ${p.title.slice(0, 60)}`));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

