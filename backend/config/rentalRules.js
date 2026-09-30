/**
 * rentalRules.js
 * Shared configuration and validation rules for luxury/premium rentals on Looped.
 */

const RENTAL_CONFIG = {
  MIN_VALUE: 3000, // Minimum original retail value in INR (Rs 3,000)
  ALLOWED_CATEGORIES_OR_KEYWORDS: [
    'wedding & bridal wear',
    'wedding',
    'bridal',
    'lehenga',
    'designer saree',
    'saree',
    'sherwani',
    'gown/evening wear',
    'gown',
    'evening wear',
    'blazer/suit/tuxedo',
    'blazer',
    'suit',
    'tuxedo',
    'party/cocktail wear',
    'party wear',
    'cocktail',
    'designer jewellery sets',
    'jewellery',
    'jewelry',
    'anarkali',
    'indo-western',
    'couture'
  ],
  DAILY_RATE_MIN_PERCENT: 0.08, // 8% of retail value
  DAILY_RATE_MAX_PERCENT: 0.15, // 15% of retail value
  DEPOSIT_MIN_PERCENT: 0.30,    // 30% of retail value
  DEPOSIT_MAX_PERCENT: 0.50     // 50% of retail value
};

/**
 * Checks whether an item qualifies for the premium rental tier.
 * @param {Object} product
 * @returns {{ eligible: boolean, reason?: string }}
 */
function checkRentalEligibility(product) {
  if (!product) return { eligible: false, reason: 'Product details missing' };

  const effectiveValue = Number(product.originalPrice) || Number(product.price) || 0;
  if (effectiveValue < RENTAL_CONFIG.MIN_VALUE) {
    return {
      eligible: false,
      reason: `Item value (₹${effectiveValue}) is below the ₹${RENTAL_CONFIG.MIN_VALUE} minimum requirement for rentals. Rentals are reserved for premium & occasion wear.`
    };
  }

  const categoryLower = (product.category || '').toLowerCase();
  const titleLower = (product.title || '').toLowerCase();
  const tagsLower = Array.isArray(product.tags) ? product.tags.map(t => String(t).toLowerCase()) : [];

  const textToSearch = `${categoryLower} ${titleLower} ${tagsLower.join(' ')}`;

  const isEligibleCategory = RENTAL_CONFIG.ALLOWED_CATEGORIES_OR_KEYWORDS.some(kw =>
    textToSearch.includes(kw.toLowerCase())
  );

  if (!isEligibleCategory) {
    return {
      eligible: false,
      reason: 'Only premium occasion wear (Bridal, Lehenga, Designer Saree, Sherwani, Gown, Tuxedo/Suit, Party Wear, Designer Jewellery) can be listed for rent. Everyday basics (tees, jeans, casual shirts) are not eligible.'
    };
  }

  return { eligible: true };
}

module.exports = {
  RENTAL_CONFIG,
  checkRentalEligibility
};
