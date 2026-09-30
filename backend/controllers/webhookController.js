const crypto = require('crypto');
const aiService = require('../services/aiService');

// Verify webhook signature (x-hub-signature-256)
function verifySignature(req) {
  const appSecret = process.env.APP_SECRET;
  if (!appSecret) {
    console.warn('⚠️ WARNING: APP_SECRET is not set. Webhook signature verification skipped.');
    return true;
  }

  const signature = req.headers['x-hub-signature-256'];
  if (!signature) {
    console.error('❌ Signature verification failed: Header x-hub-signature-256 is missing.');
    return false;
  }

  const parts = signature.split('=');
  const signatureHash = parts[1];
  
  if (!req.rawBody) {
    console.error('❌ Signature verification failed: req.rawBody is missing. Configure express.json verify middleware.');
    return false;
  }

  const expectedHash = crypto
    .createHmac('sha256', appSecret)
    .update(req.rawBody)
    .digest('hex');

  if (signatureHash !== expectedHash) {
    console.error('❌ Signature verification failed: Hash mismatch.');
    return false;
  }

  return true;
}

exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'looped_verify_token';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    return res.status(200).send(challenge);
  }
  
  console.error('❌ Webhook verification failed. Tokens mismatch.');
  return res.sendStatus(403);
};

exports.handleWebhook = async (req, res) => {
  try {
    if (!verifySignature(req)) {
      return res.status(401).send('Signature verification failed');
    }

    const body = req.body;

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;
      const message = value?.messages?.[0];

      if (message) {
        const from = message.from;
        const text = message.text?.body || '';
        const senderName = value.contacts?.[0]?.profile?.name || 'Customer';

        console.log(`💬 Incoming WhatsApp message from ${from} (${senderName}): "${text}"`);

        aiService.processIncomingMessage(from, text, senderName).catch(err => {
          console.error(`❌ Error in processIncomingMessage for ${from}:`, err);
        });
      }
      
      return res.status(200).send('EVENT_RECEIVED');
    }

    return res.sendStatus(404);
  } catch (err) {
    console.error('❌ Webhook error:', err);
    return res.sendStatus(500);
  }
};
