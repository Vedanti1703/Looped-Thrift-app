const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const sizeController = require('../controllers/sizeController');

router.get('/profile', auth, sizeController.getSizeProfile);
router.post('/profile', auth, sizeController.saveSizeProfile);
router.get('/predict/:productId', auth, sizeController.predictFit);

module.exports = router;
