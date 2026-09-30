const Collection = require('../models/Collection');
const Product = require('../models/Product');

// GET /collections — Get all collections for current user
exports.getCollections = async (req, res) => {
  try {
    const collections = await Collection.find({ userId: req.userId })
      .populate('productIds', 'title price originalPrice image condition tags')
      .sort({ updatedAt: -1 });

    res.json(collections || []);
  } catch (err) {
    console.error('Error fetching collections:', err);
    res.status(500).json({ message: err.message || 'Failed to load collections' });
  }
};

// GET /collections/:id — Get a single collection with populated products
exports.getCollection = async (req, res) => {
  try {
    const collection = await Collection.findOne({
      _id: req.params.id,
      userId: req.userId
    }).populate('productIds', 'title price originalPrice image condition tags brand size');

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json(collection);
  } catch (err) {
    console.error('Error fetching collection:', err);
    res.status(500).json({ message: err.message || 'Failed to load collection details' });
  }
};

// POST /collections — Create a new collection
exports.createCollection = async (req, res) => {
  try {
    const { name, productId } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Collection name is required' });
    }

    let coverImage = '';
    const initialProductIds = [];

    if (productId) {
      const product = await Product.findById(productId);
      if (product) {
        initialProductIds.push(product._id);
        coverImage = product.image || '';
      }
    }

    const newCollection = await Collection.create({
      name: name.trim(),
      userId: req.userId,
      productIds: initialProductIds,
      coverImage
    });

    const populatedCollection = await Collection.findById(newCollection._id)
      .populate('productIds', 'title price originalPrice image condition tags');

    res.status(201).json(populatedCollection);
  } catch (err) {
    console.error('Error creating collection:', err);
    res.status(500).json({ message: err.message || 'Failed to create collection' });
  }
};

// POST /collections/:id/items — Add an item to a collection
exports.addItemToCollection = async (req, res) => {
  try {
    const { productId } = req.body;
    if (!productId) {
      return res.status(400).json({ message: 'productId is required' });
    }

    const collection = await Collection.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    // Add if not already in collection
    const alreadyExists = collection.productIds.some(
      id => id.toString() === productId.toString()
    );

    if (!alreadyExists) {
      collection.productIds.push(product._id);
      if (!collection.coverImage && product.image) {
        collection.coverImage = product.image;
      }
      await collection.save();
    }

    const updated = await Collection.findById(collection._id)
      .populate('productIds', 'title price originalPrice image condition tags');

    res.json(updated);
  } catch (err) {
    console.error('Error adding item to collection:', err);
    res.status(500).json({ message: err.message || 'Failed to save item to collection' });
  }
};

// DELETE /collections/:id/items/:productId — Remove an item from a collection
exports.removeItemFromCollection = async (req, res) => {
  try {
    const { id, productId } = req.params;

    const collection = await Collection.findOne({
      _id: id,
      userId: req.userId
    });

    if (!collection) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    collection.productIds = collection.productIds.filter(
      pId => pId.toString() !== productId.toString()
    );

    await collection.save();

    const updated = await Collection.findById(collection._id)
      .populate('productIds', 'title price originalPrice image condition tags');

    res.json(updated);
  } catch (err) {
    console.error('Error removing item from collection:', err);
    res.status(500).json({ message: err.message || 'Failed to remove item from collection' });
  }
};

// DELETE /collections/:id — Delete a collection
exports.deleteCollection = async (req, res) => {
  try {
    const deleted = await Collection.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId
    });

    if (!deleted) {
      return res.status(404).json({ message: 'Collection not found' });
    }

    res.json({ success: true, message: 'Collection deleted successfully' });
  } catch (err) {
    console.error('Error deleting collection:', err);
    res.status(500).json({ message: err.message || 'Failed to delete collection' });
  }
};
