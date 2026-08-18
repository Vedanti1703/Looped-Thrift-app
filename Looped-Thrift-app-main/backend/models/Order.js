const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  productName: { type: String, required: true },
  size: { type: String, default: '' },
  color: { type: String, default: '' },
  quantity: { type: Number, default: 1 },
  address: { type: String, required: true },
  totalAmount: { type: Number, required: true },
  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  estimatedDelivery: { type: String, default: '3-5 business days' }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
