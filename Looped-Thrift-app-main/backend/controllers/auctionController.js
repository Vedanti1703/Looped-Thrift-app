const Auction = require('../models/Auction');
const Product = require('../models/Product');
const User = require('../models/User');

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
        );

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

// Seller creates auction
async function createAuction(req, res) {
  try {
    const {
      productId,
      title,
      description,
      image,
      startingPrice,
      reservePrice,
      incrementAmount,
      startTime,
      endTime
    } = req.body;
    const sellerId = req.userId;

    const seller = await User.findById(sellerId);
    const sellerName = seller?.name || seller?.email?.split('@')[0] || 'Seller';

    const now = new Date();
    const start = new Date(startTime || now);
    const end = new Date(endTime);

    if (end <= start) {
      return res.status(400).json({ message: 'Auction end time must be after start time' });
    }

    let status = 'upcoming';
    if (start <= now && end > now) {
      status = 'live';
    }

    const auction = new Auction({
      productId: productId || undefined,
      sellerId,
      sellerName,
      title,
      description: description || '',
      image,
      startingPrice: Number(startingPrice) || 100,
      currentPrice: Number(startingPrice) || 100,
      reservePrice: Number(reservePrice) || 0,
      incrementAmount: Number(incrementAmount) || 50,
      startTime: start,
      endTime: end,
      status,
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

// Get all auctions with optional status filter
async function getAuctions(req, res) {
  try {
    const { status } = req.query;
    const query = {};
    if (status && status !== 'all') {
      if (status === 'live_or_ending') {
        query.status = { $in: ['live', 'ending'] };
      } else {
        query.status = status;
      }
    }

    const auctions = await Auction.find(query).sort({ endTime: 1 });
    res.json(auctions);
  } catch (err) {
    console.error('getAuctions error:', err);
    res.status(500).json({ message: err.message || 'Server error fetching auctions' });
  }
}

// Get single auction with incremented viewCount
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

    res.json(auction);
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

module.exports = {
  placeBid,
  createAuction,
  getAuctions,
  getAuction,
  settleAuction,
  getMyAuctions
};
