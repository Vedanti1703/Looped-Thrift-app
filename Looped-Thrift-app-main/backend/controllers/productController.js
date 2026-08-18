const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Rental = require('../models/Rental');

// GET /products — supports tag filtering & recommendations
exports.getProducts = async (req, res) => {
  try {
    const { tags, category, condition, minPrice, maxPrice, search, userId } = req.query;
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

    // Recommendation: score by how many tags match user's liked tags
    if (userId) {
      const user = await User.findById(userId).select('likedTags');
      if (user && user.likedTags.length > 0) {
        products = products.map(p => {
          const matchScore = p.tags.filter(t => user.likedTags.includes(t)).length;
          return { ...p, matchScore };
        }).sort((a, b) => b.matchScore - a.matchScore);
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

// POST /products — seller uploads item
exports.createProduct = async (req, res) => {
  try {
    const { title, price, condition, category, tags, image, description, brand, size, sellerId, sellerName } = req.body;
    const product = await Product.create({
      title, price: Number(price), condition, category,
      tags: typeof tags === 'string' ? tags.split(',').map(t => t.trim().toLowerCase()) : tags,
      image: image || `https://picsum.photos/seed/${Date.now()}/400/500`,
      description, brand, size, sellerId, sellerName,
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

    let assistant = await User.findOne({ email: 'assistant@looped.app' });
    if (!assistant) {
      assistant = await User.create({
        email: 'assistant@looped.app',
        password: '$2a$10$NotRealPasswordUsedForLoopedAIAssistantToken12345',
        name: 'Looped AI',
        avatar: '🤖',
        isVerified: true
      });
    }

    assistant.phone = '+1234567890';
    await assistant.save();

    // Phones to seed orders and rentals for
    const userPhones = ['+919372760976', '919372760976', '9372760976', '+1234567890'];
    await User.deleteMany({
      $or: [
        { phone: { $in: userPhones } },
        { email: { $in: userPhones.map(p => `testuser_${p.replace('+', 'plus')}@looped.app`) } }
      ]
    });
    const rentProduct = insertedProducts.find(p => p.title === 'Sakura Embroidered Kimono') || insertedProducts[0];

    userPhones.forEach(async (phone, idx) => {
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
          productName: 'Tokyo Streetwear Hoodie',
          size: 'XL',
          color: 'Black',
          quantity: 1,
          address: '123 Main St, New Delhi, India',
          totalAmount: 950,
          status: 'Shipped',
          estimatedDelivery: 'Tomorrow, by 5:00 PM'
        });

        await Order.create({
          orderId: `LOOPED-ORD-78901${idx}`,
          name: 'Test Customer',
          phone,
          productName: 'Plaid Wool Blazer',
          size: 'M',
          color: 'Plaid',
          quantity: 1,
          address: '123 Main St, New Delhi, India',
          totalAmount: 1600,
          status: 'Pending',
          estimatedDelivery: '3-5 business days'
        });
      } catch (err) {
        console.error(`Error seeding data for phone ${phone}:`, err.message);
      }
    });

    res.json({ message: `Seeded ${insertedProducts.length} products, 2 orders, and 1 rental.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// 30 sample products with varied tags, categories, conditions
const dummyProducts = [
  { title: 'Harajuku Patchwork Jacket', price: 1800, originalPrice: 4500, condition: 'Like New', category: "Women's Outerwear", tags: ['japan', 'streetwear', 'harajuku', 'jacket', 'colorful'], image: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400', sellerName: 'Priya M.', brand: 'Vintage', size: 'M', views: 45, likes: 12 },
  { title: 'Ivory Zari Lehenga Set', price: 3500, originalPrice: 8000, condition: 'Like New', category: "Women's Traditional", tags: ['wedding', 'jaipur', 'lehenga', 'bridal', 'traditional'], image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=400', sellerName: 'Ananya S.', brand: 'Meena Bazaar', size: 'S', views: 89, likes: 34 },
  { title: 'Oversized Herringbone Coat', price: 2200, originalPrice: 6000, condition: 'Good', category: "Women's Outerwear", tags: ['winter', 'london', 'coat', 'formal', 'vintage'], image: 'https://images.unsplash.com/photo-1548624313-0396a6b4b47b?w=400', sellerName: 'Tara K.', brand: 'Topshop', size: 'L', views: 67, likes: 19 },
  { title: 'Tokyo Streetwear Hoodie', price: 950, originalPrice: 2500, condition: 'Good', category: "Men's Tops", tags: ['japan', 'streetwear', 'hoodie', 'casual', 'oversized'], image: 'https://images.unsplash.com/photo-1556821840-3a63f15732ce?w=400', sellerName: 'Rohan D.', brand: 'A Bathing Ape', size: 'XL', views: 120, likes: 48 },
  { title: 'Red Bandhani Dupatta', price: 450, originalPrice: 1200, condition: 'Like New', category: "Accessories", tags: ['jaipur', 'wedding', 'bandhani', 'traditional', 'colorful'], image: 'https://images.unsplash.com/photo-1569143252821-a6e4a8c78e08?w=400', sellerName: 'Kavya L.', brand: 'Rajasthan Craft', size: 'One Size', views: 34, likes: 15 },
  { title: 'Plaid Wool Blazer', price: 1600, originalPrice: 4200, condition: 'Like New', category: "Men's Outerwear", tags: ['winter', 'london', 'blazer', 'formal', 'classic'], image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', sellerName: 'Neil J.', brand: 'M&S', size: 'M', views: 55, likes: 22 },
  { title: 'Sakura Embroidered Kimono', price: 2800, originalPrice: 7000, condition: 'Good', category: "Women's Traditional", tags: ['japan', 'kimono', 'floral', 'traditional', 'vintage'], image: 'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=400', sellerName: 'Mia W.', brand: 'Kyoto Thrift', size: 'Free', views: 201, likes: 88 },
  { title: 'Block Print Anarkali Suit', price: 1100, originalPrice: 2800, condition: 'Like New', category: "Women's Traditional", tags: ['jaipur', 'wedding', 'anarkali', 'block-print', 'festive'], image: 'https://images.unsplash.com/photo-1583391733956-6c78276477e2?w=400', sellerName: 'Sneha P.', brand: 'FabIndia', size: 'S', views: 73, likes: 31 },
  { title: 'Thermal Fleece Jogger Set', price: 800, originalPrice: 1800, condition: 'Good', category: "Men's Bottoms", tags: ['winter', 'casual', 'fleece', 'athleisure', 'cozy'], image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?w=400', sellerName: 'Arjun B.', brand: 'H&M Sport', size: 'L', views: 44, likes: 9 },
  { title: 'Denim Cargo Wide Leg', price: 1200, originalPrice: 3000, condition: 'Like New', category: "Women's Bottoms", tags: ['streetwear', 'denim', 'y2k', 'casual', 'trendy'], image: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400', sellerName: 'Zoe F.', brand: 'Zara', size: 'S', views: 156, likes: 67 },
  { title: 'Chunky Knit Turtleneck', price: 700, originalPrice: 1900, condition: 'Good', category: "Women's Tops", tags: ['winter', 'knit', 'cozy', 'casual', 'london'], image: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=400', sellerName: 'Lisa R.', brand: 'COS', size: 'M', views: 88, likes: 29 },
  { title: 'Origami Pleat Trousers', price: 1400, originalPrice: 3500, condition: 'Like New', category: "Women's Bottoms", tags: ['japan', 'minimalist', 'pleated', 'formal', 'streetwear'], image: 'https://images.unsplash.com/photo-1594938298603-c8148c4b4ae4?w=400', sellerName: 'Haruto Y.', brand: 'Issey Miyake', size: 'XS', views: 112, likes: 45 },
  { title: 'Mirror Work Choli', price: 900, originalPrice: 2400, condition: 'Fair', category: "Women's Traditional", tags: ['jaipur', 'wedding', 'mirror-work', 'festive', 'colorful'], image: 'https://images.unsplash.com/photo-1620919942697-c88c5aebd43a?w=400', sellerName: 'Diya K.', brand: 'Rajasthali', size: 'M', views: 62, likes: 24 },
  { title: 'Oxford Leather Brogues', price: 1500, originalPrice: 4000, condition: 'Good', category: "Footwear", tags: ['london', 'winter', 'formal', 'classic', 'leather'], image: 'https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=400', sellerName: 'Sam H.', brand: 'Clarks', size: '42', views: 77, likes: 18 },
  { title: 'Vintage Boro Indigo Jacket', price: 3200, originalPrice: 9000, condition: 'Well Loved', category: "Men's Outerwear", tags: ['japan', 'vintage', 'indigo', 'boro', 'artisan'], image: 'https://images.unsplash.com/photo-1551537482-f2075a1d41f2?w=400', sellerName: 'Kenji T.', brand: 'Vintage Japan', size: 'M', views: 189, likes: 76 },
  { title: 'Bridal Kundan Necklace Set', price: 2600, originalPrice: 6500, condition: 'Like New', category: "Jewelry", tags: ['jaipur', 'wedding', 'bridal', 'kundan', 'traditional'], image: 'https://images.unsplash.com/photo-1617038220319-276d3cfab638?w=400', sellerName: 'Ritu V.', brand: 'Amrapali', size: 'One Size', views: 95, likes: 42 },
  { title: 'Camel Cashmere Scarf', price: 850, originalPrice: 2200, condition: 'Like New', category: "Accessories", tags: ['winter', 'london', 'cashmere', 'luxury', 'classic'], image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=400', sellerName: 'Claire B.', brand: 'Johnstons', size: 'One Size', views: 43, likes: 16 },
  { title: 'Kawaii Pastel Coord Set', price: 1300, originalPrice: 3200, condition: 'Like New', category: "Women's Sets", tags: ['japan', 'kawaii', 'pastel', 'cute', 'harajuku'], image: 'https://images.unsplash.com/photo-1519985176271-adb1088fa94c?w=400', sellerName: 'Yuki A.', brand: 'Axes Femme', size: 'S', views: 167, likes: 71 },
  { title: 'Sharara with Zari Dupatta', price: 2000, originalPrice: 5000, condition: 'Good', category: "Women's Traditional", tags: ['jaipur', 'wedding', 'sharara', 'festive', 'traditional'], image: 'https://images.unsplash.com/photo-1588965218882-8528fdb1c2a3?w=400', sellerName: 'Meera G.', brand: 'Craftsvilla', size: 'M', views: 58, likes: 20 },
  { title: 'Faux Fur Teddy Coat', price: 1700, originalPrice: 4500, condition: 'Like New', category: "Women's Outerwear", tags: ['winter', 'london', 'faux-fur', 'trendy', 'cozy'], image: 'https://images.unsplash.com/photo-1543087903-1ac2364d7188?w=400', sellerName: 'Emma L.', brand: 'ASOS', size: 'L', views: 134, likes: 56 },
  { title: 'Grunge Layered Flannel', price: 600, originalPrice: 1500, condition: 'Good', category: "Men's Tops", tags: ['streetwear', 'grunge', 'flannel', '90s', 'casual'], image: 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=400', sellerName: 'Jake M.', brand: 'Thrift', size: 'L', views: 99, likes: 33 },
  { title: 'Meenakari Potli Bag', price: 550, originalPrice: 1400, condition: 'Like New', category: "Bags", tags: ['jaipur', 'wedding', 'meenakari', 'traditional', 'accessory'], image: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400', sellerName: 'Anita R.', brand: 'Rajasthani Craft', size: 'One Size', views: 47, likes: 21 },
  { title: 'Linen Wide-Leg Pants', price: 750, originalPrice: 1800, condition: 'Like New', category: "Women's Bottoms", tags: ['minimalist', 'linen', 'summer', 'casual', 'japan'], image: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=400', sellerName: 'Hana N.', brand: 'Muji', size: 'XS', views: 88, likes: 35 },
  { title: 'Merino Wool Roll-Neck', price: 920, originalPrice: 2600, condition: 'Good', category: "Men's Tops", tags: ['winter', 'london', 'merino', 'classic', 'smart'], image: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400', sellerName: 'Tom F.', brand: 'Uniqlo', size: 'M', views: 61, likes: 14 },
  { title: 'Y2K Vinyl Flared Skirt', price: 680, originalPrice: 1600, condition: 'Like New', category: "Women's Bottoms", tags: ['streetwear', 'y2k', 'vinyl', 'retro', 'trendy'], image: 'https://images.unsplash.com/photo-1583496661160-fb5886a773af?w=400', sellerName: 'Luna S.', brand: 'Vintage', size: 'XS', views: 143, likes: 62 },
  { title: 'Shearling Aviator Jacket', price: 2900, originalPrice: 7500, condition: 'Good', category: "Men's Outerwear", tags: ['winter', 'london', 'aviator', 'leather', 'vintage'], image: 'https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?w=400', sellerName: 'Lucas M.', brand: 'Schott NYC', size: 'L', views: 176, likes: 70 },
  { title: 'Banaras Silk Saree', price: 4200, originalPrice: 11000, condition: 'New with tags', category: "Women's Traditional", tags: ['wedding', 'saree', 'silk', 'banarasi', 'traditional'], image: 'https://images.unsplash.com/photo-1617627143233-69db79f9697f?w=400', sellerName: 'Sunita B.', brand: 'Ritu Kumar', size: 'Free', views: 210, likes: 93 },
  { title: 'Denim Patchwork Shorts', price: 480, originalPrice: 1200, condition: 'Good', category: "Women's Bottoms", tags: ['streetwear', 'denim', 'patchwork', 'summer', 'casual'], image: 'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?w=400', sellerName: 'Sara K.', brand: 'Levi\'s', size: 'S', views: 72, likes: 28 },
  { title: 'Mohair Fuzzy Cardigan', price: 1050, originalPrice: 2800, condition: 'Like New', category: "Women's Tops", tags: ['winter', 'london', 'mohair', 'cozy', 'knit'], image: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=400', sellerName: 'Grace O.', brand: 'Arket', size: 'M', views: 118, likes: 51 },
  { title: 'Platform Mary Janes', price: 1100, originalPrice: 2900, condition: 'Like New', category: "Footwear", tags: ['japan', 'kawaii', 'platform', 'streetwear', 'harajuku'], image: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400', sellerName: 'Chiaki S.', brand: 'Liz Lisa', size: '38', views: 196, likes: 84 },
];
