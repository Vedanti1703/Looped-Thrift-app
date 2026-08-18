const axios = require('axios');

async function sendWhatsApp(to, text) {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || 'v23.0';

  if (!token || token === 'your_token' || !phoneNumberId || phoneNumberId === 'your_phone_id') {
    console.warn('⚠️ WhatsApp credentials missing or placeholder. Mocking message send.');
    console.log(`[MOCK SEND] To: ${to}, Message: "${text.replace(/\n/g, '\n            ')}"`);
    return { mock: true, success: true };
  }

  try {
    const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
    const response = await axios.post(
      url,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log(`✅ WhatsApp message sent to ${to}. Message ID:`, response.data?.messages?.[0]?.id);
    return response.data;
  } catch (err) {
    console.error(`❌ Error sending WhatsApp message to ${to}:`, err.response?.data || err.message);
    throw err;
  }
}

module.exports = sendWhatsApp;
