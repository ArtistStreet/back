const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  originalPrice: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  image: { type: String, required: true },
  rating: { type: Number, default: 0 },
  sold: { type: Number, default: 0 },
  category: { type: String, required: true },
  isMall: { type: Boolean, default: false },
  description: { type: String },
  stock: { type: Number, default: 999 }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);
