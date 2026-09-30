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

    // 5. Calculate carbon savings and update buyer sustainability stats
    try {
      const { calculateSavings, calculateSustainabilityTier } = require('../utils/carbonCalculator');
      let totalCo2 = 0;
      let totalWater = 0;
      let totalKm = 0;
      let totalTreeDays = 0;

      if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
          const savings = calculateSavings(item.category || "Women's Tops", item.condition || 'Good');
          totalCo2 += savings.co2SavedKg;
          totalWater += savings.waterSavedLitres;
          totalKm += savings.equivalentKmNotDriven;
          totalTreeDays += savings.treeDaysEquivalent;
        });
      } else {
        const savings = calculateSavings("Women's Tops", 'Good');
        totalCo2 = savings.co2SavedKg;
        totalWater = savings.waterSavedLitres;
        totalKm = savings.equivalentKmNotDriven;
        totalTreeDays = savings.treeDaysEquivalent;
      }

      order.carbonSavings = {
        co2SavedKg: parseFloat(totalCo2.toFixed(2)),
        waterSavedLitres: parseFloat(totalWater.toFixed(0)),
        equivalentKmNotDriven: parseFloat(totalKm.toFixed(1)),
        treeDaysEquivalent: parseFloat(totalTreeDays.toFixed(1))
      };
      await order.save();

      const buyerUser = await User.findById(order.userId || order.buyerId);
      if (buyerUser) {
        if (!buyerUser.sustainabilityStats) {
          buyerUser.sustainabilityStats = {
            totalCo2SavedKg: 0,
            totalWaterSavedLitres: 0,
            totalItemsCirculated: 0,
            sustainabilityScore: 0,
            tier: 'Seedling'
          };
        }
        buyerUser.sustainabilityStats.totalCo2SavedKg = parseFloat(
          ((buyerUser.sustainabilityStats.totalCo2SavedKg || 0) + totalCo2).toFixed(2)
        );
        buyerUser.sustainabilityStats.totalWaterSavedLitres = parseFloat(
          ((buyerUser.sustainabilityStats.totalWaterSavedLitres || 0) + totalWater).toFixed(0)
        );
        buyerUser.sustainabilityStats.totalItemsCirculated =
          (buyerUser.sustainabilityStats.totalItemsCirculated || 0) + (order.items?.length || 1);

        const tierInfo = calculateSustainabilityTier(buyerUser.sustainabilityStats.totalCo2SavedKg);
        buyerUser.sustainabilityStats.tier = tierInfo.tier;
        buyerUser.sustainabilityStats.sustainabilityScore = tierInfo.score;
        await buyerUser.save();
      }
    } catch (carbonErr) {
      console.warn('Could not compute carbon savings for order:', carbonErr.message);
    }

    // 6. Clear the authenticated user's cart
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

/**
 * POST /payment/upi-qr or /api/payments/upi-qr
 * Creates or reuses a single-use Razorpay UPI QR code for the user's order.
 */
exports.createUpiQr = async (req, res) => {
  try {
    const isQrEnabled = process.env.ENABLE_INAPP_UPI_QR !== 'false';
    if (!isQrEnabled) {
      console.warn('In-app UPI QR is disabled via ENABLE_INAPP_UPI_QR=false');
      return res.status(200).json({
        success: false,
        qrDisabled: true,
        message: 'Razorpay QR Codes not enabled on this account'
      });
    }

    const { orderId, deliveryAddress } = req.body;

    let order = null;
    if (orderId) {
      order = await Order.findOne({
        orderId,
        userId: req.userId,
        paymentStatus: { $in: ['PENDING', 'pending'] }
      });
    }

    // If orderId not provided or not found, check for an existing pending order for this user
    if (!order) {
      order = await Order.findOne({
        userId: req.userId,
        paymentStatus: { $in: ['PENDING', 'pending'] }
      }).sort({ createdAt: -1 });
    }

    // If still no pending order, create one using cart + deliveryAddress
    if (!order) {
      if (!deliveryAddress || !deliveryAddress.name || !deliveryAddress.phone || !deliveryAddress.address) {
        return res.status(400).json({
          success: false,
          message: 'Delivery details required to create order.'
        });
      }

      const cart = await Cart.findOne({ userId: req.userId });
      if (!cart || !cart.items || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Your cart is empty.'
        });
      }

      const productIds = cart.items.map(item => item.productId).filter(Boolean);
      const dbProducts = await Product.find({ _id: { $in: productIds } });
      const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));

      let calculatedSubtotal = 0;
      const verifiedOrderItems = [];
      const buyer = await User.findById(req.userId);

      for (const item of cart.items) {
        const pid = item.productId?.toString();
        const product = productMap.get(pid);
        if (!product) continue;
        const itemPrice = typeof product.price === 'number' ? product.price : (item.price || 0);
        const quantity = item.quantity || 1;
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
          message: 'Invalid order total.'
        });
      }

      const calculatedTotal = calculatedSubtotal;
      const amountInPaise = Math.round(calculatedTotal * 100);
      const razorpay = getRazorpayInstance();
      const generatedOrderId = `LOOPED-ORD-${Date.now().toString().slice(-6)}${Math.floor(100 + Math.random() * 900)}`;

      let razorpayOrder;
      try {
        razorpayOrder = await razorpay.orders.create({
          amount: amountInPaise,
          currency: 'INR',
          receipt: generatedOrderId,
          notes: {
            userId: req.userId.toString(),
            customerName: deliveryAddress.name.trim(),
            customerPhone: deliveryAddress.phone.trim()
          }
        });
      } catch (rzpErr) {
        console.error('Razorpay Orders API error:', rzpErr);
        return res.status(500).json({
          success: false,
          message: rzpErr.error?.description || rzpErr.message || 'Failed to initialize payment gateway order'
        });
      }

      const primarySeller = verifiedOrderItems.find(i => i.sellerId) || {};
      order = await Order.create({
        orderId: generatedOrderId,
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
        address: deliveryAddress.address.trim(),
        city: (deliveryAddress.city || '').trim(),
        state: (deliveryAddress.state || '').trim(),
        pincode: (deliveryAddress.pincode || '').trim(),
        totalAmount: calculatedTotal,
        currency: 'INR',
        razorpayOrderId: razorpayOrder.id,
        paymentStatus: 'PENDING',
        orderStatus: 'PENDING',
        status: 'Pending',
        payoutStatus: 'ON_HOLD',
        timeline: [{
          status: 'PENDING',
          title: 'Order Created',
          description: `Order initialized for INR ${calculatedTotal}. Awaiting payment.`,
          actorRole: 'buyer',
          timestamp: new Date()
        }]
      });
    }

    // Now call Razorpay QR Codes API
    const razorpay = getRazorpayInstance();
    const amountInPaise = Math.round(order.totalAmount * 100);
    const closeBy = Math.floor(Date.now() / 1000) + 10 * 60; // 10 minutes

    try {
      const qrResponse = await razorpay.qrCode.create({
        type: 'upi_qr',
        name: 'Looped',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: amountInPaise,
        description: `Order #${order.orderId}`,
        close_by: closeBy,
        notes: {
          orderId: order.orderId,
          userId: req.userId.toString()
        }
      });

      order.qrCodeId = qrResponse.id;
      await order.save();

      return res.json({
        success: true,
        qrId: qrResponse.id,
        imageUrl: qrResponse.image_url,
        expiresAt: closeBy * 1000,
        orderId: order.orderId,
        amount: order.totalAmount
      });
    } catch (qrErr) {
      console.warn('Razorpay QR Codes not enabled on this account:', qrErr.error?.description || qrErr.message || qrErr);
      return res.status(200).json({
        success: false,
        qrDisabled: true,
        message: 'Razorpay QR Codes not enabled on this account'
      });
    }
  } catch (err) {
    console.error('Error in createUpiQr:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error creating UPI QR'
    });
  }
};

/**
 * GET /payment/upi-qr/:qrId/status or /api/payments/upi-qr/:qrId/status
 * Polls payment status for a specific UPI QR code.
 */
exports.getUpiQrStatus = async (req, res) => {
  try {
    const { qrId } = req.params;
    if (!qrId) {
      return res.status(400).json({ success: false, message: 'QR ID is required.' });
    }

    let order = await Order.findOne({ qrCodeId: qrId });
    if (!order && req.query.orderId) {
      order = await Order.findOne({ orderId: req.query.orderId });
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order for this QR code was not found.' });
    }

    // If already marked paid in DB, return immediately (idempotent)
    if (order.paymentStatus === 'PAID' || order.paymentStatus === 'paid') {
      return res.json({
        success: true,
        status: 'paid',
        orderId: order.orderId
      });
    }

    // Verify status directly from Razorpay
    try {
      const razorpay = getRazorpayInstance();
      const qrDetails = await razorpay.qrCode.fetch(qrId);

      const payments = await razorpay.qrCode.fetchAllPayments(qrId);
      const successfulPayment = payments?.items?.find(p => p.status === 'captured' || p.status === 'authorized');

      if (successfulPayment || (qrDetails.status === 'closed' && qrDetails.payments_amount_received > 0)) {
        order.paymentStatus = 'PAID';
        order.orderStatus = 'CONFIRMED';
        order.status = 'CONFIRMED';
        order.payoutStatus = 'ON_HOLD';
        order.returnStatus = 'NONE';
        if (successfulPayment?.id) {
          order.razorpayPaymentId = successfulPayment.id;
        }

        order.timeline.push({
          status: 'CONFIRMED',
          title: 'Payment Received via UPI QR',
          description: `UPI QR payment received. Payment ID: ${successfulPayment?.id || 'QR_CAPTURED'}`,
          actorRole: 'system',
          timestamp: new Date()
        });

        await order.save();

        // Clear user cart
        await Cart.findOneAndUpdate({ userId: order.userId }, { items: [] });

        return res.json({
          success: true,
          status: 'paid',
          orderId: order.orderId
        });
      }

      // Check if QR expired or closed without payment
      const isExpired = qrDetails.status === 'closed' || (qrDetails.close_by && Date.now() / 1000 > qrDetails.close_by);
      if (isExpired) {
        return res.json({
          success: true,
          status: 'expired',
          orderId: order.orderId
        });
      }

      return res.json({
        success: true,
        status: 'pending',
        orderId: order.orderId
      });
    } catch (rzpErr) {
      // In case qrCode fetch fails (e.g. simulated test QR), check current DB status
      return res.json({
        success: true,
        status: (order.paymentStatus === 'PAID' || order.paymentStatus === 'paid') ? 'paid' : 'pending',
        orderId: order.orderId
      });
    }
  } catch (err) {
    console.error('Error checking UPI QR status:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Internal server error checking QR status'
    });
  }
};

/**
 * POST /payment/webhook or /api/payments/webhook
 * Handles Razorpay webhooks (qr_code.credited, payment.captured, order.paid, payment.failed)
 * Verifies webhook signature against raw body and RAZORPAY_WEBHOOK_SECRET.
 */
exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const webhookSecret = (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim();

    if (!signature || !webhookSecret) {
      return res.status(400).json({
        success: false,
        message: 'Webhook signature or secret missing.'
      });
    }

    const payload = req.rawBody ? req.rawBody.toString() : JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.warn('❌ Webhook signature verification failed');
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook signature.'
      });
    }

    const event = req.body?.event;
    const eventPayload = req.body?.payload;

    if (event === 'qr_code.credited' || event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = eventPayload?.payment?.entity;
      const qrEntity = eventPayload?.qr_code?.entity;
      const orderEntity = eventPayload?.order?.entity;

      const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
      const qrId = qrEntity?.id || paymentEntity?.notes?.qrId;
      const customOrderId = paymentEntity?.notes?.orderId || qrEntity?.notes?.orderId;
      const paymentId = paymentEntity?.id;

      const query = {
        $or: [
          ...(razorpayOrderId ? [{ razorpayOrderId }] : []),
          ...(qrId ? [{ qrCodeId: qrId }] : []),
          ...(customOrderId ? [{ orderId: customOrderId }] : [])
        ]
      };

      const order = await Order.findOne(query);
      if (order) {
        if (order.paymentStatus !== 'PAID' && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'PAID';
          order.orderStatus = 'CONFIRMED';
          order.status = 'CONFIRMED';
          order.payoutStatus = 'ON_HOLD';
          order.returnStatus = 'NONE';
          if (paymentId) order.razorpayPaymentId = paymentId;

          order.timeline.push({
            status: 'CONFIRMED',
            title: `Payment Confirmed via Webhook (${event})`,
            description: `Payment ID: ${paymentId || 'N/A'}. Event: ${event}`,
            actorRole: 'system',
            timestamp: new Date()
          });

          await order.save();

          // Clear user cart
          await Cart.findOneAndUpdate({ userId: order.userId }, { items: [] });
          console.log(`✅ Order ${order.orderId} marked PAID via webhook (${event})`);
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = eventPayload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const customOrderId = paymentEntity?.notes?.orderId;

      const order = await Order.findOne({
        $or: [
          ...(razorpayOrderId ? [{ razorpayOrderId }] : []),
          ...(customOrderId ? [{ orderId: customOrderId }] : [])
        ]
      });

      if (order && order.paymentStatus === 'PENDING') {
        order.paymentStatus = 'FAILED';
        order.timeline.push({
          status: 'FAILED',
          title: 'Payment Failed via Webhook',
          description: paymentEntity?.error_description || 'Payment was unsuccessful',
          actorRole: 'system',
          timestamp: new Date()
        });
        await order.save();
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error in webhook handler' });
  }
};

