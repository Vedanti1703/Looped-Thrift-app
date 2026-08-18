const router = require('express').Router();
const auth = require('../middleware/auth');
const { getProducts, getProduct, createProduct, seedProducts } = require('../controllers/productController');

router.get('/', getProducts);
router.get('/:id', getProduct);
router.post('/', auth, createProduct);
router.post('/admin/seed', seedProducts); // dev only

module.exports = router;
