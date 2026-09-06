const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });
const mongoose = require('mongoose');
const Product = require('../models/Product');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const products = await Product.find({}, 'title category tags price brand size description').lean();
  console.log('=== PRODUCT CATALOG AUDIT ===\n');
  products.forEach(p => {
    console.log(JSON.stringify({
      title: p.title,
      category: p.category,
      tags: p.tags,
      price: p.price,
      size: p.size,
      brand: p.brand || '',
      desc_snippet: (p.description || '').slice(0, 80)
    }));
  });
  
  // Summary: category distribution
  const cats = {};
  products.forEach(p => { cats[p.category] = (cats[p.category] || 0) + 1; });
  console.log('\n=== CATEGORY DISTRIBUTION ===');
  Object.entries(cats).sort((a,b) => b[1]-a[1]).forEach(([c,n]) => console.log(`  ${c}: ${n}`));
  
  // Tag distribution
  const tagMap = {};
  products.forEach(p => (p.tags||[]).forEach(t => { tagMap[t] = (tagMap[t]||0)+1; }));
  console.log('\n=== TOP TAGS ===');
  Object.entries(tagMap).sort((a,b)=>b[1]-a[1]).slice(0,30).forEach(([t,n]) => console.log(`  ${t}: ${n}`));
  
  process.exit(0);
});
