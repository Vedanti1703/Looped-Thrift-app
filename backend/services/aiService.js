const { WhatsAppConversation, WhatsAppMessage } = require('../models/WhatsAppConversation');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Rental = require('../models/Rental');
const User = require('../models/User');
const whatsappService = require('./whatsappService');
const loopedAiController = require('../controllers/loopedAiController');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

exports.processIncomingMessage = async (phone, text, senderName) => {
  // 0. Use LLM if OpenAI API key is configured
  if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key') {
    try {
      const aiServiceLLM = require('./aiServiceLLM');
      await aiServiceLLM.processIncomingMessage(phone, text, senderName);
      return;
    } catch (err) {
      console.warn('⚠️ OpenAI LLM service failed, falling back to rule-based agent:', err.message);
    }
  }

  // 1. Fetch or create WhatsAppConversation
  let convo = await WhatsAppConversation.findOne({ phone });
  if (!convo) {
    convo = await WhatsAppConversation.create({
      phone,
      name: senderName,
      loopedAiState: { step: 'idle', orderData: {} }
    });
  }

  // 2. Save incoming message to message history
  await WhatsAppMessage.create({
    phone,
    sender: 'user',
    text
  });

  // 3. Check if human support is active
  if (convo.humanSupportRequired) {
    console.log(`[AI Skipped] Convo with ${phone} is flagged for human support.`);
    return;
  }

  const textLower = text.toLowerCase().trim();

  // 4. Check for explicit human support request
  const escalationKeywords = ['human', 'agent', 'support', 'executive', 'customer support', 'talk to a person'];
  if (escalationKeywords.some(kw => textLower.includes(kw))) {
    convo.humanSupportRequired = true;
    await convo.save();
    
    const replyText = "I have stopped AI replies and flagged your chat for manual support. A human executive will get back to you shortly. 📞";
    await whatsappService.sendMessage(phone, replyText);
    return;
  }

  // 5. If state is not idle (multi-step ordering flow), delegate directly to loopedAiController
  if (convo.loopedAiState && convo.loopedAiState.step !== 'idle') {
    const replyText = await loopedAiController.generateResponse(text, convo, null);
    await whatsappService.sendMessage(phone, replyText);
    return;
  }

  // 6. Detect intent
  const intent = detectIntent(textLower);
  console.log(`Detected Intent for ${phone}: ${intent}`);

  let replyText = "";

  switch (intent) {
    case 'Greeting':
      replyText = `Hello 👋 Welcome to Looped Thrift.\nHow can I help you today?`;
      break;

    case 'Product Search':
      replyText = await handleProductSearch(text);
      break;

    case 'Product Details':
      replyText = await handleProductDetails(text);
      break;

    case 'Order Tracking':
      replyText = await handleOrderTracking(text, phone);
      break;

    case 'Rental Inquiry':
      replyText = await handleRentalInquiry(text, phone);
      break;

    case 'Selling Inquiry':
      replyText = `Want to sell clothes? Here's the process:\n\n` +
                  `1. Register on our website.\n` +
                  `2. Click "Upload" to list items with brand, size, condition, and price.\n` +
                  `3. Get AI price recommendations based on market data.\n` +
                  `4. Once purchased, ship it to the buyer and get paid! 💸`;
      break;

    case 'Return Policy':
      replyText = `Our Return Policy:\n\n` +
                  `- Returns accepted within 7 days of delivery.\n` +
                  `- Valid only if item is not as described, damaged, or incorrect.\n` +
                  `- Refunds processed in 5-7 business days.`;
      break;

    case 'Payment Questions':
      replyText = `We support the following payment methods:\n\n` +
                  `- UPI (GPay, PhonePe, Paytm)\n` +
                  `- Credit/Debit cards (Visa, Mastercard, RuPay)\n` +
                  `- Net Banking\n` +
                  `- Cash on Delivery (COD)`;
      break;

    case 'Delivery Questions':
      replyText = `Delivery details:\n\n` +
                  `- Timeframe: 3-5 business days.\n` +
                  `- Charges: ₹80, or FREE for orders above ₹1500.\n` +
                  `- Tracking updates are sent when your order ships! 🚚`;
      break;

    case 'General Conversation':
    default:
      // Delegate reasoning to existing AI chat service logic
      replyText = await loopedAiController.generateResponse(text, convo, null);
      break;
  }

  await whatsappService.sendMessage(phone, replyText);
};

// Intent classifier
function detectIntent(text) {
  if (text.includes('track') || text.includes('order status') || text.includes('my order') || /looped-ord-\d+/i.test(text)) {
    return 'Order Tracking';
  }
  if (text.includes('rent') || text.includes('rental') || text.includes('can i rent')) {
    return 'Rental Inquiry';
  }
  if (text.includes('sell') || text.includes('selling') || text.includes('how to sell') || text.includes('sell clothes')) {
    return 'Selling Inquiry';
  }
  if (text.includes('available') || text.includes('details') || text.includes('is product') || text.includes('info about')) {
    return 'Product Details';
  }
  
  const buyKeywords = ['buy', 'order', 'purchase', 'checkout', 'want to get', 'add to cart'];
  if (buyKeywords.some(kw => text.includes(kw) && !text.includes('cancel') && !text.includes('how to'))) {
    return 'General Conversation';
  }

  if (text.includes('show') || text.includes('find') || text.includes('search') || text.includes('hoodie') || text.includes('jacket') || text.includes('jeans') || text.includes('shirt') || text.includes('tshirt') || text.includes('dress') || text.includes('sweater') || text.includes('looking for') || text.includes('suggest') || text.includes('recommend')) {
    return 'Product Search';
  }
  
  if (text.includes('return') || text.includes('refund') || text.includes('exchange')) {
    return 'Return Policy';
  }
  if (text.includes('payment') || text.includes('pay') || text.includes('cod') || text.includes('upi') || text.includes('card')) {
    return 'Payment Questions';
  }
  if (text.includes('delivery') || text.includes('shipping') || text.includes('ship') || text.includes('timeline') || text.includes('charge')) {
    return 'Delivery Questions';
  }
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'yo', 'sup'];
  if (greetings.some(g => text.startsWith(g) || text === g)) {
    return 'Greeting';
  }
  return 'General Conversation';
}

// Product search in MongoDB
async function handleProductSearch(text) {
  try {
    const cleanText = text.toLowerCase();
    
    // Parse price cap
    let maxPrice = null;
    const priceMatch = cleanText.match(/(?:under|below|less than|price|budget|₹|rs\.?)\s*(\d+)/i);
    if (priceMatch) {
      maxPrice = parseInt(priceMatch[1]);
    }

    // Clean search term
    let searchTerms = cleanText
      .replace(/(?:under|below|less than|price|max|budget|₹|rs\.?)\s*\d+/g, '')
      .replace(/show|me|find|search|looking|for|want|to|buy|a|some/g, '')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 1);

    // Stemming for plurals (e.g. hoodies -> hoodie, jeans -> jean, shirts -> shirt)
    searchTerms = searchTerms.map(term => {
      if (term.endsWith('ies')) return term.slice(0, -3) + 'ie'; // hoodies -> hoodie
      if (term.endsWith('s') && term.length > 3) {
        return term.slice(0, -1);
      }
      return term;
    });

    let query = {};
    if (maxPrice) {
      query.price = { $lte: maxPrice };
    }

    if (searchTerms.length > 0) {
      const matchConditions = searchTerms.map(term => ({
        $or: [
          { title: { $regex: term, $options: 'i' } },
          { category: { $regex: term, $options: 'i' } },
          { tags: { $in: [term] } },
          { brand: { $regex: term, $options: 'i' } }
        ]
      }));
      query.$and = matchConditions;
    }

    const products = await Product.find(query).limit(5).lean();

    if (products.length === 0) {
      return "I couldn't find any products matching those criteria in our store. Try searching for something else, like 'hoodies' or 'jeans'! 🧥";
    }

    let reply = "Here's what I found matching your request:\n\n";
    products.forEach((p, idx) => {
      reply += `${idx + 1}. *${p.title}*\n`;
      reply += `   Price: ₹${p.price}\n`;
      reply += `   Size: ${p.size || 'N/A'} | Condition: ${p.condition}\n`;
      if (p.listingType === 'rent' || p.listingType === 'both') {
        reply += `   Rent: ₹${p.rentPricePerDay}/day (Deposit: ₹${p.securityDeposit})\n`;
      }
      reply += `   View: ${FRONTEND_URL}/product/${p._id}\n\n`;
    });
    return reply.trim();
  } catch (err) {
    console.error('Product search error:', err);
    return "Something went wrong while searching products.";
  }
}

// Product Details in MongoDB
async function handleProductDetails(text) {
  try {
    let term = text.toLowerCase()
      .replace(/is|available|details|show|me|info|about|on/g, '')
      .trim();
    
    if (term.length < 2) {
      return "Which product would you like to see details for? Reply with the product name!";
    }

    const product = await Product.findOne({ title: { $regex: term, $options: 'i' } }).lean();
    if (!product) {
      return `I couldn't find a product matching *"${term}"* in our database. Can you check the spelling?`;
    }

    let reply = `*${product.title}* is available! Details:\n\n`;
    reply += `💰 Price: ₹${product.price}\n`;
    reply += `📐 Size: ${product.size || 'N/A'}\n`;
    reply += `⭐ Condition: ${product.condition}\n`;
    reply += `📝 Description: ${product.description || 'No description available'}\n`;
    reply += `🏷️ Category: ${product.category}\n`;
    if (product.listingType === 'rent' || product.listingType === 'both') {
      reply += `🔄 Rental Price: ₹${product.rentPricePerDay}/day\n`;
      reply += `🔒 Security Deposit: ₹${product.securityDeposit}\n`;
    }
    reply += `🔗 View Item: ${FRONTEND_URL}/product/${product._id}`;
    return reply;
  } catch (err) {
    console.error('Product details error:', err);
    return "Error checking product availability.";
  }
}

// Order tracking in MongoDB
async function handleOrderTracking(text, phone) {
  try {
    const orderIdMatch = text.match(/LOOPED-ORD-\d+/i);
    if (orderIdMatch) {
      const orderId = orderIdMatch[0].toUpperCase();
      const order = await Order.findOne({ orderId });
      if (!order) {
        return `I couldn't find an order with ID *${orderId}*. Please check your Order ID and try again.`;
      }
      return formatOrderDetails(order);
    }

    const orders = await Order.find({ phone }).sort({ createdAt: -1 }).limit(3);
    if (orders.length === 0) {
      return `I couldn't find any orders linked to your phone number (${phone}). If you have an Order ID (e.g., LOOPED-ORD-123456), please reply with it so I can track it!`;
    }

    if (orders.length === 1) {
      return `Found 1 order associated with your number:\n\n` + formatOrderDetails(orders[0]);
    }

    let reply = `I found ${orders.length} orders associated with your number:\n\n`;
    orders.forEach((ord) => {
      reply += `📦 Order *${ord.orderId}*\n`;
      reply += `   Product: ${ord.productName}\n`;
      reply += `   Status: *${ord.status}*\n`;
      reply += `   Est. Delivery: ${ord.estimatedDelivery}\n\n`;
    });
    reply += `To view details, reply with the Order ID.`;
    return reply;
  } catch (err) {
    console.error('Order tracking error:', err);
    return "Error tracking your order.";
  }
}

function formatOrderDetails(order) {
  let details = `📦 *Order ID*: ${order.orderId}\n`;
  details += `👤 *Customer*: ${order.name}\n`;
  details += `🛍️ *Product*: ${order.productName} (${order.size || 'M'}, ${order.color || 'As shown'})\n`;
  details += `🔢 *Quantity*: ${order.quantity}\n`;
  details += `💰 *Amount*: ₹${order.totalAmount}\n`;
  details += `📍 *Delivery Address*: ${order.address}\n`;
  details += `🚚 *Status*: *${order.status}*\n`;
  details += `📅 *Est. Delivery*: ${order.estimatedDelivery}`;
  return details;
}

// Rental Inquiries in MongoDB
async function handleRentalInquiry(text, phone) {
  try {
    const user = await User.findOne({ phone });
    let rentals = [];
    if (user) {
      rentals = await Rental.find({ renterId: user._id }).sort({ createdAt: -1 }).limit(3).lean();
    }

    let reply = `Looped Thrift rental policy:\n` +
                `- Rental Duration: Up to 14 days.\n` +
                `- Security Deposit: Fully refundable after the item is returned.\n` +
                `- Shipping: Handled by us.\n\n`;

    if (rentals.length > 0) {
      reply += `*Your Rentals:*\n`;
      rentals.forEach((rent, idx) => {
        reply += `${idx + 1}. *${rent.productTitle}*\n`;
        reply += `   Status: *${rent.status}*\n`;
        reply += `   Duration: ${new Date(rent.startDate).toLocaleDateString()} to ${new Date(rent.endDate).toLocaleDateString()}\n`;
        reply += `   Deposit: ₹${rent.securityDeposit} | Total: ₹${rent.totalAmount}\n\n`;
      });
    } else {
      const rentableProducts = await Product.find({
        $or: [
          { listingType: { $in: ['rent', 'both'] } },
          { rentAvailable: true }
        ]
      }).limit(3).lean();

      if (rentableProducts.length > 0) {
        reply += `*Here are some items available for rent right now:*\n\n`;
        rentableProducts.forEach((p, idx) => {
          reply += `${idx + 1}. *${p.title}*\n`;
          reply += `   Daily Rent: ₹${p.rentPricePerDay || 100}/day\n`;
          reply += `   Deposit: ₹${p.securityDeposit || 300}\n`;
          reply += `   Rent Link: ${FRONTEND_URL}/product/${p._id}\n\n`;
        });
      }
    }
    return reply.trim();
  } catch (err) {
    console.error('Rental inquiry error:', err);
    return "Error retrieving rental information.";
  }
}
