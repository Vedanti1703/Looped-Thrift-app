const crypto = require('crypto');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const User = require('../models/User');
const { getRazorpayInstance } = require('../config/razorpay');

/**
 * POST /payment/create-order
 * Recalculates cart total from DB and initializes Razorpay Order + pending Order record.
 */
exports.createOrder = async (req, res) => {
  try {
    const { deliveryAddress } = req.body;

    if (!deliveryAddress || !deliveryAddress.name || !deliveryAddress.phone || !deliveryAddress.address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide full delivery details (Name, Phone, and Address are required).'
      });
    }

    // 1. Fetch user's cart
    const cart = await Cart.findOne({ userId: req.userId });
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Add items before checking out.'
      });
    }

    // 2. Fetch fresh product data from DB to recalculate total securely (never trust client amounts)
    const productIds = cart.items.map(item => item.productId).filter(Boolean);
    const dbProducts = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));

    let calculatedSubtotal = 0;
    const verifiedOrderItems = [];

    // Fetch buyer details
    const buyer = await User.findById(req.userId);

    for (const item of cart.items) {
      const pid = item.productId?.toString();
      const product = productMap.get(pid);

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Item "${item.title || 'Product'}" is no longer available in the marketplace.`
        });
      }

      const itemPrice = Number(product.price) || 0;
      const quantity = Math.max(1, Number(item.quantity) || 1);
      calculatedSubtotal += itemPrice * quantity;

      verifiedOrderItems.push({
        productId: product._id,
        title: product.title,
        price: itemPrice,
        quantity,
        image: product.image || item.image || '',
        condition: product.condition || item.condition || '',
        size: product.size || item.size || '',
        sellerId: product.sellerId || null,
        sellerName: product.sellerName || 'Seller'
      });
    }

    if (calculatedSubtotal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order total. Please review your cart.'
      });
    }

    const calculatedTotal = calculatedSubtotal; // Free shipping
    const amountInPaise = Math.round(calculatedTotal * 100);

    // 3. Initialize Razorpay Order via SDK
    const razorpay = getRazorpayInstance();
    const orderId = `LOOPED-ORD-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: orderId,
        notes: {
          userId: req.userId.toString(),
          customerName: deliveryAddress.name.trim(),
          customerPhone: deliveryAddress.phone.trim()
        }
      });
    } catch (rzpErr) {
      console.error('❌ Razorpay Orders API error:', rzpErr);
      return res.status(500).json({
        success: false,
        message: rzpErr.error?.description || rzpErr.message || 'Failed to initialize payment gateway order'
      });
    }

    // Determine primary seller
    const primarySeller = verifiedOrderItems.find(i => i.sellerId) || {};

    // 4. Save pending Order record in MongoDB with Buyer Protection tracking
    const newOrder = await Order.create({
      orderId,
      userId: req.userId,
      buyerId: req.userId,
      buyerName: (deliveryAddress.name || buyer?.name || '').trim(),
      buyerEmail: buyer?.email || '',
      sellerId: primarySeller.sellerId || null,
      sellerName: primarySeller.sellerName || 'Seller',
      name: deliveryAddress.name.trim(),
      phone: deliveryAddress.phone.trim(),
      productName: verifiedOrderItems.map(i => i.title).join(', '),
      items: verifiedOrderItems,
      quantity: verifiedOrderItems.reduce((acc, i) => acc + i.quantity, 0),
      address: deliveryAddress.address.trim(),
      city: (deliveryAddress.city || '').trim(),
      state: (deliveryAddress.state || '').trim(),
      pincode: (deliveryAddress.pincode || '').trim(),
      totalAmount: calculatedTotal,
      currency: 'INR',
      razorpayOrderId: razorpayOrder.id,
      paymentStatus: 'pending',
      orderStatus: 'CONFIRMED',
      status: 'CONFIRMED',
      payoutStatus: 'ON_HOLD',
      returnStatus: 'NONE',
      estimatedDelivery: '3-5 business days',
      timeline: [{
        status: 'INITIALIZED',
        title: 'Order Created',
        description: 'Payment initialized with Looped Buyer Protection.',
        actorRole: 'buyer',
        timestamp: new Date()
      }]
    });

    res.status(201).json({
      success: true,
      orderId: newOrder.orderId,
      mongoOrderId: newOrder._id,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
      items: verifiedOrderItems,
      totalAmount: calculatedTotal
    });
  } catch (err) {
    console.error('Error creating payment order:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while creating order'
    });
  }
};

/**
 * POST /payment/verify
 * Cryptographically verifies Razorpay signature via HMAC-SHA256 and marks order as paid.
 */
exports.verifyPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing Razorpay signature verification parameters (order ID, payment ID, or signature).'
      });
    }

    // 1. Locate the Order
    let order = await Order.findOne({
      $or: [
        { razorpayOrderId: razorpay_order_id },
        ...(orderId ? [{ orderId }] : [])
      ]
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Corresponding order not found in database.'
      });
    }

    // Idempotency check: if already marked paid, return success immediately
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'paid') {
      return res.json({
        success: true,
        message: 'Payment has already been verified for this order.',
        order
      });
    }

    // 2. Perform HMAC-SHA256 signature verification
    const key_secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
    if (!key_secret) {
      console.error('❌ Missing RAZORPAY_KEY_SECRET in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error: Razorpay secret key is not set.'
      });
    }

    const hmac = crypto.createHmac('sha256', key_secret);
    hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = hmac.digest('hex');

    if (generatedSignature !== razorpay_signature) {
      console.error('❌ Signature mismatch during payment verification');
      order.paymentStatus = 'FAILED';
      order.orderStatus = 'CANCELLED';
      order.status = 'Cancelled';
      await order.save();

      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: Signature mismatch or altered payment response.'
      });
    }

    // 3. Update order to confirmed and paid status with Buyer Protection active
    order.paymentStatus = 'PAID';
    order.orderStatus = 'CONFIRMED';
    order.status = 'CONFIRMED';
    order.payoutStatus = 'ON_HOLD';
    order.returnStatus = 'NONE';
    order.paidAt = new Date();
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpaySignature = razorpay_signature;

    order.timeline.push({
      status: 'PAID',
      title: 'Payment Verified & Protected',
      description: 'Payment successfully captured. Seller payout is securely on hold under Looped Buyer Protection.',
      actorRole: 'buyer',
      timestamp: new Date()
    });

    await order.save();

    // 4. Create in-app notifications for buyer and seller
    try {
      const Notification = require('../models/Notification');
      // Buyer notification
      await Notification.create({
        userId: order.userId || order.buyerId,
        title: 'Payment Protected! 🔒',
        message: `Your payment for order #${order.orderId} is protected while you await delivery.`,
        type: 'PAYMENT_SUCCESS',
        orderId: order.orderId
      });

      // Seller notification
      if (order.sellerId) {
        await Notification.create({
          userId: order.sellerId,
          title: 'New Thrift Order Received! 🛍️',
          message: `You received an order for "${order.productName || 'items'}". Please ship within 2-3 business days.`,
          type: 'PAYMENT_SUCCESS',
          orderId: order.orderId
        });
      }
    } catch (notifErr) {
      console.warn('Could not dispatch in-app notification:', notifErr.message);
    }

    // 5. Clear the authenticated user's cart
    if (req.userId) {
      await Cart.findOneAndUpdate({ userId: req.userId }, { items: [] });
    }

    res.json({
      success: true,
      message: 'Payment verified and order placed successfully!',
      order
    });
  } catch (err) {
    console.error('Error verifying payment signature:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while verifying payment'
    });
  }
};

/**
 * POST /payment/failure
 * Records payment failure or user cancellation for a pending order.
 */
exports.recordPaymentFailure = async (req, res) => {
  try {
    const { razorpay_order_id, orderId, error } = req.body;

    const order = await Order.findOne({
      $or: [
        ...(razorpay_order_id ? [{ razorpayOrderId: razorpay_order_id }] : []),
        ...(orderId ? [{ orderId }] : [])
      ]
    });

    if (order && !['paid', 'refunded'].includes((order.paymentStatus || '').toLowerCase())) {
      order.paymentStatus = 'FAILED';
      order.orderStatus = 'CANCELLED';
      order.status = 'Cancelled';
      await order.save();
    }

    res.json({
      success: true,
      message: 'Payment failure recorded.',
      error: error?.description || error?.message || 'Payment cancelled or failed'
    });
  } catch (err) {
    console.error('Error recording payment failure:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while recording failure'
    });
  }
};

/**
 * GET /payment/order/:id
 * Fetches order details for confirmation page or tracking.
 */
exports.getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      $or: [
        { orderId: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    }).lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while fetching order'
    });
  }
};

/**
 * GET /payment/my-orders
 * Fetches order history for current logged in user.
 */
exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      orders: orders || []
    });
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Internal server error while fetching orders'
    });
  }
};

/**
 * GET /payment/key
 * Returns public Razorpay Key ID for client initialization.
 */
exports.getRazorpayKey = (req, res) => {
  res.json({
    keyId: (process.env.RAZORPAY_KEY_ID || '').trim()
  });
};
