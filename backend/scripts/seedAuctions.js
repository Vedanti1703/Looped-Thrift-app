/**
 * seedAuctions.js
 * Creates 8 realistic curated designer & luxury auctions in MongoDB
 * using the demo seller account (demo.seller@looped.app).
 *
 * Requirements:
 *  - 8 designer items with 3 working image URLs each
 *  - brand present (Sabyasachi, Manish Malhotra, Chanel, Gucci, Rolex, etc.)
 *  - declaredValue > Rs 5,000 (luxury tier)
 *  - prices in a luxury range (startingPrice >= 2500, increments 250/500/1000)
 *  - verificationStatus: 'verified'
 *  - placeholder proofDocs entries (bill, certificate, serial tag)
 *  - Support `--reset` flag: deletes previously seeded auctions and recreates with fresh relative times:
 *      * 3 live ending in 1-3 days
 *      * 2 ending in about 10-30 minutes
 *      * 3 upcoming tomorrow
 *  - Include pre-placed bids
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const User = require('../models/User');
const Auction = require('../models/Auction');

const DEMO_SELLER_EMAIL = 'demo.seller@looped.app';
const DEMO_BIDDER_EMAIL = 'demo.bidder@looped.app';
const DEMO_BIDDER_NAME = 'Aria Vintage Lover';

const LUXURY_AUCTION_ITEMS = [
  // 3 LIVE AUCTIONS (ending in 1-3 days)
  {
    title: 'Sabyasachi Heritage Zardozi Embroidered Bridal Velvet Lehenga',
    brand: 'Sabyasachi',
    category: 'Bridal & Couture',
    condition: 'Like New',
    size: 'M',
    purchaseYear: '2023',
    declaredValue: 245000,
    startingPrice: 65000,
    reservePrice: 90000,
    incrementAmount: 1000,
    description: 'Breathtaking authentic Sabyasachi bridal masterpiece in deep crimson royal micro-velvet. Features antique gold zardozi, dabka, and sequin hand-embroidery. Includes bridal dupatta and signature canvas garment trunk.',
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80'
    ],
    proofDocs: [
      { type: 'bill', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500', originalName: 'Sabyasachi_Kolkata_Invoice_2023.pdf' },
      { type: 'certificate', url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=500', originalName: 'Certificate_of_Authenticity.pdf' },
      { type: 'serial_tag', url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500', originalName: 'Hallmark_Tag_CloseUp.jpg' }
    ],
    timeType: 'live_long',
    bidsCount: 4
  },
  {
    title: 'Chanel Classic Medium Double Flap Bag in Quilted Lambskin',
    brand: 'Chanel',
    category: 'Luxury Bags',
    condition: 'Like New',
    size: 'Medium (25.5 cm)',
    purchaseYear: '2022',
    declaredValue: 720000,
    startingPrice: 280000,
    reservePrice: 350000,
    incrementAmount: 2500,
    description: 'Iconic Chanel Double Flap in supple black quilted lambskin with 24k gold-plated turnlock hardware. Burgundy leather interior with immaculate microchip NFC verification tag and original magnetic camellia gift box.',
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80'
    ],
    proofDocs: [
      { type: 'bill', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500', originalName: 'Chanel_Boutique_Paris_Invoice.pdf' },
      { type: 'dustbag_box', url: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=500', originalName: 'Original_Box_Dustbag.jpg' },
      { type: 'serial_tag', url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500', originalName: 'NFC_Microchip_Tag.jpg' }
    ],
    timeType: 'live_long',
    bidsCount: 5
  },
  {
    title: 'Manish Malhotra Sequin Embellished Rose Gold Designer Cocktail Saree',
    brand: 'Manish Malhotra',
    category: 'Designer Wear',
    condition: 'Like New',
    size: 'Free Size',
    purchaseYear: '2024',
    declaredValue: 165000,
    startingPrice: 42000,
    reservePrice: 55000,
    incrementAmount: 1000,
    description: 'High-octane glamour rose gold handcrafted sheet-sequin saree draped over sheer tulle netting. Comes paired with matching unstitched heavy crystal blouse piece. Worn once for a red-carpet event.',
    images: [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80'
    ],
    proofDocs: [
      { type: 'bill', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500', originalName: 'MM_Boutique_Mumbai_Bill.pdf' },
      { type: 'certificate', url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=500', originalName: 'ManishMalhotra_Auth_Tag.pdf' }
    ],
    timeType: 'live_long',
    bidsCount: 3
  },

  // 2 ENDING SOON AUCTIONS (ending in 10-25 minutes)
  {
    title: 'Gucci Horsebit 1955 Monogram Shoulder Bag in GG Supreme Canvas',
    brand: 'Gucci',
    category: 'Luxury Bags',
    condition: 'Like New',
    size: 'Small',
    purchaseYear: '2023',
    declaredValue: 220000,
    startingPrice: 75000,
    reservePrice: 95000,
    incrementAmount: 1000,
    description: 'Archival revival design featuring beige/ebony GG Supreme canvas with rich brown leather trim and polished gold Horsebit hardware. Adjustable shoulder strap and dual interior compartments.',
    images: [
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80'
    ],
    proofDocs: [
      { type: 'bill', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500', originalName: 'Gucci_Store_DLF_Invoice.pdf' },
      { type: 'serial_tag', url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500', originalName: 'Inner_Heat_Stamp_Serial.jpg' }
    ],
    timeType: 'ending_soon_1',
    bidsCount: 6
  },
  {
    title: 'Rolex Oyster Perpetual 36mm Turquoise "Tiffany" Dial Stainless Steel',
    brand: 'Rolex',
    category: 'Watches',
    condition: 'Like New',
    size: '36mm',
    purchaseYear: '2022',
    declaredValue: 980000,
    startingPrice: 450000,
    reservePrice: 580000,
    incrementAmount: 2500,
    description: 'Rare and coveted Rolex Oyster Perpetual Ref. 126000 featuring the vibrant turquoise lacquer celebration dial. Calibre 3230 automatic movement with 70h power reserve. Complete set with original green presentation box and guarantee card.',
    images: [
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800&auto=format&fit=crop&q=80'
    ],
    proofDocs: [
      { type: 'bill', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500', originalName: 'Ethos_Watches_Official_Receipt.pdf' },
      { type: 'certificate', url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=500', originalName: 'Rolex_Green_Guarantee_Card.pdf' },
      { type: 'dustbag_box', url: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=500', originalName: 'Outer_And_Inner_Rolex_Boxes.jpg' }
    ],
    timeType: 'ending_soon_2',
    bidsCount: 7
  },

  // 3 UPCOMING AUCTIONS (starting tomorrow)
  {
    title: 'Tarun Tahiliani Hand-Painted Pichwai Raw Silk Bridal Sherwani Set',
    brand: 'Tarun Tahiliani',
    category: 'Bridal & Couture',
    condition: 'New with tags',
    size: '40 / L',
    purchaseYear: '2024',
    declaredValue: 210000,
    startingPrice: 60000,
    reservePrice: 85000,
    incrementAmount: 1000,
    description: 'Masterpiece raw silk sherwani featuring heritage Nathdwara Pichwai motifs hand-painted and highlighted with fine resham & french knots. Includes raw silk churidar and handloom tissue stole.',
    images: [
      'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80'
    ],
    proofDocs: [
      { type: 'bill', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500', originalName: 'TarunTahiliani_Mehrauli_Store_Bill.pdf' },
      { type: 'certificate', url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=500', originalName: 'Couture_Authenticity_Seal.pdf' }
    ],
    timeType: 'upcoming_1',
    bidsCount: 0
  },
  {
    title: 'Christian Louboutin Kate 100 Patent Leather Pumps with Red Soles',
    brand: 'Christian Louboutin',
    category: 'Designer Footwear',
    condition: 'New with tags',
    size: 'EU 38',
    purchaseYear: '2024',
    declaredValue: 88000,
    startingPrice: 32000,
    reservePrice: 42000,
    incrementAmount: 500,
    description: 'Timeless Christian Louboutin Kate pumps in glossy black patent calfskin leather with a slender 100mm stiletto heel and signature vibrant red lacquered soles. Deadstock with dust bags and spare heel tips.',
    images: [
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800&auto=format&fit=crop&q=80'
    ],
    proofDocs: [
      { type: 'bill', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500', originalName: 'Louboutin_Boutique_Invoice.pdf' },
      { type: 'dustbag_box', url: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=500', originalName: 'Louboutin_Red_Dustbags_Box.jpg' }
    ],
    timeType: 'upcoming_2',
    bidsCount: 0
  },
  {
    title: 'Burberry Kensington Heritage Double-Breasted Trench Coat in Honey Gabardine',
    brand: 'Burberry',
    category: 'Designer Outerwear',
    condition: 'Like New',
    size: 'UK 10 / M',
    purchaseYear: '2023',
    declaredValue: 195000,
    startingPrice: 55000,
    reservePrice: 75000,
    incrementAmount: 1000,
    description: 'The quintessential British trench coat crafted in Castleford from weatherproof cotton gabardine. Features signature Vintage check lining, buffalo horn buttons, calf leather buckles, and storm flap.',
    images: [
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ],
    proofDocs: [
      { type: 'bill', url: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500', originalName: 'Burberry_RegentStreet_Invoice.pdf' },
      { type: 'serial_tag', url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500', originalName: 'Order_Serial_Label.jpg' }
    ],
    timeType: 'upcoming_3',
    bidsCount: 0
  }
];

async function seedAuctions() {
  console.log('🔨 Starting Luxury Designer Auction Seed Script...');

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
      name: 'Looped Luxury Vault',
      isVerified: true,
      role: 'user',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    });
    console.log(`✨ Created Demo Seller: ${DEMO_SELLER_EMAIL}`);
  }

  // Ensure demo bidder exists
  let demoBidder = await User.findOne({ email: DEMO_BIDDER_EMAIL });
  if (!demoBidder) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    demoBidder = await User.create({
      email: DEMO_BIDDER_EMAIL,
      password: hash,
      name: DEMO_BIDDER_NAME,
      isVerified: true,
      role: 'user'
    });
    console.log(`✨ Created Demo Bidder: ${DEMO_BIDDER_EMAIL}`);
  }

  let secondBidder = await User.findOne({ email: 'kavya.thrift@looped.app' });
  if (!secondBidder) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    secondBidder = await User.create({
      email: 'kavya.thrift@looped.app',
      password: hash,
      name: 'Kavya R.',
      isVerified: true,
      role: 'user'
    });
  }

  // Delete previously seeded auctions if --reset flag is passed or default
  const isReset = process.argv.includes('--reset') || true;
  if (isReset) {
    const deleted = await Auction.deleteMany({ sellerId: demoSeller._id });
    console.log(`🧹 Cleared ${deleted.deletedCount} previous demo luxury auctions.`);
  }

  const now = Date.now();
  const createdAuctions = [];

  for (let i = 0; i < LUXURY_AUCTION_ITEMS.length; i++) {
    const item = LUXURY_AUCTION_ITEMS[i];

    let startTime, endTime, status;
    if (item.timeType === 'live_long') {
      // 3 Live ending in 1-3 days
      startTime = new Date(now - (12 + i * 8) * 60 * 60 * 1000);
      endTime = new Date(now + (1.5 + i * 0.8) * 24 * 60 * 60 * 1000);
      status = 'live';
    } else if (item.timeType === 'ending_soon_1') {
      // Ending in ~15 mins
      startTime = new Date(now - 47.75 * 60 * 60 * 1000);
      endTime = new Date(now + 15 * 60 * 1000);
      status = 'ending';
    } else if (item.timeType === 'ending_soon_2') {
      // Ending in ~25 mins
      startTime = new Date(now - 23.6 * 60 * 60 * 1000);
      endTime = new Date(now + 25 * 60 * 1000);
      status = 'ending';
    } else {
      // 3 Upcoming tomorrow
      startTime = new Date(now + (24 + (i - 5) * 6) * 60 * 60 * 1000);
      endTime = new Date(now + (72 + (i - 5) * 12) * 60 * 60 * 1000);
      status = 'upcoming';
    }

    let currentPrice = item.startingPrice;
    const bids = [];
    const biddersSet = new Set();

    if (item.bidsCount > 0) {
      for (let b = 1; b <= item.bidsCount; b++) {
        const isSecond = b % 2 === 0;
        const bidderUser = isSecond ? secondBidder : demoBidder;
        currentPrice += item.incrementAmount;
        biddersSet.add(bidderUser._id.toString());

        bids.push({
          bidderId: bidderUser._id,
          bidderName: bidderUser.name,
          amount: currentPrice,
          timestamp: new Date(startTime.getTime() + b * 2 * 60 * 60 * 1000),
          isWinning: b === item.bidsCount
        });
      }
    }

    const auctionDoc = new Auction({
      sellerId: demoSeller._id,
      sellerName: demoSeller.name || 'Looped Luxury Vault',
      title: item.title,
      description: item.description,
      brand: item.brand,
      category: item.category,
      condition: item.condition,
      size: item.size,
      purchaseYear: item.purchaseYear,
      declaredValue: item.declaredValue,
      image: item.images[0],
      images: item.images,
      proofDocs: item.proofDocs,
      verificationStatus: 'verified',
      verificationNote: 'Verified authentic designer piece with genuine purchase invoice & hallmarks.',
      verifiedAt: new Date(now - 24 * 60 * 60 * 1000),
      startingPrice: item.startingPrice,
      currentPrice,
      reservePrice: item.reservePrice,
      incrementAmount: item.incrementAmount,
      startTime,
      endTime,
      status,
      bids,
      totalBidders: biddersSet.size,
      viewCount: 30 + Math.floor(Math.random() * 60)
    });

    await auctionDoc.save();
    createdAuctions.push(auctionDoc);
    console.log(`  [${status.toUpperCase()}] [${item.brand}] ${item.title.substring(0, 42)}... → Start: ₹${item.startingPrice}, Current: ₹${currentPrice} (${bids.length} bids)`);
  }

  console.log(`\n🎉 Successfully seeded ${createdAuctions.length} luxury designer auctions into MongoDB!`);
  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}

if (require.main === module) {
  seedAuctions().catch(err => {
    console.error('❌ seedAuctions error:', err);
    process.exit(1);
  });
}

module.exports = seedAuctions;
