const User = require('../models/User');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const InteractionEvent = require('../models/InteractionEvent');

/**
 * Calculates cosine similarity between two numeric vectors of identical dimension.
 * @param {number[]} vecA 
 * @param {number[]} vecB 
 * @returns {number} Cosine similarity in range [-1.0, 1.0]
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA <= 0 || normB <= 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Computes an exponential recency decay factor based on interaction timestamp.
 * Half-life is set to ~14 days (lambda = ln(2) / 14 ~ 0.05).
 * @param {Date|string|number} date 
 * @returns {number} Decay weight between (0, 1]
 */
function computeRecencyFactor(date) {
  if (!date) return 1.0;
  const interactionTime = new Date(date).getTime();
  const now = Date.now();
  const diffDays = Math.max(0, (now - interactionTime) / (1000 * 60 * 60 * 24));
  const lambda = 0.05; // 14-day half-life
  return Math.exp(-lambda * diffDays);
}

/**
 * Builds or refreshes the 1536-dimensional User Taste Vector.
 * Combines embeddings from:
 *  - Purchased items (weight: 2.8)
 *  - Carted items (weight: 1.8)
 *  - Liked / Swiped-Right items (weight: 1.0)
 *  - High-dwell viewed items (weight: 0.5)
 *  - Disliked / Swiped-Left items (weight: -0.4, Rocchio negative feedback)
 * 
 * Weighted by exponential recency decay and normalized to unit length.
 * 
 * @param {string|mongoose.Types.ObjectId} userId 
 * @returns {Promise<number[]|null>} Normalized 1536-dim vector or null
 */
async function buildUserTasteVector(userId) {
  if (!userId) return null;

  try {
    const user = await User.findById(userId)
      .populate('likedItems', 'embedding title category brand price updatedAt createdAt')
      .populate('dislikedItems', 'embedding title category brand price updatedAt createdAt');

    if (!user) return null;

    // 1. Fetch Cart items
    let cartProductIds = [];
    try {
      const cart = await Cart.findOne({ userId }).lean();
      if (cart && Array.isArray(cart.items)) {
        cartProductIds = cart.items.map(item => item.productId).filter(Boolean);
      }
    } catch (cartErr) {
      console.warn('⚠️ Could not load cart for taste vector:', cartErr.message);
    }

    // 2. Fetch Purchased items
    let purchasedProductIds = [];
    try {
      const orders = await Order.find({
        $or: [{ userId }, { buyerId: userId }]
      }).select('items createdAt').lean();

      if (orders && orders.length > 0) {
        for (const order of orders) {
          if (Array.isArray(order.items)) {
            for (const item of order.items) {
              if (item.productId) {
                purchasedProductIds.push({
                  productId: item.productId,
                  date: order.createdAt
                });
              }
            }
          }
        }
      }
    } catch (orderErr) {
      console.warn('⚠️ Could not load orders for taste vector:', orderErr.message);
    }

    // 3. Fetch Dwell events (>2.5 seconds)
    let dwellProductIds = [];
    try {
      const dwellEvents = await InteractionEvent.find({
        userId,
        eventType: { $in: ['dwell', 'view'] },
        dwellTimeMs: { $gte: 2500 }
      }).sort({ createdAt: -1 }).limit(30).lean();

      dwellProductIds = dwellEvents.map(e => ({
        productId: e.productId,
        dwellTimeMs: e.dwellTimeMs,
        date: e.createdAt
      }));
    } catch (evtErr) {
      console.warn('⚠️ Could not load interaction events:', evtErr.message);
    }

    // Fetch product details for cart and purchased products that need embeddings
    const additionalIds = [
      ...cartProductIds,
      ...purchasedProductIds.map(p => p.productId),
      ...dwellProductIds.map(d => d.productId)
    ];

    let additionalProductsMap = new Map();
    if (additionalIds.length > 0) {
      const addProds = await Product.find({ _id: { $in: additionalIds } })
        .select('embedding title category brand price')
        .lean();
      addProds.forEach(p => additionalProductsMap.set(p._id.toString(), p));
    }

    // Composite Vector accumulator
    let compositeVec = null;
    let dimension = 1536;
    let totalPositiveWeight = 0;

    const addSignal = (embedding, weight, date) => {
      if (!Array.isArray(embedding) || embedding.length === 0) return;
      if (!compositeVec) {
        dimension = embedding.length;
        compositeVec = new Array(dimension).fill(0);
      }
      if (embedding.length !== dimension) return;

      const recency = computeRecencyFactor(date);
      const effectiveWeight = weight * recency;

      for (let i = 0; i < dimension; i++) {
        compositeVec[i] += embedding[i] * effectiveWeight;
      }
      if (weight > 0) {
        totalPositiveWeight += effectiveWeight;
      }
    };

    // A. Purchased items (Weight: 2.8)
    for (const p of purchasedProductIds) {
      const prod = additionalProductsMap.get(p.productId.toString());
      if (prod && prod.embedding) {
        addSignal(prod.embedding, 2.8, p.date);
      }
    }

    // B. Carted items (Weight: 1.8)
    for (const cId of cartProductIds) {
      const prod = additionalProductsMap.get(cId.toString());
      if (prod && prod.embedding) {
        addSignal(prod.embedding, 1.8, new Date());
      }
    }

    // C. Liked / Swiped-Right items (Weight: 1.0)
    for (const item of (user.likedItems || [])) {
      if (item && item.embedding) {
        addSignal(item.embedding, 1.0, item.updatedAt || item.createdAt);
      }
    }

    // D. Dwell items (Weight: 0.3 - 0.7 depending on dwell duration)
    for (const d of dwellProductIds) {
      const prod = additionalProductsMap.get(d.productId.toString());
      if (prod && prod.embedding) {
        const dwellWeight = Math.min((d.dwellTimeMs || 2500) / 10000, 1.0) * 0.7;
        addSignal(prod.embedding, dwellWeight, d.date);
      }
    }

    // E. Disliked / Swiped-Left items (Negative weight: -0.4, Rocchio negative feedback)
    for (const item of (user.dislikedItems || [])) {
      if (item && item.embedding) {
        addSignal(item.embedding, -0.4, item.updatedAt || item.createdAt);
      }
    }

    if (!compositeVec || totalPositiveWeight <= 0) {
      return null;
    }

    // Normalize composite taste vector (L2 norm = 1)
    let norm = 0;
    for (let i = 0; i < dimension; i++) {
      norm += compositeVec[i] * compositeVec[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < dimension; i++) {
        compositeVec[i] /= norm;
      }
    }

    // Update user record with updated taste vector (atomic to avoid VersionError)
    await User.findByIdAndUpdate(userId, {
      $set: {
        tasteVector: compositeVec,
        tasteVectorUpdatedAt: new Date()
      }
    });

    return compositeVec;
  } catch (err) {
    console.error('❌ Error in buildUserTasteVector:', err);
    return null;
  }
}

/**
 * Rank candidate products based on cosine similarity to the user's taste vector,
 * augmented with tag, brand, category, and price affinity signals.
 * 
 * Supports both Home Feed and Swipe Deck modes.
 * 
 * @param {Array} products List of product objects
 * @param {Object} user User document or populated user object
 * @param {Object} options { forSwipe: boolean, includeScores: boolean }
 * @returns {Array} Re-ranked product list
 */
function rankProductsByTaste(products, user, options = {}) {
  const { forSwipe = false } = options;
  if (!Array.isArray(products) || products.length === 0) return [];
  if (!user) return products;

  const userTasteVector = (user.tasteVector && user.tasteVector.length > 0)
    ? user.tasteVector
    : (options.tasteVector && options.tasteVector.length > 0 ? options.tasteVector : null);
  const likedItemIds = new Set((user.likedItems || []).map(p => (p._id || p).toString()));
  const dislikedItemIds = new Set((user.dislikedItems || []).map(p => (p._id || p).toString()));
  const swipedRightIds = new Set((user.swipedRight || []).map(p => (p._id || p).toString()));
  const swipedLeftIds = new Set((user.swipedLeft || []).map(p => (p._id || p).toString()));
  const allSwipedIds = new Set([...swipedRightIds, ...swipedLeftIds]);

  const likedTags = new Set(user.likedTags || []);
  const dislikedTags = new Set(user.dislikedTags || []);

  const likedCategories = new Set((user.likedItems || []).map(p => p.category).filter(Boolean));
  const dislikedCategories = new Set((user.dislikedItems || []).map(p => p.category).filter(Boolean));

  const likedBrands = new Set((user.likedItems || []).map(p => p.brand).filter(Boolean));
  const dislikedBrands = new Set((user.dislikedItems || []).map(p => p.brand).filter(Boolean));

  // If forSwipe deck, exclude already swiped items
  let candidates = products;
  if (forSwipe) {
    candidates = candidates.filter(p => !allSwipedIds.has(p._id.toString()));
  }

  // Score each product
  const scored = candidates.map(p => {
    const pIdStr = p._id.toString();
    let score = 0;
    let cosineSim = 0;

    const isLiked = likedItemIds.has(pIdStr);
    const isDisliked = dislikedItemIds.has(pIdStr);

    if (isDisliked) {
      score -= 1000;
    } else if (isLiked) {
      score += 40;
    }

    // 1. Primary: Cosine Similarity between product embedding and User Taste Vector
    if (userTasteVector && p.embedding && Array.isArray(p.embedding) && p.embedding.length === userTasteVector.length) {
      cosineSim = cosineSimilarity(userTasteVector, p.embedding);
      // Cosine similarity gives the highest weight (+70)
      score += cosineSim * 70;
    }

    // 2. Tag Similarity (+6 per liked tag, -6 per disliked tag)
    const pTags = (p.tags || []).map(t => t.toLowerCase());
    const matchLikedTags = pTags.filter(t => likedTags.has(t)).length;
    const matchDislikedTags = pTags.filter(t => dislikedTags.has(t)).length;
    score += (matchLikedTags * 6);
    score -= (matchDislikedTags * 6);

    // 3. Category Affinity (+12 for liked, -12 for disliked)
    if (p.category) {
      if (likedCategories.has(p.category)) score += 12;
      if (dislikedCategories.has(p.category) && !likedCategories.has(p.category)) score -= 12;
    }

    // 4. Brand Affinity (+8 for liked, -8 for disliked)
    if (p.brand) {
      if (likedBrands.has(p.brand)) score += 8;
      if (dislikedBrands.has(p.brand) && !likedBrands.has(p.brand)) score -= 8;
    }

    return {
      ...p,
      matchScore: score,
      cosineSimilarity: cosineSim
    };
  });

  // Filter out severely disliked items for general feed
  let result = scored;
  if (!forSwipe) {
    result = result.filter(p => p.matchScore > -500);
  }

  // Sort by matchScore descending
  result.sort((a, b) => b.matchScore - a.matchScore);

  // For Swipe Deck: Apply 80/20 Exploitation vs Exploration mix
  if (forSwipe && result.length > 5) {
    const topCount = Math.floor(result.length * 0.8);
    const topPicks = result.slice(0, topCount);
    const explorePicks = result.slice(topCount);

    // Interleave exploration items (1 exploration item every 4-5 items)
    const mixed = [];
    let topIdx = 0;
    let expIdx = 0;

    while (topIdx < topPicks.length || expIdx < explorePicks.length) {
      for (let i = 0; i < 4 && topIdx < topPicks.length; i++) {
        mixed.push(topPicks[topIdx++]);
      }
      if (expIdx < explorePicks.length) {
        mixed.push(explorePicks[expIdx++]);
      }
    }
    return mixed;
  }

  return result;
}

module.exports = {
  cosineSimilarity,
  buildUserTasteVector,
  rankProductsByTaste,
  computeRecencyFactor
};
