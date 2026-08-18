const Product = require('../models/Product');
const Order = require('../models/Order');

// Seeding the assistant user (ran once or verified on server startup)
exports.getOrCreateAssistantUser = async () => {
  const User = require('../models/User');
  try {
    let assistant = await User.findOne({ email: 'assistant@looped.app' });
    if (!assistant) {
      assistant = await User.create({
        email: 'assistant@looped.app',
        password: '$2a$10$NotRealPasswordUsedForLoopedAIAssistantToken12345',
        name: 'Looped AI',
        avatar: '🤖',
        isVerified: true
      });
      console.log('🤖 Looped AI assistant user created successfully.');
    }
    return assistant;
  } catch (err) {
    console.error('Error seeding assistant user:', err);
    return null;
  }
};

// Generates response based on message content and state
exports.generateResponse = async (text, conversation, userId) => {
  const msg = text.trim();
  const msgLower = msg.toLowerCase();
  
  // Initialize state if not present
  if (!conversation.loopedAiState) {
    conversation.loopedAiState = { step: 'idle', orderData: {} };
  }
  const state = conversation.loopedAiState;

  // 1. Check for immediate Escalation rules
  const escalationKeywords = [
    'manager', 'human', 'support', 'agent', 'executive', 'refund dispute',
    'payment failed', 'failed payment', 'legal', 'abuse', 'hack', 'scam',
    'missing order', 'stole', 'technical issue', 'bug', 'error', 'fraud'
  ];
  
  if (escalationKeywords.some(kw => msgLower.includes(kw))) {
    state.step = 'idle';
    state.orderData = {};
    conversation.loopedAiState = state;
    await conversation.save();
    return "I'll connect you with one of our support executives who can assist further.";
  }

  // 2. Order Cancellation General Flow
  if (msgLower.includes('cancel order') || msgLower.includes('cancel my order') || msgLower.includes('stop order')) {
    if (state.step !== 'idle') {
      state.step = 'idle';
      state.orderData = {};
      conversation.loopedAiState = state;
      await conversation.save();
      return "No worries! I've cancelled the order setup. Let me know if you need help with anything else. 😊";
    }
    
    // Extract potential order ID
    const ordMatch = msg.match(/LOOPED-ORD-\d+/i);
    if (ordMatch) {
      return `Got it. I've successfully cancelled your order ${ordMatch[0].toUpperCase()}. Any refund will be processed in 5-7 business days. 👍`;
    }
    
    return "I can help with that! Could you please tell me your Order ID (like LOOPED-ORD-123456) so I can cancel it? ❌";
  }

  // 3. Multi-step Order Collection state machine
  if (state.step !== 'idle') {
    return await handleOrderFlow(msg, conversation);
  }

  // 4. Intent detection for buying/checkout
  const buyKeywords = ['buy', 'order', 'purchase', 'checkout', 'want to get', 'add to cart'];
  if (buyKeywords.some(kw => msgLower.includes(kw) && !msgLower.includes('cancel') && !msgLower.includes('how to'))) {
    // If convo is about a specific product, prefill it!
    if (conversation.productId) {
      try {
        const product = await Product.findById(conversation.productId);
        if (product) {
          state.step = 'collecting_name';
          state.orderData = {
            productName: product.title,
            size: product.size || 'M',
            color: 'As shown',
            quantity: 1,
            name: '',
            phone: '',
            address: ''
          };
          conversation.loopedAiState = state;
          await conversation.save();
          return `Sure! I'd love to help you order the *${product.title}* (₹${product.price}). Size is ${product.size || 'M'}.\n\nWhat is your full name to start? 👋`;
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    // Default buy path if no product context
    state.step = 'collecting_product_name';
    state.orderData = { productName: '', size: '', color: '', quantity: 1, name: '', phone: '', address: '' };
    conversation.loopedAiState = state;
    await conversation.save();
    return "Sure! I'd love to help you place an order. What is the name of the product you want to buy? 🛍️";
  }

  // 5. Product Recommendations
  if (msgLower.includes('recommend') || msgLower.includes('suggest') || msgLower.includes('show me') || msgLower.includes('need a') || msgLower.includes('looking for')) {
    return await handleRecommendations(msgLower);
  }

  // 6. Negotiation
  if (msgLower.includes('discount') || msgLower.includes('cheaper') || msgLower.includes('lower price') || msgLower.includes('negotiate') || msgLower.includes('reduce') || msgLower.includes('coupon')) {
    // Check if they previously negotiated in message history, or just objection first
    const prevMsgs = await require('../models/Message').Message.find({ conversationId: conversation._id }).sort({ createdAt: -1 }).limit(10);
    const didNegotiateBefore = prevMsgs.some(m => m.text.includes('competitively priced'));
    
    if (didNegotiateBefore || msgLower.includes('coupon') || msgLower.includes('code')) {
      return "Since you love it, I can offer our approved first-time customer discount of 10%! Use coupon code *LOOPED10* at checkout. 😊";
    }
    return "This product is already competitively priced because it's thrifted and quality-checked.";
  }

  // 7. Policy and FAQ answers
  if (msgLower.includes('return') || msgLower.includes('refund')) {
    return "We accept returns within 7 days of delivery only if the item is not as described or has undisclosed damage. Refunds are processed after verification.";
  }
  if (msgLower.includes('exchange')) {
    return "Since we are a thrift marketplace with unique one-off items, we do not support direct exchanges. However, you can return qualifying items or list them back on the platform!";
  }
  if (msgLower.includes('shipping') || msgLower.includes('delivery') || msgLower.includes('cod') || msgLower.includes('charge') || msgLower.includes('timeline')) {
    return "Estimated delivery is 3-5 business days. Shipping is ₹80, and free for orders above ₹1500. Cash on Delivery (COD) and pickup options are available!";
  }
  if (msgLower.includes('payment') || msgLower.includes('pay')) {
    return "We support UPI, Credit/Debit cards, Net Banking, and Cash on Delivery (COD).";
  }
  if (msgLower.includes('quality') || msgLower.includes('condition') || msgLower.includes('thrift')) {
    return "All items on Looped are quality-checked and categorized (New with tags, Like New, Good, Fair, Well Loved) so you know exactly what you are getting!";
  }

  // 8. Basic greetings
  const greetings = ['hi', 'hello', 'hey', 'good morning', 'good afternoon', 'good evening', 'yo', 'sup'];
  if (greetings.some(g => msgLower.startsWith(g))) {
    return "Hi 👋 Welcome to Looped! I'm Looped AI, your thrift assistant. How can I help you find or order style today? 😊";
  }

  // 9. Fallback message (In Character)
  return "I'm not completely sure about that. Let me connect you with our support team.";
};

// State machine handler for placing orders step-by-step
async function handleOrderFlow(msg, conversation) {
  const state = conversation.loopedAiState;
  const msgLower = msg.toLowerCase();

  switch (state.step) {
    case 'collecting_product_name':
      state.orderData.productName = msg;
      state.step = 'collecting_size';
      break;
    case 'collecting_size':
      state.orderData.size = msg;
      state.step = 'collecting_color';
      break;
    case 'collecting_color':
      state.orderData.color = msg;
      state.step = 'collecting_quantity';
      break;
    case 'collecting_quantity':
      const qty = parseInt(msg);
      state.orderData.quantity = isNaN(qty) || qty <= 0 ? 1 : qty;
      state.step = 'collecting_name';
      break;
    case 'collecting_name':
      state.orderData.name = msg;
      state.step = 'collecting_phone';
      break;
    case 'collecting_phone':
      state.orderData.phone = msg;
      state.step = 'collecting_address';
      break;
    case 'collecting_address':
      state.orderData.address = msg;
      state.step = 'confirming_order';
      
      conversation.loopedAiState = state;
      await conversation.save();
      
      return `Here is your order summary:\n\n` +
             `📦 *Product*: ${state.orderData.productName}\n` +
             `📐 *Size*: ${state.orderData.size}\n` +
             `🎨 *Color*: ${state.orderData.color}\n` +
             `🔢 *Quantity*: ${state.orderData.quantity}\n` +
             `👤 *Deliver to*: ${state.orderData.name}\n` +
             `📞 *Phone*: ${state.orderData.phone}\n` +
             `🏠 *Address*: ${state.orderData.address}\n\n` +
             `Does everything look correct? Reply *YES* to place the order, or *CANCEL* to stop. 👍`;
             
    case 'confirming_order':
      if (msgLower === 'yes' || msgLower === 'y' || msgLower.includes('correct') || msgLower.includes('right')) {
        const orderId = 'LOOPED-ORD-' + Math.floor(100000 + Math.random() * 900000);
        
        let productPrice = 1000;
        try {
          const product = await Product.findOne({ title: { $regex: state.orderData.productName, $options: 'i' } });
          if (product) {
            productPrice = product.price;
          }
        } catch (err) {
          console.warn('Could not retrieve product price for order creation:', err.message);
        }

        try {
          await Order.create({
            orderId,
            name: state.orderData.name || 'WhatsApp Customer',
            phone: state.orderData.phone || conversation.phone || '+1234567890',
            productName: state.orderData.productName,
            size: state.orderData.size,
            color: state.orderData.color,
            quantity: state.orderData.quantity || 1,
            address: state.orderData.address,
            totalAmount: productPrice * (state.orderData.quantity || 1),
            status: 'Pending',
            estimatedDelivery: '3-5 business days'
          });
        } catch (err) {
          console.error('Error creating order in DB:', err);
        }

        state.step = 'idle';
        state.orderData = {};
        conversation.loopedAiState = state;
        await conversation.save();
        return `Woohoo! Your order has been placed successfully. 🎉\n\n*Order ID*: ${orderId}\n\nEstimated delivery is 3-5 business days. Thanks for shopping sustainably with Looped! ♻️`;
      } else if (msgLower === 'cancel' || msgLower === 'no' || msgLower === 'n') {
        state.step = 'idle';
        state.orderData = {};
        conversation.loopedAiState = state;
        await conversation.save();
        return "Order cancelled. Let me know if you want to search or list other items! 😊";
      } else {
        return "Please reply with *YES* to place the order, or *CANCEL* to stop. 👍";
      }
    default:
      state.step = 'idle';
      state.orderData = {};
  }

  conversation.loopedAiState = state;
  await conversation.save();

  // Prompt for the next detail
  switch (state.step) {
    case 'collecting_size':
      return "Got it! What size do you need? (e.g. S, M, L, XL, or Free Size)";
    case 'collecting_color':
      return "Perfect. What color would you prefer?";
    case 'collecting_quantity':
      return "Nice! How many items of this would you like?";
    case 'collecting_name':
      return "Almost there! Could you please share your full name for the delivery?";
    case 'collecting_phone':
      return "Got it. What is your phone number for updates?";
    case 'collecting_address':
      return "And finally, what is the delivery address? 📍";
    default:
      return "Let me check that details...";
  }
}

// Handler for searching matching products in DB and recommending them
async function handleRecommendations(text) {
  try {
    // Extract keywords
    const keywords = text.replace(/recommend|suggest|show me|need a|looking for/g, '').trim().split(' ');
    
    // Build query conditions
    const matchConditions = keywords.map(kw => {
      if (kw.length < 2) return null;
      return {
        $or: [
          { title: { $regex: kw, $options: 'i' } },
          { tags: { $in: [kw.toLowerCase()] } },
          { category: { $regex: kw, $options: 'i' } },
          { brand: { $regex: kw, $options: 'i' } }
        ]
      };
    }).filter(Boolean);

    let query = {};
    if (matchConditions.length > 0) {
      query = { $or: matchConditions };
    }

    const matches = await Product.find(query).limit(3).lean();

    if (matches.length === 0) {
      // Fallback: list any 3 popular items
      const fallback = await Product.find().limit(3).lean();
      if (fallback.length === 0) {
        return "I'm sorry, I couldn't find any items available in our store right now. Let me know what styles you usually wear! 👗";
      }
      
      let reply = "I couldn't find exactly that, but here are some popular thrift items on Looped right now:\n\n";
      fallback.forEach((p, idx) => {
        reply += `${idx + 1}. *${p.title}* (${p.size || 'M'}) - ₹${p.price} [View](file:///product/${p._id})\n`;
      });
      return reply + "\nDo any of these catch your eye? 😊";
    }

    let reply = "Here's what I found matching your request:\n\n";
    matches.forEach((p, idx) => {
      reply += `${idx + 1}. *${p.title}* (${p.size || 'M'}) - ₹${p.price} [View](file:///product/${p._id})\n`;
    });
    return reply + "\nTap the links to view more photos or add to your cart! 🛍️";
  } catch (err) {
    console.error('Error fetching recommendations:', err);
    return "I'm not completely sure about that. Let me connect you with our support team.";
  }
}
