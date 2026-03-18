const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.getCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }
  res.json(cart);
};

exports.addItem = async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Math.max(1, Number(quantity || 1));
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }
  const idx = cart.items.findIndex((i) => String(i.product) === String(productId));
  if (idx >= 0) {
    cart.items[idx].quantity += qty;
  } else {
    cart.items.push({
      product: product._id,
      name: product.name,
      image: product.image,
      price: product.price,
      quantity: qty,
    });
  }
  await cart.save();
  res.status(200).json(cart);
};

exports.updateItem = async (req, res) => {
  const productId = req.params.productId;
  const { quantity } = req.body;
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });
  const idx = cart.items.findIndex((i) => String(i.product) === String(productId));
  if (idx < 0) return res.status(404).json({ message: 'Item not found' });
  const qty = Number(quantity);
  if (qty <= 0) {
    cart.items.splice(idx, 1);
  } else {
    cart.items[idx].quantity = qty;
  }
  await cart.save();
  res.json(cart);
};

exports.removeItem = async (req, res) => {
  const productId = req.params.productId;
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: 'Cart not found' });
  cart.items = cart.items.filter((i) => String(i.product) !== String(productId));
  await cart.save();
  res.json(cart);
};

exports.clearCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  } else {
    cart.items = [];
    await cart.save();
  }
  res.json(cart);
};
