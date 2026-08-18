const sendWhatsApp = require('../utils/sendWhatsApp');
const { WhatsAppMessage } = require('../models/WhatsAppConversation');

exports.sendMessage = async (to, text) => {
  try {
    await WhatsAppMessage.create({
      phone: to,
      sender: 'ai',
      text: text
    });
  } catch (err) {
    console.error('Error saving WhatsAppMessage (AI response):', err);
  }

  return await sendWhatsApp(to, text);
};
