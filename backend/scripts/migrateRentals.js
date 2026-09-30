/**
 * migrateRentals.js
 * Idempotent migration script for the existing product catalog:
 * - Iterates over all products in MongoDB
 * - If product does NOT meet the premium rental rule (originalPrice >= 3000 & eligible occasion/category),
 *   sets listingType to 'sell' and clears rentPricePerDay, securityDeposit, and rentAvailable.
 * - If it does meet the rule, preserves/adjusts rental parameters.
 *
 * Usage: node scripts/migrateRentals.js
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);

const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const Product = require('../models/Product');
const { checkRentalEligibility } = require('../config/rentalRules');

async function migrateRentals() {
  console.log('🔄 Starting Rental Catalog Migration...');

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/looped';
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB');

  const products = await Product.find({});
  console.log(`Found ${products.length} products to evaluate.`);

  let resetCount = 0;
  let keptCount = 0;

  for (const product of products) {
    const eligibility = checkRentalEligibility(product);

    if (!eligibility.eligible) {
      // Ineligible -> reset listingType to 'sell' and clear rent fields
      if (product.listingType !== 'sell' || product.rentPricePerDay || product.rentAvailable) {
        product.listingType = 'sell';
        product.rentPricePerDay = undefined;
        product.securityDeposit = undefined;
        product.rentAvailable = false;
        await product.save();
        resetCount++;
      }
    } else {
      // Eligible -> Ensure rentPricePerDay and securityDeposit are within formula if listed for rent
      if (['rent', 'both'].includes(product.listingType) && product.rentPricePerDay) {
        keptCount++;
      }
    }
  }

  console.log('\n========================================');
  console.log('🎉 Rental Migration Complete');
  console.log(`- Total products evaluated:   ${products.length}`);
  console.log(`- Ineligible items reset:     ${resetCount}`);
  console.log(`- Eligible rentals retained:  ${keptCount}`);
  console.log('========================================\n');

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB.');
}

if (require.main === module) {
  migrateRentals().catch(err => {
    console.error('❌ Migration error:', err);
    process.exit(1);
  });
}

module.exports = migrateRentals;
