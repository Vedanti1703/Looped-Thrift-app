const router = require('express').Router();
const auth = require('../middleware/auth');
const { getProfile, likeItem, swipeItem } = require('../controllers/userController');

// Optional auth helper for swipe & like dev requests
const optionalAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    return auth(req, res, next);
  }
  next();
};

router.get('/profile', auth, getProfile);
router.post('/like', optionalAuth, likeItem);
router.post('/swipe', optionalAuth, swipeItem);

module.exports = router;

