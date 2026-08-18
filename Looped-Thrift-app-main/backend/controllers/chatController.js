const { Conversation, Message } = require('../models/Message');
const mongoose = require('mongoose');
const loopedAi = require('./loopedAiController');

// GET /chat/conversations
// Get all conversations for the logged-in user (auto-ensures assistant convo is created)
exports.getConversations = async (req, res) => {
  try {
    const assistantUser = await loopedAi.getOrCreateAssistantUser();
    
    if (assistantUser) {
      // Check if general conversation with assistant exists
      let assistantConvo = await Conversation.findOne({
        buyerId: req.userId,
        sellerId: assistantUser._id,
        productId: { $exists: false }
      });

      if (!assistantConvo) {
        const User = require('../models/User');
        const buyer = await User.findById(req.userId).select('name email');
        const buyerName = buyer?.name || buyer?.email?.split('@')[0] || 'Buyer';

        assistantConvo = await Conversation.create({
          buyerId: req.userId,
          buyerName,
          sellerId: assistantUser._id,
          sellerName: 'Looped AI',
          lastMessage: 'Hi 👋 Welcome to Looped! Ask me anything about policies, products, or order a style! 😊',
          lastMessageAt: new Date(),
        });

        // Create the greeting message in Messages
        await Message.create({
          conversationId: assistantConvo._id,
          senderId: assistantUser._id,
          senderName: 'Looped AI',
          text: 'Hi 👋 Welcome to Looped! Ask me anything about policies, products, or order a style! 😊',
        });
      }
    }

    const conversations = await Conversation.find({
      $or: [{ buyerId: req.userId }, { sellerId: req.userId }]
    }).sort({ lastMessageAt: -1 });
    res.json(conversations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /chat/conversation
// Start or get existing conversation between buyer and seller about a product
exports.getOrCreateConversation = async (req, res) => {
  try {
    const { productId, productTitle, productImage, sellerId, sellerName } = req.body;
    const buyerId   = req.userId;

    // If matching Looped AI, look up the assistant user
    let actualSellerId = sellerId;
    let actualSellerName = sellerName;
    if (sellerName === 'Looped AI') {
      const assistantUser = await loopedAi.getOrCreateAssistantUser();
      if (assistantUser) {
        actualSellerId = assistantUser._id;
        actualSellerName = 'Looped AI';
      }
    }

    // Check if conversation already exists
    let convo = await Conversation.findOne({ productId, buyerId, sellerId: actualSellerId });

    if (!convo) {
      // Get buyer name from User model
      const User   = require('../models/User');
      const buyer  = await User.findById(buyerId).select('name email');
      const buyerName = buyer?.name || buyer?.email?.split('@')[0] || 'Buyer';

      convo = await Conversation.create({
        productId, productTitle, productImage,
        buyerId, buyerName,
        sellerId: actualSellerId, sellerName: actualSellerName,
      });
    }

    res.json(convo);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /chat/messages/:conversationId
// Get all messages in a conversation (with poll — called every 3s by frontend)
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Verify user is part of this conversation
    const convo = await Conversation.findById(conversationId);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant =
      convo.buyerId.toString()  === req.userId ||
      convo.sellerId.toString() === req.userId;

    if (!isParticipant) return res.status(403).json({ message: 'Not authorised' });

    const messages = await Message.find({ conversationId }).sort({ createdAt: 1 });

    // Mark messages as read for this user
    await Message.updateMany(
      { conversationId, senderId: { $ne: req.userId }, read: false },
      { $set: { read: true } }
    );

    // Reset unread count for this user
    const isBuyer = convo.buyerId.toString() === req.userId;
    await Conversation.findByIdAndUpdate(conversationId, {
      [isBuyer ? 'unreadBuyer' : 'unreadSeller']: 0
    });

    res.json({ conversation: convo, messages });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /chat/messages
// Send a message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Message cannot be empty' });

    const convo = await Conversation.findById(conversationId);
    if (!convo) return res.status(404).json({ message: 'Conversation not found' });

    const isParticipant =
      convo.buyerId.toString()  === req.userId ||
      convo.sellerId.toString() === req.userId;
    if (!isParticipant) return res.status(403).json({ message: 'Not authorised' });

    // Get sender name
    const User   = require('../models/User');
    const sender = await User.findById(req.userId).select('name email');
    const senderName = sender?.name || sender?.email?.split('@')[0] || 'User';

    // Save the message
    const message = await Message.create({
      conversationId,
      senderId: req.userId,
      senderName,
      text: text.trim(),
    });

    // Update conversation last message
    const isBuyer = convo.buyerId.toString() === req.userId;
    
    // Check if recipient is Looped AI
    const assistantUser = await loopedAi.getOrCreateAssistantUser();
    const isConvoWithAssistant = assistantUser && convo.sellerId.toString() === assistantUser._id.toString();

    if (isConvoWithAssistant) {
      // AI assistant replies immediately
      const replyText = await loopedAi.generateResponse(text.trim(), convo, req.userId);
      
      // Save assistant message
      await Message.create({
        conversationId,
        senderId: assistantUser._id,
        senderName: 'Looped AI',
        text: replyText,
      });

      // Update conversation with AI's reply and reset unreadSeller (since bot read it)
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage:   replyText,
        lastMessageAt: new Date(),
        unreadBuyer:   1, // Notify user
        unreadSeller:  0
      });
    } else {
      // Normal seller conversation update
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage:   text.trim(),
        lastMessageAt: new Date(),
        $inc: { [isBuyer ? 'unreadSeller' : 'unreadBuyer']: 1 }
      });
    }

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
