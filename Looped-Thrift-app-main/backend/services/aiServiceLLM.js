const { WhatsAppConversation, WhatsAppMessage } = require('../models/WhatsAppConversation');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Rental = require('../models/Rental');
const User = require('../models/User');
const whatsappService = require('./whatsappService');
const loopedAiController = require('../controllers/loopedAiController');
const axios = require('axios');

// OpenAI completion helper
async function getLlmResponse(messages, toolsList) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const payload = {
    model,
    messages
  };

  if (toolsList && toolsList.length > 0) {
    payload.tools = toolsList;
    payload.tool_choice = 'auto';
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    payload,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      timeout: 10000
    }
  );

  return response.data?.choices?.[0]?.message;
}

// Rewrites robotic system messages during checkout to make them natural and conversational
async function rewriteRoboticReply(roboticReply, userText) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const prompt = `You are a friendly shopping assistant.
The customer is in a checkout flow. The state machine generated this robotic system message:
"${roboticReply}"

The customer's last input was: "${userText}"

Rewrite the system message to sound conversational, natural, and friendly.
CRITICAL:
1. Maintain all links (like http://localhost:5173/product/...), sizes, quantities, names, addresses, and prices exactly. Do not invent or change them.
2. Maintain any Order IDs (like LOOPED-ORD-123456) exactly.
3. Keep it brief. Ask for only one thing at a time.
4. If it is a final confirmation summary, present it clearly and ask if everything looks correct.`;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          { role: 'system', content: 'You rewrite system messages to sound conversational and friendly.' },
          { role: 'user', content: prompt }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        timeout: 5000
      }
    );

    return response.data?.choices?.[0]?.message?.content || roboticReply;
  } catch (err) {
    console.error('Error rewriting robotic reply:', err.message);
    return roboticReply; // Fallback to raw reply on failure
  }
}

// Tool Call Definitions
const tools = [
  {
    type: 'function',
    function: {
      name: 'searchProducts',
      description: 'Search products in MongoDB by category, price limit, title keyword, or brand.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Product category' },
          maxPrice: { type: 'number', description: 'Maximum price limit (e.g. 1000)' },
          search: { type: 'string', description: 'Title or general keyword (e.g. "hoodie")' },
          brand: { type: 'string', description: 'Brand name' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getProductDetails',
      description: 'Get detailed information about a product by title.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Product title name' }
        },
        required: ['title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'trackOrder',
      description: 'Track an order by its unique Order ID (e.g., LOOPED-ORD-123456).',
      parameters: {
        type: 'object',
        properties: {
          orderId: { type: 'string', description: 'Order ID' }
        },
        required: ['orderId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getOrdersByPhone',
      description: 'Get order history linked to a customer phone number.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number' }
        },
        required: ['phone']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'checkRental',
      description: 'Check active rentals and rental policy details for the customer.',
      parameters: {
        type: 'object',
        properties: {
          phone: { type: 'string', description: 'Phone number' }
        },
        required: ['phone']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getPolicies',
      description: 'Get Return, Payment, Delivery, or Selling policies.',
      parameters: {
        type: 'object',
        properties: {
          policyType: { type: 'string', enum: ['returns', 'payments', 'delivery', 'selling'], description: 'Type of policy to query' }
        },
        required: ['policyType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'handoffToHuman',
      description: 'Handoff the chat conversation to human customer support.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'startCheckout',
      description: 'Start checking out / purchasing a specific product name.',
      parameters: {
        type: 'object',
        properties: {
          productName: { type: 'string', description: 'Name of the product to purchase' }
        },
        required: ['productName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createOrder',
      description: 'Directly create an order in MongoDB (alternative checkout path).',
      parameters: {
        type: 'object',
        properties: {
          productName: { type: 'string', description: 'Product name' },
          name: { type: 'string', description: 'Customer name' },
          phone: { type: 'string', description: 'Customer phone' },
          address: { type: 'string', description: 'Delivery address' },
          size: { type: 'string', description: 'Product size' },
          color: { type: 'string', description: 'Product color' },
          quantity: { type: 'number', description: 'Quantity (default is 1)' }
        },
        required: ['productName', 'name', 'phone', 'address']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'saveConversation',
      description: 'Save/persist conversation context (automatic, acts as verification stub).',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'loadConversation',
      description: 'Load conversation context (automatic, acts as verification stub).',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];

// Tool Execution Mapped to MongoDB
async function executeTool(name, args, phone) {
  switch (name) {
    case 'searchProducts':
      return await dbSearchProducts(args);
    case 'getProductDetails':
      return await dbGetProductDetails(args);
    case 'trackOrder':
      return await dbTrackOrder(args);
    case 'getOrdersByPhone':
      return await dbGetOrdersByPhone(args);
    case 'checkRental':
      return await dbCheckRental(args);
    case 'getPolicies':
      return await dbGetPolicies(args);
    case 'handoffToHuman':
      return await dbHandoffToHuman(phone);
    case 'startCheckout':
      return await dbStartCheckout(args, phone);
    case 'createOrder':
      return await dbCreateOrder(args);
    case 'saveConversation':
    case 'loadConversation':
      return { success: true, message: 'Automatic session persistence is active.' };
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Database Tool Implementations
async function dbSearchProducts({ category, maxPrice, search, brand }) {
  try {
    let query = {};
    if (maxPrice) query.price = { $lte: maxPrice };

    const searchTerms = [];
    if (search) searchTerms.push(search.toLowerCase());
    if (category) searchTerms.push(category.toLowerCase());
    if (brand) searchTerms.push(brand.toLowerCase());

    const stemmedTerms = searchTerms.map(term => {
      if (term.endsWith('ies')) return term.slice(0, -3) + 'ie';
      if (term.endsWith('s') && term.length > 3) return term.slice(0, -1);
      return term;
    });

    if (stemmedTerms.length > 0) {
      const conditions = stemmedTerms.map(term => ({
        $or: [
          { title: { $regex: term, $options: 'i' } },
          { category: { $regex: term, $options: 'i' } },
          { tags: { $in: [term] } },
          { brand: { $regex: term, $options: 'i' } }
        ]
      }));
      query.$and = conditions;
    }

    const products = await Product.find(query).limit(5).lean();
    return { success: true, products };
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
    const order = await Order.findOne({ orderId: orderId.toUpperCase() }).lean();
    if (!order) return { success: false, message: `Order ID ${orderId} not found` };
    return { success: true, order };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbGetOrdersByPhone({ phone }) {
  try {
    const orders = await Order.find({ phone }).sort({ createdAt: -1 }).limit(3).lean();
    return { success: true, orders };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbCheckRental({ phone }) {
  try {
    const user = await User.findOne({ phone });
    let rentals = [];
    if (user) {
      rentals = await Rental.find({ renterId: user._id }).sort({ createdAt: -1 }).limit(3).lean();
    }
    const rentableProducts = await Product.find({
      $or: [
        { listingType: { $in: ['rent', 'both'] } },
        { rentAvailable: true }
      ]
    }).limit(3).lean();

    return { success: true, rentals, rentableProducts };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbGetPolicies({ policyType }) {
  const templates = {
    returns: `Returns accepted within 7 days of delivery only if item is not as described, damaged, or incorrect. Refunds are processed in 5-7 business days.`,
    payments: `We support UPI (GPay, PhonePe, Paytm), Credit/Debit cards, Net Banking, and Cash on Delivery (COD).`,
    delivery: `Delivery takes 3-5 business days. Shipping is ₹80, or FREE for orders above ₹1500. Tracking updates are sent when your order ships!`,
    selling: `To sell clothes: Register on our website, go to "Upload", post photos of your clothes, set brand/size/condition/price. Use our AI tool to get price recommendations. Ship when sold and get paid!`
  };
  return { success: true, policy: templates[policyType] || 'Policy not found.' };
}

async function dbHandoffToHuman(phone) {
  try {
    await WhatsAppConversation.updateOne({ phone }, { humanSupportRequired: true });
    return { success: true, message: 'Conversation handed off to human support.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbStartCheckout({ productName }, phone) {
  try {
    const product = await Product.findOne({ title: { $regex: productName, $options: 'i' } });
    if (!product) {
      return { success: false, message: `Product "${productName}" is not available.` };
    }

    await WhatsAppConversation.updateOne(
      { phone },
      {
        loopedAiState: {
          step: 'collecting_size',
          orderData: {
            productName: product.title,
            size: '',
            color: '',
            quantity: 1,
            name: '',
            phone,
            address: ''
          }
        }
      }
    );

    return {
      success: true,
      productName: product.title,
      price: product.price,
      message: `Checkout started for "${product.title}" (₹${product.price}). Now requesting size.`
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function dbCreateOrder({ productName, name, phone, address, size, color, quantity }) {
  try {
    const product = await Product.findOne({ title: { $regex: productName, $options: 'i' } });
    const price = product ? product.price : 1000;
    const orderId = 'LOOPED-ORD-' + Math.floor(100000 + Math.random() * 900000);

    const order = await Order.create({
      orderId,
      name,
      phone,
      productName: product ? product.title : productName,
      size: size || 'M',
      color: color || 'As shown',
      quantity: quantity || 1,
      address,
      totalAmount: price * (quantity || 1),
      status: 'Pending',
      estimatedDelivery: '3-5 business days'
    });

    return { success: true, orderId, order };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Conversation Processing
exports.processIncomingMessage = async (phone, text, senderName) => {
  let convo = await WhatsAppConversation.findOne({ phone });
  if (!convo) {
    convo = await WhatsAppConversation.create({
      phone,
      name: senderName,
      loopedAiState: { step: 'idle', orderData: {} }
    });
  }

  // 1. If state is not idle (checkout flow active), delegate to state machine + LLM rewriter
  if (convo.loopedAiState && convo.loopedAiState.step !== 'idle') {
    const roboticReply = await loopedAiController.generateResponse(text, convo, null);
    const friendlyReply = await rewriteRoboticReply(roboticReply, text);
    
    // Save generated AI response in history
    await WhatsAppMessage.create({
      phone,
      sender: 'ai',
      text: friendlyReply
    });

    await whatsappService.sendMessage(phone, friendlyReply);
    return;
  }

  // 2. Normal LLM Conversation flow
  const dbMessages = await WhatsAppMessage.find({ phone }).sort({ createdAt: 1 }).limit(20);

  const openaiMessages = [
    {
      role: 'system',
      content: `You are Looped AI, the official AI shopping assistant of Looped Thrift.
You help customers buy, sell, and rent thrift fashion.
Be friendly and concise. Use emojis sparingly.

CRITICAL RULES:
- Never hallucinate or invent products, prices, order statuses, or policies.
- Whenever product, order, or rental information is needed, always call the appropriate tool.
- If a product is unavailable, politely explain that and suggest similar ones or search other budget ranges (e.g. search under 1500 if under 1000 is unavailable).
- If the customer requests a human or customer support, immediately call handoffToHuman().
- If the customer wants to buy, order, or checkout a product, call startCheckout(productName).
- Always maintain the context of the conversation (e.g., if they ask to filter a previous search by color, understand the query applies to the products previously discussed).
- When multiple products are returned by a search, generate smart recommendations like "Based on your budget, I recommend the Tokyo Streetwear Hoodie because it offers the best value..." rather than just listing them raw.
- Never expose internal database details.`
    }
  ];

  dbMessages.forEach(msg => {
    openaiMessages.push({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    });
  });

  try {
    let responseMessage = await getLlmResponse(openaiMessages, tools);

    let loopCount = 0;
    while (responseMessage.tool_calls && responseMessage.tool_calls.length > 0 && loopCount < 5) {
      loopCount++;
      openaiMessages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const name = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        console.log(`[LLM Tool Call] Executing ${name} for ${phone} with args:`, args);

        const result = await executeTool(name, args, phone);
        console.log(`[LLM Tool Result] for ${name}:`, result);

        openaiMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: name,
          content: JSON.stringify(result)
        });
      }

      responseMessage = await getLlmResponse(openaiMessages, tools);
    }

    const finalReply = responseMessage.content || "I'm sorry, I encountered an issue. Let me connect you to support.";
    
    // Save response in history
    await WhatsAppMessage.create({
      phone,
      sender: 'ai',
      text: finalReply
    });

    await whatsappService.sendMessage(phone, finalReply);

  } catch (err) {
    console.error('LLM API error:', err.message);
    throw err; // propagates to aiService.js for rule-based fallback
  }
};

exports.executeTool = executeTool;
exports.rewriteRoboticReply = rewriteRoboticReply;
