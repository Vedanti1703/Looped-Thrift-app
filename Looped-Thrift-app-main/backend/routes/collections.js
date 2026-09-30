const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  getCollections,
  getCollection,
  createCollection,
  addItemToCollection,
  removeItemFromCollection,
  deleteCollection
} = require('../controllers/collectionController');

// All collection operations require authentication
router.use(auth);

router.get('/', getCollections);
router.get('/:id', getCollection);
router.post('/', createCollection);
router.post('/:id/items', addItemToCollection);
router.delete('/:id/items/:productId', removeItemFromCollection);
router.delete('/:id', deleteCollection);

module.exports = router;
