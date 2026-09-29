/**
 * seedRentals.js
 * Seeds 18 premium occasion rental items:
 *  - Bridal Lehenga, Banarasi Wedding Saree, Royal Sherwani, Classic Black Tuxedo,
 *    3-Piece Italian Wool Suit, Designer Velvet Blazer, Embellished Evening Gowns,
 *    Cocktail Dresses, Floor-Length Anarkali, Indo-Western Fusion Set, Designer Kundan/Polki Jewellery Sets.
 *
 * Each item has:
 *  - 3 high-res working images
 *  - originalPrice (retail value >= 3000)
 *  - rentPricePerDay (8-15% of retail value)
 *  - securityDeposit (30-50% of retail value)
 *  - size, brand, occasion ('Wedding', 'Party', 'Formal'), dryCleaningIncluded (true)
 *  - listingType: 'rent'
 *  - sellerId: demo seller (demo.seller@looped.app)
 *  - tags including 'seed-rental' for idempotency
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const User = require('../models/User');
const Product = require('../models/Product');

const DEMO_SELLER_EMAIL = 'demo.seller@looped.app';

const PREMIUM_RENTAL_ITEMS = [
  // 1. Bridal & Wedding (6 items)
  {
    title: 'Sabyasachi Heritage Crimson Zardozi Bridal Lehenga',
    brand: 'Sabyasachi',
    category: "Women's Traditional",
    condition: 'Like New',
    size: 'M',
    originalPrice: 220000,
    price: 95000,
    rentPricePerDay: 4500,
    securityDeposit: 15000,
    occasion: 'Wedding',
    dryCleaningIncluded: true,
    tags: ['wedding', 'bridal', 'lehenga', 'crimson', 'seed-rental', 'designer'],
    description: 'Heritage bridal velvet lehenga adorned with intricate dabka, antique zari, and zardozi embroidery. Perfect for wedding ceremony.',
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Pure Katan Silk Banarasi Wedding Saree in Royal Red & Gold',
    brand: 'Raw Mango',
    category: "Women's Traditional",
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 48000,
    price: 24000,
    rentPricePerDay: 1800,
    securityDeposit: 6000,
    occasion: 'Wedding',
    dryCleaningIncluded: true,
    tags: ['wedding', 'saree', 'banarasi', 'red', 'seed-rental', 'silk'],
    description: 'Handwoven pure katan silk Banarasi saree with opulent kadwa gold zari work. Includes designer stitched blouse.',
    images: [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Tarun Tahiliani Raw Silk Embroidered Groom Sherwani Set',
    brand: 'Tarun Tahiliani',
    category: "Men's Tops",
    condition: 'Like New',
    size: '42 / L',
    originalPrice: 135000,
    price: 60000,
    rentPricePerDay: 3500,
    securityDeposit: 12000,
    occasion: 'Wedding',
    dryCleaningIncluded: true,
    tags: ['wedding', 'sherwani', 'groom', 'ivory', 'seed-rental'],
    description: 'Bespoke ivory raw silk sherwani with tonal threadwork, pearls, and matching churidar + organza safa stole.',
    images: [
      'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Anita Dongre Emerald Green Hand-Painted Pichwai Lehenga',
    brand: 'Anita Dongre',
    category: "Women's Traditional",
    condition: 'New with tags',
    size: 'S',
    originalPrice: 110000,
    price: 52000,
    rentPricePerDay: 2800,
    securityDeposit: 9000,
    occasion: 'Wedding',
    dryCleaningIncluded: true,
    tags: ['wedding', 'lehenga', 'emerald', 'green', 'seed-rental'],
    description: 'Ethereal silk lehenga featuring hand-painted floral Pichwai motifs with gota patti detailing. Ideal for Sangeet or Mehendi.',
    images: [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Heritage Kundan & Uncut Polki Choker Necklace Set with Maang Tikka',
    brand: 'Tanishq Mia Luxury',
    category: 'Jewelry',
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 42000,
    price: 18000,
    rentPricePerDay: 1200,
    securityDeposit: 4500,
    occasion: 'Wedding',
    dryCleaningIncluded: true,
    tags: ['wedding', 'jewellery', 'jewelry', 'kundan', 'polki', 'seed-rental'],
    description: 'Gold-plated artisanal bridal choker crafted with Jadau Kundan, emerald green drops, and matching chandelier earrings.',
    images: [
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Floor-Length Regal Ivory Chikankari Anarkali with Mukaish Work',
    brand: 'Abu Jani Sandeep Khosla',
    category: "Women's Traditional",
    condition: 'Like New',
    size: 'L',
    originalPrice: 92000,
    price: 38000,
    rentPricePerDay: 2200,
    securityDeposit: 7500,
    occasion: 'Wedding',
    dryCleaningIncluded: true,
    tags: ['wedding', 'anarkali', 'chikankari', 'ivory', 'seed-rental'],
    description: 'Fine Lucknowi shadow-work chikankari hand-stitched on pure georgette, sparkling with mukaish silver accents.',
    images: [
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80'
    ]
  },

  // 2. Party & Cocktail (6 items)
  {
    title: 'Manish Malhotra Rose Gold Draped Sequin Cocktail Gown',
    brand: 'Manish Malhotra',
    category: "Women's Sets",
    condition: 'Like New',
    size: 'S',
    originalPrice: 85000,
    price: 36000,
    rentPricePerDay: 2400,
    securityDeposit: 7000,
    occasion: 'Party',
    dryCleaningIncluded: true,
    tags: ['party', 'cocktail', 'gown', 'sequin', 'rose gold', 'seed-rental'],
    description: 'Stunning bodycon evening gown encrusted with micro-sequins and dramatic cowl back drape.',
    images: [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Midnight Blue Velvet Tuxedo Dinner Jacket with Satin Shawl Lapel',
    brand: 'Hugo Boss',
    category: "Men's Outerwear",
    condition: 'Like New',
    size: '40 / M',
    originalPrice: 52000,
    price: 22000,
    rentPricePerDay: 1600,
    securityDeposit: 5000,
    occasion: 'Party',
    dryCleaningIncluded: true,
    tags: ['party', 'tuxedo', 'blazer', 'velvet', 'blue', 'seed-rental'],
    description: 'Plush Italian cotton velvet dinner jacket in deep midnight blue with contrasting silk grosgrain lapels.',
    images: [
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Gaurav Gupta Sculptural Metallic Silver Cocktail Mini Dress',
    brand: 'Gaurav Gupta',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'XS',
    originalPrice: 68000,
    price: 28000,
    rentPricePerDay: 2000,
    securityDeposit: 6000,
    occasion: 'Party',
    dryCleaningIncluded: true,
    tags: ['party', 'cocktail', 'silver', 'sculptural', 'seed-rental'],
    description: 'Signature 3D boned sculptural metallic cocktail dress with architectural shoulder accent.',
    images: [
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Indo-Western Embroidered Cape & Sharara Set in Lilac Silk',
    brand: 'Ridhi Mehra',
    category: "Women's Sets",
    condition: 'New with tags',
    size: 'M',
    originalPrice: 58000,
    price: 25000,
    rentPricePerDay: 1750,
    securityDeposit: 5500,
    occasion: 'Party',
    dryCleaningIncluded: true,
    tags: ['party', 'indo-western', 'sharara', 'lilac', 'seed-rental'],
    description: 'Flowy georgette sharara paired with a hand-embroidered pearl bustier and sheer floor-sweeping cape.',
    images: [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Zuhair Murad Inspired Emerald Green Satin Corset Evening Gown',
    brand: 'Couture Club',
    category: "Women's Sets",
    condition: 'Like New',
    size: 'M',
    originalPrice: 46000,
    price: 19000,
    rentPricePerDay: 1500,
    securityDeposit: 4500,
    occasion: 'Party',
    dryCleaningIncluded: true,
    tags: ['party', 'gown', 'emerald', 'corset', 'seed-rental'],
    description: 'Lustrous duchess satin corset ball gown with a thigh-high side slit and structured boning.',
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Designer Swarovski Crystal Statement Chandelier Earring & Bracelet Set',
    brand: 'Swarovski',
    category: 'Jewelry',
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 28000,
    price: 12000,
    rentPricePerDay: 850,
    securityDeposit: 2500,
    occasion: 'Party',
    dryCleaningIncluded: true,
    tags: ['party', 'jewellery', 'jewelry', 'crystal', 'seed-rental'],
    description: 'High-shine pavé Swarovski crystal cascading shoulder-duster earrings with matching tennis bracelet.',
    images: [
      'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602751584552-8ba73aad10e1?w=800&auto=format&fit=crop&q=80'
    ]
  },

  // 3. Formal & Gala (6 items)
  {
    title: 'Armani Classic Black Tie Peak Lapel Tuxedo 2-Piece Suit',
    brand: 'Giorgio Armani',
    category: "Men's Tops",
    condition: 'Like New',
    size: '38 / S',
    originalPrice: 125000,
    price: 54000,
    rentPricePerDay: 3200,
    securityDeposit: 10000,
    occasion: 'Formal',
    dryCleaningIncluded: true,
    tags: ['formal', 'tuxedo', 'suit', 'black tie', 'seed-rental'],
    description: 'Refined Italian virgin wool tuxedo with satin peak lapels and flat-front trousers with satin side piping.',
    images: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Canali 3-Piece Charcoal Herringbone Wool Formal Suit',
    brand: 'Canali',
    category: "Men's Tops",
    condition: 'Like New',
    size: '42 / L',
    originalPrice: 140000,
    price: 58000,
    rentPricePerDay: 3500,
    securityDeposit: 11000,
    occasion: 'Formal',
    dryCleaningIncluded: true,
    tags: ['formal', 'suit', '3-piece', 'charcoal', 'wool', 'seed-rental'],
    description: 'Impeccably tailored Super 150s wool suit comprising blazer jacket, tailored waistcoat, and pleated trousers.',
    images: [
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Gucci Tailored Double-Breasted Cream Wool Blazer Jacket',
    brand: 'Gucci',
    category: "Women's Outerwear",
    condition: 'Like New',
    size: '38 / S',
    originalPrice: 115000,
    price: 49000,
    rentPricePerDay: 2900,
    securityDeposit: 9500,
    occasion: 'Formal',
    dryCleaningIncluded: true,
    tags: ['formal', 'blazer', 'cream', 'wool', 'seed-rental'],
    description: 'Structured double-breasted cream wool blazer with engraved gold interlocking GG crest buttons.',
    images: [
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Carolina Herrera Black Off-Shoulder Column Gala Gown',
    brand: 'Carolina Herrera',
    category: "Women's Sets",
    condition: 'Like New',
    size: 'M',
    originalPrice: 175000,
    price: 72000,
    rentPricePerDay: 4200,
    securityDeposit: 14000,
    occasion: 'Formal',
    dryCleaningIncluded: true,
    tags: ['formal', 'gown', 'black tie', 'gala', 'seed-rental'],
    description: 'Dramatic black silk-crepe column gown with architectural off-the-shoulder sculpted neckline.',
    images: [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Tom Ford Velvet Shawl-Collar Formal Blazer in Royal Purple',
    brand: 'Tom Ford',
    category: "Men's Outerwear",
    condition: 'Like New',
    size: '42 / L',
    originalPrice: 180000,
    price: 75000,
    rentPricePerDay: 4500,
    securityDeposit: 15000,
    occasion: 'Formal',
    dryCleaningIncluded: true,
    tags: ['formal', 'blazer', 'velvet', 'purple', 'seed-rental'],
    description: 'Exquisite cocktail and black tie jacket in plush purple velvet with black silk grosgrain shawl collar.',
    images: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    title: 'Ralph Lauren Black Label Crepe Formal Pantsuit with Satin Lapels',
    brand: 'Ralph Lauren',
    category: "Women's Sets",
    condition: 'New with tags',
    size: 'S',
    originalPrice: 65000,
    price: 28000,
    rentPricePerDay: 1900,
    securityDeposit: 6000,
    occasion: 'Formal',
    dryCleaningIncluded: true,
    tags: ['formal', 'suit', 'pantsuit', 'black', 'seed-rental'],
    description: 'Sleek tailored smoking jacket and high-waisted cigarette trouser ensemble in matte fluid crepe.',
    images: [
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ]
  }
];

async function seedRentals() {
  console.log('👗 Starting Premium Rentals Seed Script (18 Items)...');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  // Ensure demo seller exists
  let demoSeller = await User.findOne({ email: DEMO_SELLER_EMAIL });
  if (!demoSeller) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    demoSeller = await User.create({
      email: DEMO_SELLER_EMAIL,
      password: hash,
      name: 'Looped Premium Wardrobe',
      isVerified: true,
      role: 'user'
    });
    console.log(`✨ Created Demo Seller: ${DEMO_SELLER_EMAIL}`);
  }

  // Clear previous seed-rental items
  const deleted = await Product.deleteMany({ tags: 'seed-rental' });
  console.log(`🧹 Cleared ${deleted.deletedCount} previous seed-rental items.`);

  const created = [];
  for (const item of PREMIUM_RENTAL_ITEMS) {
    const prod = new Product({
      title: item.title,
      description: item.description,
      brand: item.brand,
      category: item.category,
      condition: item.condition,
      size: item.size,
      originalPrice: item.originalPrice,
      price: item.price,
      listingType: 'rent',
      rentPricePerDay: item.rentPricePerDay,
      securityDeposit: item.securityDeposit,
      rentAvailable: true,
      occasion: item.occasion,
      dryCleaningIncluded: item.dryCleaningIncluded,
      image: item.images[0],
      images: item.images,
      sellerId: demoSeller._id,
      sellerName: demoSeller.name || 'Looped Premium Wardrobe',
      tags: item.tags,
      views: 45 + Math.floor(Math.random() * 80),
      likes: 12 + Math.floor(Math.random() * 30)
    });

    await prod.save();
    created.push(prod);
    console.log(`  [${item.occasion.toUpperCase()}] ${item.title.substring(0, 40)}... → ₹${item.rentPricePerDay}/day (Deposit: ₹${item.securityDeposit})`);
  }

  console.log(`\n🎉 Successfully seeded ${created.length} premium rental items into MongoDB!`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}

if (require.main === module) {
  seedRentals().catch(err => {
    console.error('❌ seedRentals error:', err);
    process.exit(1);
  });
}

module.exports = seedRentals;
