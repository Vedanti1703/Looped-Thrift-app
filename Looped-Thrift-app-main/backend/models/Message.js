const mongoose = require('mongoose');

// A Conversation is between a buyer and a seller about a specific product
const conversationSchema = new mongoose.Schema({
  productId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  productTitle:{ type: String },
  productImage:{ type: String },
  buyerId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  buyerName:   { type: String },
  sellerId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  sellerName:  { type: String },
  lastMessage: { type: String, default: '' },
  lastMessageAt:{ type: Date, default: Date.now },
  unreadBuyer:  { type: Number, default: 0 },
  unreadSeller: { type: Number, default: 0 },
  loopedAiState:{
    step: { type: String, default: 'idle' },
    orderData: {
      productName: { type: String, default: '' },
      size: { type: String, default: '' },
      color: { type: String, default: '' },
      quantity: { type: Number, default: 1 },
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' }
    }
  }
}, { timestamps: true });

// A Message belongs to a conversation
const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
  senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName:     { type: String },
  text:           { type: String, required: true },
  read:           { type: Boolean, default: false },
}, { timestamps: true });

const Conversation = mongoose.model('Conversation', conversationSchema);
const Message      = mongoose.model('Message',      messageSchema);

module.exports = { Conversation, Message };
