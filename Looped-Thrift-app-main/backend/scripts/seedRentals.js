/**
 * backend/scripts/seedRentals.js
 * ---------------------------------------------------------------------------
 * Seeds 30 luxury occasion-wear items across 3 categories:
 *  - WEDDING & BRIDAL (10 items) - occasion: 'wedding'
 *  - PARTY & COCKTAIL (10 items) - occasion: 'party'
 *  - FORMAL & BLACK TIE (10 items) - occasion: 'formal'
 *
 * Rules:
 *  1. Delete ONLY existing products with listingType 'rent' owned by demo.seller@looped.app
 *  2. All items pass checkRentalEligibility (retail value >= 3000, allowed categories/tags)
 *  3. Every item has local verified images in /rentals/
 * ---------------------------------------------------------------------------
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Product = require('../models/Product');
const User = require('../models/User');
const { checkRentalEligibility } = require('../config/rentalRules');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';
const DEMO_SELLER_EMAIL = 'demo.seller@looped.app';

const RENTAL_ITEMS = [
  // ==========================================
  // WEDDING & BRIDAL (10 items)
  // ==========================================
  {
    title: 'Red Bridal Lehenga with Zardozi Embroidery',
    description: 'Crimson silk bridal lehenga with royal gold zardozi and zari hand embroidery. Includes heavy flared skirt, choli blouse, and embroidered dupatta.',
    originalPrice: 180000,
    price: 180000,
    rentPricePerDay: 5000,
    securityDeposit: 45000,
    size: 'M',
    brand: 'Sabyasachi',
    condition: 'Like New',
    category: 'Wedding & Bridal Wear',
    tags: ['wedding', 'bridal', 'lehenga', 'zardozi', 'red', 'couture'],
    occasion: 'wedding',
    image: '/rentals/red-bridal-lehenga-1.jpg',
    images: ['/rentals/red-bridal-lehenga-1.jpg', '/rentals/red-bridal-lehenga-2.jpg'],
  },
  {
    title: 'Ivory-Gold Bridal Lehenga with Cape Dupatta',
    description: 'Luxury ivory and champagne gold bridal lehenga with intricate resham embroidery and a cascading sheer cape dupatta.',
    originalPrice: 150000,
    price: 150000,
    rentPricePerDay: 4500,
    securityDeposit: 40000,
    size: 'S-M',
    brand: 'Manish Malhotra',
    condition: 'Like New',
    category: 'Wedding & Bridal Wear',
    tags: ['wedding', 'bridal', 'lehenga', 'ivory', 'gold', 'cape'],
    occasion: 'wedding',
    image: '/rentals/ivory-gold-bridal-lehenga-1.jpg',
    images: ['/rentals/ivory-gold-bridal-lehenga-1.jpg', '/rentals/ivory-gold-bridal-lehenga-2.jpg'],
  },
  {
    title: 'Pastel Pink Sequin Bridal Lehenga',
    description: 'Blush pink bridal lehenga adorned with shimmering silver and iridescent sequins, sweetheart neckline choli, and scalloped dupatta.',
    originalPrice: 120000,
    price: 120000,
    rentPricePerDay: 3500,
    securityDeposit: 30000,
    size: 'M',
    brand: 'Falguni Shane Peacock',
    condition: 'Like New',
    category: 'Wedding & Bridal Wear',
    tags: ['wedding', 'bridal', 'lehenga', 'pink', 'sequin', 'pastel'],
    occasion: 'wedding',
    image: '/rentals/pastel-pink-sequin-lehenga-1.jpg',
    images: ['/rentals/pastel-pink-sequin-lehenga-1.jpg', '/rentals/pastel-pink-sequin-lehenga-2.jpg'],
  },
  {
    title: 'Kanjivaram Silk Saree Maroon and Gold',
    description: 'Pure Kanjivaram bridal silk saree in royal maroon with rich gold zari korvai borders and grand pallu. Comes with unstitched matching blouse piece.',
    originalPrice: 45000,
    price: 45000,
    rentPricePerDay: 1500,
    securityDeposit: 12000,
    size: 'Free Size',
    brand: 'Nalli Silks',
    condition: 'Like New',
    category: 'Designer Saree',
    tags: ['wedding', 'bridal', 'saree', 'kanjivaram', 'maroon', 'gold', 'silk'],
    occasion: 'wedding',
    image: '/rentals/kanjivaram-silk-saree-maroon-1.jpg',
    images: ['/rentals/kanjivaram-silk-saree-maroon-1.jpg', '/rentals/kanjivaram-silk-saree-maroon-2.jpg'],
  },
  {
    title: 'Banarasi Silk Wedding Saree Teal',
    description: 'Handwoven pure Banarasi silk saree in teal green with intricate gold and silver kadwa zari work throughout the body and pallu.',
    originalPrice: 38000,
    price: 38000,
    rentPricePerDay: 1300,
    securityDeposit: 10000,
    size: 'Free Size',
    brand: 'Raw Mango',
    condition: 'Like New',
    category: 'Designer Saree',
    tags: ['wedding', 'bridal', 'saree', 'banarasi', 'teal', 'silk', 'zari'],
    occasion: 'wedding',
    image: '/rentals/banarasi-silk-wedding-saree-teal-1.jpg',
    images: ['/rentals/banarasi-silk-wedding-saree-teal-1.jpg', '/rentals/banarasi-silk-wedding-saree-teal-2.jpg'],
  },
  {
    title: 'Kundan Polki Bridal Choker Set with Maang Tikka and Earrings',
    description: 'Heavy handcrafted Kundan Polki bridal choker necklace set in 22k gold plating with emerald drop beads, matching chandelier earrings, and maang tikka.',
    originalPrice: 85000,
    price: 85000,
    rentPricePerDay: 2500,
    securityDeposit: 25000,
    size: 'Adjustable',
    brand: 'Tanishq Heritage',
    condition: 'Like New',
    category: 'Designer Jewellery Sets',
    tags: ['wedding', 'bridal', 'jewellery', 'jewelry', 'kundan', 'polki', 'choker', 'earrings', 'maang tikka'],
    occasion: 'wedding',
    image: '/rentals/kundan-polki-bridal-set-1.jpg',
    images: ['/rentals/kundan-polki-bridal-set-1.jpg', '/rentals/kundan-polki-bridal-set-2.jpg'],
  },
  {
    title: 'Temple Gold Haram Long Necklace Set with Earrings',
    description: 'Traditional antique temple gold long haram necklace featuring Goddess Lakshmi motifs, nakshi carvings, and matching heavy jhumka earrings.',
    originalPrice: 70000,
    price: 70000,
    rentPricePerDay: 2000,
    securityDeposit: 20000,
    size: 'Adjustable',
    brand: 'Malabar Heritage',
    condition: 'Like New',
    category: 'Designer Jewellery Sets',
    tags: ['wedding', 'bridal', 'jewellery', 'jewelry', 'temple gold', 'haram', 'necklace', 'earrings'],
    occasion: 'wedding',
    image: '/rentals/temple-gold-haram-set-1.jpg',
    images: ['/rentals/temple-gold-haram-set-1.jpg', '/rentals/temple-gold-haram-set-2.jpg'],
  },
  {
    title: 'Jadau Layered Bridal Necklace Set with Earrings',
    description: 'Opulent multi-layered Rajasthani Jadau bridal necklace set with uncut polki diamonds, ruby clusters, green enamel work, and matching earrings.',
    originalPrice: 95000,
    price: 95000,
    rentPricePerDay: 2800,
    securityDeposit: 28000,
    size: 'Adjustable',
    brand: 'Amrapali Jewels',
    condition: 'Like New',
    category: 'Designer Jewellery Sets',
    tags: ['wedding', 'bridal', 'jewellery', 'jewelry', 'jadau', 'necklace', 'earrings', 'layered'],
    occasion: 'wedding',
    image: '/rentals/jadau-layered-bridal-necklace-set-1.jpg',
    images: ['/rentals/jadau-layered-bridal-necklace-set-1.jpg', '/rentals/jadau-layered-bridal-necklace-set-2.jpg'],
  },
  {
    title: "Groom's Ivory Embroidered Sherwani with Stole",
    description: 'Royal ivory raw silk groom sherwani with tone-on-tone zardozi embroidery, pearl buttons, churidar pants, and an embroidered silk stole.',
    originalPrice: 45000,
    price: 45000,
    rentPricePerDay: 1800,
    securityDeposit: 12000,
    size: '40 / L',
    brand: 'Manyavar Mohey',
    condition: 'Like New',
    category: 'Wedding & Bridal Wear',
    tags: ['wedding', 'groom', 'sherwani', 'ivory', 'embroidered', 'stole'],
    occasion: 'wedding',
    image: '/rentals/groom-ivory-embroidered-sherwani-1.jpg',
    images: ['/rentals/groom-ivory-embroidered-sherwani-1.jpg', '/rentals/groom-ivory-embroidered-sherwani-2.jpg'],
  },
  {
    title: "Groom's Royal Blue Velvet Sherwani",
    description: 'Luxurious royal blue micro-velvet groom sherwani featuring antique gold dori embroidery along the mandarin collar and cuffs, paired with silk trousers.',
    originalPrice: 65000,
    price: 65000,
    rentPricePerDay: 2200,
    securityDeposit: 15000,
    size: '42 / XL',
    brand: 'Tarun Tahiliani',
    condition: 'Like New',
    category: 'Wedding & Bridal Wear',
    tags: ['wedding', 'groom', 'sherwani', 'velvet', 'royal blue', 'couture'],
    occasion: 'wedding',
    image: '/rentals/groom-royal-blue-velvet-sherwani-1.jpg',
    images: ['/rentals/groom-royal-blue-velvet-sherwani-1.jpg', '/rentals/groom-royal-blue-velvet-sherwani-2.jpg'],
  },

  // ==========================================
  // PARTY & COCKTAIL (10 items)
  // ==========================================
  {
    title: 'Rose Gold Sequin Mini Cocktail Dress',
    description: 'Statement mini cocktail dress drenched in rose gold metallic sequins with a plunging neckline, structured shoulders, and body-sculpting silhouette.',
    originalPrice: 18000,
    price: 18000,
    rentPricePerDay: 900,
    securityDeposit: 4000,
    size: 'S',
    brand: 'House of CB',
    condition: 'Like New',
    category: 'Party/Cocktail Wear',
    tags: ['party', 'cocktail', 'dress', 'sequin', 'rose gold', 'mini'],
    occasion: 'party',
    image: '/rentals/rose-gold-sequin-mini-dress-1.jpg',
    images: ['/rentals/rose-gold-sequin-mini-dress-1.jpg', '/rentals/rose-gold-sequin-mini-dress-2.jpg'],
  },
  {
    title: 'Black Sequin Bodycon Party Dress',
    description: 'High-octane black sequin bodycon party dress with open back detail, long sleeves, and a flattering contoured fit.',
    originalPrice: 8000,
    price: 8000,
    rentPricePerDay: 500,
    securityDeposit: 2500,
    size: 'S-M',
    brand: 'Zara Evening',
    condition: 'Like New',
    category: 'Party/Cocktail Wear',
    tags: ['party', 'cocktail', 'dress', 'sequin', 'black', 'bodycon'],
    occasion: 'party',
    image: '/rentals/black-sequin-bodycon-party-dress-1.jpg',
    images: ['/rentals/black-sequin-bodycon-party-dress-1.jpg', '/rentals/black-sequin-bodycon-party-dress-2.jpg'],
  },
  {
    title: 'Emerald Satin Cocktail Gown',
    description: 'Floor-skimming emerald green heavy silk-satin cocktail gown with cowl neckline, thigh-high slit, and delicate criss-cross back straps.',
    originalPrice: 12000,
    price: 12000,
    rentPricePerDay: 700,
    securityDeposit: 3500,
    size: 'M',
    brand: 'Reformation',
    condition: 'Like New',
    category: 'Gown/Evening Wear',
    tags: ['party', 'cocktail', 'gown', 'satin', 'emerald', 'evening wear'],
    occasion: 'party',
    image: '/rentals/emerald-satin-cocktail-gown-1.jpg',
    images: ['/rentals/emerald-satin-cocktail-gown-1.jpg', '/rentals/emerald-satin-cocktail-gown-2.jpg'],
  },
  {
    title: 'Embroidered Anarkali Suit Emerald',
    description: 'Floor-length emerald green georgette Anarkali suit with heavy gota patti and thread embroidery, paired with churidar and net dupatta.',
    originalPrice: 22000,
    price: 22000,
    rentPricePerDay: 1100,
    securityDeposit: 4500,
    size: 'M',
    brand: 'Ritu Kumar',
    condition: 'Like New',
    category: 'Wedding & Bridal Wear',
    tags: ['party', 'anarkali', 'emerald', 'embroidered', 'festive', 'cocktail'],
    occasion: 'party',
    image: '/rentals/embroidered-anarkali-suit-emerald-1.jpg',
    images: ['/rentals/embroidered-anarkali-suit-emerald-1.jpg', '/rentals/embroidered-anarkali-suit-emerald-2.jpg'],
  },
  {
    title: 'Indo-Western Draped Saree Gown',
    description: 'Sculptural pre-draped saree gown in metallic blush with pleated pallu detail and structured bodice for red carpet cocktail parties.',
    originalPrice: 35000,
    price: 35000,
    rentPricePerDay: 1600,
    securityDeposit: 8000,
    size: 'M',
    brand: 'Gaurav Gupta',
    condition: 'Like New',
    category: 'Gown/Evening Wear',
    tags: ['party', 'indo-western', 'saree', 'gown', 'draped', 'cocktail'],
    occasion: 'party',
    image: '/rentals/indo-western-draped-saree-gown-1.jpg',
    images: ['/rentals/indo-western-draped-saree-gown-1.jpg', '/rentals/indo-western-draped-saree-gown-2.jpg'],
  },
  {
    title: 'Blush Sharara Set with Embroidery',
    description: 'Pastel blush silk sharara set featuring intricate floral thread work, mirror accents, peplum kurti, and scalloped organza dupatta.',
    originalPrice: 28000,
    price: 28000,
    rentPricePerDay: 1300,
    securityDeposit: 7000,
    size: 'S-M',
    brand: 'Anita Dongre',
    condition: 'Like New',
    category: 'Wedding & Bridal Wear',
    tags: ['party', 'sharara', 'blush', 'embroidered', 'festive', 'party wear'],
    occasion: 'party',
    image: '/rentals/blush-sharara-set-embroidery-1.jpg',
    images: ['/rentals/blush-sharara-set-embroidery-1.jpg', '/rentals/blush-sharara-set-embroidery-2.jpg'],
  },
  {
    title: 'Crystal-Embellished Red Party Gown',
    description: 'Fiery crimson red evening gown encrusted with Swarovski crystals across the bodice with a dramatic sweeping mermaid train.',
    originalPrice: 26000,
    price: 26000,
    rentPricePerDay: 1200,
    securityDeposit: 6500,
    size: 'M',
    brand: 'Monique Lhuillier',
    condition: 'Like New',
    category: 'Gown/Evening Wear',
    tags: ['party', 'cocktail', 'gown', 'red', 'crystal', 'embellished', 'evening wear'],
    occasion: 'party',
    image: '/rentals/crystal-embellished-red-party-gown-1.jpg',
    images: ['/rentals/crystal-embellished-red-party-gown-1.jpg', '/rentals/crystal-embellished-red-party-gown-2.jpg'],
  },
  {
    title: 'Wine Velvet Co-ord Party Set',
    description: 'Deep wine velvet party co-ord featuring a tailored cropped blazer top and matching high-waisted wide-leg trousers with satin piping.',
    originalPrice: 9000,
    price: 9000,
    rentPricePerDay: 600,
    securityDeposit: 2500,
    size: 'S',
    brand: 'ASOS Luxe',
    condition: 'Like New',
    category: 'Party/Cocktail Wear',
    tags: ['party', 'velvet', 'co-ord', 'wine', 'cocktail', 'blazer'],
    occasion: 'party',
    image: '/rentals/wine-velvet-coord-party-set-1.jpg',
    images: ['/rentals/wine-velvet-coord-party-set-1.jpg', '/rentals/wine-velvet-coord-party-set-2.jpg'],
  },
  {
    title: "Men's Velvet Bandhgala Party Jacket",
    description: 'Tailored midnight black velvet bandhgala jacket with metallic buttons and satin pocket square, perfect for evening cocktail galas.',
    originalPrice: 20000,
    price: 20000,
    rentPricePerDay: 1000,
    securityDeposit: 5000,
    size: '40 / L',
    brand: 'Raghavendra Rathore',
    condition: 'Like New',
    category: 'Blazer/Suit/Tuxedo',
    tags: ['party', 'bandhgala', 'blazer', 'suit', 'velvet', 'men'],
    occasion: 'party',
    image: '/rentals/mens-velvet-bandhgala-party-jacket-1.jpg',
    images: ['/rentals/mens-velvet-bandhgala-party-jacket-1.jpg', '/rentals/mens-velvet-bandhgala-party-jacket-2.jpg'],
  },
  {
    title: "Men's Indo-Western Kurta with Jacket",
    description: 'Contemporary asymmetric black silk kurta paired with a gold brocade Nehru jacket and tapered trousers for celebratory occasions.',
    originalPrice: 16000,
    price: 16000,
    rentPricePerDay: 800,
    securityDeposit: 4000,
    size: '40 / L',
    brand: 'FabIndia Heritage',
    condition: 'Like New',
    category: 'Wedding & Bridal Wear',
    tags: ['party', 'indo-western', 'kurta', 'jacket', 'men', 'festive'],
    occasion: 'party',
    image: '/rentals/mens-indo-western-kurta-jacket-1.jpg',
    images: ['/rentals/mens-indo-western-kurta-jacket-1.jpg', '/rentals/mens-indo-western-kurta-jacket-2.jpg'],
  },

  // ==========================================
  // FORMAL & BLACK TIE (10 items)
  // ==========================================
  {
    title: 'Black Tie Tuxedo with Satin Lapel',
    description: 'Classic black formal tuxedo crafted from pure wool with silk satin peak lapels, tailored trousers, and matching black satin bow tie.',
    originalPrice: 30000,
    price: 30000,
    rentPricePerDay: 1500,
    securityDeposit: 8000,
    size: '40R',
    brand: 'Hugo Boss',
    condition: 'Like New',
    category: 'Blazer/Suit/Tuxedo',
    tags: ['formal', 'tuxedo', 'suit', 'black tie', 'satin lapel'],
    occasion: 'formal',
    image: '/rentals/black-tie-tuxedo-satin-lapel-1.jpg',
    images: ['/rentals/black-tie-tuxedo-satin-lapel-1.jpg', '/rentals/black-tie-tuxedo-satin-lapel-2.jpg'],
  },
  {
    title: 'Navy 3-Piece Wool Suit',
    description: 'Sophisticated navy blue tailored 3-piece suit in Super 120s Italian wool. Includes 2-button blazer, 5-button waistcoat, and flat-front trousers.',
    originalPrice: 28000,
    price: 28000,
    rentPricePerDay: 1400,
    securityDeposit: 7500,
    size: '38R',
    brand: 'Raymond Luxury',
    condition: 'Like New',
    category: 'Blazer/Suit/Tuxedo',
    tags: ['formal', 'suit', 'wool', 'navy', '3-piece', 'blazer'],
    occasion: 'formal',
    image: '/rentals/navy-3-piece-wool-suit-1.jpg',
    images: ['/rentals/navy-3-piece-wool-suit-1.jpg', '/rentals/navy-3-piece-wool-suit-2.jpg'],
  },
  {
    title: 'Charcoal Slim-Fit Blazer and Trousers',
    description: 'Modern slim-fit charcoal grey formal suit set featuring a notched lapel jacket and matching tapered dress trousers.',
    originalPrice: 15000,
    price: 15000,
    rentPricePerDay: 800,
    securityDeposit: 4000,
    size: '40R',
    brand: 'Massimo Dutti',
    condition: 'Like New',
    category: 'Blazer/Suit/Tuxedo',
    tags: ['formal', 'blazer', 'suit', 'charcoal', 'trousers'],
    occasion: 'formal',
    image: '/rentals/charcoal-slim-fit-blazer-trousers-1.jpg',
    images: ['/rentals/charcoal-slim-fit-blazer-trousers-1.jpg', '/rentals/charcoal-slim-fit-blazer-trousers-2.jpg'],
  },
  {
    title: "Women's Cream Tailored Blazer Set",
    description: "Chic cream tailored formal pant suit with structured double-breasted blazer, horn buttons, and wide-leg pleated trousers.",
    originalPrice: 12000,
    price: 12000,
    rentPricePerDay: 700,
    securityDeposit: 3500,
    size: 'S',
    brand: 'Mango Premium',
    condition: 'Like New',
    category: 'Blazer/Suit/Tuxedo',
    tags: ['formal', 'blazer', 'suit', 'cream', 'women'],
    occasion: 'formal',
    image: '/rentals/womens-cream-tailored-blazer-set-1.jpg',
    images: ['/rentals/womens-cream-tailored-blazer-set-1.jpg', '/rentals/womens-cream-tailored-blazer-set-2.jpg'],
  },
  {
    title: 'Backless Satin Evening Gown Champagne',
    description: 'Draped champagne gold silk-satin formal evening gown featuring an open back, high neckline, and floor-sweeping puddle train.',
    originalPrice: 45000,
    price: 45000,
    rentPricePerDay: 3000,
    securityDeposit: 15000,
    size: 'S-M',
    brand: 'Galvan London',
    condition: 'Like New',
    category: 'Gown/Evening Wear',
    tags: ['formal', 'gown', 'evening wear', 'champagne', 'satin', 'backless'],
    occasion: 'formal',
    image: '/rentals/backless-satin-evening-gown-champagne-1.jpg',
    images: ['/rentals/backless-satin-evening-gown-champagne-1.jpg', '/rentals/backless-satin-evening-gown-champagne-2.jpg'],
  },
  {
    title: 'Floor-Length Black Velvet Evening Gown',
    description: 'Timeless black velvet formal gown with an off-the-shoulder neckline, corset boning, and elegant column silhouette for black-tie galas.',
    originalPrice: 24000,
    price: 24000,
    rentPricePerDay: 1200,
    securityDeposit: 6000,
    size: 'M',
    brand: 'Ralph Lauren Evening',
    condition: 'Like New',
    category: 'Gown/Evening Wear',
    tags: ['formal', 'gown', 'evening wear', 'black', 'velvet', 'floor-length'],
    occasion: 'formal',
    image: '/rentals/floor-length-black-velvet-evening-gown-1.jpg',
    images: ['/rentals/floor-length-black-velvet-evening-gown-1.jpg', '/rentals/floor-length-black-velvet-evening-gown-2.jpg'],
  },
  {
    title: "Women's Black Tuxedo Pantsuit",
    description: 'Sharply tailored women\'s black evening tuxedo featuring satin shawl lapels, cigarette pants with satin side stripes, and silk lining.',
    originalPrice: 20000,
    price: 20000,
    rentPricePerDay: 1000,
    securityDeposit: 5000,
    size: 'M',
    brand: 'Saint Laurent Style',
    condition: 'Like New',
    category: 'Blazer/Suit/Tuxedo',
    tags: ['formal', 'tuxedo', 'suit', 'black', 'pantsuit', 'women'],
    occasion: 'formal',
    image: '/rentals/womens-black-tuxedo-pantsuit-1.jpg',
    images: ['/rentals/womens-black-tuxedo-pantsuit-1.jpg', '/rentals/womens-black-tuxedo-pantsuit-2.jpg'],
  },
  {
    title: 'Midnight Blue Sequin Evening Gown',
    description: 'Enchanting midnight blue evening gown adorned with gradient micro-sequins, long sleeves, and a subtle side slit for formal galas.',
    originalPrice: 32000,
    price: 32000,
    rentPricePerDay: 1500,
    securityDeposit: 8000,
    size: 'M',
    brand: 'Jenny Packham',
    condition: 'Like New',
    category: 'Gown/Evening Wear',
    tags: ['formal', 'gown', 'evening wear', 'midnight blue', 'sequin'],
    occasion: 'formal',
    image: '/rentals/midnight-blue-sequin-evening-gown-1.jpg',
    images: ['/rentals/midnight-blue-sequin-evening-gown-1.jpg', '/rentals/midnight-blue-sequin-evening-gown-2.jpg'],
  },
  {
    title: "Men's Double-Breasted Grey Suit",
    description: 'Executive double-breasted formal suit in charcoal grey birdseye wool with peak lapels, horn buttons, and tailored straight-leg trousers.',
    originalPrice: 35000,
    price: 35000,
    rentPricePerDay: 1600,
    securityDeposit: 9000,
    size: '42R',
    brand: 'Canali',
    condition: 'Like New',
    category: 'Blazer/Suit/Tuxedo',
    tags: ['formal', 'suit', 'grey', 'double-breasted', 'men', 'blazer'],
    occasion: 'formal',
    image: '/rentals/mens-double-breasted-grey-suit-1.jpg',
    images: ['/rentals/mens-double-breasted-grey-suit-1.jpg', '/rentals/mens-double-breasted-grey-suit-2.jpg'],
  },
  {
    title: "Men's Maroon Velvet Dinner Jacket",
    description: 'Statement maroon velvet dinner jacket with contrasting black grosgrain shawl lapels and silk lining, designed for black tie events.',
    originalPrice: 22000,
    price: 22000,
    rentPricePerDay: 1100,
    securityDeposit: 5500,
    size: '40R',
    brand: 'Tom Ford Inspired',
    condition: 'Like New',
    category: 'Blazer/Suit/Tuxedo',
    tags: ['formal', 'blazer', 'suit', 'maroon', 'velvet', 'dinner jacket'],
    occasion: 'formal',
    image: '/rentals/mens-maroon-velvet-dinner-jacket-1.jpg',
    images: ['/rentals/mens-maroon-velvet-dinner-jacket-1.jpg', '/rentals/mens-maroon-velvet-dinner-jacket-2.jpg'],
  },
];

async function seedRentals() {
  console.log('🌱 Starting Rental Seed Script...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // 1. Find or create demo seller
  let seller = await User.findOne({ email: DEMO_SELLER_EMAIL });
  if (!seller) {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);
    seller = await User.create({
      name: 'Looped Studio Vintage',
      email: DEMO_SELLER_EMAIL,
      password: passwordHash,
      role: 'user',
      isVerified: true,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    });
    console.log(`✨ Created demo seller: ${DEMO_SELLER_EMAIL}`);
  }

  // 2. Delete ONLY existing rental products owned by demo.seller@looped.app
  const deleteResult = await Product.deleteMany({
    sellerId: seller._id,
    listingType: { $in: ['rent', 'both'] }
  });
  console.log(`🗑️ Deleted ${deleteResult.deletedCount} old rental items owned by ${DEMO_SELLER_EMAIL}`);

  // 3. Validate and insert all 30 items
  let inserted = [];
  for (const item of RENTAL_ITEMS) {
    const productDoc = {
      ...item,
      sellerId: seller._id,
      sellerName: seller.name,
      listingType: 'rent',
      rentAvailable: true,
      dryCleaningIncluded: true,
    };

    // Check eligibility rule
    const eligibility = checkRentalEligibility(productDoc);
    if (!eligibility.eligible) {
      console.error(`❌ Eligibility Failed for "${item.title}": ${eligibility.reason}`);
      process.exit(1);
    }

    const created = await Product.create(productDoc);
    inserted.push(created);
  }

  console.log(`\n🎉 Successfully seeded ${inserted.length} luxury rental items!`);

  // Breakdown
  const weddingCount = inserted.filter(p => p.occasion === 'wedding').length;
  const partyCount = inserted.filter(p => p.occasion === 'party').length;
  const formalCount = inserted.filter(p => p.occasion === 'formal').length;

  console.log('\n📊 Rental Items Count by Occasion:');
  console.log(`  💍 Wedding & Bridal:   ${weddingCount} items`);
  console.log(`  🍸 Party & Cocktail:  ${partyCount} items`);
  console.log(`  👔 Formal & Black Tie: ${formalCount} items`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ✨ Total Rentals:     ${inserted.length} items\n`);

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB. seedRentals complete!');
}

if (require.main === module) {
  seedRentals().catch(err => {
    console.error('❌ seedRentals error:', err);
    process.exit(1);
  });
}

module.exports = seedRentals;
module.exports.RENTAL_ITEMS = RENTAL_ITEMS;
