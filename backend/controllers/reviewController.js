const mongoose = require('mongoose');
const Review = require('../models/Review');
const Product = require('../models/Product');
const User = require('../models/User');

const updateProductRatingStats = async (productId) => {
  if (!mongoose.Types.ObjectId.isValid(productId)) return;
  const reviews = await Review.find({ productId });
  const reviewCount = reviews.length;
  const sumRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  const avgRating = reviewCount > 0 ? (sumRating / reviewCount) : 0;
  await Product.findByIdAndUpdate(productId, { avgRating, reviewCount });
};

// GET /reviews/product/:productId
exports.getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.json([]);
    }
    const reviews = await Review.find({ productId })
      .populate('user', 'name email avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /reviews/seller/:sellerId
exports.getSellerReviews = async (req, res) => {
  try {
    const { sellerId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      return res.json([]);
    }
    const sellerProducts = await Product.find({ sellerId }).select('_id');
    const productIds = sellerProducts.map(p => p._id);
    const reviews = await Review.find({ productId: { $in: productIds } })
      .populate('user', 'name email avatar')
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /reviews
exports.createReview = async (req, res) => {
  try {
    const { productId, rating, comment } = req.body;
    if (!productId || !rating) {
      return res.status(400).json({ message: 'Product ID and rating are required' });
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product ID' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Check if seller is reviewing their own product
    if (product.sellerId && product.sellerId.toString() === req.userId) {
      return res.status(403).json({ message: 'Sellers cannot review their own items' });
    }

    const user = await User.findById(req.userId);
    const userName = user?.name || user?.email?.split('@')[0] || 'Anonymous';

    const review = await Review.create({
      productId,
      user: req.userId,
      userName,
      rating: Number(rating),
      comment: comment || '',
    });

    await updateProductRatingStats(productId);

    const populatedReview = await Review.findById(review._id).populate('user', 'name email avatar');
    res.status(201).json(populatedReview);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /reviews/:reviewId
exports.deleteReview = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.reviewId)) {
      return res.status(404).json({ message: 'Review not found' });
    }
    const review = await Review.findById(req.params.reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    if (review.user.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this review' });
    }

    const productId = review.productId;
    await Review.findByIdAndDelete(req.params.reviewId);
    await updateProductRatingStats(productId);

    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
