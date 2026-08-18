const router = require('express').Router();
const auth   = require('../middleware/auth');
const {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
} = require('../controllers/chatController');

router.get('/conversations',          auth, getConversations);
router.post('/conversation',          auth, getOrCreateConversation);
router.get('/messages/:conversationId', auth, getMessages);
router.post('/messages',              auth, sendMessage);

module.exports = router;
