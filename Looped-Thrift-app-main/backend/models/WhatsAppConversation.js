const mongoose = require('mongoose');

const whatsappConversationSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  name: { type: String, default: '' },
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  loopedAiState: {
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
  },
  humanSupportRequired: { type: Boolean, default: false }
}, { timestamps: true });

const whatsappMessageSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  sender: { type: String, enum: ['user', 'ai', 'human'], required: true },
  text: { type: String, required: true },
}, { timestamps: true });

const WhatsAppConversation = mongoose.model('WhatsAppConversation', whatsappConversationSchema);
const WhatsAppMessage = mongoose.model('WhatsAppMessage', whatsappMessageSchema);

module.exports = { WhatsAppConversation, WhatsAppMessage };
