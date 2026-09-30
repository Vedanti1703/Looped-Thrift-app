const router = require('express').Router();
const auth = require('../middleware/auth');
const { getCart, addToCart, removeFromCart } = require('../controllers/cartController');

router.get('/', auth, getCart);
router.post('/add', auth, addToCart);
router.delete('/remove/:productId', auth, removeFromCart);

module.exports = router;
