const router = require('express').Router();
const auth = require('../middleware/auth');
const { getProfile, likeItem } = require('../controllers/userController');

router.get('/profile', auth, getProfile);
router.post('/like', auth, likeItem);

module.exports = router;
