/**
 * generateProducts.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Generates a realistic, internally-consistent synthetic thrift-fashion dataset
 * for the Looped Thrift App. Output: data/looped-products.json
 *
 * Usage:
 *   node scripts/generateProducts.js              → 1000 products
 *   node scripts/generateProducts.js --count 2000 → 2000 products
 *   node scripts/generateProducts.js --count 50   → quick sample
 *
 * DATA IS SYNTHETIC / DEMO ONLY — not real scraped inventory.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs   = require('fs');
const path = require('path');

// ── CLI args ─────────────────────────────────────────────────────────────────
const args  = process.argv.slice(2);
const cIdx  = args.indexOf('--count');
const COUNT = cIdx !== -1 ? Math.max(1, parseInt(args[cIdx + 1], 10) || 1000) : 1000;
const OUTPUT_PATH = path.resolve(__dirname, '../data/looped-products.json');

// ── Seeded random (deterministic per run for reproducibility) ─────────────────
let seed = 42;
function rand() {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0xffffffff;
}
function pick(arr)            { return arr[Math.floor(rand() * arr.length)]; }
function pickN(arr, n)        { const s=[...arr]; for(let i=s.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[s[i],s[j]]=[s[j],s[i]];} return s.slice(0,n); }
function randInt(min, max)    { return min + Math.floor(rand() * (max - min + 1)); }
function randPrice(min, max)  {
  const nicePrices = [199,249,299,349,399,449,499,549,599,649,699,749,799,849,899,949,999,
                      1049,1099,1149,1199,1249,1299,1349,1399,1449,1499,1599,1699,1799,1899,
                      1999,2099,2199,2299,2399,2499,2999,3499,3999,4499];
  const valid = nicePrices.filter(p => p >= min && p <= max);
  return valid.length ? pick(valid) : min + Math.round((rand()*(max-min))/50)*50;
}

// ── Schema-valid condition enum ────────────────────────────────────────────────
const CONDITIONS = ['New with tags', 'Like New', 'Good', 'Fair', 'Well Loved'];
// Condition → price multiplier (relative to "Like New" base)
const CONDITION_MULTIPLIER = {
  'New with tags': 1.15,
  'Like New':      1.0,
  'Good':          0.82,
  'Fair':          0.65,
  'Well Loved':    0.50,
};
// Condition → originalPrice multiplier
const ORIGINAL_PRICE_FACTOR = {
  'New with tags': 2.0,
  'Like New':      2.5,
  'Good':          3.2,
  'Fair':          3.8,
  'Well Loved':    4.5,
};

// ── Category definitions (matching real schema values) ─────────────────────────
const CATEGORIES = {
  "Women's Tops": {
    subtypes: ['T-shirt', 'Crop Top', 'Tank Top', 'Blouse', 'Tube Top'],
    priceBase: [200, 750],
    sizes: ['XS','S','M','L','XL','XXL'],
    genderTag: 'women',
  },
  "Men's Tops": {
    subtypes: ['T-shirt', 'Shirt', 'Polo', 'Tank Top'],
    priceBase: [200, 750],
    sizes: ['XS','S','M','L','XL','XXL'],
    genderTag: 'men',
  },
  "Women's Outerwear": {
    subtypes: ['Cardigan', 'Hoodie', 'Sweater', 'Jacket', 'Denim Jacket', 'Bomber Jacket', 'Blazer'],
    priceBase: [500, 1800],
    sizes: ['XS','S','M','L','XL','XXL'],
    genderTag: 'women',
  },
  "Men's Outerwear": {
    subtypes: ['Hoodie', 'Sweater', 'Jacket', 'Denim Jacket', 'Bomber Jacket', 'Blazer'],
    priceBase: [500, 1800],
    sizes: ['XS','S','M','L','XL','XXL'],
    genderTag: 'men',
  },
  "Women's Bottoms": {
    subtypes: ['Jeans', 'Straight Jeans', 'Mom Jeans', 'Wide Leg Jeans', 'Trousers', 'Cargo Pants', 'Shorts', 'Skirt', 'Mini Skirt', 'Midi Skirt'],
    priceBase: [400, 1500],
    sizes: ['XS','S','M','L','XL','XXL'],
    genderTag: 'women',
  },
  "Men's Bottoms": {
    subtypes: ['Jeans', 'Straight Jeans', 'Cargo Pants', 'Trousers', 'Shorts'],
    priceBase: [400, 1500],
    sizes: ['XS','S','M','L','XL','XXL'],
    genderTag: 'men',
  },
  "Women's Sets": {
    subtypes: ['Coord Set', 'Track Set', 'Linen Set', 'Printed Set', 'Lounge Set'],
    priceBase: [600, 1800],
    sizes: ['XS','S','M','L','XL'],
    genderTag: 'women',
  },
  "Women's Traditional": {
    subtypes: ['Anarkali', 'Salwar Suit', 'Kurti', 'Lehenga Set', 'Sharara Set', 'Saree'],
    priceBase: [800, 4500],
    sizes: ['XS','S','M','L','Free'],
    genderTag: 'women',
  },
  "Footwear": {
    subtypes: ['Sneakers', 'Flats', 'Boots', 'Heels', 'Sandals', 'Platform Shoes', 'Loafers'],
    priceBase: [500, 2000],
    sizes: ['36','37','38','39','40','41','42','43','44'],
    genderTag: null,
  },
  "Accessories": {
    subtypes: ['Belt', 'Cap', 'Scarf', 'Sunglasses', 'Hair Clip', 'Bandana'],
    priceBase: [150, 800],
    sizes: ['One Size'],
    genderTag: null,
  },
  "Bags": {
    subtypes: ['Shoulder Bag', 'Tote Bag', 'Handbag', 'Crossbody Bag', 'Backpack', 'Clutch'],
    priceBase: [300, 1500],
    sizes: ['One Size'],
    genderTag: null,
  },
  "Jewelry": {
    subtypes: ['Necklace', 'Earrings', 'Bracelet', 'Ring Set', 'Anklet'],
    priceBase: [150, 1200],
    sizes: ['One Size'],
    genderTag: null,
  },
};

// ── Color families (stored in tags + title) ────────────────────────────────────
const COLOR_FAMILIES = {
  black:   { shades: ['black', 'jet black', 'charcoal'], primary: 'black' },
  white:   { shades: ['white', 'off-white', 'cream', 'ivory'], primary: 'white' },
  pink:    { shades: ['pink', 'baby pink', 'hot pink', 'rose pink', 'dusty pink'], primary: 'pink' },
  red:     { shades: ['red', 'maroon', 'burgundy', 'crimson'], primary: 'red' },
  blue:    { shades: ['blue', 'navy', 'sky blue', 'cobalt', 'denim blue'], primary: 'blue' },
  green:   { shades: ['green', 'olive', 'sage', 'forest green', 'mint'], primary: 'green' },
  yellow:  { shades: ['yellow', 'mustard', 'lemon'], primary: 'yellow' },
  orange:  { shades: ['orange', 'rust', 'terracotta'], primary: 'orange' },
  brown:   { shades: ['brown', 'tan', 'camel', 'mocha'], primary: 'brown' },
  beige:   { shades: ['beige', 'nude', 'sand'], primary: 'beige' },
  grey:    { shades: ['grey', 'silver', 'ash grey'], primary: 'grey' },
  purple:  { shades: ['purple', 'lavender', 'lilac', 'violet', 'plum'], primary: 'purple' },
  multicolor: { shades: ['multicolor', 'colorful', 'patchwork', 'printed', 'tie-dye'], primary: 'multicolor' },
};

const ALL_COLORS = Object.values(COLOR_FAMILIES).flatMap(f => f.shades);

// ── Style → compatible subtypes ──────────────────────────────────────────────
const STYLE_RULES = {
  'casual':         { cats: ["Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Women's Sets","Footwear","Accessories","Bags"], subtypes: ['T-shirt','Crop Top','Tank Top','Jeans','Shorts','Sneakers','Tote Bag','Coord Set'] },
  'streetwear':     { cats: ["Women's Tops","Men's Tops","Women's Outerwear","Men's Outerwear","Women's Bottoms","Men's Bottoms","Footwear","Bags","Accessories"], subtypes: ['Hoodie','Cargo Pants','Jeans','Bomber Jacket','T-shirt','Sneakers','Cap','Backpack','Straight Jeans','Shorts'] },
  'y2k':            { cats: ["Women's Tops","Women's Bottoms","Women's Outerwear","Women's Sets","Footwear","Accessories"], subtypes: ['Crop Top','Mini Skirt','Wide Leg Jeans','Tube Top','Crop Top','Platform Shoes','Belt','Sunglasses','Cargo Pants','Mom Jeans'] },
  'classy':         { cats: ["Women's Tops","Men's Tops","Women's Outerwear","Men's Outerwear","Women's Bottoms","Men's Bottoms","Women's Sets","Footwear"], subtypes: ['Blazer','Shirt','Blouse','Trousers','Heels','Loafers','Straight Jeans'] },
  'formal':         { cats: ["Women's Outerwear","Men's Outerwear","Women's Bottoms","Men's Bottoms","Footwear","Men's Tops","Women's Tops"], subtypes: ['Blazer','Trousers','Shirt','Heels','Loafers','Blouse'] },
  'vintage':        { cats: ["Women's Tops","Men's Tops","Women's Outerwear","Men's Outerwear","Women's Bottoms","Accessories","Bags","Footwear"], subtypes: ['Jacket','Denim Jacket','Jeans','Boots','Shoulder Bag','T-shirt','Loafers'] },
  'minimal':        { cats: ["Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Women's Sets","Footwear","Bags"], subtypes: ['T-shirt','Tank Top','Trousers','Jeans','Sneakers','Tote Bag','Coord Set','Straight Jeans'] },
  'boho':           { cats: ["Women's Tops","Women's Bottoms","Women's Outerwear","Accessories","Footwear","Bags"], subtypes: ['Blouse','Midi Skirt','Cardigan','Sandals','Scarf','Tote Bag','Tank Top'] },
  'sporty':         { cats: ["Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Women's Sets","Footwear","Accessories"], subtypes: ['T-shirt','Shorts','Track Set','Sneakers','Cap','Tank Top'] },
  'preppy':         { cats: ["Women's Tops","Men's Tops","Women's Outerwear","Men's Outerwear","Women's Bottoms","Men's Bottoms","Footwear"], subtypes: ['Polo','Cardigan','Straight Jeans','Trousers','Blazer','Loafers'] },
  'party':          { cats: ["Women's Tops","Women's Outerwear","Women's Sets","Women's Bottoms","Footwear","Jewelry","Bags","Accessories"], subtypes: ['Tube Top','Crop Top','Coord Set','Mini Skirt','Heels','Clutch','Necklace'] },
  'oversized':      { cats: ["Women's Tops","Men's Tops","Women's Outerwear","Men's Outerwear","Women's Bottoms","Men's Bottoms"], subtypes: ['Hoodie','T-shirt','Sweater','Cardigan','Jacket','Shirt','Cargo Pants','Jeans'] },
  'chic':           { cats: ["Women's Tops","Women's Outerwear","Women's Bottoms","Women's Sets","Footwear","Bags","Jewelry"], subtypes: ['Blouse','Blazer','Trousers','Midi Skirt','Heels','Crossbody Bag','Earrings'] },
  'korean-inspired':{ cats: ["Women's Tops","Women's Outerwear","Women's Bottoms","Women's Sets","Footwear","Accessories"], subtypes: ['Cardigan','Crop Top','Mom Jeans','Coord Set','Sneakers','Hair Clip','T-shirt','Midi Skirt'] },
  'retro':          { cats: ["Women's Tops","Men's Tops","Women's Bottoms","Women's Outerwear","Footwear","Accessories","Bags"], subtypes: ['T-shirt','Polo','Jeans','Bomber Jacket','Sneakers','Belt','Shoulder Bag'] },
  'indie':          { cats: ["Women's Tops","Women's Bottoms","Women's Outerwear","Accessories","Footwear","Bags"], subtypes: ['Cardigan','Blouse','Midi Skirt','Boots','Scarf','Tote Bag','T-shirt'] },
};

// ── Occasion → compatible categories ──────────────────────────────────────────
const OCCASION_COMPAT = {
  'college':    ["Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Women's Outerwear","Men's Outerwear","Footwear","Bags","Accessories","Women's Sets"],
  'casual':     ["Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Women's Sets","Footwear","Accessories","Bags"],
  'farewell':   ["Women's Outerwear","Women's Sets","Women's Tops","Women's Bottoms","Footwear","Jewelry","Bags"],
  'party':      ["Women's Tops","Women's Sets","Women's Outerwear","Women's Bottoms","Footwear","Jewelry","Bags","Accessories"],
  'date':       ["Women's Tops","Men's Tops","Women's Outerwear","Women's Bottoms","Men's Bottoms","Footwear","Bags","Jewelry"],
  'office':     ["Women's Outerwear","Men's Outerwear","Women's Bottoms","Men's Bottoms","Men's Tops","Women's Tops","Footwear"],
  'wedding':    ["Women's Traditional","Jewelry","Bags","Footwear"],
  'vacation':   ["Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Footwear","Bags","Accessories","Women's Sets"],
  'festival':   ["Women's Traditional","Women's Tops","Accessories","Jewelry","Bags","Footwear"],
  'summer':     ["Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Footwear","Accessories","Bags","Women's Sets"],
  'winter':     ["Women's Outerwear","Men's Outerwear","Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Accessories"],
  'brunch':     ["Women's Tops","Women's Bottoms","Women's Sets","Footwear","Bags","Accessories"],
  'travel':     ["Women's Tops","Men's Tops","Women's Bottoms","Men's Bottoms","Women's Sets","Footwear","Bags","Accessories"],
  'night out':  ["Women's Tops","Women's Sets","Women's Outerwear","Women's Bottoms","Footwear","Jewelry","Bags"],
};

// ── Fit → compatible subtypes ──────────────────────────────────────────────
const FIT_SUBTYPE_COMPAT = {
  'Oversized':  ['Hoodie','T-shirt','Sweater','Cardigan','Jacket','Shirt','Cargo Pants','Jeans','Blazer'],
  'Cropped':    ['Crop Top','T-shirt','Blazer','Cardigan','Jacket','Tank Top'],
  'Fitted':     ['Bodycon','Tube Top','T-shirt','Blouse','Jeans','Trousers','Blazer'],
  'Wide Leg':   ['Wide Leg Jeans','Trousers','Cargo Pants','Jeans','Midi Skirt'],
  'Slim':       ['Jeans','Straight Jeans','Trousers','Shirt'],
  'Straight':   ['Jeans','Straight Jeans','Trousers','Cargo Pants'],
  'Relaxed':    ['Jeans','Mom Jeans','Trousers','T-shirt','Hoodie','Shorts'],
  'Regular':    ['T-shirt','Jeans','Shorts','Trousers','Shirt','Blouse','Cardigan'],
  'Baggy':      ['Jeans','Cargo Pants','Shorts','T-shirt','Hoodie'],
};

// ── Materials → subtype compatibility ──────────────────────────────────────────
const SUBTYPE_MATERIAL = {
  'T-shirt':        ['Cotton','Jersey','Organic Cotton','Rayon'],
  'Crop Top':       ['Cotton','Rayon','Polyester','Jersey','Ribbed Knit'],
  'Tank Top':       ['Cotton','Rayon','Jersey','Polyester'],
  'Blouse':         ['Satin','Chiffon','Rayon','Linen','Cotton'],
  'Tube Top':       ['Ribbed Knit','Jersey','Cotton','Satin'],
  'Polo':           ['Cotton','Pique'],
  'Shirt':          ['Cotton','Linen','Oxford Cotton','Flannel','Satin'],
  'Cardigan':       ['Knit','Wool Blend','Mohair','Cotton Knit','Acrylic'],
  'Hoodie':         ['Fleece','Cotton Fleece','Polyester Blend'],
  'Sweater':        ['Wool Blend','Knit','Cashmere Blend','Acrylic'],
  'Jacket':         ['Denim','Canvas','Corduroy','Polyester','Nylon'],
  'Denim Jacket':   ['Denim'],
  'Bomber Jacket':  ['Satin','Nylon','Polyester','Satin Polyester'],
  'Blazer':         ['Wool Blend','Polyester','Linen','Cotton Blend'],
  'Jeans':          ['Denim','Stretch Denim'],
  'Straight Jeans': ['Denim','Stretch Denim'],
  'Mom Jeans':      ['Denim','Stretch Denim'],
  'Wide Leg Jeans': ['Denim','Stretch Denim'],
  'Trousers':       ['Polyester','Linen','Cotton Blend','Crepe'],
  'Cargo Pants':    ['Cotton','Nylon','Cotton Twill'],
  'Shorts':         ['Denim','Cotton','Linen','Polyester'],
  'Skirt':          ['Cotton','Polyester','Denim','Satin'],
  'Mini Skirt':     ['Denim','Cotton','Satin','Vinyl','Corduroy'],
  'Midi Skirt':     ['Cotton','Polyester','Linen','Satin','Chiffon'],
  'Coord Set':      ['Cotton','Polyester','Rayon','Linen'],
  'Track Set':      ['Polyester','Cotton Fleece'],
  'Linen Set':      ['Linen'],
  'Printed Set':    ['Rayon','Polyester'],
  'Lounge Set':     ['Cotton','Fleece','Jersey'],
  'Anarkali':       ['Georgette','Rayon','Chiffon'],
  'Salwar Suit':    ['Cotton','Silk','Georgette'],
  'Kurti':          ['Cotton','Rayon','Silk'],
  'Lehenga Set':    ['Silk','Georgette','Net'],
  'Sharara Set':    ['Georgette','Silk','Chiffon'],
  'Saree':          ['Silk','Cotton Silk','Georgette','Net'],
  'Sneakers':       ['Canvas','Leather','Mesh'],
  'Flats':          ['Leather','Synthetic'],
  'Boots':          ['Leather','Suede','Faux Leather'],
  'Heels':          ['Leather','Satin','Synthetic'],
  'Sandals':        ['Leather','Synthetic'],
  'Platform Shoes': ['Synthetic','Leather','Faux Leather'],
  'Loafers':        ['Leather','Suede'],
  'Belt':           ['Leather','Faux Leather'],
  'Cap':            ['Cotton','Polyester'],
  'Scarf':          ['Wool','Cotton','Acrylic'],
  'Sunglasses':     ['Acetate','Metal','Plastic'],
  'Hair Clip':      ['Acetate','Metal'],
  'Bandana':        ['Cotton'],
  'Shoulder Bag':   ['Leather','Faux Leather','Canvas'],
  'Tote Bag':       ['Canvas','Cotton','Leather'],
  'Handbag':        ['Leather','Faux Leather','Satin'],
  'Crossbody Bag':  ['Leather','Faux Leather','Nylon'],
  'Backpack':       ['Canvas','Nylon','Polyester'],
  'Clutch':         ['Satin','Leather','Embroidered'],
  'Necklace':       ['Gold-toned','Silver-toned','Oxidized'],
  'Earrings':       ['Gold-toned','Silver-toned','Oxidized','Beaded'],
  'Bracelet':       ['Gold-toned','Silver-toned','Beaded'],
  'Ring Set':       ['Gold-toned','Silver-toned'],
  'Anklet':         ['Gold-toned','Silver-toned','Beaded'],
};

// ── Brands ────────────────────────────────────────────────────────────────────
const BRANDS_BY_CAT = {
  "Women's Tops":       ['H&M','Zara','Forever 21','Mango','Only','Vero Moda','Urbanic','Westside','Max'],
  "Men's Tops":         ['H&M','Uniqlo','Roadster','Allen Solly','Mango','Zara','Max','Only'],
  "Women's Outerwear":  ['Zara','Mango','H&M','Forever 21','Vero Moda','Only','Urbanic'],
  "Men's Outerwear":    ['H&M','Uniqlo','Roadster','Mango','Allen Solly','Zara'],
  "Women's Bottoms":    ['Zara','Levi\'s','H&M','Mango','Forever 21','Only','Urbanic'],
  "Men's Bottoms":      ['Levi\'s','H&M','Roadster','Mango','Uniqlo','Zara'],
  "Women's Sets":       ['Zara','H&M','Urbanic','Mango','Forever 21','Westside'],
  "Women's Traditional":['FabIndia','Westside','Max','Biba','Libas'],
  "Footwear":           ['Puma','Adidas','Nike','H&M','Zara','Mango'],
  "Accessories":        ['H&M','Zara','Forever 21','Mango'],
  "Bags":               ['H&M','Zara','Mango','Forever 21','Westside'],
  "Jewelry":            ['H&M','Zara','Forever 21','Westside','Aurelia'],
};

// ── Seller names ──────────────────────────────────────────────────────────────
const SELLER_NAMES = [
  'Priya M.','Ananya S.','Tara K.','Sneha P.','Kavya L.','Rohan D.','Neil J.',
  'Zoe F.','Lisa R.','Mia W.','Hana N.','Luna S.','Sara K.','Grace O.',
  'Emma L.','Yuki A.','Arjun B.','Jake M.','Tom F.','Sam H.','Diya K.',
  'Ritu V.','Meera G.','Anita R.','Sunita B.','Chiaki S.','Claire B.',
  'Lucas M.','Kenji T.','Haruto Y.','Nisha R.','Pooja V.','Aisha K.',
  'Divya T.','Rhea N.','Tanvi S.','Simran J.','Monika P.','Kritika A.',
  'Aditi B.','Ishaan M.','Karan V.','Vivek T.','Siddharth R.','Rahul G.',
];

// ── Guaranteed coverage map (AI Style Me test queries) ────────────────────────
// These are injected at the start before random generation to guarantee coverage.
const GUARANTEED_PRODUCTS = [
  // pink tops / cardigans
  ...Array.from({length:5}, (_,i) => ({ _cat:"Women's Tops",    _sub:'Crop Top',     _color:'pink',       _shade:'pink',       _style:'y2k',       _occ:'college',  _fit:'Cropped',  _brand:'H&M',      _cond:'Like New', _extra: i })),
  ...Array.from({length:4}, (_,i) => ({ _cat:"Women's Tops",    _sub:'T-shirt',      _color:'pink',       _shade:'baby pink',  _style:'casual',    _occ:'casual',   _fit:'Regular',  _brand:'Zara',     _cond:'Like New', _extra: i })),
  ...Array.from({length:4}, (_,i) => ({ _cat:"Women's Outerwear",_sub:'Cardigan',     _color:'pink',       _shade:'pink',       _style:'korean-inspired',_occ:'college',_fit:'Regular',_brand:'Mango',  _cond:'Good',     _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Outerwear",_sub:'Cardigan',     _color:'pink',       _shade:'dusty pink', _style:'casual',    _occ:'brunch',   _fit:'Cropped',  _brand:'H&M',      _cond:'Like New', _extra: i })),
  // black hoodies / tops
  ...Array.from({length:5}, (_,i) => ({ _cat:"Women's Outerwear",_sub:'Hoodie',       _color:'black',      _shade:'black',      _style:'streetwear',_occ:'college',  _fit:'Oversized',_brand:'H&M',      _cond:'Good',     _extra: i })),
  ...Array.from({length:4}, (_,i) => ({ _cat:"Men's Outerwear",  _sub:'Hoodie',       _color:'black',      _shade:'black',      _style:'streetwear',_occ:'college',  _fit:'Oversized',_brand:'Zara',     _cond:'Good',     _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Men's Tops",       _sub:'T-shirt',      _color:'black',      _shade:'black',      _style:'casual',    _occ:'casual',   _fit:'Regular',  _brand:'Uniqlo',   _cond:'Like New', _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Tops",     _sub:'T-shirt',      _color:'black',      _shade:'black',      _style:'minimal',   _occ:'casual',   _fit:'Regular',  _brand:'H&M',      _cond:'Like New', _extra: i })),
  // white crop tops / tops
  ...Array.from({length:5}, (_,i) => ({ _cat:"Women's Tops",    _sub:'Crop Top',     _color:'white',      _shade:'white',      _style:'casual',    _occ:'casual',   _fit:'Cropped',  _brand:'Zara',     _cond:'Like New', _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Tops",    _sub:'T-shirt',      _color:'white',      _shade:'white',      _style:'minimal',   _occ:'casual',   _fit:'Regular',  _brand:'Uniqlo',   _cond:'Like New', _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Tops",    _sub:'Blouse',       _color:'white',      _shade:'off-white',  _style:'classy',    _occ:'office',   _fit:'Fitted',   _brand:'Mango',    _cond:'Good',     _extra: i })),
  // blue jeans
  ...Array.from({length:6}, (_,i) => ({ _cat:"Women's Bottoms", _sub:'Jeans',        _color:'blue',       _shade:'blue',       _style:'casual',    _occ:'casual',   _fit:'Straight', _brand:'Levi\'s',  _cond:'Good',     _extra: i })),
  ...Array.from({length:4}, (_,i) => ({ _cat:"Women's Bottoms", _sub:'Wide Leg Jeans',_color:'blue',      _shade:'denim blue', _style:'streetwear',_occ:'college',  _fit:'Wide Leg', _brand:'Zara',     _cond:'Like New', _extra: i })),
  ...Array.from({length:4}, (_,i) => ({ _cat:"Men's Bottoms",   _sub:'Straight Jeans',_color:'blue',      _shade:'navy',       _style:'casual',    _occ:'casual',   _fit:'Straight', _brand:'Levi\'s',  _cond:'Good',     _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Bottoms", _sub:'Mom Jeans',    _color:'blue',       _shade:'sky blue',   _style:'vintage',   _occ:'college',  _fit:'Relaxed',  _brand:'H&M',      _cond:'Good',     _extra: i })),
  // red dresses
  ...Array.from({length:4}, (_,i) => ({ _cat:"Women's Sets",    _sub:'Coord Set',    _color:'red',        _shade:'red',        _style:'party',     _occ:'party',    _fit:'Fitted',   _brand:'Forever 21',_cond:'Like New', _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Tops",    _sub:'Blouse',       _color:'red',        _shade:'red',        _style:'classy',    _occ:'date',     _fit:'Fitted',   _brand:'Mango',    _cond:'Like New', _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Bottoms", _sub:'Midi Skirt',   _color:'red',        _shade:'maroon',     _style:'chic',      _occ:'date',     _fit:'Fitted',   _brand:'Zara',     _cond:'Good',     _extra: i })),
  // Y2K pink
  ...Array.from({length:4}, (_,i) => ({ _cat:"Women's Tops",    _sub:'Crop Top',     _color:'pink',       _shade:'hot pink',   _style:'y2k',       _occ:'college',  _fit:'Cropped',  _brand:'Forever 21',_cond:'Like New', _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Bottoms", _sub:'Mini Skirt',   _color:'pink',       _shade:'baby pink',  _style:'y2k',       _occ:'party',    _fit:'Fitted',   _brand:'Urbanic',  _cond:'Good',     _extra: i })),
  // classy black
  ...Array.from({length:4}, (_,i) => ({ _cat:"Women's Outerwear",_sub:'Blazer',      _color:'black',      _shade:'black',      _style:'classy',    _occ:'farewell', _fit:'Fitted',   _brand:'Zara',     _cond:'Like New', _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Bottoms", _sub:'Trousers',     _color:'black',      _shade:'black',      _style:'formal',    _occ:'office',   _fit:'Straight', _brand:'Mango',    _cond:'Like New', _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Women's Sets",    _sub:'Coord Set',    _color:'black',      _shade:'black',      _style:'classy',    _occ:'farewell', _fit:'Fitted',   _brand:'Zara',     _cond:'Like New', _extra: i })),
  // oversized streetwear
  ...Array.from({length:5}, (_,i) => ({ _cat:"Women's Outerwear",_sub:'Hoodie',      _color:'grey',       _shade:'grey',       _style:'oversized', _occ:'college',  _fit:'Oversized',_brand:'H&M',      _cond:'Good',     _extra: i })),
  ...Array.from({length:4}, (_,i) => ({ _cat:"Men's Outerwear",  _sub:'Hoodie',      _color:'grey',       _shade:'ash grey',   _style:'streetwear',_occ:'casual',   _fit:'Oversized',_brand:'H&M',      _cond:'Good',     _extra: i })),
  ...Array.from({length:4}, (_,i) => ({ _cat:"Women's Bottoms",  _sub:'Cargo Pants', _color:'brown',      _shade:'tan',        _style:'streetwear',_occ:'college',  _fit:'Baggy',    _brand:'Zara',     _cond:'Good',     _extra: i })),
  ...Array.from({length:3}, (_,i) => ({ _cat:"Men's Bottoms",    _sub:'Cargo Pants', _color:'black',      _shade:'black',      _style:'streetwear',_occ:'casual',   _fit:'Baggy',    _brand:'Roadster', _cond:'Good',     _extra: i })),
];

// ── Image builder: Real Fashion Photography per Category & Color ───────────────
const REAL_FASHION_PHOTO_POOLS = {
  "Tops": {
    black:  ['photo-1583743814966-8936f5b7be1a', 'photo-1618354691373-d851c5c3a990', 'photo-1503342217505-b0a15ec3261c', 'photo-1521572163474-6864f9cf17ab'],
    white:  ['photo-1521572163474-6864f9cf17ab', 'photo-1529374255404-311a2a4f3fd4', 'photo-1581655353564-df123a1eb820', 'photo-1586363104862-3a5e2ab60d99'],
    pink:   ['photo-1525507119028-ed4c629a60a3', 'photo-1564584217132-2271feaeb3c5', 'photo-1515886657613-9f3515b0c78f', 'photo-1558171813-4c088753af8f'],
    blue:   ['photo-1503342217505-b0a15ec3261c', 'photo-1503342394128-c104d54dba01'],
    red:    ['photo-1562157873-818bc0726f68'],
    green:  ['photo-1596755094514-f87e34085b2c'],
    yellow: ['photo-1564257631407-4deb1f99d992'],
    purple: ['photo-1518622358385-8ea7d0794bf6'],
    grey:   ['photo-1576566588028-4147f3842f27'],
    brown:  ['photo-1598554747436-c9293d6a588f'],
    beige:  ['photo-1598554747436-c9293d6a588f'],
  },
  "Outerwear": {
    black:  ['photo-1556821840-3a63f15732ce', 'photo-1620799139507-2a76f79a2f4d', 'photo-1594938298603-c8148c4b4ae4', 'photo-1591047139829-d91aecb6caea'],
    pink:   ['photo-1434389677669-e08b4cac3105', 'photo-1578768079052-aa76e52ff62e'],
    blue:   ['photo-1601379327928-bedfaf9da2d0', 'photo-1551537482-f2075a1d41f2'],
    grey:   ['photo-1509942774463-acf339cf87d5', 'photo-1611312449412-6cefac5dc3e4'],
    beige:  ['photo-1548624313-0396a6b4b47b', 'photo-1521223890158-f9f7c3d5d504', 'photo-1543087903-1ac2364d7188'],
    brown:  ['photo-1521223890158-f9f7c3d5d504', 'photo-1543087903-1ac2364d7188'],
    white:  ['photo-1551488831-00ddcb6c6bd3'],
  },
  "Bottoms": {
    blue:   ['photo-1541099649105-f69ad21f3246', 'photo-1542272604-787c3835535d', 'photo-1582552938357-32b906df40cb', 'photo-1475178626620-a4d074967571'],
    black:  ['photo-1604176354204-9268737828e4', 'photo-1583496661160-fb5886a773af'],
    brown:  ['photo-1509551388413-e18d0ac5d495', 'photo-1506629082955-511b1aa562c8'],
    beige:  ['photo-1506629082955-511b1aa562c8', 'photo-1473966968600-fa801b869a1a'],
    white:  ['photo-1473966968600-fa801b869a1a'],
  },
  "Sets": {
    red:    ['photo-1610030469983-98e550d6193c', 'photo-1588965218882-8528fdb1c2a3'],
    pink:   ['photo-1519985176271-adb1088fa94c', 'photo-1469334031218-e382a71b716b'],
    black:  ['photo-1509551388413-e18d0ac5d495', 'photo-1515886657613-9f3515b0c78f'],
    pastel: ['photo-1519985176271-adb1088fa94c'],
  },
  "Traditional": {
    pink:   ['photo-1610030469983-98e550d6193c', 'photo-1583391733956-6c78276477e2'],
    red:    ['photo-1583391733956-6c78276477e2', 'photo-1620919942697-c88c5aebd43a', 'photo-1617627143233-69db79f9697f'],
    yellow: ['photo-1588965218882-8528fdb1c2a3'],
    orange: ['photo-1620919942697-c88c5aebd43a'],
  },
  "Footwear": {
    white:  ['photo-1549298916-b41d501d3772', 'photo-1595950653106-6c9ebd614d3a', 'photo-1460353581641-37baddab0fa2'],
    black:  ['photo-1542291026-7eec264c27ff', 'photo-1600269452121-4f2416e55c28', 'photo-1608256246200-53e635b5b65f'],
    brown:  ['photo-1614252369475-531eba835eb1', 'photo-1605733160314-4fc7dac4bb16'],
    red:    ['photo-1543163521-1bf539c55dd2'],
  },
  "Bags": {
    brown:  ['photo-1548036328-c9fa89d128fa', 'photo-1591561954557-26941169b49e'],
    black:  ['photo-1584917865442-de89df76afd3', 'photo-1590874103328-eac38ef100ab'],
    red:    ['photo-1566150905458-1bf1fc113f0d'],
    pink:   ['photo-1590874103328-eac38ef100ab'],
  },
  "Accessories": {
    gold:   ['photo-1599643478518-a784e5dc4c8f', 'photo-1630019852942-f89202989a59'],
    silver: ['photo-1535632066927-ab7c9ab60908', 'photo-1635767798638-3665c302e27c', 'photo-1611591437281-460bfbe1220a'],
    brown:  ['photo-1520903920243-00d872a2d1c9', 'photo-1553062407-98eeb64c6a62'],
    black:  ['photo-1572635196237-14b3f281503f', 'photo-1588850561407-ed78c334e67a', 'photo-1556306535-0f09a537f0a3'],
  }
};

function getCategoryGroup(category) {
  if (category.includes('Tops')) return 'Tops';
  if (category.includes('Outerwear')) return 'Outerwear';
  if (category.includes('Bottoms')) return 'Bottoms';
  if (category.includes('Sets')) return 'Sets';
  if (category.includes('Traditional')) return 'Traditional';
  if (category.includes('Footwear')) return 'Footwear';
  if (category.includes('Bags')) return 'Bags';
  return 'Accessories';
}

let imageCounter = 0;
function makeImage(shade, subtype, category) {
  imageCounter++;
  const shadeClean = (shade || '').toLowerCase().trim();

  // Find matching primary color family
  let colorFamily = 'grey';
  for (const [fam, data] of Object.entries(COLOR_FAMILIES)) {
    if (data.shades.includes(shadeClean) || fam === shadeClean) {
      colorFamily = fam;
      break;
    }
  }

  const group = getCategoryGroup(category);
  const pool = REAL_FASHION_PHOTO_POOLS[group]?.[colorFamily]
    || REAL_FASHION_PHOTO_POOLS[group]?.['black']
    || REAL_FASHION_PHOTO_POOLS['Tops']['white'];

  const photoId = pool[(imageCounter - 1) % pool.length];
  // Parameterize URL with unique product index signature to guarantee zero duplicate URLs
  return `https://images.unsplash.com/${photoId}?w=400&h=500&fit=crop&auto=format&sig=${imageCounter}`;
}

// ── Title builder (Rich, realistic marketplace variations) ─────────────────────
const ACCENT_ADJECTIVES = [
  'Ribbed', 'Seamless', 'Embroidered', 'Distressed', 'Washed', 'Vintage-Wash',
  'Textured', 'High-Waisted', 'Relaxed-Fit', 'Cropped', 'Chunky Knit', 'Button-Down',
  'Satin-Finish', 'Tiered', 'Patchwork', 'Raw-Hem', 'Pleated', 'Oversized', 'Soft-Touch'
];

function buildTitle(shade, subtype, fit, style, material) {
  const parts = [];

  const shadeDisplay = shade.split(' ').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  parts.push(shadeDisplay);

  // Add rich design accent for title variety
  const accent = ACCENT_ADJECTIVES[imageCounter % ACCENT_ADJECTIVES.length];

  const styleWords = {
    'oversized': 'Oversized', 'y2k': 'Y2K', 'vintage': 'Vintage',
    'streetwear': 'Streetwear', 'classy': 'Classic', 'formal': 'Formal',
    'boho': 'Boho', 'sporty': 'Sporty', 'chic': 'Chic',
    'korean-inspired': 'Korean-Style', 'minimal': 'Minimal', 'retro': 'Retro',
    'indie': 'Indie', 'preppy': 'Preppy', 'party': 'Party',
  };
  const stylePrefix = styleWords[style];

  if (stylePrefix && rand() > 0.4) {
    parts.push(stylePrefix);
  } else if (accent && rand() > 0.3) {
    parts.push(accent);
  }

  parts.push(subtype);
  return parts.join(' ');
}

// ── Description builder ────────────────────────────────────────────────────────
function buildDescription(shade, subtype, fit, style, material, condition, occasion, brand) {
  const conditionText = condition === 'New with tags' ? 'Brand new with original tags still attached.'
    : condition === 'Like New' ? 'Worn once or twice — in excellent condition with no visible wear.'
    : condition === 'Good' ? 'Gently used with minimal wear. A few light signs of use.'
    : condition === 'Fair' ? 'Shows some signs of wear but still has good life left.'
    : 'Lovingly worn — a true vintage piece with character.';

  const fitDesc = {
    'Oversized': 'Relaxed, oversized fit for an effortlessly cool look.',
    'Cropped': 'Cropped length that hits above the waist.',
    'Fitted': 'Slim fitted silhouette that flatters your shape.',
    'Wide Leg': 'Flowy wide-leg cut for a laid-back, editorial feel.',
    'Slim': 'Slim tapered fit through the leg.',
    'Straight': 'Classic straight cut — timeless and versatile.',
    'Relaxed': 'Relaxed, easy-wearing fit.',
    'Regular': 'True to size with a comfortable regular fit.',
    'Baggy': 'Intentionally baggy for a streetwear-inspired silhouette.',
  }[fit] || '';

  const materialDesc = material ? `Made from ${material.toLowerCase()}.` : '';
  const occasionDesc = occasion ? `Perfect for ${occasion}.` : '';

  return `${shade.charAt(0).toUpperCase() + shade.slice(1)} ${subtype.toLowerCase()} by ${brand}. ${fitDesc} ${materialDesc} ${conditionText} ${occasionDesc}`.replace(/\s+/g,' ').trim();
}

// ── Tags builder ────────────────────────────────────────────────────────────────
function buildTags(shade, subtype, style, fit, occasion, material, category) {
  const tags = new Set();
  // Color (always — critical for AI Style Me)
  tags.add(shade.toLowerCase());
  // Primary color family if shade differs from family name
  const family = Object.entries(COLOR_FAMILIES).find(([,v]) => v.shades.includes(shade));
  if (family && family[0] !== shade) tags.add(family[0]);
  // Subtype
  tags.add(subtype.toLowerCase().replace(/\s+/g,'-'));
  // Style
  if (style) tags.add(style.toLowerCase());
  // Fit
  if (fit) tags.add(fit.toLowerCase().replace(/\s+/g,'-'));
  // Occasion
  if (occasion) tags.add(occasion.toLowerCase().replace(/\s+/g,'-'));
  // Material
  if (material) tags.add(material.toLowerCase().replace(/\s+/g,'-'));
  // Category-derived
  const catTags = {
    "Women's Tops":        ['tops','women'],
    "Men's Tops":          ['tops','men'],
    "Women's Outerwear":   ['outerwear','women'],
    "Men's Outerwear":     ['outerwear','men'],
    "Women's Bottoms":     ['bottoms','women'],
    "Men's Bottoms":       ['bottoms','men'],
    "Women's Sets":        ['set','coord','women'],
    "Women's Traditional": ['traditional','ethnic','women'],
    "Footwear":            ['shoes','footwear'],
    "Accessories":         ['accessory','accessories'],
    "Bags":                ['bag','accessory'],
    "Jewelry":             ['jewelry','accessory'],
  };
  for (const t of (catTags[category] || [])) tags.add(t);
  // Extra style keywords
  const styleExtras = {
    'streetwear': ['urban','trendy'],
    'y2k': ['retro','2000s','trendy','y2k'],
    'vintage': ['secondhand','retro'],
    'boho': ['boho','bohemian'],
    'casual': ['everyday','relaxed'],
    'classy': ['elegant','sophisticated'],
    'formal': ['professional','smart'],
    'oversized': ['baggy','loose'],
    'korean-inspired': ['kpop','korean','kawaii'],
    'minimal': ['minimalist','clean'],
    'party': ['glam','night-out'],
  };
  for (const t of (styleExtras[style] || [])) tags.add(t);
  // Season hints
  const seasonalSubtypes = { 'Hoodie':1,'Sweater':1,'Cardigan':1,'Jacket':1,'Boots':1,'Scarf':1 };
  if (seasonalSubtypes[subtype]) tags.add('winter');
  const summerSubtypes = { 'Tank Top':1,'Shorts':1,'Sandals':1,'Mini Skirt':1,'Crop Top':1 };
  if (summerSubtypes[subtype]) tags.add('summer');

  return [...tags].filter(Boolean).slice(0, 12);
}

// ── Price builder ───────────────────────────────────────────────────────────────
function buildPrice(category, condition) {
  const [pMin, pMax] = CATEGORIES[category].priceBase;
  const base = randPrice(pMin, pMax);
  const multiplier = CONDITION_MULTIPLIER[condition] || 1.0;
  const price = Math.max(pMin, Math.round(base * multiplier / 50) * 50);
  // originalPrice: condition-factored, always > price
  const opFactor = ORIGINAL_PRICE_FACTOR[condition] || 2.5;
  const originalPriceRaw = Math.round(price * opFactor / 100) * 100;
  const originalPrice = Math.max(price + 100, originalPriceRaw);
  return { price, originalPrice };
}

// ── Core product builder ────────────────────────────────────────────────────────
function buildProduct(opts) {
  const cat        = opts._cat;
  const catDef     = CATEGORIES[cat];
  const subtype    = opts._sub   || pick(catDef.subtypes);
  const colorKey   = opts._color || pick(Object.keys(COLOR_FAMILIES));
  const colorFam   = COLOR_FAMILIES[colorKey];
  const shade      = opts._shade || pick(colorFam.shades);
  const style      = opts._style || pick(Object.keys(STYLE_RULES));
  const condition  = opts._cond  || pick(CONDITIONS);
  const brand      = opts._brand || pick(BRANDS_BY_CAT[cat] || ['H&M']);
  const seller     = pick(SELLER_NAMES);
  const size       = pick(catDef.sizes);
  const material   = pick(SUBTYPE_MATERIAL[subtype] || ['Cotton']);
  // Fit: must be compatible with subtype
  const fitOptions = Object.entries(FIT_SUBTYPE_COMPAT)
    .filter(([, subtypes]) => subtypes.includes(subtype))
    .map(([fit]) => fit);
  const fit = opts._fit || (fitOptions.length ? pick(fitOptions) : 'Regular');
  // Occasion: must be compatible with category
  const occOptions = Object.entries(OCCASION_COMPAT)
    .filter(([, cats]) => cats.includes(cat))
    .map(([occ]) => occ);
  const occasion = opts._occ || (occOptions.length ? pick(occOptions) : 'casual');

  const { price: rawPrice, originalPrice: rawOrig } = buildPrice(cat, condition);
  const extraOffset = (opts._extra || 0) * 50;
  const price = rawPrice + extraOffset;
  const originalPrice = rawOrig + extraOffset;

  const title       = buildTitle(shade, subtype, fit, style, material);
  const description = buildDescription(shade, subtype, fit, style, material, condition, occasion, brand);
  const tags        = buildTags(shade, subtype, style, fit, occasion, material, cat);
  const image       = makeImage(shade, subtype, cat);

  return {
    title,
    description,
    price,
    originalPrice,
    condition,
    category: cat,
    tags,
    image,
    images: [],
    sellerName: seller,
    size,
    brand,
    listingType: 'sell',
    views: randInt(5, 300),
    likes: randInt(0, 100),
    avgRating: Math.round(rand() * 15 + 30) / 10,  // 3.0 – 4.5
    reviewCount: randInt(0, 50),
  };
}

// ── Main generation ─────────────────────────────────────────────────────────────
function generate(count) {
  console.log(`\n🎨 Looped Synthetic Dataset Generator`);
  console.log(`   Target count:   ${count}`);
  console.log(`   Output:         ${OUTPUT_PATH}`);
  console.log(`   Data type:      SYNTHETIC / DEMO ONLY — not real scraped inventory\n`);

  const products = [];

  // 1. Inject guaranteed coverage products first
  for (const spec of GUARANTEED_PRODUCTS) {
    if (products.length >= count) break;
    products.push(buildProduct(spec));
  }
  console.log(`✅ Injected ${products.length} guaranteed coverage products`);

  // 2. Random generation with weighted category distribution
  const categoryWeights = [
    ["Women's Tops",        12],
    ["Men's Tops",           8],
    ["Women's Outerwear",   12],
    ["Men's Outerwear",      6],
    ["Women's Bottoms",     14],
    ["Men's Bottoms",        7],
    ["Women's Sets",         8],
    ["Women's Traditional",  6],
    ["Footwear",             8],
    ["Accessories",          7],
    ["Bags",                 7],
    ["Jewelry",              5],
  ];
  const totalWeight = categoryWeights.reduce((s, [,w]) => s + w, 0);
  const weightedCats = [];
  for (const [cat, w] of categoryWeights) {
    for (let i = 0; i < w; i++) weightedCats.push(cat);
  }

  while (products.length < count) {
    const cat = pick(weightedCats);
    products.push(buildProduct({ _cat: cat }));
  }

  console.log(`✅ Generated ${products.length} total products`);

  // Category distribution report
  const catDist = {};
  const colorDist = {};
  const styleDist = {};
  for (const p of products) {
    catDist[p.category] = (catDist[p.category] || 0) + 1;
    for (const tag of p.tags) {
      const isColor = ALL_COLORS.includes(tag);
      if (isColor) colorDist[tag] = (colorDist[tag] || 0) + 1;
      if (Object.keys(STYLE_RULES).includes(tag)) styleDist[tag] = (styleDist[tag] || 0) + 1;
    }
  }

  console.log('\n📊 Category Distribution:');
  Object.entries(catDist).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`   ${c.padEnd(30)} ${n}`));

  console.log('\n🎨 Top Color Tags:');
  Object.entries(colorDist).sort((a,b)=>b[1]-a[1]).slice(0,15).forEach(([c,n]) => console.log(`   ${c.padEnd(20)} ${n}`));

  console.log('\n✨ Style Tag Distribution:');
  Object.entries(styleDist).sort((a,b)=>b[1]-a[1]).forEach(([c,n]) => console.log(`   ${c.padEnd(20)} ${n}`));

  return products;
}

// ── Run ────────────────────────────────────────────────────────────────────────
const products = generate(COUNT);

// Ensure output directory exists
const outDir = path.dirname(OUTPUT_PATH);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(OUTPUT_PATH, JSON.stringify(products, null, 2));
console.log(`\n💾 Written to ${OUTPUT_PATH}`);
console.log(`   Total products: ${products.length}`);

// Show 3 sample products
console.log('\n📝 3 Sample Products:');
[0, Math.floor(products.length/2), products.length-1].forEach(i => {
  const p = products[i];
  console.log(`\n[${i}] ${p.title}`);
  console.log(`     Category: ${p.category} | Size: ${p.size} | Brand: ${p.brand}`);
  console.log(`     Price: ₹${p.price} (orig ₹${p.originalPrice}) | Condition: ${p.condition}`);
  console.log(`     Tags: ${p.tags.join(', ')}`);
  console.log(`     Description: ${p.description.slice(0,100)}...`);
});

console.log('\n✅ Done. Next step: node scripts/validateProducts.js\n');
