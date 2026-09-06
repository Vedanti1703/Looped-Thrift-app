/**
 * syncAllProductsToDB.js
 * Updates the 1,000 synthetic product records in MongoDB to cleanly match
 * the regenerated looped-products.json dataset (updating title, description, price, tags, image).
 * Does NOT touch the 30 original hand-curated seed products.
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

async function run() {
  console.log('🔄 Syncing synthetic products to MongoDB...');

  const generated = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  await mongoose.connect(process.env.MONGO_URI);

  // Find all non-seed synthetic products (products that are not one of the 30 original hand-curated ones)
  const seedTitles = [
    'Sakura Embroidered Kimono', 'Block Print Anarkali Suit', 'Thermal Fleece Jogger Set',
    'Denim Cargo Wide Leg', 'Chunky Knit Turtleneck', 'Origami Pleat Trousers',
    'Mirror Work Choli', 'Oxford Leather Brogues', 'Vintage Boro Indigo Jacket',
    'Bridal Kundan Necklace Set', 'Camel Cashmere Scarf', 'Kawaii Pastel Coord Set',
    'Sharara with Zari Dupatta', 'Faux Fur Teddy Coat', 'Grunge Layered Flannel',
    'Meenakari Potli Bag', 'Linen Wide-Leg Pants', 'Merino Wool Roll-Neck',
    'Y2K Vinyl Flared Skirt', 'Shearling Aviator Jacket', 'Banaras Silk Saree',
    'Denim Patchwork Shorts', 'Mohair Fuzzy Cardigan', 'Platform Mary Janes'
  ];

  // Remove existing synthetic products and re-insert fresh clean records
  const deleteResult = await Product.deleteMany({ title: { $nin: seedTitles } });
  console.log(`🗑️  Removed ${deleteResult.deletedCount} old synthetic products`);

  const toInsert = generated.map(p => ({
    title:         p.title,
    description:   p.description,
    price:         p.price,
    originalPrice: p.originalPrice,
    condition:     p.condition,
    category:      p.category,
    tags:          p.tags,
    image:         p.image,
    images:        p.images || [],
    sellerName:    p.sellerName || 'Looped Member',
    size:          p.size || '',
    brand:         p.brand || '',
    listingType:   p.listingType || 'sell',
    views:         p.views || 0,
    likes:         p.likes || 0,
    avgRating:     p.avgRating || 4.0,
    reviewCount:   p.reviewCount || 5,
  }));

  const insertResult = await Product.insertMany(toInsert);
  console.log(`✅ Inserted ${insertResult.length} fresh synthetic products into MongoDB`);

  const total = await Product.countDocuments();
  console.log(`📊 Total products in DB: ${total}`);

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌ Sync error:', err.message);
  process.exit(1);
});
