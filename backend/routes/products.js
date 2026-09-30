const router = require('express').Router();
const auth = require('../middleware/auth');
const { getProducts, getProduct, createProduct, seedProducts, searchNatural, searchVisual } = require('../controllers/productController');

router.get('/', getProducts);
router.post('/search-natural', searchNatural);
router.post('/search-visual', searchVisual);
router.get('/:id', getProduct);
router.post('/', auth, createProduct);
router.post('/admin/seed', seedProducts); // dev only

module.exports = router;
