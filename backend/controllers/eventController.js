const InteractionEvent = require('../models/InteractionEvent');
const User = require('../models/User');
const Product = require('../models/Product');
const { buildUserTasteVector } = require('../services/recommendationService');

// POST /events — log one or multiple interaction events (views, dwell time, cart, purchase)
exports.logEvent = async (req, res) => {
  try {
    const userId = req.userId || req.body.userId || null;
    const rawEvents = Array.isArray(req.body.events) ? req.body.events : [req.body];

    const validEvents = [];
    let shouldUpdateTasteVector = false;

    for (const evt of rawEvents) {
      const { productId, eventType, dwellTimeMs = 0, page = 'feed', metadata = {} } = evt;
      if (!productId || !eventType) continue;

      validEvents.push({
        userId,
        sessionId: req.body.sessionId || null,
        productId,
        eventType,
        dwellTimeMs: Number(dwellTimeMs) || 0,
        page,
        metadata
      });

      // Events that strongly shift taste vector
      if (['cart_add', 'purchase', 'swipe_right', 'like'].includes(eventType)) {
        shouldUpdateTasteVector = true;
      }
    }

    if (validEvents.length === 0) {
      return res.status(400).json({ message: 'No valid events to record' });
    }

    const inserted = await InteractionEvent.insertMany(validEvents);

    // Update user stats if userId is present
    if (userId) {
      const totalDwell = validEvents.reduce((acc, e) => acc + (e.dwellTimeMs || 0), 0);
      const viewsCount = validEvents.filter(e => e.eventType === 'view').length;
      const cartCount = validEvents.filter(e => e.eventType === 'cart_add').length;

      await User.findByIdAndUpdate(userId, {
        $inc: {
          'interactionStats.dwellTimeTotalMs': totalDwell,
          'interactionStats.viewsCount': viewsCount,
          'interactionStats.cartAddsCount': cartCount
        }
      }).catch(err => console.warn('User stats update warning:', err.message));

      if (shouldUpdateTasteVector) {
        buildUserTasteVector(userId).catch(err => console.warn('Taste vector update warning:', err.message));
      }
    }

    res.json({ success: true, loggedCount: inserted.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /events/export — export interaction matrix for Collaborative Filtering / LightFM training
exports.exportInteractions = async (req, res) => {
  try {
    const { limit = 5000 } = req.query;

    const events = await InteractionEvent.find({ userId: { $ne: null } })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();

    // Map eventType to implicit feedback score
    const eventWeights = {
      purchase: 5.0,
      cart_add: 3.5,
      swipe_right: 2.5,
      like: 2.0,
      dwell: 1.2,
      view: 0.5,
      swipe_left: -1.0,
      unlike: -0.5
    };

    const interactions = events.map(e => ({
      userId: e.userId.toString(),
      productId: e.productId.toString(),
      eventType: e.eventType,
      dwellTimeMs: e.dwellTimeMs,
      weight: eventWeights[e.eventType] || 1.0,
      timestamp: e.createdAt
    }));

    const uniqueUsers = [...new Set(interactions.map(i => i.userId))];
    const uniqueProducts = [...new Set(interactions.map(i => i.productId))];

    res.json({
      totalInteractions: interactions.length,
      uniqueUsersCount: uniqueUsers.length,
      uniqueProductsCount: uniqueProducts.length,
      interactions
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
