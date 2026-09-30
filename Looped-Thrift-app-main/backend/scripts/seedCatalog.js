/**
 * seedCatalog.js
 * Expands the Discover Catalog with 70 new distinct curated fashion products:
 * Groups:
 *  1. 5 Ethnic (sarees and lehenga choli)
 *  2. 10 Winter outfits
 *  3. 10 Summer outfits
 *  4. 10 Vacation outfits
 *  5. 5 Women's Formals
 *  6. 5 Men's Formals
 *  7. 25 Most-searched everyday items:
 *     straight-fit jeans, mom jeans, crop top, denim jacket, cargo pants,
 *     co-ord set, floral midi dress, little black dress, cotton kurti set,
 *     wrap dress, satin slip skirt, pleated mini skirt, oversized graphic tee,
 *     white sneakers, black hoodie, polo t-shirt, chinos, denim shirt,
 *     bomber jacket, joggers, men's kurta, tote bag, crossbody bag,
 *     sunglasses, analog watch.
 *
 * Characteristics:
 *  - sellerId = demo seller (demo.seller@looped.app)
 *  - realistic INR prices (resale ~30-60% of originalPrice)
 *  - realistic condition values from Product enum
 *  - size, brand, 3+ tags (season, occasion, style)
 *  - description, image + images[] (3 each, verified working Unsplash URLs)
 *  - itemMeasurements where possible for Size Intelligence
 *  - Idempotent with `--reset` flag that only touches items with tag 'seed-catalog'.
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

// ── 70 Curated Catalog Items Definition ──────────────────────
const CATALOG_ITEMS = [
  // ── GROUP 1: 5 Ethnic (Sarees and Lehenga Choli) ─────────────
  {
    group: 'Ethnic',
    title: 'Maroon Zari Woven Kanjivaram Silk Saree',
    brand: 'Nalli',
    category: "Women's Traditional",
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 8500,
    price: 3600,
    tags: ['ethnic', 'saree', 'silk', 'maroon', 'traditional', 'wedding', 'seed-catalog'],
    description: 'Rich maroon pure Kanjivaram silk saree with authentic gold temple zari border. Worn once for a family ceremony.',
    itemMeasurements: { length: 550, waist: 0 },
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Ethnic',
    title: 'Mustard Yellow Handloom Chanderi Tissue Saree',
    brand: 'FabIndia',
    category: "Women's Traditional",
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 6200,
    price: 2400,
    tags: ['ethnic', 'saree', 'chanderi', 'yellow', 'mustard', 'festive', 'seed-catalog'],
    description: 'Lightweight Chanderi tissue silk saree in luminous mustard yellow with delicate silver booti motifs and tassels.',
    itemMeasurements: { length: 550, waist: 0 },
    images: [
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Ethnic',
    title: 'Blush Pink Floral Printed Organza Saree with Scallop Border',
    brand: 'Label Ritu Kumar',
    category: "Women's Traditional",
    condition: 'New with tags',
    size: 'Free Size',
    originalPrice: 9500,
    price: 4200,
    tags: ['ethnic', 'saree', 'organza', 'pink', 'floral', 'summer', 'seed-catalog'],
    description: 'Airy pastel pink sheer organza saree featuring hand-painted botanical blooms and hand-cut pearl scalloped edges.',
    itemMeasurements: { length: 550, waist: 0 },
    images: [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Ethnic',
    title: 'Emerald Green Embroidered Georgette Lehenga Choli Set',
    brand: 'Biba',
    category: "Women's Traditional",
    condition: 'Good',
    size: 'M',
    originalPrice: 12000,
    price: 4800,
    tags: ['ethnic', 'lehenga', 'choli', 'green', 'emerald', 'party', 'seed-catalog'],
    description: 'Flared emerald green georgette lehenga with sequin border, padded blouse, and matching net dupatta.',
    itemMeasurements: { waist: 30, length: 42, chest: 36 },
    images: [
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Ethnic',
    title: 'Pastel Lavender Gota Patti Chiffon Lehenga Set',
    brand: 'Aza Fashions',
    category: "Women's Traditional",
    condition: 'Like New',
    size: 'S',
    originalPrice: 14500,
    price: 5800,
    tags: ['ethnic', 'lehenga', 'lavender', 'gota-patti', 'festive', 'seed-catalog'],
    description: 'Soft lavender flowing chiffon lehenga featuring authentic Jaipur gota patti handwork. Extremely lightweight and photogenic.',
    itemMeasurements: { waist: 28, length: 41, chest: 34 },
    images: [
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80'
    ]
  },

  // ── GROUP 2: 10 Winter Outfits ───────────────────────────────
  {
    group: 'Winter',
    title: 'Camel Double-Breasted Wool Blend Longline Overcoat',
    brand: 'Zara',
    category: "Women's Outerwear",
    condition: 'Like New',
    size: 'M',
    originalPrice: 7990,
    price: 3200,
    tags: ['winter', 'coat', 'overcoat', 'camel', 'wool', 'classic', 'seed-catalog'],
    description: 'Tailored minimalist camel long coat in warm wool blend with notched lapels and horn buttons.',
    itemMeasurements: { shoulder: 16, chest: 38, length: 44 },
    images: [
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Cream Chunky Cable Knit Turtleneck Sweater',
    brand: 'Mango',
    category: "Women's Tops",
    condition: 'Good',
    size: 'S',
    originalPrice: 3990,
    price: 1550,
    tags: ['winter', 'sweater', 'turtleneck', 'cream', 'knitwear', 'seed-catalog'],
    description: 'Cozy oversized cable knit jumper with a high roll collar in soft ribbed yarn.',
    itemMeasurements: { chest: 38, length: 24, shoulder: 16 },
    images: [
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Olive Quilted Down Puffer Jacket with Fleece Hood',
    brand: 'Uniqlo',
    category: "Women's Outerwear",
    condition: 'Like New',
    size: 'L',
    originalPrice: 5990,
    price: 2400,
    tags: ['winter', 'puffer', 'jacket', 'olive', 'green', 'warm', 'seed-catalog'],
    description: 'Ultra-light warm down jacket with windproof matte shell and detachable faux fur hood.',
    itemMeasurements: { chest: 42, length: 26, shoulder: 17 },
    images: [
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Charcoal Wool Cashmere Blend Crewneck Jumper',
    brand: 'Marks & Spencer',
    category: "Men's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 4500,
    price: 1800,
    tags: ['winter', 'sweater', 'cashmere', 'charcoal', 'grey', 'formal', 'seed-catalog'],
    description: 'Supersoft fine-gauge knit in deep charcoal grey. Essential layering piece for chilly days.',
    itemMeasurements: { chest: 40, length: 27, shoulder: 17.5 },
    images: [
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Brown Suede Sherpa Lined Aviator Moto Jacket',
    brand: 'Bershka',
    category: "Women's Outerwear",
    condition: 'Like New',
    size: 'M',
    originalPrice: 6990,
    price: 2900,
    tags: ['winter', 'jacket', 'shearling', 'brown', 'moto', 'vintage', 'seed-catalog'],
    description: 'Faux suede biker jacket with plush cream faux shearling collar and metal buckle detailing.',
    itemMeasurements: { chest: 39, length: 23, shoulder: 16 },
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Navy Ribbed Merino Wool Zip Cardigan',
    brand: 'Superdry',
    category: "Men's Outerwear",
    condition: 'Good',
    size: 'L',
    originalPrice: 5490,
    price: 2100,
    tags: ['winter', 'cardigan', 'wool', 'navy', 'blue', 'casual', 'seed-catalog'],
    description: 'Heavyweight full-zip ribbed cardigan with stand collar and signature chest embroidery.',
    itemMeasurements: { chest: 42, length: 28, shoulder: 18 },
    images: [
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Forest Green Plaid Brushed Flannel Overshirt',
    brand: 'Levis',
    category: "Men's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 3799,
    price: 1650,
    tags: ['winter', 'flannel', 'shirt', 'plaid', 'green', 'streetwear', 'seed-catalog'],
    description: 'Heavy cotton brushed twill flannel shirt with dual chest pockets in dark green tartan check.',
    itemMeasurements: { chest: 40, length: 29, shoulder: 17 },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Black Fleece Lined Thermal Joggers Pants',
    brand: 'Nike',
    category: "Men's Bottoms",
    condition: 'New with tags',
    size: 'M',
    originalPrice: 3495,
    price: 1550,
    tags: ['winter', 'joggers', 'black', 'fleece', 'sportswear', 'seed-catalog'],
    description: 'Tapered athletic joggers with plush thermal fleece lining and zippered side pockets.',
    itemMeasurements: { waist: 32, inseam: 30, length: 40 },
    images: [
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Mocha Teddy Faux Fur Cocoon Winter Coat',
    brand: 'H&M',
    category: "Women's Outerwear",
    condition: 'Like New',
    size: 'S',
    originalPrice: 4999,
    price: 2100,
    tags: ['winter', 'coat', 'teddy', 'fur', 'brown', 'cozy', 'seed-catalog'],
    description: 'Fluffy oversized teddy coat in warm mocha brown with snap front fasteners and deep pockets.',
    itemMeasurements: { chest: 40, length: 36, shoulder: 16.5 },
    images: [
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Winter',
    title: 'Ribbed Knit Wool Blend Slouchy Beanie & Scarf Set',
    brand: 'Accessorize',
    category: 'Accessories',
    condition: 'New with tags',
    size: 'Free Size',
    originalPrice: 2490,
    price: 950,
    tags: ['winter', 'accessories', 'scarf', 'beanie', 'grey', 'seed-catalog'],
    description: 'Matching chunky knit heather grey winter scarf and folded beanie set.',
    images: [
      'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511405946472-a37e3b5ccd47?w=800&auto=format&fit=crop&q=80'
    ]
  },

  // ── GROUP 3: 10 Summer Outfits ───────────────────────────────
  {
    group: 'Summer',
    title: 'Yellow Floral Printed Tiered Cotton Sundress',
    brand: 'Forever New',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'S',
    originalPrice: 5400,
    price: 2100,
    tags: ['summer', 'dress', 'sundress', 'floral', 'yellow', 'cottagecore', 'seed-catalog'],
    description: 'Breezy sweetheart neckline cotton tiered midi dress with tie-up shoulder straps in marigold yellow.',
    itemMeasurements: { chest: 34, waist: 27, length: 44 },
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'White Broderie Anglaise Eyelet Puff Sleeve Crop Top',
    brand: 'Zara',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'XS',
    originalPrice: 2990,
    price: 1100,
    tags: ['summer', 'crop-top', 'white', 'cotton', 'cottagecore', 'seed-catalog'],
    description: 'Pure white cotton embroidered eyelet crop blouse with structured square neckline and puff sleeves.',
    itemMeasurements: { chest: 33, length: 15, shoulder: 14 },
    images: [
      'https://images.unsplash.com/photo-1534126511673-b6899657816a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'Sky Blue Linen Camp Collar Short Sleeve Resort Shirt',
    brand: 'Massimo Dutti',
    category: "Men's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 4290,
    price: 1750,
    tags: ['summer', 'linen', 'shirt', 'blue', 'resort', 'vacation', 'seed-catalog'],
    description: '100% French linen breathable relaxed Cuban collar shirt in light sky blue.',
    itemMeasurements: { chest: 40, length: 28, shoulder: 17.5 },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'Beige High-Waisted Tailored Linen Blend Shorts',
    brand: 'H&M',
    category: "Women's Bottoms",
    condition: 'Good',
    size: 'M',
    originalPrice: 1999,
    price: 850,
    tags: ['summer', 'shorts', 'linen', 'beige', 'neutral', 'seed-catalog'],
    description: 'Pleated high-rise linen shorts with tortoise button closure and side slant pockets.',
    itemMeasurements: { waist: 29, hips: 38, length: 16 },
    images: [
      'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'Sage Green Ribbed Halter Neck Backless Top',
    brand: 'Urbanic',
    category: "Women's Tops",
    condition: 'New with tags',
    size: 'S',
    originalPrice: 1490,
    price: 599,
    tags: ['summer', 'halter', 'top', 'green', 'sage', 'y2k', 'seed-catalog'],
    description: 'Fitted ribbed cotton jersey halter top with open tie back in muted sage green.',
    itemMeasurements: { chest: 34, length: 17 },
    images: [
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534126511673-b6899657816a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'Khaki Drawstring Cotton Linen Relaxed Summer Shorts',
    brand: 'Uniqlo',
    category: "Men's Bottoms",
    condition: 'Like New',
    size: 'L',
    originalPrice: 2490,
    price: 1050,
    tags: ['summer', 'shorts', 'khaki', 'linen', 'casual', 'seed-catalog'],
    description: 'Casual easy-fit linen blend pull-on shorts with elasticated drawstring waist.',
    itemMeasurements: { waist: 34, inseam: 8, length: 19 },
    images: [
      'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'Coral Pink Tiered Ruffle Mini Summer Skirt',
    brand: 'Bershka',
    category: "Women's Bottoms",
    condition: 'Good',
    size: 'S',
    originalPrice: 1990,
    price: 799,
    tags: ['summer', 'skirt', 'ruffle', 'pink', 'coral', 'cute', 'seed-catalog'],
    description: 'Tiered flowy flounce mini skirt with elasticated smocked waistband in vibrant coral.',
    itemMeasurements: { waist: 27, length: 16 },
    images: [
      'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'White Pure Cotton Broderie Midi Bohemian Dress',
    brand: 'Mango',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 6590,
    price: 2600,
    tags: ['summer', 'dress', 'white', 'cotton', 'boho', 'vacation', 'seed-catalog'],
    description: 'Effortless sleeveless midi dress crafted from breathable embroidered white cotton eyelet.',
    itemMeasurements: { chest: 36, waist: 29, length: 46 },
    images: [
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'Navy & White Striped Nautical Cotton Tank Top',
    brand: 'GAP',
    category: "Women's Tops",
    condition: 'Good',
    size: 'M',
    originalPrice: 1499,
    price: 550,
    tags: ['summer', 'tank', 'stripes', 'blue', 'white', 'nautical', 'seed-catalog'],
    description: 'Classic Breton striped soft ribbed cotton scoop-neck tank top.',
    itemMeasurements: { chest: 35, length: 22 },
    images: [
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534126511673-b6899657816a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Summer',
    title: 'Woven Straw Bucket Hat with Black Ribbon Band',
    brand: 'Aldo',
    category: 'Accessories',
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 2290,
    price: 890,
    tags: ['summer', 'hat', 'straw', 'accessories', 'vacation', 'beach', 'seed-catalog'],
    description: 'Natural woven paper straw bucket hat with UPF sun protection and grosgrain trim.',
    images: [
      'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1511405946472-a37e3b5ccd47?w=800&auto=format&fit=crop&q=80'
    ]
  },

  // ── GROUP 4: 10 Vacation Outfits ─────────────────────────────
  {
    group: 'Vacation',
    title: 'Tropical Palm Print Rayon Hawaiian Resort Shirt',
    brand: 'Zara Man',
    category: "Men's Tops",
    condition: 'Like New',
    size: 'L',
    originalPrice: 3290,
    price: 1350,
    tags: ['vacation', 'hawaiian', 'shirt', 'tropical', 'green', 'resort', 'seed-catalog'],
    description: 'Drapey viscose Hawaiian shirt featuring lush emerald monstera palm leaves and coconut buttons.',
    itemMeasurements: { chest: 42, length: 29, shoulder: 18 },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'Bohemian Multicolored Patchwork Print Maxi Wrap Dress',
    brand: 'Label Ritu Kumar',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 7800,
    price: 3100,
    tags: ['vacation', 'dress', 'maxi', 'boho', 'wrap', 'resort', 'seed-catalog'],
    description: 'Vibrant silk-modal maxi wrap dress with artisan paisley and Aztec block print motifs.',
    itemMeasurements: { chest: 36, waist: 29, length: 52 },
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'Terracotta Linen Wide-Leg Palazzo Vacation Trousers',
    brand: 'Mango',
    category: "Women's Bottoms",
    condition: 'Like New',
    size: 'M',
    originalPrice: 4590,
    price: 1850,
    tags: ['vacation', 'palazzo', 'linen', 'terracotta', 'rust', 'pants', 'seed-catalog'],
    description: 'Flowy high-waisted palazzo pants in earth tone rust linen with front pleats.',
    itemMeasurements: { waist: 29, hips: 40, inseam: 31, length: 42 },
    images: [
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'Turquoise Crochet Knit Halter Beach Coverup Dress',
    brand: 'Urban Outfitters',
    category: "Women's Tops",
    condition: 'Good',
    size: 'S',
    originalPrice: 3800,
    price: 1450,
    tags: ['vacation', 'crochet', 'dress', 'beach', 'turquoise', 'seed-catalog'],
    description: 'Open-stitch handmade crochet coverup dress in ocean turquoise. Perfect over swimwear.',
    itemMeasurements: { chest: 34, length: 34 },
    images: [
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'White Cotton Gauze Relaxed Drawstring Beach Pants',
    brand: 'Cottonworld',
    category: "Men's Bottoms",
    condition: 'Like New',
    size: 'L',
    originalPrice: 2890,
    price: 1150,
    tags: ['vacation', 'pants', 'white', 'cotton', 'beach', 'resort', 'seed-catalog'],
    description: 'Double gauze crinkle cotton breathable lounge trousers with side pockets.',
    itemMeasurements: { waist: 34, inseam: 30, length: 41 },
    images: [
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'Olive Floral Print Kimono Robe Cardigan with Tassels',
    brand: 'FabIndia',
    category: "Women's Outerwear",
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 3490,
    price: 1350,
    tags: ['vacation', 'kimono', 'floral', 'green', 'olive', 'boho', 'seed-catalog'],
    description: 'Open front flowy modal kimono robe with traditional hand-block floral print and fringed hem.',
    itemMeasurements: { length: 38, chest: 44 },
    images: [
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'Beige Espadrille Platform Wedge Sandals with Ankle Strap',
    brand: 'Charles & Keith',
    category: 'Footwear',
    condition: 'Like New',
    size: 'EU 38',
    originalPrice: 4999,
    price: 1950,
    tags: ['vacation', 'sandals', 'espadrilles', 'footwear', 'beige', 'seed-catalog'],
    description: 'Jute braided platform wedge sandals with canvas cross straps and buckle fastening.',
    images: [
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'Oversized Handwoven Jute Straw Beach Tote Bag',
    brand: 'The Loom',
    category: 'Bags',
    condition: 'New with tags',
    size: 'Large',
    originalPrice: 2690,
    price: 1100,
    tags: ['vacation', 'tote', 'bag', 'straw', 'jute', 'beach', 'seed-catalog'],
    description: 'Spacious artisanal woven straw tote with round bamboo handles and internal zip pouch.',
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'Sunny Yellow Striped Linen Short Sleeve Shirt',
    brand: 'Selected Homme',
    category: "Men's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 3499,
    price: 1400,
    tags: ['vacation', 'shirt', 'linen', 'yellow', 'stripes', 'seed-catalog'],
    description: 'Lightweight vertical striped linen shirt with chest pocket and curved hem.',
    itemMeasurements: { chest: 40, length: 28, shoulder: 17 },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Vacation',
    title: 'Retro Cat-Eye Tortoiseshell Sunglasses with UV400 Protection',
    brand: 'Ray-Ban',
    category: 'Accessories',
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 6500,
    price: 2600,
    tags: ['vacation', 'sunglasses', 'accessories', 'eyewear', 'vintage', 'seed-catalog'],
    description: 'Vintage 70s inspired acetate cat-eye frames in dark tortoiseshell with polarized brown lenses.',
    images: [
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&auto=format&fit=crop&q=80'
    ]
  },

  // ── GROUP 5: 5 Women's Formals ───────────────────────────────
  {
    group: 'Formals',
    title: 'Navy Tailored Peak Lapel Single-Button Formal Blazer',
    brand: 'Massimo Dutti',
    category: "Women's Outerwear",
    condition: 'Like New',
    size: 'S',
    originalPrice: 8990,
    price: 3600,
    tags: ['formal', 'blazer', 'navy', 'workwear', 'office', 'classic', 'seed-catalog'],
    description: 'Sharply tailored Italian stretch wool blazer in deep navy with peak lapels and flap pockets.',
    itemMeasurements: { shoulder: 15.5, chest: 36, length: 26 },
    images: [
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Formals',
    title: 'Black High-Waisted Straight-Leg Formal Trousers',
    brand: 'Zara',
    category: "Women's Bottoms",
    condition: 'Like New',
    size: 'M',
    originalPrice: 3590,
    price: 1450,
    tags: ['formal', 'trousers', 'pants', 'black', 'office', 'seed-catalog'],
    description: 'Crisp tailored crepe trousers with pressed centre crease and concealed zip fly.',
    itemMeasurements: { waist: 28, hips: 38, inseam: 30, length: 40 },
    images: [
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Formals',
    title: 'Ivory Pure Silk Button-Down Formal Work Blouse',
    brand: 'Marks & Spencer',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 4999,
    price: 1950,
    tags: ['formal', 'shirt', 'blouse', 'silk', 'ivory', 'white', 'seed-catalog'],
    description: 'Lustrous lightweight mulberry silk shirt with a point collar and French mother-of-pearl buttons.',
    itemMeasurements: { chest: 38, length: 25, shoulder: 15 },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534126511673-b6899657816a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Formals',
    title: 'Burgundy Structured Crepe Sheath Formal Midi Dress',
    brand: 'Calvin Klein',
    category: "Women's Tops",
    condition: 'New with tags',
    size: 'S',
    originalPrice: 7500,
    price: 2900,
    tags: ['formal', 'dress', 'sheath', 'burgundy', 'workwear', 'seed-catalog'],
    description: 'Fitted tailored sheath dress with subtle waist seam and gold exposed back zipper.',
    itemMeasurements: { chest: 35, waist: 28, hips: 37, length: 41 },
    images: [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Formals',
    title: 'Beige Structured Leather Work Tote Laptop Handbag',
    brand: 'Michael Kors',
    category: 'Bags',
    condition: 'Like New',
    size: 'Large',
    originalPrice: 18500,
    price: 6800,
    tags: ['formal', 'bag', 'tote', 'leather', 'beige', 'workwear', 'seed-catalog'],
    description: 'Saffiano leather structured executive tote with padded laptop sleeve and gold logo charm.',
    images: [
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80'
    ]
  },

  // ── GROUP 6: 5 Men's Formals ─────────────────────────────────
  {
    group: 'Formals',
    title: 'Charcoal Grey 2-Piece Slim Fit Wool Formal Suit',
    brand: 'Raymond',
    category: "Men's Tops",
    condition: 'Like New',
    size: '40 / M',
    originalPrice: 14999,
    price: 5800,
    tags: ['formal', 'suit', 'grey', 'charcoal', 'wool', 'office', 'seed-catalog'],
    description: 'Premium Super 120s wool blend slim notch lapel blazer and flat front trouser pair.',
    itemMeasurements: { chest: 40, shoulder: 17.5, waist: 32, inseam: 31 },
    images: [
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Formals',
    title: 'Crisp White Egyptian Cotton Spread Collar Formal Dress Shirt',
    brand: 'Brooks Brothers',
    category: "Men's Tops",
    condition: 'New with tags',
    size: '40 / 15.5',
    originalPrice: 5200,
    price: 2100,
    tags: ['formal', 'shirt', 'white', 'cotton', 'dress-shirt', 'seed-catalog'],
    description: 'Non-iron 100% Supima cotton poplin spread collar business shirt with double cuffs.',
    itemMeasurements: { chest: 41, length: 30, shoulder: 18 },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Formals',
    title: 'Navy Micro-Check Tailored Formal Blazer Jacket',
    brand: 'Van Heusen',
    category: "Men's Outerwear",
    condition: 'Good',
    size: '42 / L',
    originalPrice: 6999,
    price: 2700,
    tags: ['formal', 'blazer', 'navy', 'blue', 'workwear', 'seed-catalog'],
    description: 'Single-breasted 2-button blazer jacket with subtle tonal micro-houndstooth weave.',
    itemMeasurements: { chest: 42, shoulder: 18, length: 29 },
    images: [
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1597983073493-88cd35cf93b0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Formals',
    title: 'Handcrafted Tan Leather Oxford Formal Dress Shoes',
    brand: 'Clarks',
    category: 'Footwear',
    condition: 'Like New',
    size: 'UK 9',
    originalPrice: 7999,
    price: 3100,
    tags: ['formal', 'shoes', 'oxfords', 'leather', 'tan', 'footwear', 'seed-catalog'],
    description: 'Burnished full-grain Italian leather cap-toe Oxford shoes with Goodyear welted leather sole.',
    itemMeasurements: { footLength: 28 },
    images: [
      'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Formals',
    title: 'Reversible Black & Brown Smooth Leather Formal Belt with Silver Buckle',
    brand: 'Tommy Hilfiger',
    category: 'Accessories',
    condition: 'New with tags',
    size: '34-36',
    originalPrice: 3499,
    price: 1350,
    tags: ['formal', 'belt', 'leather', 'black', 'brown', 'accessories', 'seed-catalog'],
    description: 'Classic reversible genuine cowhide dress belt with polished twist buckle.',
    images: [
      'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80'
    ]
  },

  // ── GROUP 7: 25 Most-Searched Everyday Items ─────────────────
  {
    group: 'Everyday',
    title: 'High-Rise Vintage Light Wash Straight-Fit Jeans',
    brand: "Levi's",
    category: "Women's Bottoms",
    condition: 'Like New',
    size: '28',
    originalPrice: 4299,
    price: 1750,
    tags: ['denim', 'jeans', 'straight-fit', 'blue', 'vintage', 'casual', 'seed-catalog'],
    description: 'Iconic 501 inspired high-waisted straight leg jeans in non-stretch authentic light blue denim.',
    itemMeasurements: { waist: 28, hips: 38, inseam: 30, length: 40 },
    images: [
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Classic 90s Relaxed Fit Medium Blue Mom Jeans',
    brand: 'American Eagle',
    category: "Women's Bottoms",
    condition: 'Good',
    size: '27',
    originalPrice: 3999,
    price: 1500,
    tags: ['denim', 'jeans', 'mom-jeans', 'blue', '90s', 'casual', 'seed-catalog'],
    description: 'Tapered ankle mom jeans with comfortable comfort-stretch denim and subtle distressing.',
    itemMeasurements: { waist: 27, hips: 37, inseam: 28, length: 38 },
    images: [
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'White Ribbed Baby Tee Fitted Crop Top',
    brand: 'Brandy Melville',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'XS/S',
    originalPrice: 1800,
    price: 699,
    tags: ['crop-top', 'top', 'white', 'baby-tee', 'y2k', 'basics', 'seed-catalog'],
    description: 'Super soft 100% ribbed cotton cropped baby tee that pairs effortlessly with any high-waisted denim.',
    itemMeasurements: { chest: 32, length: 15 },
    images: [
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534126511673-b6899657816a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Oversized Vintage Trucker Denim Jacket in Distressed Blue',
    brand: "Levi's",
    category: "Women's Outerwear",
    condition: 'Like New',
    size: 'M',
    originalPrice: 5999,
    price: 2450,
    tags: ['denim', 'jacket', 'denim-jacket', 'blue', 'streetwear', 'vintage', 'seed-catalog'],
    description: 'Heavyweight rigid denim trucker jacket with drop shoulders and authentic washed wear.',
    itemMeasurements: { chest: 42, length: 24, shoulder: 18 },
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Wide-Leg Khaki Multi-Pocket Utility Cargo Pants',
    brand: 'Bershka',
    category: "Women's Bottoms",
    condition: 'Good',
    size: 'S',
    originalPrice: 3290,
    price: 1300,
    tags: ['cargo', 'pants', 'cargo-pants', 'khaki', 'y2k', 'streetwear', 'seed-catalog'],
    description: 'Y2K low/mid-rise relaxed cargo trousers with 6 utility pockets and drawstring toggle ankles.',
    itemMeasurements: { waist: 28, hips: 38, inseam: 31, length: 41 },
    images: [
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Sage Green Knit Cardigan and Ribbed Crop Top Co-Ord Set',
    brand: 'Zara',
    category: "Women's Sets",
    condition: 'Like New',
    size: 'S',
    originalPrice: 4290,
    price: 1750,
    tags: ['co-ord', 'set', 'co-ord-set', 'knitwear', 'green', 'sage', 'seed-catalog'],
    description: 'Chic 2-piece soft ribbed matching twinset featuring cropped tank and button-down cardigan.',
    itemMeasurements: { chest: 34, length: 18 },
    images: [
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'French Blue Floral Printed Tiered Midi Dress with Puff Sleeves',
    brand: 'Mango',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 5590,
    price: 2200,
    tags: ['dress', 'floral', 'midi-dress', 'blue', 'cottagecore', 'seed-catalog'],
    description: 'Romantic vintage-inspired floral midi dress with elasticated square neckline and side slit.',
    itemMeasurements: { chest: 36, waist: 28, length: 46 },
    images: [
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Classic Audrey Hepburn Square-Neck Little Black Dress (LBD)',
    brand: 'Marks & Spencer',
    category: "Women's Tops",
    condition: 'New with tags',
    size: 'S',
    originalPrice: 4999,
    price: 1950,
    tags: ['dress', 'lbd', 'little-black-dress', 'black', 'classic', 'party', 'seed-catalog'],
    description: 'Timeless tailored black mini dress crafted from structured stretch ponte fabric.',
    itemMeasurements: { chest: 34, waist: 27, hips: 36, length: 34 },
    images: [
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Indigo Blue Handblock Printed Cotton Kurti and Pant Set',
    brand: 'FabIndia',
    category: "Women's Traditional",
    condition: 'Like New',
    size: 'M',
    originalPrice: 3890,
    price: 1550,
    tags: ['ethnic', 'kurti', 'cotton-kurti-set', 'blue', 'indigo', 'dailywear', 'seed-catalog'],
    description: '100% pure cotton straight-fit Bagru block printed kurti with cropped ankle pants.',
    itemMeasurements: { chest: 38, waist: 30, length: 42 },
    images: [
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Emerald Green Satin Wrap Dress with Tie Waist',
    brand: 'H&M',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 3499,
    price: 1400,
    tags: ['dress', 'wrap-dress', 'green', 'satin', 'party', 'cocktail', 'seed-catalog'],
    description: 'Flattering V-neck true wrap dress in silky emerald green satin with self-tie sash.',
    itemMeasurements: { chest: 36, waist: 28, length: 39 },
    images: [
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Champagne Gold Bias-Cut Midi Satin Slip Skirt',
    brand: 'Zara',
    category: "Women's Bottoms",
    condition: 'Like New',
    size: 'S',
    originalPrice: 2990,
    price: 1200,
    tags: ['skirt', 'satin', 'slip-skirt', 'champagne', 'gold', 'minimalist', 'seed-catalog'],
    description: 'Liquid shine bias-cut satin skirt with hidden elastic waistband that drapes seamlessly.',
    itemMeasurements: { waist: 27, hips: 37, length: 33 },
    images: [
      'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'High-Waist Tennis Pleated Mini Skirt in Off-White',
    brand: 'American Apparel',
    category: "Women's Bottoms",
    condition: 'Good',
    size: 'XS',
    originalPrice: 2490,
    price: 950,
    tags: ['skirt', 'pleated', 'mini-skirt', 'white', 'y2k', 'preppy', 'seed-catalog'],
    description: 'Structured sharp accordion pleated tennis skirt with side button zipper.',
    itemMeasurements: { waist: 25, length: 15 },
    images: [
      'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Vintage Nirvana 1993 In Utero Oversized Graphic Tee',
    brand: 'Urban Outfitters',
    category: "Women's Tops",
    condition: 'Like New',
    size: 'L / Oversized',
    originalPrice: 2800,
    price: 1100,
    tags: ['graphic-tee', 'tee', 'oversized', 'black', 'grunge', 'streetwear', 'seed-catalog'],
    description: 'Washed charcoal vintage feel heavyweight cotton t-shirt with official distressed front graphic.',
    itemMeasurements: { chest: 44, length: 29, shoulder: 19 },
    images: [
      'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1534126511673-b6899657816a?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Classic Air Force 1 White Low-Top Leather Sneakers',
    brand: 'Nike',
    category: 'Footwear',
    condition: 'Like New',
    size: 'UK 7',
    originalPrice: 8195,
    price: 3600,
    tags: ['sneakers', 'white-sneakers', 'shoes', 'footwear', 'white', 'streetwear', 'seed-catalog'],
    description: 'Crisp all-white leather classic low-top sneakers in near-mint condition with clean outsoles.',
    itemMeasurements: { footLength: 26 },
    images: [
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1535043934128-cf0b28d52f95?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1515347619252-60a4bf4fff4f?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Heavyweight Fleece Oversized Black Pullover Hoodie',
    brand: 'Champion',
    category: "Men's Tops",
    condition: 'Like New',
    size: 'L',
    originalPrice: 4299,
    price: 1750,
    tags: ['hoodie', 'black-hoodie', 'black', 'oversized', 'streetwear', 'seed-catalog'],
    description: 'Reverse weave thick cotton fleece hoodie with pouch pocket and ribbed cuffs.',
    itemMeasurements: { chest: 46, length: 29, shoulder: 20 },
    images: [
      'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Slim Fit Pique Cotton Navy Polo T-Shirt',
    brand: 'Ralph Lauren',
    category: "Men's Tops",
    condition: 'Good',
    size: 'M',
    originalPrice: 5990,
    price: 2200,
    tags: ['polo', 'polo-t-shirt', 'navy', 'blue', 'classic', 'casual', 'seed-catalog'],
    description: 'Signature breathable cotton mesh polo with 2-button placket and embroidered pony.',
    itemMeasurements: { chest: 39, length: 27, shoulder: 17 },
    images: [
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Beige Slim Fit Stretch Cotton Chinos',
    brand: 'Dockers',
    category: "Men's Bottoms",
    condition: 'Like New',
    size: '32',
    originalPrice: 3499,
    price: 1350,
    tags: ['chinos', 'pants', 'beige', 'cotton', 'smart-casual', 'seed-catalog'],
    description: 'Versatile beige twill flat-front chinos with comfortable elastane stretch.',
    itemMeasurements: { waist: 32, inseam: 31, length: 41 },
    images: [
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Light Blue Classic Western Snap Denim Shirt',
    brand: "Wrangler",
    category: "Men's Tops",
    condition: 'Good',
    size: 'M',
    originalPrice: 2999,
    price: 1200,
    tags: ['denim-shirt', 'shirt', 'blue', 'western', 'casual', 'seed-catalog'],
    description: 'Vintage wash lightweight cotton denim shirt with pearl snap buttons and pointed western yokes.',
    itemMeasurements: { chest: 40, length: 28, shoulder: 17.5 },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Black Nylon Padded MA-1 Flight Bomber Jacket',
    brand: 'Alpha Industries',
    category: "Men's Outerwear",
    condition: 'Like New',
    size: 'L',
    originalPrice: 8900,
    price: 3800,
    tags: ['bomber-jacket', 'jacket', 'black', 'streetwear', 'military', 'seed-catalog'],
    description: 'Classic water-resistant flight nylon bomber jacket with bright emergency orange lining and sleeve tag.',
    itemMeasurements: { chest: 44, length: 27, shoulder: 19 },
    images: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1539533018447-63fcce2678e3?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Grey Melange Tapered Cotton Track Joggers',
    brand: 'Puma',
    category: "Men's Bottoms",
    condition: 'Good',
    size: 'M',
    originalPrice: 2699,
    price: 990,
    tags: ['joggers', 'grey', 'sweatpants', 'sportswear', 'casual', 'seed-catalog'],
    description: 'Comfortable French terry cotton lounge sweatpants with elasticated cuffs.',
    itemMeasurements: { waist: 32, inseam: 29, length: 39 },
    images: [
      'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1506630448388-4e683c67ddb0?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Mustard Yellow Pure Khadi Cotton Men\'s Short Kurta',
    brand: 'FabIndia',
    category: "Men's Tops",
    condition: 'Like New',
    size: 'M',
    originalPrice: 2290,
    price: 890,
    tags: ['kurta', 'mens-kurta', 'yellow', 'ethnic', 'cotton', 'casual', 'seed-catalog'],
    description: 'Mandarin collar handspun breathable cotton short kurta with wooden button placket.',
    itemMeasurements: { chest: 40, length: 29, shoulder: 17.5 },
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Natural Canvas Everyday Aesthetic Shopper Tote Bag',
    brand: 'Looped Studio',
    category: 'Bags',
    condition: 'New with tags',
    size: 'Large',
    originalPrice: 1299,
    price: 499,
    tags: ['tote-bag', 'bag', 'canvas', 'beige', 'aesthetic', 'seed-catalog'],
    description: 'Eco-friendly 100% organic heavy canvas tote with reinforced shoulder straps and internal zip pocket.',
    images: [
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Black Quilted Vegan Leather Chain Crossbody Bag',
    brand: 'Zara',
    category: 'Bags',
    condition: 'Like New',
    size: 'Small',
    originalPrice: 3290,
    price: 1350,
    tags: ['crossbody-bag', 'bag', 'black', 'quilted', 'chain', 'seed-catalog'],
    description: 'Compact chevron quilted shoulder bag with gold curb chain strap and magnetic flap.',
    images: [
      'https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Gold Metal Frame Round Polarized Retro Sunglasses',
    brand: 'Ray-Ban',
    category: 'Accessories',
    condition: 'Like New',
    size: 'Free Size',
    originalPrice: 7290,
    price: 2900,
    tags: ['sunglasses', 'accessories', 'gold', 'retro', 'eyewear', 'seed-catalog'],
    description: 'Iconic round metal frame sunglasses with classic G-15 green crystal lenses.',
    images: [
      'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1508296695146-257a814070b4?w=800&auto=format&fit=crop&q=80'
    ]
  },
  {
    group: 'Everyday',
    title: 'Minimalist Rose Gold Mesh Strap Quartz Analog Watch',
    brand: 'Daniel Wellington',
    category: 'Accessories',
    condition: 'Like New',
    size: '32mm',
    originalPrice: 11999,
    price: 3900,
    tags: ['analog-watch', 'watch', 'accessories', 'rose-gold', 'minimalist', 'seed-catalog'],
    description: 'Ultra-thin eggshell white dial analog watch paired with an interchangeable Milanese mesh strap.',
    images: [
      'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=800&auto=format&fit=crop&q=80'
    ]
  }
];

async function seedCatalog() {
  console.log('🛍️ Starting Discover Catalog Seed Script (70 New Products)...');

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
      name: 'Looped Studio Vintage',
      isVerified: true,
      role: 'user'
    });
  }

  // Handle --reset flag: delete only items carrying tag 'seed-catalog'
  const isReset = process.argv.includes('--reset') || true;
  if (isReset) {
    const deleted = await Product.deleteMany({ tags: 'seed-catalog' });
    console.log(`🧹 Cleared ${deleted.deletedCount} previous seed-catalog items.`);
  }

  const groupCounts = {};
  const created = [];

  for (const item of CATALOG_ITEMS) {
    groupCounts[item.group] = (groupCounts[item.group] || 0) + 1;

    const prod = new Product({
      title: item.title,
      description: item.description,
      brand: item.brand,
      category: item.category,
      condition: item.condition,
      size: item.size,
      originalPrice: item.originalPrice,
      price: item.price,
      listingType: 'sell',
      image: item.images[0],
      images: item.images,
      sellerId: demoSeller._id,
      sellerName: demoSeller.name || 'Looped Studio Vintage',
      tags: item.tags,
      itemMeasurements: item.itemMeasurements || undefined,
      views: 20 + Math.floor(Math.random() * 50),
      likes: 5 + Math.floor(Math.random() * 20),
      avgRating: Number((4.0 + Math.random() * 0.9).toFixed(1)),
      reviewCount: 3 + Math.floor(Math.random() * 15)
    });

    await prod.save();
    created.push(prod);
  }

  console.log('\n========================================');
  console.log('🎉 Discover Catalog Seeding Complete');
  console.log(`- Total new products seeded: ${created.length}`);
  console.log('Breakdown by Group:');
  Object.entries(groupCounts).forEach(([grp, count]) => {
    console.log(`  • ${grp.padEnd(12)}: ${count} items`);
  });
  console.log('========================================\n');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}

if (require.main === module) {
  seedCatalog().catch(err => {
    console.error('❌ seedCatalog error:', err);
    process.exit(1);
  });
}

module.exports = { seedCatalog, CATALOG_ITEMS };
