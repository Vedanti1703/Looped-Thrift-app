const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Rental = require('../models/Rental');
const Auction = require('../models/Auction');
const { getEmbedding } = require('../utils/embeddings');
const { rankProductsByTaste, buildUserTasteVector } = require('../services/recommendationService');
const { computeImageHash, checkPriceAnomaly } = require('../services/fraudService');

// GET /products — supports tag filtering & AI recommendations based on user right/left swipes
exports.getProducts = async (req, res) => {
  try {
    const { tags, category, condition, minPrice, maxPrice, search, userId, forSwipe } = req.query;
    let query = {};

    if (tags) query.tags = { $in: tags.split(',') };
    if (category) query.category = category;
    if (condition) query.condition = condition;
    if (search) query.title = { $regex: search, $options: 'i' };
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    let products = await Product.find(query).lean();

    if (userId) {
      let user = await User.findById(userId)
        .populate('likedItems', 'tags category brand price embedding updatedAt createdAt')
        .populate('dislikedItems', 'tags category brand price embedding updatedAt createdAt');

      if (user) {
        // If user taste vector is not yet built, build it from interactions
        if (!user.tasteVector || user.tasteVector.length === 0) {
          await buildUserTasteVector(user._id);
          user = await User.findById(userId)
            .populate('likedItems', 'tags category brand price embedding updatedAt createdAt')
            .populate('dislikedItems', 'tags category brand price embedding updatedAt createdAt');
        }

        products = rankProductsByTaste(products, user, {
          forSwipe: forSwipe === 'true' || forSwipe === true
        });
      }
    }

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /products/:id — also returns similar & complete-the-look
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id, { $inc: { views: 1 } }, { new: true }
    ).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Similar: share at least 1 tag, different product
    const similar = await Product.find({
      _id: { $ne: product._id },
      tags: { $in: product.tags }
    }).limit(6).lean();

    // Complete the look: different category
    const completeTheLook = await Product.find({
      _id: { $ne: product._id },
      category: { $ne: product.category }
    }).limit(6).lean();

    res.json({ product, similar, completeTheLook });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /products/search-visual — visual image search & CV photo analysis
exports.searchVisual = async (req, res) => {
  try {
    const { imageUrl, mode } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: 'imageUrl is required' });
    }

    const { searchByImage, analyseClothingPhoto } = require('../services/visualSearch');

    if (mode === 'analyse' || mode === 'quality') {
      const analysis = await analyseClothingPhoto(imageUrl);
      return res.json({
        success: true,
        ...analysis
      });
    }

    const result = await searchByImage(imageUrl);

    if (!result.success) {
      return res.status(400).json({ message: result.error || result.message || 'Visual search failed' });
    }

    res.json({
      success: true,
      description: result.description,
      products: result.products || []
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /products/search-natural — AI natural language search with semantic embedding + keyword fallback
exports.searchNatural = async (req, res) => {
  try {
    const { query, search, limit = 12 } = req.body;
    const cleanQuery = (query || search || '').trim();
    if (!cleanQuery) {
      return res.status(400).json({ message: 'query is required' });
    }

    const terms = cleanQuery.toLowerCase().split(/\s+/).filter(w => w.length > 1);
    let products = [];

    // ── Helper: robust keyword + tag search (always available) ──
    const keywordSearch = async () => {
      // Score-based in-memory search using title, tags, category, brand, description
      const allProds = await Product.find({}).lean();
      const scored = allProds.map(p => {
        let score = 0;
        const titleLower = (p.title || '').toLowerCase();
        const descLower  = (p.description || '').toLowerCase();
        const catLower   = (p.category || '').toLowerCase();
        const brandLower = (p.brand || '').toLowerCase();
        const pTags      = (p.tags || []).map(t => t.toLowerCase());

        for (const term of terms) {
          if (titleLower.includes(term))   score += 4;
          if (pTags.some(t => t.includes(term) || term.includes(t))) score += 3;
          if (catLower.includes(term))     score += 2;
          if (brandLower.includes(term))   score += 2;
          if (descLower.includes(term))    score += 1;
        }
        return { ...p, score };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.filter(p => p.score > 0).slice(0, Number(limit));
    };

    // ── Attempt: Semantic Vector Embedding Search ──
    let usedFallback = false;
    try {
      const queryVector = await getEmbedding(cleanQuery);

      // Try Atlas $vectorSearch first
      try {
        const vectorResults = await Product.aggregate([
          {
            $vectorSearch: {
              index: 'product_vector_index',
              path: 'embedding',
              queryVector,
              numCandidates: 100,
              limit: Number(limit),
            },
          },
          { $addFields: { score: { $meta: 'vectorSearchScore' } } },
        ]);
        if (vectorResults.length > 0) {
          products = vectorResults;
        } else {
          throw new Error('Atlas vector search returned 0 results — falling back');
        }
      } catch (atlasErr) {
        // Try in-memory cosine similarity
        const allProds = await Product.find({ embedding: { $exists: true, $ne: null } }).lean();
        if (allProds.length > 0) {
          const scored = allProds.map(p => {
            let score = 0;
            if (p.embedding && p.embedding.length === queryVector.length) {
              let dot = 0, normA = 0, normB = 0;
              for (let i = 0; i < queryVector.length; i++) {
                dot   += queryVector[i] * p.embedding[i];
                normA += queryVector[i] * queryVector[i];
                normB += p.embedding[i] * p.embedding[i];
              }
              if (normA > 0 && normB > 0) score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
            }
            return { ...p, score };
          });
          scored.sort((a, b) => b.score - a.score);
          products = scored.slice(0, Number(limit));
        }
        // If still empty, fall through to keyword search
        if (products.length === 0) {
          usedFallback = true;
          products = await keywordSearch();
        }
      }
    } catch (embErr) {
      console.warn('⚠️ Embedding unavailable, using keyword fallback:', embErr.message);
      usedFallback = true;
      products = await keywordSearch();
    }

    // Always ensure we return something via keyword search if everything above returned empty
    if (products.length === 0 && !usedFallback) {
      products = await keywordSearch();
    }

    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /products — seller uploads item
exports.createProduct = async (req, res) => {
  try {
    const { title, price, originalPrice, condition, category, tags, image, images, description, brand, size, sellerId, sellerName, itemMeasurements } = req.body;
    const parsedTags = typeof tags === 'string' ? tags.split(',').map(t => t.trim().toLowerCase()) : tags;

    // Generate embedding for newly created product (non-blocking fallback on failure)
    let embedding;
    try {
      const textParts = [
        title,
        description,
        category,
        Array.isArray(parsedTags) ? parsedTags.join(' ') : parsedTags,
        condition,
        brand,
      ].filter(Boolean);
      const textToEmbed = textParts.join(' ').trim();
      if (textToEmbed) {
        embedding = await getEmbedding(textToEmbed);
      }
    } catch (embErr) {
      console.warn('⚠️ Warning: Failed to generate embedding for new product (saving product without embedding):', embErr.message);
    }

    // Compute perceptual hash (pHash) for duplicate & stolen image detection
    let imageHash;
    const finalImage = image || (Array.isArray(images) && images.length > 0 ? images[0] : null) || `https://picsum.photos/seed/${Date.now()}/400/500`;
    try {
      const hashRes = await computeImageHash(finalImage);
      if (hashRes && hashRes.phash) {
        imageHash = hashRes.phash;
      }
    } catch (hashErr) {
      console.warn('⚠️ Perceptual hash generation notice:', hashErr.message);
    }

    // Evaluate Isolation Forest price anomaly
    let priceAnomalyData = { isAnomaly: false, anomalyScore: 0, anomalyType: 'normal' };
    try {
      const anomalyCheck = await checkPriceAnomaly({
        brand,
        category,
        condition,
        price: Number(price),
        originalPrice: originalPrice ? Number(originalPrice) : 0
      });
      priceAnomalyData = {
        isAnomaly: anomalyCheck.flag,
        anomalyScore: anomalyCheck.anomalyScore,
        anomalyType: anomalyCheck.anomalyType,
        predictedPrice: anomalyCheck.predictedPrice,
        priceRatio: anomalyCheck.priceRatio,
        severity: anomalyCheck.severity,
        reason: anomalyCheck.reason
      };
    } catch (anomErr) {
      console.warn('⚠️ Price anomaly evaluation notice:', anomErr.message);
    }

    const product = await Product.create({
      title,
      price: Number(price),
      originalPrice: originalPrice ? Number(originalPrice) : undefined,
      condition,
      category,
      tags: parsedTags,
      image: finalImage,
      images: images || [],
      description,
      brand,
      size,
      sellerId,
      sellerName,
      embedding,
      imageHash,
      priceAnomaly: priceAnomalyData,
      itemMeasurements: itemMeasurements || {}
    });

    // Track on user profile
    if (sellerId) {
      await User.findByIdAndUpdate(sellerId, { $push: { uploadedItems: product._id } });
    }

    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /products/seed — seed dummy data (dev only)
exports.seedProducts = async (req, res) => {
  try {
    await Product.deleteMany({});
    const insertedProducts = await Product.insertMany(dummyProducts);

    await Order.deleteMany({});
    await Rental.deleteMany({});

    // Phones to seed orders and rentals for
    const userPhones = ['+919372760976', '919372760976', '9372760976'];
    await User.deleteMany({
      $or: [
        { phone: { $in: [...userPhones, '+1234567890'] } },
        { email: { $in: [...userPhones.map(p => `testuser_${p.replace('+', 'plus')}@looped.app`), 'assistant@looped.app'] } }
      ]
    });

    let assistant = await User.create({
      email: 'assistant@looped.app',
      password: '$2a$10$NotRealPasswordUsedForLoopedAIAssistantToken12345',
      name: 'Looped AI',
      phone: '+1234567890',
      avatar: '🤖',
      isVerified: true
    });

    const rentProduct = insertedProducts.find(p => p.title === 'Zara Floral Chiffon Wrap Midi Dress') || insertedProducts[0];

    for (let idx = 0; idx < userPhones.length; idx++) {
      const phone = userPhones[idx];
      try {
        // Find or create user
        let user = await User.findOne({ phone });
        if (!user) {
          user = await User.create({
            email: `testuser_${phone.replace('+', 'plus')}@looped.app`,
            password: '$2a$10$NotRealPasswordUsedForLoopedAIAssistantToken12345',
            name: 'Test Customer',
            phone,
            isVerified: true
          });
        }


        // Create dummy rental
        await Rental.create({
          productId: rentProduct._id,
          productTitle: rentProduct.title,
          productImage: rentProduct.image,
          renterId: user._id,
          renterName: 'Test Customer',
          sellerId: assistant._id,
          sellerName: 'Tokyo Thrift',
          startDate: new Date(),
          endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          totalAmount: 1000,
          rentPricePerDay: 100,
          securityDeposit: 300,
          status: 'active'
        });

        // Create static tracked orders
        await Order.create({
          orderId: `LOOPED-ORD-12345${idx}`,
          name: 'Test Customer',
          phone,
          productName: 'Zara Checked Flannel Overshirt',
          size: 'L',
          color: 'Black/Red',
          quantity: 1,
          address: '123 Main St, New Delhi, India',
          totalAmount: 1100,
          status: 'Shipped',
          estimatedDelivery: 'Tomorrow, by 5:00 PM'
        });

        await Order.create({
          orderId: `LOOPED-ORD-78901${idx}`,
          name: 'Test Customer',
          phone,
          productName: 'Mango Linen Button-Front Shirt Dress',
          size: 'M',
          color: 'Olive',
          quantity: 1,
          address: '123 Main St, New Delhi, India',
          totalAmount: 1400,
          status: 'Pending',
          estimatedDelivery: '3-5 business days'
        });
      } catch (err) {
        console.error(`Error seeding data for phone ${phone}:`, err.message);
      }
    }

    // Seed sample auctions
    await Auction.deleteMany({});
    const now = new Date();
    await Auction.create([
      {
        title: 'Rare Vintage Y2K Chrome Hearts Leather Jacket',
        description: 'Authentic 2000s archival leather biker jacket with silver dagger hardware and silk lining.',
        image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=500&auto=format&fit=crop',
        startingPrice: 3500,
        currentPrice: 4200,
        reservePrice: 4000,
        incrementAmount: 100,
        startTime: new Date(now.getTime() - 2 * 60 * 60 * 1000), // started 2h ago
        endTime: new Date(now.getTime() + 2 * 60 * 60 * 1000),   // ends in 2 hours
        status: 'live',
        sellerId: assistant._id,
        sellerName: 'Looped Vintage Vault',
        totalBidders: 4,
        bids: [
          { bidderId: assistant._id, bidderName: 'Aarav M.', amount: 3700, timestamp: new Date(now.getTime() - 90 * 60 * 1000), isWinning: false },
          { bidderId: assistant._id, bidderName: 'Simran K.', amount: 3900, timestamp: new Date(now.getTime() - 60 * 60 * 1000), isWinning: false },
          { bidderId: assistant._id, bidderName: 'Dev R.', amount: 4100, timestamp: new Date(now.getTime() - 30 * 60 * 1000), isWinning: false },
          { bidderId: assistant._id, bidderName: 'Priya S.', amount: 4200, timestamp: new Date(now.getTime() - 10 * 60 * 1000), isWinning: true },
        ],
        declaredValue: 5000,
        condition: 'Like New',
        category: 'Designer Outerwear',
        brand: 'Chrome Hearts'
      },
      {
        title: 'Archival Vivienne Westwood Corset Top',
        description: 'Iconic vintage Renaissance tapestry print boned corset. Museum grade collector piece.',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=500&auto=format&fit=crop',
        startingPrice: 5000,
        currentPrice: 5000,
        reservePrice: 6000,
        incrementAmount: 150,
        startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000), // starts tomorrow
        endTime: new Date(now.getTime() + 48 * 60 * 60 * 1000),
        status: 'upcoming',
        sellerId: assistant._id,
        sellerName: 'Tokyo Archive',
        totalBidders: 0,
        bids: [],
        declaredValue: 7000,
        condition: 'Like New',
        category: 'Designer Wear',
        brand: 'Vivienne Westwood'
      },
      {
        title: 'Limited Edition Jacquemus Le Chiquito Mini Bag',
        description: 'Pastel pink micro leather bag with gold-tone signature hardware. Includes original box and dustbag.',
        image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&auto=format&fit=crop',
        startingPrice: 2000,
        currentPrice: 3100,
        reservePrice: 2800,
        incrementAmount: 100,
        startTime: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        endTime: new Date(now.getTime() + 20 * 60 * 1000), // ends in 20 minutes (ending soon)
        status: 'ending',
        sellerId: assistant._id,
        sellerName: 'Paris Thrift Club',
        totalBidders: 5,
        bids: [
          { bidderId: assistant._id, bidderName: 'Tanya P.', amount: 2200, timestamp: new Date(now.getTime() - 120 * 60 * 1000), isWinning: false },
          { bidderId: assistant._id, bidderName: 'Rohan V.', amount: 2500, timestamp: new Date(now.getTime() - 80 * 60 * 1000), isWinning: false },
          { bidderId: assistant._id, bidderName: 'Meera C.', amount: 2800, timestamp: new Date(now.getTime() - 45 * 60 * 1000), isWinning: false },
          { bidderId: assistant._id, bidderName: 'Ananya G.', amount: 3100, timestamp: new Date(now.getTime() - 15 * 60 * 1000), isWinning: true },
        ],
        declaredValue: 3500,
        condition: 'Good',
        category: 'Luxury Bags',
        brand: 'Jacquemus'
      }
    ]);

    res.json({ message: `Seeded ${insertedProducts.length} products, 2 orders, 1 rental, and 3 auctions.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 50 realistic products across 5 curated fashion categories (10 per category)
const dummyProducts = [
  // ==========================================
  // Category 1: Women's Crop Tops (10 items)
  // ==========================================
  {
    title: 'Zara Ribbed Knit Halter Crop Top',
    price: 650,
    originalPrice: 1590,
    condition: 'Like New',
    category: "Women's Crop Tops",
    tags: ['casual', 'summer', 'rib-knit', 'zara', 'minimalist', 'crop top', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&h=500&fit=crop',
    sellerName: 'Priya M.',
    brand: 'Zara',
    size: 'S',
    description: 'Soft yellow ribbed knit halter top in flawless condition. Perfect for summer outings with zero stretch or pilling.',
    views: 142,
    likes: 58
  },
  {
    title: 'H&M Cotton Corset Style Crop Top',
    price: 450,
    originalPrice: 1299,
    condition: 'Good',
    category: "Women's Crop Tops",
    tags: ['corset', 'cotton', 'h&m', 'casual', 'y2k', 'crop top', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=400&h=500&fit=crop',
    sellerName: 'Riya S.',
    brand: 'H&M',
    size: 'M',
    description: 'Cute structured cotton crop top with boning detail. Worn a few times, gentle wash wear but no stains or rips.',
    views: 98,
    likes: 36
  },
  {
    title: 'Urbanic Crochet Boho Crop Top',
    price: 550,
    originalPrice: 1490,
    condition: 'Like New',
    category: "Women's Crop Tops",
    tags: ['crochet', 'boho', 'urbanic', 'summer', 'knit', 'crop top', 'festive'],
    image: 'https://images.unsplash.com/photo-1534126511673-b6899657816a?w=400&h=500&fit=crop',
    sellerName: 'Ananya G.',
    brand: 'Urbanic',
    size: 'S',
    description: 'Handmade-style crochet knit crop top with scalloped hem. Only worn once for a beach photoshoot.',
    views: 115,
    likes: 49
  },
  {
    title: 'Forever 21 Floral Smocked Cami Top',
    price: 380,
    originalPrice: 1199,
    condition: 'Good',
    category: "Women's Crop Tops",
    tags: ['floral', 'smocked', 'forever21', 'summer', 'chiffon', 'crop top', 'casual'],
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?w=400&h=500&fit=crop',
    sellerName: 'Tanvi D.',
    brand: 'Forever 21',
    size: 'XS',
    description: 'Ditsy floral print cami with stretchy smocked bodice and tie straps. Very light color fade around inner seam.',
    views: 76,
    likes: 24
  },
  {
    title: 'Mango Linen Wrap Crop Blouse',
    price: 850,
    originalPrice: 2290,
    condition: 'Like New',
    category: "Women's Crop Tops",
    tags: ['linen', 'wrap', 'mango', 'minimalist', 'summer', 'crop top', 'japan'],
    image: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=500&fit=crop',
    sellerName: 'Sneha P.',
    brand: 'Mango',
    size: 'M',
    description: 'Pure breathable linen wrap top with self-tie waist. Worn twice, crisp texture and intact stitch lines.',
    views: 165,
    likes: 71
  },
  {
    title: 'Nike Pro Dri-FIT Athletic Crop Top',
    price: 900,
    originalPrice: 2495,
    condition: 'New with tags',
    category: "Women's Crop Tops",
    tags: ['athleisure', 'sports', 'nike', 'dri-fit', 'crop top', 'streetwear', 'gym'],
    image: 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?w=400&h=500&fit=crop',
    sellerName: 'Kavya N.',
    brand: 'Nike',
    size: 'S',
    description: 'Brand new Nike Pro performance crop top with original price tags attached. Moisture-wicking compression fit.',
    views: 180,
    likes: 65
  },
  {
    title: 'Zara Square-Neck Long Sleeve Crop Top',
    price: 720,
    originalPrice: 1790,
    condition: 'Like New',
    category: "Women's Crop Tops",
    tags: ['square-neck', 'zara', 'winter', 'knit', 'chic', 'crop top', 'party'],
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop',
    sellerName: 'Pooja R.',
    brand: 'Zara',
    size: 'L',
    description: 'Flattering deep square neckline top with fitted long sleeves. Premium stretch fabric with no visible signs of wear.',
    views: 88,
    likes: 32
  },
  {
    title: 'Vero Moda Puff Sleeve Floral Top',
    price: 490,
    originalPrice: 1699,
    condition: 'Good',
    category: "Women's Crop Tops",
    tags: ['puff-sleeve', 'floral', 'vero moda', 'casual', 'cotton', 'crop top', 'jaipur'],
    image: 'https://images.unsplash.com/photo-1516762689617-e1cffcef479d?w=400&h=500&fit=crop',
    sellerName: 'Neha T.',
    brand: 'Vero Moda',
    size: 'M',
    description: 'Charming floral print blouse with elasticated puff sleeves. Minor elasticity wear on one shoulder, looks great on.',
    views: 63,
    likes: 19
  },
  {
    title: 'ONLY Satin Cowl Neck Crop Top',
    price: 580,
    originalPrice: 1599,
    condition: 'Like New',
    category: "Women's Crop Tops",
    tags: ['satin', 'cowl-neck', 'only', 'party', 'y2k', 'crop top', 'night-out'],
    image: 'https://images.unsplash.com/photo-1551803091-e20673f15770?w=400&h=500&fit=crop',
    sellerName: 'Diya K.',
    brand: 'ONLY',
    size: 'S',
    description: 'Glossy emerald green satin top featuring an elegant draped cowl neck and adjustable cross-back straps.',
    views: 134,
    likes: 52
  },
  {
    title: 'Urbanic Ruched Front Linen Top',
    price: 620,
    originalPrice: 1690,
    condition: 'New with tags',
    category: "Women's Crop Tops",
    tags: ['linen', 'ruched', 'urbanic', 'summer', 'casual', 'crop top', 'vintage'],
    image: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=400&h=500&fit=crop',
    sellerName: 'Tara K.',
    brand: 'Urbanic',
    size: 'XS',
    description: 'Freshly unboxed with tags intact. Features front drawstring ruching for customizable crop length.',
    views: 105,
    likes: 41
  },

  // ==========================================
  // Category 2: Women's Dresses (10 items)
  // ==========================================
  {
    title: 'Zara Floral Chiffon Wrap Midi Dress',
    price: 1200,
    originalPrice: 3990,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['floral', 'wrap', 'chiffon', 'zara', 'summer', 'dress', 'boho'],
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=400&h=500&fit=crop',
    sellerName: 'Priya M.',
    brand: 'Zara',
    size: 'M',
    description: 'Flowy chiffon midi dress with delicate floral prints and an adjustable waist tie. Worn once for a brunch.',
    views: 178,
    likes: 74
  },
  {
    title: 'H&M Satin Cowl Slip Dress',
    price: 850,
    originalPrice: 2299,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['satin', 'slip', 'h&m', 'party', 'y2k', 'dress', 'minimalist'],
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=400&h=500&fit=crop',
    sellerName: 'Ananya S.',
    brand: 'H&M',
    size: 'S',
    description: 'Champagne gold satin slip dress with cowl neck. Beautiful silky drape with zero flaws or thread pulls.',
    views: 152,
    likes: 63
  },
  {
    title: 'AND Bohemian Tiered Maxi Dress',
    price: 950,
    originalPrice: 2999,
    condition: 'Good',
    category: "Women's Dresses",
    tags: ['maxi', 'bohemian', 'and', 'cotton', 'summer', 'dress', 'jaipur'],
    image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=400&h=500&fit=crop',
    sellerName: 'Meera G.',
    brand: 'AND',
    size: 'L',
    description: 'Crimson tiered maxi dress with tassel neck ties. Light wash softening on fabric, overall excellent condition.',
    views: 92,
    likes: 38
  },
  {
    title: 'Mango Linen Button-Front Shirt Dress',
    price: 1400,
    originalPrice: 4590,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['linen', 'shirt-dress', 'mango', 'minimalist', 'formal', 'dress', 'japan'],
    image: 'https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?w=400&h=500&fit=crop',
    sellerName: 'Ritu V.',
    brand: 'Mango',
    size: 'M',
    description: 'Classic olive linen shirt dress with wooden buttons and detachable fabric belt. Immaculate condition.',
    views: 140,
    likes: 55
  },
  {
    title: 'FabIndia Hand-Block Print Anarkali Dress',
    price: 1600,
    originalPrice: 4290,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['anarkali', 'block-print', 'fabindia', 'cotton', 'traditional', 'jaipur', 'wedding'],
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=500&fit=crop',
    sellerName: 'Sneha P.',
    brand: 'FabIndia',
    size: 'S',
    description: 'Pure mulmul cotton flared dress with Bagru block print borders. Gorgeous festive drape with zero defects.',
    views: 195,
    likes: 79
  },
  {
    title: 'Forever 21 Ribbed Knit Bodycon Dress',
    price: 600,
    originalPrice: 1899,
    condition: 'Good',
    category: "Women's Dresses",
    tags: ['bodycon', 'knit', 'forever21', 'casual', 'winter', 'dress', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=400&h=500&fit=crop',
    sellerName: 'Riya S.',
    brand: 'Forever 21',
    size: 'S',
    description: 'Thick ribbed midi dress with side slit. Moderate wear on fabric, still holds flattering shape nicely.',
    views: 84,
    likes: 30
  },
  {
    title: 'Biba Embroidered Festive Kurta Dress',
    price: 1350,
    originalPrice: 3799,
    condition: 'Good',
    category: "Women's Dresses",
    tags: ['embroidered', 'festive', 'biba', 'silk-blend', 'traditional', 'jaipur', 'dress'],
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=400&h=500&fit=crop',
    sellerName: 'Sunita B.',
    brand: 'Biba',
    size: 'XL',
    description: 'Teal silk-blend flared dress with golden thread embroidery along the yoke. Slight fray on one tassel string.',
    views: 110,
    likes: 42
  },
  {
    title: 'ONLY Tiered Pastel Smocked Dress',
    price: 750,
    originalPrice: 2199,
    condition: 'Good',
    category: "Women's Dresses",
    tags: ['pastel', 'tiered', 'only', 'cotton', 'summer', 'dress', 'cottagecore'],
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=500&fit=crop',
    sellerName: 'Kavya L.',
    brand: 'ONLY',
    size: 'XS',
    description: 'Breezy lilac tiered dress with stretchy smocked back. Soft washed cotton feel with all stitches secure.',
    views: 73,
    likes: 27
  },
  {
    title: 'Marks & Spencer Little Black Cocktail Dress',
    price: 1800,
    originalPrice: 4999,
    condition: 'New with tags',
    category: "Women's Dresses",
    tags: ['cocktail', 'lbd', 'marks & spencer', 'crepe', 'formal', 'party', 'dress'],
    image: 'https://images.unsplash.com/photo-1612336307429-8a898d10e223?w=400&h=500&fit=crop',
    sellerName: 'Tara K.',
    brand: 'Marks & Spencer',
    size: 'M',
    description: 'Never worn M&S structured crepe shift dress with original brand tags. Pristine luxury silhouette.',
    views: 162,
    likes: 68
  },
  {
    title: 'Vero Moda Floral A-Line Sundress',
    price: 890,
    originalPrice: 2599,
    condition: 'New with tags',
    category: "Women's Dresses",
    tags: ['sundress', 'floral', 'vero moda', 'viscose', 'summer', 'dress', 'casual'],
    image: 'https://images.unsplash.com/photo-1502716119720-b23a93e5fe1b?w=400&h=500&fit=crop',
    sellerName: 'Tanvi D.',
    brand: 'Vero Moda',
    size: 'L',
    description: 'Sunshine yellow daisy print dress with sweet neckline. Brand new with tags attached, never used.',
    views: 128,
    likes: 51
  },

  // ==========================================
  // Category 3: Women's T-Shirts (10 items)
  // ==========================================
  {
    title: 'Uniqlo Supima Cotton Crewneck Tee',
    price: 450,
    originalPrice: 1290,
    condition: 'Like New',
    category: "Women's T-Shirts",
    tags: ['supima', 'cotton', 'uniqlo', 'minimalist', 'japan', 'basics', 'casual'],
    image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=400&h=500&fit=crop',
    sellerName: 'Priya M.',
    brand: 'Uniqlo',
    size: 'M',
    description: 'Silky smooth 100% Supima cotton basic white tee. Only washed once on delicate cycle, zero yellowing.',
    views: 132,
    likes: 48
  },
  {
    title: 'H&M Oversized Graphic Band Tee',
    price: 400,
    originalPrice: 1499,
    condition: 'Good',
    category: "Women's T-Shirts",
    tags: ['oversized', 'graphic', 'h&m', 'vintage', 'streetwear', 'grunge', 'cotton'],
    image: 'https://images.unsplash.com/photo-1503342394128-c104d54dba01?w=400&h=500&fit=crop',
    sellerName: 'Riya S.',
    brand: 'H&M',
    size: 'L',
    description: 'Relaxed drop-shoulder rock graphic tee in charcoal grey. Cool vintage washed finish with minor collar fade.',
    views: 145,
    likes: 59
  },
  {
    title: 'Zara Heavyweight Boxy T-Shirt',
    price: 550,
    originalPrice: 1590,
    condition: 'Like New',
    category: "Women's T-Shirts",
    tags: ['boxy', 'heavyweight', 'zara', 'streetwear', 'cotton', 'casual', 'minimalist'],
    image: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=400&h=500&fit=crop',
    sellerName: 'Ananya G.',
    brand: 'Zara',
    size: 'S',
    description: 'Thick structured cotton tee with cropped boxy cut. Retains rich jet-black color and crisp neckline.',
    views: 112,
    likes: 44
  },
  {
    title: "Levi's Classic Batwing Logo Tee",
    price: 480,
    originalPrice: 1399,
    condition: 'Good',
    category: "Women's T-Shirts",
    tags: ['logo', 'classic', 'levi\'s', 'denim-vibe', 'cotton', 'casual', '90s'],
    image: 'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=500&fit=crop',
    sellerName: 'Kavya N.',
    brand: "Levi's",
    size: 'M',
    description: 'Signature red batwing print on crisp white cotton. Slight cracking on screen print from regular wear.',
    views: 89,
    likes: 33
  },
  {
    title: 'FabIndia Indigo Handblock T-Shirt',
    price: 620,
    originalPrice: 1590,
    condition: 'Like New',
    category: "Women's T-Shirts",
    tags: ['indigo', 'block-print', 'fabindia', 'organic-cotton', 'jaipur', 'boho', 'artisan'],
    image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400&h=500&fit=crop',
    sellerName: 'Sneha P.',
    brand: 'FabIndia',
    size: 'M',
    description: 'Artisanal dabu indigo dyed t-shirt made of organic slub cotton. Washed with herbal detergent, no color bleeding.',
    views: 168,
    likes: 62
  },
  {
    title: 'Mango Striped Breton Sailor Tee',
    price: 500,
    originalPrice: 1790,
    condition: 'Good',
    category: "Women's T-Shirts",
    tags: ['striped', 'breton', 'mango', 'cotton', 'french-chic', 'classic', 'casual'],
    image: 'https://images.unsplash.com/photo-1527719327859-c6ce80353573?w=400&h=500&fit=crop',
    sellerName: 'Pooja R.',
    brand: 'Mango',
    size: 'S',
    description: 'Navy and white nautical striped boatneck t-shirt. Soft cotton feel with very minor linting near underarms.',
    views: 77,
    likes: 26
  },
  {
    title: 'ONLY Distressed Washed Cotton Tee',
    price: 350,
    originalPrice: 1199,
    condition: 'Good',
    category: "Women's T-Shirts",
    tags: ['washed', 'distressed', 'only', 'casual', 'cotton', 'summer', 'y2k'],
    image: 'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=400&h=500&fit=crop',
    sellerName: 'Neha T.',
    brand: 'ONLY',
    size: 'XS',
    description: 'Vintage washed olive green relaxed tee with raw cut hem. Worn multiple times but clean and comfortable.',
    views: 65,
    likes: 18
  },
  {
    title: 'Urbanic Ribbed Mock Neck Top',
    price: 520,
    originalPrice: 1390,
    condition: 'Like New',
    category: "Women's T-Shirts",
    tags: ['mock-neck', 'rib-knit', 'urbanic', 'winter', 'chic', 'minimalist', 'london'],
    image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400&h=500&fit=crop',
    sellerName: 'Diya K.',
    brand: 'Urbanic',
    size: 'S',
    description: 'Fitted ribbed half-sleeve tee with high neck collar. Flawless elastic recovery and zero fuzzing.',
    views: 120,
    likes: 47
  },
  {
    title: 'Nike Sportswear Essential Tee',
    price: 750,
    originalPrice: 1995,
    condition: 'New with tags',
    category: "Women's T-Shirts",
    tags: ['athleisure', 'swoosh', 'nike', 'cotton', 'streetwear', 'casual', 'sportswear'],
    image: 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?w=400&h=500&fit=crop',
    sellerName: 'Tanvi D.',
    brand: 'Nike',
    size: 'L',
    description: 'Authentic Nike boyfriend-fit tee featuring embroidered mini swoosh. Brand new with tag attached.',
    views: 155,
    likes: 67
  },
  {
    title: 'Forever 21 Pastel Tie-Dye Oversized Tee',
    price: 490,
    originalPrice: 1299,
    condition: 'New with tags',
    category: "Women's T-Shirts",
    tags: ['tie-dye', 'pastel', 'forever21', 'oversized', 'y2k', 'summer', 'kawaii'],
    image: 'https://images.unsplash.com/photo-1508427953056-b00b8d78ebf5?w=400&h=500&fit=crop',
    sellerName: 'Tara K.',
    brand: 'Forever 21',
    size: 'XL',
    description: 'Soft pastel pink and lavender spiral tie-dye tee. Unworn deadstock piece with original tags.',
    views: 96,
    likes: 39
  },

  // ==========================================
  // Category 4: Men's Shirts (10 items)
  // ==========================================
  {
    title: 'Zara Checked Flannel Overshirt',
    price: 1100,
    originalPrice: 3590,
    condition: 'Like New',
    category: "Men's Shirts",
    tags: ['flannel', 'checked', 'zara', 'overshirt', 'winter', 'streetwear', 'grunge'],
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop',
    sellerName: 'Rohan M.',
    brand: 'Zara',
    size: 'L',
    description: 'Thick brushed cotton buffalo check flannel with dual chest pockets. Cozy winter layer with no pilling.',
    views: 145,
    likes: 54
  },
  {
    title: 'H&M Plaid Relaxed Flannel Shirt',
    price: 650,
    originalPrice: 1999,
    condition: 'Good',
    category: "Men's Shirts",
    tags: ['plaid', 'flannel', 'h&m', 'casual', 'cotton', 'winter', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400&h=500&fit=crop',
    sellerName: 'Aarav S.',
    brand: 'H&M',
    size: 'M',
    description: 'Classic red and navy plaid button-down. Gentle softening from laundering, all original buttons intact.',
    views: 108,
    likes: 37
  },
  {
    title: 'Uniqlo Premium Linen Long Sleeve Shirt',
    price: 950,
    originalPrice: 2990,
    condition: 'Like New',
    category: "Men's Shirts",
    tags: ['linen', 'french-linen', 'uniqlo', 'summer', 'minimalist', 'japan', 'resort'],
    image: 'https://images.unsplash.com/photo-1603252109303-2751441dd157?w=400&h=500&fit=crop',
    sellerName: 'Kabir D.',
    brand: 'Uniqlo',
    size: 'M',
    description: '100% premium French linen in crisp beige tone. Exceptionally breathable, worn once to an outdoor event.',
    views: 172,
    likes: 66
  },
  {
    title: 'Marks & Spencer Oxford Cotton Formal Shirt',
    price: 900,
    originalPrice: 2799,
    condition: 'Good',
    category: "Men's Shirts",
    tags: ['oxford', 'formal', 'marks & spencer', 'cotton', 'office', 'london', 'classic'],
    image: 'https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=400&h=500&fit=crop',
    sellerName: 'Neil J.',
    brand: 'Marks & Spencer',
    size: 'L',
    description: 'Sky blue pinpoint Oxford shirt with button-down collar. Minor crease near lower hem, presses out crisp.',
    views: 81,
    likes: 25
  },
  {
    title: "Levi's Western Denim Snap-Button Shirt",
    price: 1350,
    originalPrice: 3999,
    condition: 'Like New',
    category: "Men's Shirts",
    tags: ['western', 'denim', 'levi\'s', 'pearl-snap', 'vintage', 'casual', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=400&h=500&fit=crop',
    sellerName: 'Aditya V.',
    brand: "Levi's",
    size: 'XL',
    description: 'Mid-wash sturdy denim western shirt with authentic pearlized snap buttons and pointed yoke detailing.',
    views: 190,
    likes: 77
  },
  {
    title: 'FabIndia Handspun Khadi Cotton Shirt',
    price: 750,
    originalPrice: 2190,
    condition: 'Like New',
    category: "Men's Shirts",
    tags: ['khadi', 'handspun', 'fabindia', 'cotton', 'jaipur', 'ethnic', 'sustainable'],
    image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?w=400&h=500&fit=crop',
    sellerName: 'Vikram S.',
    brand: 'FabIndia',
    size: 'M',
    description: 'Natural ecru hand-loomed khadi short kurta shirt with mandarin collar and coconut shell buttons.',
    views: 116,
    likes: 41
  },
  {
    title: 'Tommy Hilfiger Classic Striped Poplin Shirt',
    price: 1450,
    originalPrice: 4999,
    condition: 'Good',
    category: "Men's Shirts",
    tags: ['striped', 'poplin', 'tommy hilfiger', 'preppy', 'formal', 'cotton', 'smart'],
    image: 'https://images.unsplash.com/photo-1563630423918-b58f07336ac9?w=400&h=500&fit=crop',
    sellerName: 'Ishaan G.',
    brand: 'Tommy Hilfiger',
    size: 'L',
    description: 'Bengal stripe poplin shirt with iconic chest flag embroidery. Tiny fabric wear on inside of collar cuff.',
    views: 138,
    likes: 49
  },
  {
    title: 'Zara Resort Printed Cuban Collar Shirt',
    price: 820,
    originalPrice: 2590,
    condition: 'Good',
    category: "Men's Shirts",
    tags: ['cuban-collar', 'resort', 'zara', 'viscose', 'summer', 'tropical', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1578932750294-f5075e85f44a?w=400&h=500&fit=crop',
    sellerName: 'Dev K.',
    brand: 'Zara',
    size: 'S',
    description: 'Silky drape camp collar shirt with abstract foliage motifs. Very soft and breezy, worn on one vacation.',
    views: 95,
    likes: 33
  },
  {
    title: 'H&M Military Utility Pocket Overshirt',
    price: 880,
    originalPrice: 2499,
    condition: 'New with tags',
    category: "Men's Shirts",
    tags: ['utility', 'military', 'h&m', 'cargo', 'twill', 'streetwear', 'casual'],
    image: 'https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?w=400&h=500&fit=crop',
    sellerName: 'Rohan M.',
    brand: 'H&M',
    size: 'L',
    description: 'Olive green heavy cotton twill shirt jacket with flap cargo chest pockets. New with tags still attached.',
    views: 150,
    likes: 60
  },
  {
    title: 'Uniqlo Broadcloth Slim Fit Dress Shirt',
    price: 800,
    originalPrice: 2490,
    condition: 'New with tags',
    category: "Men's Shirts",
    tags: ['broadcloth', 'slim-fit', 'uniqlo', 'formal', 'japan', 'cotton', 'office'],
    image: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&h=500&fit=crop',
    sellerName: 'Kabir D.',
    brand: 'Uniqlo',
    size: 'M',
    description: 'Unopened in store packaging. Easy-care fine broadcloth white formal shirt with structured spread collar.',
    views: 122,
    likes: 45
  },

  // ==========================================
  // Category 5: Women's/Men's Bottoms (10 items)
  // ==========================================
  {
    title: "Levi's 501 Original Straight Leg Jeans",
    price: 1600,
    originalPrice: 4599,
    condition: 'Like New',
    category: "Women's/Men's Bottoms",
    tags: ['501', 'straight-leg', 'levi\'s', 'denim', 'vintage', 'classic', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop',
    sellerName: 'Aditya V.',
    brand: "Levi's",
    size: '32',
    description: "Iconic Levi's 501 button fly jeans in medium indigo wash. Sturdy 100% heavyweight cotton with no fraying.",
    views: 198,
    likes: 80
  },
  {
    title: 'Zara High-Waisted Wide Leg Tailored Trousers',
    price: 1150,
    originalPrice: 3290,
    condition: 'Like New',
    category: "Women's/Men's Bottoms",
    tags: ['wide-leg', 'tailored', 'zara', 'crepe', 'formal', 'minimalist', 'london'],
    image: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400&h=500&fit=crop',
    sellerName: 'Priya M.',
    brand: 'Zara',
    size: '28',
    description: 'Fluid pleated wide-leg trousers in camel beige with high-rise waist and belt loops. Perfect condition.',
    views: 164,
    likes: 70
  },
  {
    title: 'H&M High-Waist Vintage Mom Jeans',
    price: 750,
    originalPrice: 2299,
    condition: 'Good',
    category: "Women's/Men's Bottoms",
    tags: ['mom-jeans', 'high-waist', 'h&m', 'denim', '90s', 'casual', 'vintage'],
    image: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=400&h=500&fit=crop',
    sellerName: 'Riya S.',
    brand: 'H&M',
    size: '26',
    description: 'Light blue stonewash tapered mom jeans. Authentic vintage feel with slight softening around knees.',
    views: 130,
    likes: 52
  },
  {
    title: 'Mango Pleated Satin Midi Skirt',
    price: 950,
    originalPrice: 2990,
    condition: 'Like New',
    category: "Women's/Men's Bottoms",
    tags: ['pleated', 'satin', 'mango', 'midi-skirt', 'elegant', 'party', 'jaipur'],
    image: 'https://images.unsplash.com/photo-1584370848010-d7fe6bc767ec?w=400&h=500&fit=crop',
    sellerName: 'Sneha P.',
    brand: 'Mango',
    size: 'S',
    description: 'Champagne sunburst pleated satin skirt with elasticated waist. Elegant motion when walking, zero stains.',
    views: 142,
    likes: 61
  },
  {
    title: "Levi's High-Rise Distressed Denim Shorts",
    price: 650,
    originalPrice: 2199,
    condition: 'Good',
    category: "Women's/Men's Bottoms",
    tags: ['shorts', 'distressed', 'levi\'s', 'denim', 'summer', 'casual', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=400&h=500&fit=crop',
    sellerName: 'Tanvi D.',
    brand: "Levi's",
    size: '28',
    description: 'Cut-off vintage denim shorts with raw frayed hem and authentic distressing. Sturdy rigid denim.',
    views: 115,
    likes: 43
  },
  {
    title: 'Uniqlo Smart Ankle Pants Trousers',
    price: 850,
    originalPrice: 2990,
    condition: 'Like New',
    category: "Women's/Men's Bottoms",
    tags: ['ankle-pants', '2-way-stretch', 'uniqlo', 'formal', 'japan', 'minimalist', 'office'],
    image: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=400&h=500&fit=crop',
    sellerName: 'Neil J.',
    brand: 'Uniqlo',
    size: '32',
    description: 'Charcoal grey 2-way stretch tailored ankle pants with hidden elastic waist. Wrinkle-resistant and spotless.',
    views: 158,
    likes: 57
  },
  {
    title: 'ONLY A-Line Buttoned Denim Mini Skirt',
    price: 500,
    originalPrice: 1699,
    condition: 'Good',
    category: "Women's/Men's Bottoms",
    tags: ['denim-skirt', 'a-line', 'only', 'y2k', 'summer', 'casual', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1551854838-212c50b4c184?w=400&h=500&fit=crop',
    sellerName: 'Kavya N.',
    brand: 'ONLY',
    size: 'XS',
    description: 'Mid-rise dark blue denim mini skirt with front metal buttons. Very minor fading near waistband, looks chic.',
    views: 88,
    likes: 31
  },
  {
    title: 'Nike Club Fleece Cargo Joggers',
    price: 980,
    originalPrice: 2795,
    condition: 'Good',
    category: "Women's/Men's Bottoms",
    tags: ['cargo', 'joggers', 'nike', 'fleece', 'athleisure', 'winter', 'streetwear'],
    image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=400&h=500&fit=crop',
    sellerName: 'Ishaan G.',
    brand: 'Nike',
    size: 'L',
    description: 'Heather grey brushed fleece cargo sweatpants with ribbed cuffs and utility pockets. Lightly worn and super soft.',
    views: 170,
    likes: 64
  },
  {
    title: 'Zara Relaxed Boyfriend Fit Jeans',
    price: 1200,
    originalPrice: 3590,
    condition: 'New with tags',
    category: "Women's/Men's Bottoms",
    tags: ['boyfriend-jeans', 'relaxed', 'zara', 'denim', 'casual', 'streetwear', 'y2k'],
    image: 'https://images.unsplash.com/photo-1475178626620-a4d074967452?w=400&h=500&fit=crop',
    sellerName: 'Ananya G.',
    brand: 'Zara',
    size: '30',
    description: 'Slouchy mid-rise boyfriend denim with raw cuffs. Never worn, comes with brand tag attached.',
    views: 144,
    likes: 56
  },
  {
    title: 'FabIndia Indigo Cotton Tiered Maxi Skirt',
    price: 890,
    originalPrice: 2490,
    condition: 'New with tags',
    category: "Women's/Men's Bottoms",
    tags: ['maxi-skirt', 'indigo', 'fabindia', 'cotton', 'jaipur', 'boho', 'ethnic'],
    image: 'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=400&h=500&fit=crop',
    sellerName: 'Sunita B.',
    brand: 'FabIndia',
    size: 'Free',
    description: 'Flared tiered bohemian skirt crafted with genuine hand-block indigo print. Unused with original shop tag.',
    views: 136,
    likes: 59
  },

  // ==========================================
  // PART 2: Evening Gowns & Formal Dresses (10 items)
  // ==========================================
  {
    title: 'Sabyasachi Champagne Tissue Organza Gown',
    price: 18000,
    originalPrice: 55000,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['gown', 'bridal', 'sabyasachi', 'champagne', 'luxury', 'festive'],
    image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=600&h=700&fit=crop',
    sellerName: 'Ananya R.',
    brand: 'Sabyasachi',
    size: 'S',
    description: 'Ethereal champagne tissue organza gown with hand-embroidered floral motifs and sweeping train. Worn once at a wedding reception.',
    views: 320,
    likes: 145
  },
  {
    title: 'Manish Malhotra Ivory Embroidered Cape Gown',
    price: 22000,
    originalPrice: 68000,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['gown', 'cape', 'embroidered', 'manish-malhotra', 'ivory', 'bridal'],
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&h=700&fit=crop',
    sellerName: 'Priya S.',
    brand: 'Manish Malhotra',
    size: 'M',
    description: 'Stunning ivory silk base gown with fully embroidered cape overlay. Perfect for cocktail dinners and receptions.',
    views: 280,
    likes: 132
  },
  {
    title: 'Anita Dongre Forest Green Lehenga Gown',
    price: 8500,
    originalPrice: 24000,
    condition: 'Good',
    category: "Women's Traditional",
    tags: ['gown', 'lehenga', 'anita-dongre', 'green', 'festive', 'wedding'],
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&h=700&fit=crop',
    sellerName: 'Meera K.',
    brand: 'Anita Dongre',
    size: 'S',
    description: 'Forest green floral lehenga-gown hybrid with delicate hand-painted blossoms and flared hemline. Festive and regal.',
    views: 195,
    likes: 88
  },
  {
    title: 'Zara Midnight Blue Satin Slip Gown',
    price: 1200,
    originalPrice: 4500,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['gown', 'satin', 'zara', 'blue', 'evening', 'formal'],
    image: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600&h=700&fit=crop',
    sellerName: 'Riya T.',
    brand: 'Zara',
    size: 'S',
    description: 'Midnight blue bias-cut satin slip gown with thin straps and side slit. Minimal and chic for evenings.',
    views: 165,
    likes: 72
  },
  {
    title: 'H&M Emerald Green Maxi Evening Gown',
    price: 900,
    originalPrice: 2999,
    condition: 'Good',
    category: "Women's Dresses",
    tags: ['gown', 'maxi', 'hm', 'green', 'evening', 'formal'],
    image: 'https://images.unsplash.com/photo-1558171813-0c399994b5fd?w=600&h=700&fit=crop',
    sellerName: 'Sneha P.',
    brand: 'H&M',
    size: 'M',
    description: 'Floor-length emerald green chiffon gown with flutter sleeves and self-tie belt. Elegant for formal occasions.',
    views: 128,
    likes: 54
  },
  {
    title: 'Mango Black Off-Shoulder Ruched Gown',
    price: 2200,
    originalPrice: 7500,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['gown', 'black', 'mango', 'off-shoulder', 'cocktail', 'evening'],
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=700&fit=crop',
    sellerName: 'Divya M.',
    brand: 'Mango',
    size: 'XS',
    description: 'Body-hugging ruched black gown with off-shoulder neckline and thigh-high slit. Statement cocktail look.',
    views: 210,
    likes: 96
  },
  {
    title: 'And. by Anita Dongre Blush Pink Flowy Gown',
    price: 3500,
    originalPrice: 9800,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['gown', 'blush', 'pink', 'and', 'flowy', 'wedding-guest'],
    image: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&h=700&fit=crop',
    sellerName: 'Kavya L.',
    brand: 'And.',
    size: 'S',
    description: 'Blush pink georgette flowy gown with flutter sleeves and floral embroidery at bodice. Worn once.',
    views: 174,
    likes: 79
  },
  {
    title: 'Forever21 Red Halter Neck Maxi Gown',
    price: 600,
    originalPrice: 2200,
    condition: 'Good',
    category: "Women's Dresses",
    tags: ['gown', 'red', 'forever21', 'halter', 'maxi', 'party'],
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&h=700&fit=crop',
    sellerName: 'Tara B.',
    brand: 'Forever 21',
    size: 'M',
    description: 'Scarlet red halter maxi with adjustable neck tie and subtle ruching at waist. Great for parties.',
    views: 103,
    likes: 41
  },
  {
    title: 'Vero Moda Rust Orange Wrap Maxi Gown',
    price: 800,
    originalPrice: 2799,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['gown', 'rust', 'orange', 'veromoda', 'wrap', 'boho'],
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=700&fit=crop',
    sellerName: 'Ananya G.',
    brand: 'Vero Moda',
    size: 'S',
    description: 'Rust orange wrap maxi with V-neckline, self-tie waist, and boho tiered skirt. Perfect for casual evenings.',
    views: 118,
    likes: 48
  },
  {
    title: 'Only Lavender Tiered Ruffle Gown',
    price: 950,
    originalPrice: 3200,
    condition: 'Good',
    category: "Women's Dresses",
    tags: ['gown', 'lavender', 'only', 'tiered', 'ruffle', 'wedding-guest'],
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&h=700&fit=crop',
    sellerName: 'Simran D.',
    brand: 'Only',
    size: 'XS',
    description: 'Soft lavender chiffon tiered gown with ruffle hem and smocked bodice. Dreamy wedding guest look.',
    views: 145,
    likes: 63
  },

  // ==========================================
  // PART 2: Sarees (3 items)
  // ==========================================
  {
    title: 'Banarasi Silk Saree in Deep Teal',
    price: 4500,
    originalPrice: 12000,
    condition: 'Like New',
    category: "Women's Traditional",
    tags: ['saree', 'banarasi', 'silk', 'teal', 'traditional', 'wedding'],
    image: 'https://images.unsplash.com/photo-1617627143233-69db79f9697f?w=600&h=700&fit=crop',
    sellerName: 'Sunita B.',
    brand: 'Banarasi Weaves',
    size: 'Free Size',
    description: 'Authentic handwoven Banarasi silk saree in deep teal with heavy gold zari border and intricate buta work.',
    views: 188,
    likes: 85
  },
  {
    title: 'Chanderi Cotton Ivory Saree with Gold Border',
    price: 2200,
    originalPrice: 6500,
    condition: 'Good',
    category: "Women's Traditional",
    tags: ['saree', 'chanderi', 'cotton', 'ivory', 'gold', 'festive'],
    image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=600&h=700&fit=crop',
    sellerName: 'Rekha V.',
    brand: 'Chanderi Silks',
    size: 'Free Size',
    description: 'Lightweight Chanderi cotton saree with subtle sheer quality, ivory body and bold gold tissue border.',
    views: 143,
    likes: 61
  },
  {
    title: 'Georgette Pink Printed Saree',
    price: 1100,
    originalPrice: 3200,
    condition: 'Like New',
    category: "Women's Traditional",
    tags: ['saree', 'georgette', 'pink', 'printed', 'casual', 'puja'],
    image: 'https://images.unsplash.com/photo-1588965218882-8528fdb1c2a3?w=600&h=700&fit=crop',
    sellerName: 'Lalita M.',
    brand: 'Soch',
    size: 'Free Size',
    description: 'Floral digital-printed georgette saree in dusty pink with matching unstitched blouse piece included.',
    views: 112,
    likes: 47
  },

  // ==========================================
  // PART 2: Dresses (3 items)
  // ==========================================
  {
    title: 'Zara Floral Midi Dress in Cream',
    price: 1100,
    originalPrice: 3499,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['dress', 'floral', 'midi', 'zara', 'cream', 'summer'],
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600&h=700&fit=crop',
    sellerName: 'Priya M.',
    brand: 'Zara',
    size: 'M',
    description: 'Cream floral midi dress with puff sleeves and button-front bodice. Effortlessly feminine for summer.',
    views: 156,
    likes: 67
  },
  {
    title: 'H&M Striped Shirt Dress',
    price: 650,
    originalPrice: 1999,
    condition: 'Good',
    category: "Women's Dresses",
    tags: ['dress', 'striped', 'shirt-dress', 'hm', 'casual', 'everyday'],
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600&h=700&fit=crop',
    sellerName: 'Ria K.',
    brand: 'H&M',
    size: 'S',
    description: 'Classic navy and white striped cotton shirt dress with button placket and tie belt. Relaxed everyday style.',
    views: 94,
    likes: 38
  },
  {
    title: 'Mango Knit Ribbed Mini Dress',
    price: 1800,
    originalPrice: 5500,
    condition: 'Like New',
    category: "Women's Dresses",
    tags: ['dress', 'knit', 'mini', 'mango', 'ribbed', 'going-out'],
    image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=700&fit=crop',
    sellerName: 'Aisha T.',
    brand: 'Mango',
    size: 'XS',
    description: 'Form-fitting ribbed knit mini dress in warm caramel with long sleeves and subtle V-neckline.',
    views: 177,
    likes: 82
  },

  // ==========================================
  // PART 2: Knee-High Boots (3 items)
  // ==========================================
  {
    title: 'Zara Black Knee High Block Heel Boots',
    price: 2200,
    originalPrice: 6999,
    condition: 'Like New',
    category: 'Footwear',
    tags: ['boots', 'knee-high', 'black', 'zara', 'block-heel', 'winter'],
    image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&h=700&fit=crop',
    sellerName: 'Sara K.',
    brand: 'Zara',
    size: '38',
    description: 'Sleek black faux leather knee-high boots with stable 6cm block heel and side zip. Worn twice, minimal scuffing.',
    views: 233,
    likes: 107
  },
  {
    title: 'H&M Brown Suede Knee High Boots',
    price: 1400,
    originalPrice: 3999,
    condition: 'Good',
    category: 'Footwear',
    tags: ['boots', 'knee-high', 'brown', 'suede', 'hm', 'winter'],
    image: 'https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600&h=700&fit=crop',
    sellerName: 'Nisha P.',
    brand: 'H&M',
    size: '37',
    description: 'Cognac brown suede-look knee-high boots with flat heel and pull-on style. Light wear, no damage.',
    views: 168,
    likes: 73
  },
  {
    title: 'Steve Madden Over-The-Knee Stretch Boots',
    price: 3500,
    originalPrice: 9500,
    condition: 'Like New',
    category: 'Footwear',
    tags: ['boots', 'over-the-knee', 'steve-madden', 'stretch', 'black', 'evening'],
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=700&fit=crop',
    sellerName: 'Pooja R.',
    brand: 'Steve Madden',
    size: '39',
    description: 'Black stretch fabric over-the-knee boots with 5cm heel and zip back. Barely worn, perfect condition.',
    views: 204,
    likes: 94
  }
];

