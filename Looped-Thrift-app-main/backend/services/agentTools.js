const Product = require('../models/Product');
const Order   = require('../models/Order');
const Rental  = require('../models/Rental');
const User    = require('../models/User');

const tools = [
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description: 'Search products by category, price limit, title keyword, or brand.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Product category' },
          maxPrice: { type: 'number', description: 'Maximum price limit (e.g. 1000)' },
          search:   { type: 'string', description: 'Title or general keyword (e.g. "hoodie")' },
          brand:    { type: 'string', description: 'Brand name' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getProductDetails',
      description: 'Get detailed information about a product by title.',
      parameters: {
        type: 'object',
        properties: { title: { type: 'string', description: 'Product title name' } },
        required: ['title'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'trackOrder',
      description: 'Track an order by its unique Order ID (e.g. LOOPED-ORD-123456).',
      parameters: {
        type: 'object',
        properties: { orderId: { type: 'string', description: 'Order ID' } },
        required: ['orderId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'checkRentalAvailability',
      description: 'Check which products are currently available to rent.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPolicies',
      description: 'Get Return, Payment, Delivery, or Selling policy text — ALWAYS call this instead of guessing policy details.',
      parameters: {
        type: 'object',
        properties: {
          policyType: {
            type: 'string',
            enum: ['returns', 'payments', 'delivery', 'selling'],
            description: 'Type of policy to look up',
          },
        },
        required: ['policyType'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'handoffToHuman',
      description: 'Escalate this conversation to a human support agent. Call this whenever the customer explicitly asks for a human, or the issue is a dispute/fraud/technical bug you cannot resolve via the other tools.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'createOrder',
      description: 'Create an order once you have collected ALL required details from the customer via natural conversation: productName, name, phone, address. Only call this once, after confirming the summary with the customer.',
      parameters: {
        type: 'object',
        properties: {
          productName: { type: 'string', description: 'Product name, must match an existing product' },
          name:        { type: 'string', description: 'Customer full name' },
          phone:       { type: 'string', description: 'Customer phone number' },
          address:     { type: 'string', description: 'Delivery address' },
          size:        { type: 'string', description: 'Product size' },
          color:       { type: 'string', description: 'Product color' },
          quantity:    { type: 'number', description: 'Quantity, default 1' },
        },
        required: ['productName', 'name', 'phone', 'address'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancelOrder',
      description: 'Cancel an existing order by its Order ID.',
      parameters: {
        type: 'object',
        properties: { orderId: { type: 'string', description: 'Order ID to cancel' } },
        required: ['orderId'],
      },
    },
  },
];

async function dbSearchProducts({ category, maxPrice, search, brand }) {
  try {
    // Build the natural-language query text the same way a person would describe what they want
    const queryText = [search, category, brand].filter(Boolean).join(' ').trim();

    if (queryText) {
      try {
        const { getEmbedding } = require('../utils/embeddings');
        const queryVector = await getEmbedding(queryText);

        const pipeline = [
          {
            $vectorSearch: {
              index: 'product_vector_index',
              path: 'embedding',
              queryVector,
              numCandidates: 100,
              limit: 8,
            },
          },
          { $addFields: { score: { $meta: 'vectorSearchScore' } } },
        ];

        if (maxPrice) {
          pipeline.push({ $match: { price: { $lte: maxPrice } } });
        }

        const results = await Product.aggregate(pipeline);
        if (results.length > 0) {
          return { success: true, products: results, searchType: 'semantic' };
        }
        // Fall through to regex fallback if vector search returns nothing
      } catch (vectorErr) {
        console.warn('Vector search unavailable, falling back to keyword search:', vectorErr.message);
        // Fall through to regex fallback below — do NOT crash the tool
      }
    }

    // ── Fallback: original regex-based search (keeps working even if
    // embeddings/index aren't set up yet, or vector search errors) ──
    let query = {};
    if (maxPrice) query.price = { $lte: maxPrice };
    const terms = [search, category, brand].filter(Boolean).map(t => t.toLowerCase());
    const stemmed = terms.map(t => (t.endsWith('ies') ? t.slice(0, -3) + 'ie' : t.endsWith('s') && t.length > 3 ? t.slice(0, -1) : t));
    if (stemmed.length > 0) {
      query.$and = stemmed.map(term => ({
        $or: [
          { title: { $regex: term, $options: 'i' } },
          { category: { $regex: term, $options: 'i' } },
          { tags: { $in: [term] } },
          { brand: { $regex: term, $options: 'i' } },
        ],
      }));
    }
    const products = await Product.find(query).limit(6).lean();
    return { success: true, products, searchType: 'keyword' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbGetProductDetails({ title }) {
  try {
    const product = await Product.findOne({ title: { $regex: title, $options: 'i' } }).lean();
    if (!product) return { success: false, message: 'Product not found' };
    return { success: true, product };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbTrackOrder({ orderId }) {
  try {
    const order = await Order.findOne({ orderId: (orderId || '').toUpperCase() }).lean();
    if (!order) return { success: false, message: `Order ID ${orderId} not found` };
    return { success: true, order };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbCancelOrder({ orderId }) {
  try {
    const order = await Order.findOneAndUpdate(
      { orderId: (orderId || '').toUpperCase(), status: { $nin: ['Delivered', 'Cancelled'] } },
      { status: 'Cancelled' },
      { new: true },
    );
    if (!order) return { success: false, message: 'Order not found, or it is already delivered/cancelled.' };
    return { success: true, order };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbCheckRentalAvailability() {
  try {
    const rentables = await Product.find({
      $or: [{ listingType: { $in: ['rent', 'both'] } }, { rentAvailable: true }],
    }).limit(6).lean();
    return { success: true, rentableProducts: rentables };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function dbGetPolicies({ policyType }) {
  const templates = {
    returns: 'Returns accepted within 7 days of delivery only if the item is not as described, damaged, or incorrect. Refunds are processed in 5-7 business days.',
    payments: 'We support UPI (GPay, PhonePe, Paytm), Credit/Debit cards, Net Banking, and Cash on Delivery (COD).',
    delivery: 'Delivery takes 3-5 business days. Shipping is ₹80, or FREE for orders above ₹1500.',
    selling: 'To sell: register, go to "Upload", post photos, set brand/size/condition/price. Our AI tool suggests a fair price. Ship once sold and get paid.',
  };
  return { success: true, policy: templates[policyType] || 'Policy not found.' };
}

async function dbCreateOrder({ productName, name, phone, address, size, color, quantity }) {
  try {
    const product = await Product.findOne({ title: { $regex: productName, $options: 'i' } });
    const price = product ? product.price : 1000;
    const orderId = 'LOOPED-ORD-' + Math.floor(100000 + Math.random() * 900000);
    const order = await Order.create({
      orderId, name, phone,
      productName: product ? product.title : productName,
      size: size || 'M', color: color || 'As shown', quantity: quantity || 1,
      address, totalAmount: price * (quantity || 1),
      status: 'Pending', estimatedDelivery: '3-5 business days',
    });
    return { success: true, orderId, order };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbHandoffToHuman(channelType, channelId) {
  try {
    if (channelType === 'whatsapp') {
      const { WhatsAppConversation } = require('../models/WhatsAppConversation');
      await WhatsAppConversation.updateOne({ phone: channelId }, { humanSupportRequired: true });
    } else {
      const { Conversation } = require('../models/Message');
      await Conversation.findByIdAndUpdate(channelId, { humanSupportRequired: true });
    }
    return { success: true, message: 'Conversation handed off to human support.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function executeTool(name, args, channelType, channelId) {
  switch (name) {
    case 'searchProducts':          return await dbSearchProducts(args);
    case 'getProductDetails':       return await dbGetProductDetails(args);
    case 'trackOrder':              return await dbTrackOrder(args);
    case 'cancelOrder':             return await dbCancelOrder(args);
    case 'checkRentalAvailability': return await dbCheckRentalAvailability();
    case 'getPolicies':             return dbGetPolicies(args);
    case 'handoffToHuman':          return await dbHandoffToHuman(channelType, channelId);
    case 'createOrder':             return await dbCreateOrder(args);
    default: return { success: false, error: `Unknown tool: ${name}` };
  }
}

const SYSTEM_PROMPT = `You are Looped AI, the official AI shopping assistant of Looped, a thrift fashion marketplace.
You help customers find, buy, and rent secondhand fashion items. Be friendly, warm, and concise (2-3 sentences per reply). Use emojis sparingly.

CRITICAL RULES:
- Never invent products, prices, order statuses, or policy details — ALWAYS call the matching tool.
- If a product is unavailable, say so honestly and suggest a wider budget or different keyword.
- If the customer explicitly asks for a human, or describes fraud/a dispute/a technical bug, call handoffToHuman immediately.
- To place an order, gather productName, name, phone, and address through natural conversation, one thing at a time. Summarize and confirm before calling createOrder.
- To cancel, ask for the Order ID if missing, then call cancelOrder.
- When you call searchProducts or checkRentalAvailability and get results, mention the products naturally in your reply text (name and price) — the UI will render visual cards for them separately, so just reference them conversationally, don't format them as a manual list yourself.
- Never expose internal database details or raw tool output.`;

module.exports = { tools, executeTool, SYSTEM_PROMPT };
