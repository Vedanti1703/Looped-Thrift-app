const Product = require('../models/Product');
const User = require('../models/User');
const OpenAI = require('openai');
const fraudService = require('../services/fraudService');

const BRAND_TIERS = {
  'Gucci': 5, 'Chanel': 5, 'Prada': 5, 'Louis Vuitton': 5, 'Dior': 5, 'Hermes': 5, 'Burberry': 5,
  'Zara': 2, 'H&M': 1, 'Uniqlo': 2, 'Mango': 2, 'Forever 21': 1, 'Urban Outfitters': 3,
  'Nike': 3, 'Adidas': 3, 'Puma': 2, 'FabIndia': 2, 'Biba': 2, 'W for Woman': 2
};

// Check 1: Machine Learning Reverse Price Anomaly Detection (Isolation Forest)
async function checkPriceAnomaly(brand, condition, category, price, originalPrice) {
  try {
    const anomaly = await fraudService.checkPriceAnomaly({
      brand,
      condition,
      category,
      price,
      originalPrice
    });

    if (anomaly.flag) {
      return {
        flag: true,
        severity: anomaly.severity || 'medium',
        anomalyType: anomaly.anomalyType,
        anomalyScore: anomaly.anomalyScore,
        predictedPrice: anomaly.predictedPrice,
        priceRatio: anomaly.priceRatio,
        reason: anomaly.reason || `Price of Rs.${price} is anomalous compared to predicted fair market value of Rs.${anomaly.predictedPrice}.`
      };
    }

    return {
      flag: false,
      anomalyScore: anomaly.anomalyScore || 0,
      predictedPrice: anomaly.predictedPrice || price
    };
  } catch (err) {
    console.error('Price anomaly check error:', err);
    // Graceful fallback
    const tier = (brand && BRAND_TIERS[brand]) || 2;
    if (tier >= 4 && price < 500) {
      return {
        flag: true,
        severity: 'high',
        reason: `A ${brand} item priced at Rs.${price} is unusually low for luxury tier. Please verify authenticity.`
      };
    }
    return { flag: false };
  }
}

// Check 2: Perceptual Hashing (pHash) Duplicate & Stolen Image Detection
async function checkDuplicateListing(sellerId, title, imageUrl) {
  if (!imageUrl && !title) return { flag: false };

  try {
    // 1. Primary: Perceptual Hashing (pHash) on visual content
    if (imageUrl) {
      const imgCheck = await fraudService.checkDuplicateImage(imageUrl, sellerId);
      if (imgCheck.flag) {
        return {
          flag: true,
          severity: imgCheck.severity || (imgCheck.isStolenPhoto ? 'high' : 'medium'),
          isStolenPhoto: imgCheck.isStolenPhoto,
          reason: imgCheck.reason,
          topMatch: imgCheck.topMatch,
          duplicates: imgCheck.matches
        };
      }
    }

    // 2. Secondary: Title match as fallback for items without distinct image
    if (sellerId && title) {
      const existingByTitle = await Product.find({
        sellerId,
        title: { $regex: title.slice(0, 20), $options: 'i' }
      }).limit(3);

      if (existingByTitle.length > 0) {
        return {
          flag: true,
          severity: 'medium',
          isStolenPhoto: false,
          reason: 'You appear to have already listed a similar item with this title.',
          duplicates: existingByTitle.map(p => ({ id: p._id, title: p.title, image: p.image }))
        };
      }
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

// Check 4: Data-Driven Seller Risk Score Classifier
async function checkSellerTrust(sellerId) {
  if (!sellerId) {
    return {
      flag: false,
      riskScore: 25,
      riskTier: 'LOW',
      trustScore: 75,
      escrowPolicy: { recommended_escrow_days: 7 }
    };
  }

  try {
    const riskData = await fraudService.evaluateSellerRisk(sellerId);
    const riskScore = riskData.risk_score || 20;
    const riskTier = riskData.risk_tier || 'LOW';
    const trustScore = Math.max(0, 100 - riskScore);

    let flag = false;
    let severity = 'none';
    let reason = '';

    if (riskTier === 'HIGH') {
      flag = true;
      severity = 'high';
      reason = `Seller flagged as HIGH risk (Score: ${riskScore}/100, Disputes: ${riskData.dispute_rate}%). Listing requires review and escrow hold is extended to ${riskData.escrow_policy.recommended_escrow_days} days.`;
    } else if (riskTier === 'MEDIUM') {
      flag = false;
      severity = 'low';
      reason = `Seller has moderate risk profile. Escrow hold set to ${riskData.escrow_policy.recommended_escrow_days} days.`;
    }

    return {
      flag,
      severity,
      reason,
      riskScore,
      riskTier,
      trustScore,
      disputeRate: riskData.dispute_rate,
      escrowPolicy: riskData.escrow_policy
    };
  } catch (err) {
    console.error('Seller trust check error:', err);
    return { flag: false, riskScore: 30, riskTier: 'LOW', trustScore: 70 };
  }
}

// Master analysis controller
exports.analyseBeforeUpload = async (req, res) => {
  try {
    const { brand, price, originalPrice, condition, category, title, description, imageUrl, sellerId } = req.body;
    const effectiveSellerId = sellerId || req.userId;

    // Run upgraded ML checks in parallel:
    // 1. Reverse Price Anomaly with Isolation Forest
    // 2. Perceptual Hashing (pHash) Duplicate/Stolen Photo Detection
    // 3. Vision Consistency Check
    // 4. Seller Risk Classifier
    const [priceCheck, duplicateCheck, aiCheck, trustCheck] = await Promise.allSettled([
      checkPriceAnomaly(brand, condition, category, Number(price), Number(originalPrice)),
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
    const highFlags = [results.price, results.duplicate, results.trust].filter(r => r && r.flag && r.severity === 'high');
    const mediumFlags = [results.price, results.duplicate, results.trust].filter(r => r && r.flag && r.severity === 'medium');

    let verdict = 'approved';
    let rejectionReasons = [];

    if (highFlags.length > 0 || results.ai?.recommendation === 'reject') {
      verdict = 'rejected';
      highFlags.forEach(f => rejectionReasons.push(f.reason));
      if (results.ai?.recommendation === 'reject') rejectionReasons.push('Visual analysis failed quality/authenticity guidelines');
    } else if (mediumFlags.length > 0 || results.ai?.recommendation === 'review') {
      verdict = 'review';
      mediumFlags.forEach(f => rejectionReasons.push(f.reason));
    }

    res.json({
      verdict,
      canProceed: verdict !== 'rejected',
      results,
      reasons: rejectionReasons,
      escrowPolicy: results.trust?.escrowPolicy || { recommended_escrow_days: 7 }
    });
  } catch (err) {
    console.error('analyseBeforeUpload error:', err);
    res.status(500).json({ message: err.message || 'Error analysing listing' });
  }
};

// GET /listing/seller-risk/:id — view seller risk profile & escrow policy
exports.getSellerRiskProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = id || req.userId;
    const risk = await fraudService.evaluateSellerRisk(sellerId);
    res.json({ success: true, risk });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
