const User = require('../models/User');
const Product = require('../models/Product');
const InteractionEvent = require('../models/InteractionEvent');
const { buildUserTasteVector } = require('../services/recommendationService');

// GET /user/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('likedItems', 'title price image tags condition category brand')
      .populate('dislikedItems', 'title price image tags condition category brand')
      .populate('uploadedItems', 'title price image views likes condition')
      .select('-password -otp -otpExpiry');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /user/like — like or unlike an item; update likedTags & user taste vector
exports.likeItem = async (req, res) => {
  try {
    const { productId } = req.body;
    const userId = req.userId || req.body.userId;
    if (!userId) return res.status(401).json({ message: 'User ID required' });

    const user = await User.findById(userId);
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const pIdStr = product._id.toString();
    const alreadyLiked = user.likedItems.some(id => id.toString() === pIdStr);

    if (alreadyLiked) {
      user.likedItems = user.likedItems.filter(id => id.toString() !== pIdStr);
      user.swipedRight = (user.swipedRight || []).filter(id => id.toString() !== pIdStr);
      await Product.findByIdAndUpdate(productId, { $inc: { likes: -1 } });
    } else {
      user.likedItems.push(product._id);
      if (!user.swipedRight) user.swipedRight = [];
      if (!user.swipedRight.some(id => id.toString() === pIdStr)) {
        user.swipedRight.push(product._id);
      }
      user.dislikedItems = (user.dislikedItems || []).filter(id => id.toString() !== pIdStr);
      user.swipedLeft = (user.swipedLeft || []).filter(id => id.toString() !== pIdStr);
      await Product.findByIdAndUpdate(productId, { $inc: { likes: 1 } });
    }

    const remainingLiked = await Product.find({ _id: { $in: user.likedItems } }).select('tags');
    user.likedTags = [...new Set(remainingLiked.flatMap(p => p.tags || []))];

    const remainingDisliked = await Product.find({ _id: { $in: user.dislikedItems || [] } }).select('tags');
    user.dislikedTags = [...new Set(remainingDisliked.flatMap(p => p.tags || []))];

    await user.save();

    // Log interaction event
    InteractionEvent.create({
      userId: user._id,
      productId: product._id,
      eventType: alreadyLiked ? 'unlike' : 'like',
      page: req.body.page || 'feed',
      metadata: { category: product.category, price: product.price }
    }).catch(err => console.warn('InteractionEvent log warning:', err.message));

    // Refresh User Taste Vector in background
    buildUserTasteVector(user._id).catch(err => console.warn('Taste vector update warning:', err.message));

    res.json({ liked: !alreadyLiked, likedItems: user.likedItems, likedTags: user.likedTags });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /user/swipe — recorded right or left swipe for AI Recommendations
exports.swipeItem = async (req, res) => {
  try {
    const { productId, action, direction, dwellTimeMs = 0 } = req.body;
    const userId = req.userId || req.body.userId;
    if (!userId) return res.status(401).json({ message: 'User ID required' });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const isRightSwipe = action === 'right' || action === 'like' || direction === 'right';
    const pIdStr = product._id.toString();

    if (!user.likedItems) user.likedItems = [];
    if (!user.likedTags) user.likedTags = [];
    if (!user.dislikedItems) user.dislikedItems = [];
    if (!user.dislikedTags) user.dislikedTags = [];
    if (!user.swipedRight) user.swipedRight = [];
    if (!user.swipedLeft) user.swipedLeft = [];
    if (!user.interactionStats) {
      user.interactionStats = {
        likesCount: 0,
        dislikesCount: 0,
        viewsCount: 0,
        dwellTimeTotalMs: 0,
        cartAddsCount: 0
      };
    }

    if (dwellTimeMs > 0) {
      user.interactionStats.dwellTimeTotalMs += Number(dwellTimeMs);
    }

    if (isRightSwipe) {
      // SWIPE RIGHT (LIKE)
      user.interactionStats.likesCount++;
      if (!user.likedItems.some(id => id.toString() === pIdStr)) {
        user.likedItems.push(product._id);
        await Product.findByIdAndUpdate(product._id, { $inc: { likes: 1 } });
      }
      if (!user.swipedRight.some(id => id.toString() === pIdStr)) {
        user.swipedRight.push(product._id);
      }
      user.dislikedItems = user.dislikedItems.filter(id => id.toString() !== pIdStr);
      user.swipedLeft = user.swipedLeft.filter(id => id.toString() !== pIdStr);
    } else {
      // SWIPE LEFT (DISLIKE / SKIP)
      user.interactionStats.dislikesCount++;
      if (!user.dislikedItems.some(id => id.toString() === pIdStr)) {
        user.dislikedItems.push(product._id);
      }
      if (!user.swipedLeft.some(id => id.toString() === pIdStr)) {
        user.swipedLeft.push(product._id);
      }
      if (user.likedItems.some(id => id.toString() === pIdStr)) {
        user.likedItems = user.likedItems.filter(id => id.toString() !== pIdStr);
        await Product.findByIdAndUpdate(product._id, { $inc: { likes: -1 } });
      }
      user.swipedRight = user.swipedRight.filter(id => id.toString() !== pIdStr);
    }

    // Rebuild likedTags & dislikedTags
    const likedProds = await Product.find({ _id: { $in: user.likedItems } }).select('tags');
    user.likedTags = [...new Set(likedProds.flatMap(p => p.tags || []))];

    const dislikedProds = await Product.find({ _id: { $in: user.dislikedItems } }).select('tags');
    user.dislikedTags = [...new Set(dislikedProds.flatMap(p => p.tags || []))];

    await user.save();

    // Log swipe and dwell interaction events
    const eventType = isRightSwipe ? 'swipe_right' : 'swipe_left';
    InteractionEvent.create({
      userId: user._id,
      productId: product._id,
      eventType,
      dwellTimeMs: Number(dwellTimeMs) || 0,
      page: 'swipe',
      metadata: {
        category: product.category,
        brand: product.brand,
        price: product.price
      }
    }).catch(err => console.warn('Swipe InteractionEvent log warning:', err.message));

    // Refresh User Taste Vector in background with the new swipe
    buildUserTasteVector(user._id).catch(err => console.warn('Taste vector update warning:', err.message));

    res.json({
      success: true,
      action: isRightSwipe ? 'right' : 'left',
      likedItemsCount: user.likedItems.length,
      dislikedItemsCount: user.dislikedItems.length,
      likedTags: user.likedTags,
      dislikedTags: user.dislikedTags,
      tasteVectorUpdated: true
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
