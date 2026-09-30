const Auction = require('../models/Auction');
const Product = require('../models/Product');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'looped_secret_2024';

// Helper: check if a user is an admin
function isUserAdmin(user) {
  if (!user) return false;
  const adminEmails = (process.env.ADMIN_EMAILS || 'admin@looped.app').split(',').map(e => e.trim().toLowerCase());
  if (user.role === 'admin') return true;
  if (user.email && (adminEmails.includes(user.email.toLowerCase()) || user.email.includes('admin@looped.app'))) return true;
  return false;
}

// Helper: optionally extract requester from Authorization header
async function getOptionalUser(req) {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) return null;
    return await User.findById(decoded.userId);
  } catch {
    return null;
  }
}

// In-memory bid queue — one queue per auction prevents race conditions (Distributed Computing)
const bidQueues = new Map();

async function placeBid(req, res) {
  const { auctionId } = req.params;
  const amount = Number(req.body.amount);
  const bidderId = req.userId;

  if (!amount) {
    return res.status(400).json({ message: 'Valid bid amount is required' });
  }

  // Get or create a queue for this auction
  if (!bidQueues.has(auctionId)) {
    bidQueues.set(auctionId, Promise.resolve());
  }

  // Chain this bid onto the auction's queue — serializes concurrent bids
  const result = await new Promise((resolve) => {
    const queue = bidQueues.get(auctionId).then(async () => {
      try {
        // Fetch current auction state
        const auction = await Auction.findById(auctionId);

        // Validation checks
        if (!auction) return resolve({ error: 'Auction not found', status: 404 });
        if (auction.status !== 'live' && auction.status !== 'ending') {
          return resolve({ error: 'Auction is not currently live for bidding', status: 400 });
        }
        if (auction.sellerId.toString() === bidderId.toString()) {
          return resolve({ error: 'Sellers cannot bid on their own auction', status: 400 });
        }
        const minRequired = auction.currentPrice + (auction.incrementAmount || 50);
        if (amount < minRequired) {
          return resolve({ error: `Minimum next bid is ₹${minRequired}`, status: 400 });
        }
        if (new Date() > new Date(auction.endTime)) {
          return resolve({ error: 'Auction has ended', status: 400 });
        }

        // Get bidder name
        const bidder = await User.findById(bidderId).select('name email');
        const bidderName = bidder?.name || bidder?.email?.split('@')[0] || 'Bidder';

        // Calculate all unique bidders including this new bidder
        const existingBidderIds = (auction.bids || []).map(b => b.bidderId.toString());
        const uniqueBidders = new Set([...existingBidderIds, bidderId.toString()]);
        const newTotalBidders = uniqueBidders.size;

        // Anti-snipe extension check: if placed within last 5 mins, extend by 2 mins and set status 'ending'
        const nowMs = Date.now();
        const currentEndMs = new Date(auction.endTime).getTime();
        const timeLeft = currentEndMs - nowMs;
        let newEndTime = auction.endTime;
        let newStatus = auction.status;

        if (timeLeft < 5 * 60 * 1000) {
          newEndTime = new Date(nowMs + 2 * 60 * 1000);
          newStatus = 'ending';
        }

        const newBidObj = {
          bidderId,
          bidderName,
          amount,
          timestamp: new Date(),
          isWinning: true
        };

        const currentVersion = auction.__v;

        // Atomic pipeline update: map existing bids to isWinning=false and concat the new winning bid
        const updated = await Auction.findOneAndUpdate(
          { _id: auctionId, __v: currentVersion },
          [
            {
              $set: {
                currentPrice: amount,
                totalBidders: newTotalBidders,
                endTime: newEndTime,
                status: newStatus,
                __v: { $add: [{ $ifNull: ['$$ROOT.__v', 0] }, 1] },
                bids: {
                  $concatArrays: [
                    {
                      $map: {
                        input: { $ifNull: ['$$ROOT.bids', []] },
                        as: 'b',
                        in: {
                          $mergeObjects: ['$$b', { isWinning: false }]
                        }
                      }
                    },
                    [newBidObj]
                  ]
                }
              }
            }
          ],
          { new: true }
        ).select('-proofDocs');

        if (!updated) {
          // Version mismatch means another concurrent bid landed first
          return resolve({ error: 'Concurrent bid conflict — someone placed a bid just before you. Please try again.', status: 409 });
        }

        resolve({ auction: updated, status: 200 });
      } catch (err) {
        resolve({ error: err.message || 'Error processing bid', status: 500 });
      }
    });
    bidQueues.set(auctionId, queue);
  });

  if (result.error) return res.status(result.status).json({ message: result.error });
  res.json(result.auction);
}

// Seller creates luxury designer auction
async function createAuction(req, res) {
  try {
    const {
      productId,
      title,
      description,
      brand,
      category,
      condition,
      size,
      purchaseYear,
      declaredValue,
      images,
      image,
      proofDocs,
      startingPrice,
      reservePrice,
      incrementAmount,
      startTime,
      endTime
    } = req.body;
    const sellerId = req.userId;

    // Server-side luxury drop validation
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Auction title is required' });
    }
    if (!brand || !brand.trim()) {
      return res.status(400).json({ message: 'Brand name is required for luxury auctions' });
    }
    const val = Number(declaredValue);
    if (isNaN(val) || val < 5000) {
      return res.status(400).json({
        message: 'Declared purchase/retail value must be at least ₹5,000. Auctions on Looped are reserved for authenticated luxury & designer items.'
      });
    }

    const allImages = Array.isArray(images) && images.length > 0 ? images : (image ? [image] : []);
    if (allImages.length < 3) {
      return res.status(400).json({ message: 'At least 3 high-resolution photos (Front, Back, Brand tag/details) are required.' });
    }

    // Authenticity proof validation: bill is required, plus certificate/tag/box
    const proofs = Array.isArray(proofDocs) ? proofDocs : [];
    const hasBill = proofs.some(p => p.type === 'bill');
    const hasAuthProof = proofs.some(p => ['certificate', 'serial_tag', 'dustbag_box'].includes(p.type));
    if (!hasBill) {
      return res.status(400).json({ message: 'Purchase invoice/bill is required for luxury verification.' });
    }
    if (!hasAuthProof) {
      return res.status(400).json({ message: 'At least one authenticity proof (Certificate, Serial number tag, or Dustbag/Box) is required.' });
    }

    const startVal = Number(startingPrice);
    if (!startVal || startVal <= 0) {
      return res.status(400).json({ message: 'Valid starting price is required' });
    }
    const resVal = Number(reservePrice) || 0;
    if (resVal > 0 && resVal < startVal) {
      return res.status(400).json({ message: 'Reserve price must be greater than or equal to starting price' });
    }

    const seller = await User.findById(sellerId);
    const sellerName = seller?.name || seller?.email?.split('@')[0] || 'Seller';

    const now = new Date();
    const start = new Date(startTime || now);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({ message: 'Auction end time must be after start time' });
    }

    // Optional: Vision / Fraud check hint
    let aiFraudHint = null;
    try {
      if (allImages[0]) {
        const { checkDescriptionImageConsistency } = require('./fakeListingController');
        if (typeof checkDescriptionImageConsistency === 'function') {
          aiFraudHint = await checkDescriptionImageConsistency(allImages[0], title, description, category, condition);
        }
      }
    } catch (visionErr) {
      console.warn('Vision hint check skipped:', visionErr.message);
    }

    const auction = new Auction({
      productId: productId || undefined,
      sellerId,
      sellerName,
      title: title.trim(),
      description: description ? description.trim() : '',
      brand: brand.trim(),
      category: category || 'Designer Wear',
      condition: condition || 'Like New',
      size: size || '',
      purchaseYear: purchaseYear || '',
      declaredValue: val,
      image: allImages[0],
      images: allImages,
      proofDocs: proofs,
      verificationStatus: 'pending',
      verificationNote: '',
      aiFraudHint,
      startingPrice: startVal,
      currentPrice: startVal,
      reservePrice: resVal,
      incrementAmount: Number(incrementAmount) || 250,
      startTime: start,
      endTime: end,
      status: 'upcoming', // Starts upcoming and pending verification
      bids: [],
      totalBidders: 0
    });

    await auction.save();
    res.status(201).json(auction);
  } catch (err) {
    console.error('createAuction error:', err);
    res.status(500).json({ message: err.message || 'Server error creating auction' });
  }
}

// Get all verified auctions with optional status filter (proofDocs excluded)
async function getAuctions(req, res) {
  try {
    const { status } = req.query;
    // Public drops feed only shows verified auctions
    const query = { verificationStatus: 'verified' };
    if (status && status !== 'all') {
      if (status === 'live_or_ending') {
        query.status = { $in: ['live', 'ending'] };
      } else {
        query.status = status;
      }
    }

    const auctions = await Auction.find(query)
      .select('-proofDocs')
      .sort({ endTime: 1 });
    res.json(auctions);
  } catch (err) {
    console.error('getAuctions error:', err);
    res.status(500).json({ message: err.message || 'Server error fetching auctions' });
  }
}

// Get single auction with incremented viewCount (proofDocs hidden unless seller or admin)
async function getAuction(req, res) {
  try {
    const { id } = req.params;
    const auction = await Auction.findByIdAndUpdate(
      id,
      { $inc: { viewCount: 1 } },
      { new: true }
    );

    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const requester = await getOptionalUser(req);
    const isOwner = requester && auction.sellerId.toString() === requester._id.toString();
    const isAdmin = isUserAdmin(requester);

    const doc = auction.toObject();
    if (!isOwner && !isAdmin) {
      delete doc.proofDocs;
    }

    res.json(doc);
  } catch (err) {
    console.error('getAuction error:', err);
    res.status(500).json({ message: err.message || 'Server error fetching auction' });
  }
}

// Settle auction (called by scheduler or manual check)
async function settleAuction(auction) {
  try {
    if (!auction || (auction.status !== 'live' && auction.status !== 'ending')) return;

    // Determine highest winning bid
    const winningBid = auction.bids.find(b => b.isWinning) ||
      [...auction.bids].sort((a, b) => b.amount - a.amount)[0];

    if (winningBid && winningBid.amount >= (auction.reservePrice || 0)) {
      auction.status = 'settled';
      auction.winnerId = winningBid.bidderId;
      auction.winnerName = winningBid.bidderName;
      auction.winnerBid = winningBid.amount;
    } else {
      auction.status = 'closed'; // closed or reserve not met
    }

    await auction.save();

    // If linked to a product, update product status
    if (auction.productId && auction.status === 'settled') {
      await Product.findByIdAndUpdate(auction.productId, { listingType: 'sold' });
    }
  } catch (err) {
    console.error('settleAuction error:', err);
  }
}

// User created or bid on auctions
async function getMyAuctions(req, res) {
  try {
    const userId = req.userId;
    const auctions = await Auction.find({
      $or: [
        { sellerId: userId },
        { 'bids.bidderId': userId },
        { winnerId: userId }
      ]
    }).sort({ updatedAt: -1 });

    res.json(auctions);
  } catch (err) {
    console.error('getMyAuctions error:', err);
    res.status(500).json({ message: err.message || 'Server error fetching your auctions' });
  }
}

// ── Admin Verification Endpoints ────────────────────────────

// GET /auction/admin/pending — get all auctions pending verification or review
async function getAdminAuctions(req, res) {
  try {
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') {
      query.verificationStatus = status;
    }
    const auctions = await Auction.find(query).sort({ createdAt: -1 });
    res.json(auctions);
  } catch (err) {
    console.error('getAdminAuctions error:', err);
    res.status(500).json({ message: err.message || 'Server error fetching admin auctions' });
  }
}

// POST /auction/admin/:id/verify — approve or reject auction with note
async function verifyAuction(req, res) {
  try {
    const { id } = req.params;
    const { action, note } = req.body; // action: 'approve' | 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Action must be approve or reject' });
    }

    const auction = await Auction.findById(id);
    if (!auction) {
      return res.status(404).json({ message: 'Auction not found' });
    }

    const now = new Date();
    if (action === 'approve') {
      auction.verificationStatus = 'verified';
      auction.verificationNote = note || 'Verified authentic luxury designer drop';
      auction.verifiedAt = now;
      auction.verifiedBy = req.userId;

      // If scheduled start time is in the past, immediately activate it
      if (new Date(auction.startTime) <= now && new Date(auction.endTime) > now) {
        auction.status = 'live';
      } else if (new Date(auction.startTime) > now) {
        auction.status = 'upcoming';
      }
    } else {
      auction.verificationStatus = 'rejected';
      auction.verificationNote = note || 'Does not meet authenticity or document requirements';
      auction.status = 'cancelled';
    }

    await auction.save();
    res.json({ message: `Auction successfully ${auction.verificationStatus}`, auction });
  } catch (err) {
    console.error('verifyAuction error:', err);
    res.status(500).json({ message: err.message || 'Server error verifying auction' });
  }
}

module.exports = {
  placeBid,
  createAuction,
  getAuctions,
  getAuction,
  settleAuction,
  getMyAuctions,
  getAdminAuctions,
  verifyAuction
};
