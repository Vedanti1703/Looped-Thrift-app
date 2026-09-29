const FASHION_IMPACT = {
  // CO2 kg per new garment produced
  CO2_NEW: {
    "Women's Tops": 2.1, "Women's T-Shirts": 2.1,
    "Women's Crop Tops": 1.8, "Women's Dresses": 5.5,
    "Women's Outerwear": 12.0, "Women's Traditional": 4.2,
    "Women's Bottoms": 4.0, "Women's Sets": 6.0,
    "Men's Shirts": 2.8, "Men's Tops": 2.5,
    "Men's Bottoms": 4.0, "Men's Outerwear": 14.0,
    "Footwear": 7.5, "Bags": 8.2,
    "Accessories": 1.2, "Jewelry": 2.0,
    "default": 3.5
  },
  // Litres of water per new garment
  WATER_NEW: {
    "Women's Tops": 2700, "Women's T-Shirts": 2700,
    "Women's Crop Tops": 1800, "Women's Dresses": 5000,
    "Women's Outerwear": 8000, "Women's Bottoms": 3500,
    "Men's Shirts": 2700, "Men's Tops": 2500,
    "Men's Bottoms": 3500, "Men's Outerwear": 9000,
    "Footwear": 4000, "Bags": 3500,
    "default": 2000
  },
  // Thrift saves this % of new garment impact
  THRIFT_SAVING_FACTOR: 0.82  // 82% savings vs new
};

function calculateSavings(category, condition) {
  const co2New   = FASHION_IMPACT.CO2_NEW[category]   || FASHION_IMPACT.CO2_NEW.default;
  const waterNew = FASHION_IMPACT.WATER_NEW[category] || FASHION_IMPACT.WATER_NEW.default;

  // Condition multiplier — better condition = slightly more savings (vs throwing away)
  const condMultiplier = {
    'New with tags': 1.0, 'Like New': 0.95, 'Good': 0.88,
    'Fair': 0.78, 'Well Loved': 0.65
  }[condition] || 0.85;

  const factor = FASHION_IMPACT.THRIFT_SAVING_FACTOR * condMultiplier;
  const co2SavedKg = parseFloat((co2New * factor).toFixed(2));
  const waterSavedLitres = parseFloat((waterNew * factor).toFixed(0));

  return {
    co2SavedKg,
    waterSavedLitres,
    equivalentKmNotDriven: parseFloat((co2SavedKg / 0.21).toFixed(1)), // avg car emits 0.21kg CO2/km
    equivalentPhoneCharges: Math.round(waterSavedLitres / 0.02),        // 0.02L per phone charge
    treeDaysEquivalent: parseFloat((co2SavedKg / 0.022).toFixed(1))     // tree absorbs 22g CO2/day
  };
}

function calculateSustainabilityTier(co2Saved) {
  if (co2Saved < 5)   return { tier: 'Seedling',         emoji: '🌱', score: Math.round(co2Saved * 4) };
  if (co2Saved < 20)  return { tier: 'Sprout',           emoji: '🌿', score: Math.round(20 + co2Saved * 2) };
  if (co2Saved < 50)  return { tier: 'Leaf',             emoji: '🍃', score: Math.round(40 + co2Saved) };
  if (co2Saved < 100) return { tier: 'Tree',             emoji: '🌳', score: Math.round(70 + co2Saved * 0.5) };
  return                     { tier: 'Forest Guardian', emoji: '🌲', score: 100 };
}

module.exports = {
  FASHION_IMPACT,
  calculateSavings,
  calculateSustainabilityTier
};
