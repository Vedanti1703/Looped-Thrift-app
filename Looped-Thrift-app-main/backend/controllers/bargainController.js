const Bargain = require('../models/Bargain');
const Product = require('../models/Product');
const User = require('../models/User');

// Buyer submits an offer
exports.createOffer = async (req, res) => {
  try {
    const { productId, offeredPrice, message } = req.body;
    const buyerId = req.userId;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    if (!product.sellerId) {
      return res.status(400).json({ message: 'This item does not have an active seller assigned and cannot receive bargain offers.' });
    }

    if (product.sellerId.toString() === buyerId.toString()) {
      return res.status(400).json({ message: 'You cannot make an offer on your own listing' });
    }

    const minOffer = product.price * 0.3;
    if (offeredPrice < minOffer) {
      return res.status(400).json({
        message: `Offer too low. Minimum offer is ₹${Math.round(minOffer)} (30% of original price)`
      });
    }

    const buyer = await User.findById(buyerId);
    const buyerName = buyer?.name || buyer?.email?.split('@')[0] || 'Buyer';
    const sellerName = product.sellerName || 'Seller';

    // Check if there is an existing pending or countered offer for this buyer & product
    const existingOffer = await Bargain.findOne({
      productId,
      buyerId,
      status: { $in: ['pending', 'countered'] }
    });

    if (existingOffer) {
      existingOffer.offeredPrice = offeredPrice;
      existingOffer.message = message || existingOffer.message;
      existingOffer.status = 'pending';
      existingOffer.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await existingOffer.save();
      return res.json(existingOffer);
    }

    const bargain = new Bargain({
      productId,
      buyerId,
      sellerId: product.sellerId,
      buyerName,
      sellerName,
      originalPrice: product.price,
      offeredPrice,
      message: message || '',
      status: 'pending'
    });

    await bargain.save();
    res.status(201).json(bargain);
  } catch (err) {
    console.error('createOffer error:', err);
    res.status(500).json({ message: err.message || 'Server error creating offer' });
  }
};

// Seller responds to an offer (accept, counter, decline) or buyer accepts/declines counter
exports.respondToOffer = async (req, res) => {
  try {
    const { bargainId } = req.params;
    const { action, counterPrice } = req.body; // action: 'accept' | 'counter' | 'decline'
    const userId = req.userId;

    const bargain = await Bargain.findById(bargainId);
    if (!bargain) {
      return res.status(404).json({ message: 'Bargain offer not found' });
    }

    const isSeller = bargain.sellerId.toString() === userId.toString();
    const isBuyer = bargain.buyerId.toString() === userId.toString();

    if (!isSeller && !isBuyer) {
      return res.status(403).json({ message: 'Unauthorized to respond to this offer' });
    }

    if (action === 'accept') {
      bargain.status = 'accepted';
    } else if (action === 'decline') {
      bargain.status = 'declined';
    } else if (action === 'counter') {
      if (!isSeller) {
        return res.status(400).json({ message: 'Only sellers can counter offer' });
      }
      if (!counterPrice || counterPrice <= 0) {
        return res.status(400).json({ message: 'Please provide a valid counter price' });
      }
      bargain.counterPrice = counterPrice;
      bargain.status = 'countered';
    } else {
      return res.status(400).json({ message: 'Invalid action' });
    }

    await bargain.save();
    res.json(bargain);
  } catch (err) {
    console.error('respondToOffer error:', err);
    res.status(500).json({ message: err.message || 'Server error responding to offer' });
  }
};

// Get all offers where user is buyer OR seller
exports.getMyOffers = async (req, res) => {
  try {
    const userId = req.userId;
    const { productId } = req.query;

    const query = {
      $or: [{ buyerId: userId }, { sellerId: userId }]
    };

    if (productId) {
      query.productId = productId;
    }

    const offers = await Bargain.find(query)
      .populate('productId', 'title image price condition category')
      .sort({ updatedAt: -1 });

    res.json(offers);
  } catch (err) {
    console.error('getMyOffers error:', err);
    res.status(500).json({ message: err.message || 'Server error fetching offers' });
  }
};

// Expire old bargains older than 48h
exports.expireOldBargains = async () => {
  try {
    const result = await Bargain.updateMany(
      {
        status: { $in: ['pending', 'countered'] },
        expiresAt: { $lte: new Date() }
      },
      { $set: { status: 'expired' } }
    );
    if (result.modifiedCount > 0) {
      console.log(`⏱️ Expired ${result.modifiedCount} outdated bargain offers`);
    }
  } catch (err) {
    console.error('expireOldBargains error:', err);
  }
};
