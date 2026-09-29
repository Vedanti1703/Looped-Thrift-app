const Product = require('../models/Product');
const User = require('../models/User');
const OpenAI = require('openai');

const BRAND_TIERS = {
  'Gucci': 5, 'Chanel': 5, 'Prada': 5, 'Louis Vuitton': 5, 'Dior': 5, 'Hermes': 5, 'Burberry': 5,
  'Zara': 2, 'H&M': 1, 'Uniqlo': 2, 'Mango': 2, 'Forever 21': 1, 'Urban Outfitters': 3,
  'Nike': 3, 'Adidas': 3, 'Puma': 2, 'FabIndia': 2, 'Biba': 2, 'W for Woman': 2
};

// Check 1: Price Anomaly Detection (Rule-based)
function checkPriceAnomaly(brand, condition, category, price, originalPrice) {
  const tier = (brand && BRAND_TIERS[brand]) || 2;

  // Luxury brand priced suspiciously low
  if (tier >= 4 && price < 500) {
    return {
      flag: true,
      severity: 'high',
      reason: `A ${brand} item priced at ₹${price} is unusually low for luxury tier. Please verify authenticity.`
    };
  }

  // Resale higher than original
  if (originalPrice && price > originalPrice * 0.95) {
    return {
      flag: true,
      severity: 'medium',
      reason: 'Resale price is close to or higher than original retail price for a thrift item.'
    };
  }

  // "New with tags" but price is less than 40% of original
  if (condition === 'New with tags' && originalPrice && price < originalPrice * 0.40) {
    return {
      flag: true,
      severity: 'low',
      reason: 'New with tags items are usually valued higher. Consider increasing your price.'
    };
  }

  return { flag: false };
}

// Check 2: Duplicate Listing Detection (Seller & title check)
async function checkDuplicateListing(sellerId, title, imageUrl) {
  if (!sellerId || !title) return { flag: false };
  try {
    const existingByTitle = await Product.find({
      sellerId,
      title: { $regex: title.slice(0, 20), $options: 'i' }
    }).limit(3);

    if (existingByTitle.length > 0) {
      return {
        flag: true,
        severity: 'medium',
        reason: 'You appear to have already listed a similar item.',
        duplicates: existingByTitle.map(p => ({ id: p._id, title: p.title, image: p.image }))
      };
    }
  } catch (err) {
    console.error('Duplicate check error:', err);
  }
  return { flag: false };
}

// Check 3: Description vs Image Consistency using OpenAI Vision (or fallback)
async function checkDescriptionImageConsistency(imageUrl, title, description, category, condition) {
  if (!process.env.OPENAI_API_KEY) {
    // Graceful fallback if no OpenAI key is set
    return {
      isClothingItem: true,
      categoryMatches: true,
      conditionMatchesImage: true,
      suspiciousFlags: [],
      isStockPhoto: false,
      hasVisibleDamage: false,
      damageDescription: '',
      overallRisk: 'low',
      recommendation: 'approve'
    };
  }

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt = `You are a fraud detection system for a fashion thrift marketplace.
Analyse this clothing listing and return ONLY a valid JSON object:

Title: "${title}"
Description: "${description}"  
Category: "${category}"
Condition claimed: "${condition}"

Looking at the image, answer:
{
  "isClothingItem": true,
  "categoryMatches": true,
  "conditionMatchesImage": true,
  "suspiciousFlags": [],
  "isStockPhoto": false,
  "hasVisibleDamage": false,
  "damageDescription": "",
  "overallRisk": "low",
  "recommendation": "approve"
}`;

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'low' } }
        ]
      }]
    });

    const text = response.choices[0].message.content;
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (err) {
    console.error('AI Consistency check error:', err.message);
    return {
      isClothingItem: true,
      categoryMatches: true,
      conditionMatchesImage: true,
      suspiciousFlags: [],
      overallRisk: 'low',
      recommendation: 'approve'
    };
  }
}

// Check 4: Seller Trust Score
async function checkSellerTrust(sellerId) {
  if (!sellerId) return { flag: false, trustScore: 70 };
  try {
    const seller = await User.findById(sellerId).populate('uploadedItems');
    if (!seller) return { flag: false, trustScore: 70 };

    const totalListings = seller.uploadedItems?.length || 0;
    const accountAgeDays = (Date.now() - new Date(seller.createdAt)) / (1000 * 60 * 60 * 24);

    if (accountAgeDays < 1 && totalListings === 0) {
      return {
        flag: true,
        severity: 'low',
        reason: 'New account — listing will be monitored as your first upload.'
      };
    }

    return { flag: false, trustScore: Math.min(100, Math.round(totalListings * 10 + accountAgeDays * 2)) };
  } catch (err) {
    console.error('Seller trust check error:', err);
    return { flag: false, trustScore: 70 };
  }
}

// Master analysis controller
exports.analyseBeforeUpload = async (req, res) => {
  try {
    const { brand, price, originalPrice, condition, category, title, description, imageUrl, sellerId } = req.body;
    const effectiveSellerId = sellerId || req.userId;

    // Run all checks in parallel
    const [priceCheck, duplicateCheck, aiCheck, trustCheck] = await Promise.allSettled([
      Promise.resolve(checkPriceAnomaly(brand, condition, category, Number(price), Number(originalPrice))),
      checkDuplicateListing(effectiveSellerId, title, imageUrl),
      checkDescriptionImageConsistency(imageUrl, title, description, category, condition),
      checkSellerTrust(effectiveSellerId)
    ]);

    const results = {
      price:     priceCheck.status === 'fulfilled' ? priceCheck.value : { flag: false },
      duplicate: duplicateCheck.status === 'fulfilled' ? duplicateCheck.value : { flag: false },
      ai:        aiCheck.status === 'fulfilled' ? aiCheck.value : { overallRisk: 'low', recommendation: 'approve' },
      trust:     trustCheck.status === 'fulfilled' ? trustCheck.value : { flag: false },
    };

    // Decide overall verdict
    const highFlags = [results.price, results.duplicate, results.trust].filter(r => r.flag && r.severity === 'high');
    const mediumFlags = [results.price, results.duplicate, results.trust].filter(r => r.flag && r.severity === 'medium');

    let verdict = 'approved';
    if (highFlags.length > 0 || results.ai?.recommendation === 'reject') {
      verdict = 'rejected';
    } else if (mediumFlags.length > 0 || results.ai?.recommendation === 'review') {
      verdict = 'review';
    }

    res.json({ verdict, results, canProceed: verdict !== 'rejected' });
  } catch (err) {
    console.error('analyseBeforeUpload error:', err);
    res.status(500).json({ message: err.message || 'Error analysing listing' });
  }
};
