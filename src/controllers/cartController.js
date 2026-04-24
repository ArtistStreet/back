const Cart = require('../models/Cart');
const Product = require('../models/Product');

exports.getCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id }).populate("items.product", "stock");
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }
  const items = (cart.items || []).map((item) => {
    const obj = item.toObject();
    if (item.product && typeof item.product === "object") {
      obj.stock = item.product.stock;
      obj.product = item.product._id;
    } else {
      obj.stock = 0;
    }
    return obj;
  });
  res.json({ ...cart.toObject(), items });
};

exports.addItem = async (req, res) => {
  const { productId, quantity } = req.body;
  const qty = Math.max(1, Number(quantity || 1));
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  }
  const idx = cart.items.findIndex(
    (i) => String(i.product) === String(productId),
  );
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
  // Return updated cart with stock
  const updatedCart = await Cart.findById(cart._id).populate(
    "items.product",
    "stock",
  );
  const items = (updatedCart.items || []).map((item) => {
    const obj = item.toObject();
    if (item.product && typeof item.product === "object") {
      obj.stock = item.product.stock;
      obj.product = item.product._id;
    } else {
      obj.stock = 0;
    }
    return obj;
  });
  res.status(200).json({ ...updatedCart.toObject(), items });
};

exports.updateItem = async (req, res) => {
  const productId = req.params.productId;
  const { quantity } = req.body;
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });
  const idx = cart.items.findIndex(
    (i) => String(i.product) === String(productId),
  );
  if (idx < 0) return res.status(404).json({ message: "Item not found" });

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const qty = Number(quantity);
  if (qty <= 0) {
    cart.items.splice(idx, 1);
  } else {
    if (qty > product.stock) {
      return res.status(400).json({
        message: `Chỉ còn ${product.stock} sản phẩm trong kho`,
        stock: product.stock,
      });
    }
    cart.items[idx].quantity = qty;
  }
  await cart.save();
  const updatedCart = await Cart.findById(cart._id).populate(
    "items.product",
    "stock",
  );
  const items = (updatedCart.items || []).map((item) => {
    const obj = item.toObject();
    if (item.product && typeof item.product === "object") {
      obj.stock = item.product.stock;
      obj.product = item.product._id;
    } else {
      obj.stock = 0;
    }
    return obj;
  });
  res.json({ ...updatedCart.toObject(), items });
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

