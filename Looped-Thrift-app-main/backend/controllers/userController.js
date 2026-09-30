const User = require('../models/User');
const Product = require('../models/Product');

// GET /user/profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('likedItems', 'title price image tags condition')
      .populate('uploadedItems', 'title price image views likes condition')
      .select('-password -otp -otpExpiry');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /user/like  — like or unlike an item; update likedTags for recommendations
exports.likeItem = async (req, res) => {
  try {
    const { productId } = req.body;
    const user = await User.findById(req.userId);
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const alreadyLiked = user.likedItems.includes(productId);

    if (alreadyLiked) {
      // Unlike: remove from likedItems; remove its tags (if not used by other liked items)
      user.likedItems = user.likedItems.filter(id => id.toString() !== productId);
      // Rebuild likedTags from remaining liked items
      const remaining = await Product.find({ _id: { $in: user.likedItems } }).select('tags');
      user.likedTags = [...new Set(remaining.flatMap(p => p.tags))];
      await product.updateOne({ $inc: { likes: -1 } });
    } else {
      // Like: add and merge tags
      user.likedItems.push(productId);
      user.likedTags = [...new Set([...user.likedTags, ...product.tags])];
      await product.updateOne({ $inc: { likes: 1 } });
    }

    await user.save();
    res.json({ liked: !alreadyLiked, likedItems: user.likedItems });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
