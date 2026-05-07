const Cart = require('../models/Cart');
const Product = require('../models/Product');

const CART_PRODUCT_FIELDS = "stock name image price";

const loadCartWithProducts = (userId) =>
  Cart.findOne({ user: userId }).populate("items.product", CART_PRODUCT_FIELDS);

const pruneMissingProducts = async (cart) => {
  if (!cart || !Array.isArray(cart.items)) return cart;
  const kept = cart.items.filter(
    (item) => item.product && typeof item.product === "object",
  );
  if (kept.length !== cart.items.length) {
    cart.items = kept;
    await cart.save();
    return loadCartWithProducts(cart.user);
  }
  return cart;
};

const toCartResponse = (cart) => {
  const items = (cart.items || []).map((item) => {
    const obj = item.toObject();
    if (item.product && typeof item.product === "object") {
      obj.stock = item.product.stock;
      obj.name = item.product.name || obj.name;
      obj.image = item.product.image || obj.image;
      obj.price =
        typeof item.product.price === "number" ? item.product.price : obj.price;
      obj.product = item.product._id;
    } else {
      obj.stock = 0;
    }
    return obj;
  });
  return { ...cart.toObject(), items };
};

exports.getCart = async (req, res) => {
  let cart = await loadCartWithProducts(req.user._id);
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
    cart = await loadCartWithProducts(req.user._id);
  }
  cart = await pruneMissingProducts(cart);
  res.json(toCartResponse(cart));
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
  let updatedCart = await loadCartWithProducts(req.user._id);
  updatedCart = await pruneMissingProducts(updatedCart);
  res.status(200).json(toCartResponse(updatedCart));
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
  let updatedCart = await loadCartWithProducts(req.user._id);
  updatedCart = await pruneMissingProducts(updatedCart);
  res.json(toCartResponse(updatedCart));
};

exports.removeItem = async (req, res) => {
  const productId = String(req.params.productId || "")
    .trim()
    .replace(/^"+|"+$/g, "");
  if (!productId) {
    return res.status(400).json({ message: "Thiếu productId" });
  }

  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) return res.status(404).json({ message: "Cart not found" });

  const beforeCount = cart.items.length;
  await Cart.updateOne(
    { user: req.user._id },
    { $pull: { items: { product: productId } } },
  );

  let updatedCart = await loadCartWithProducts(req.user._id);
  updatedCart = await pruneMissingProducts(updatedCart);
  const afterCount = (updatedCart?.items || []).length;
  if (beforeCount === afterCount) {
    return res.status(404).json({ message: "Item not found in cart" });
  }
  res.json(toCartResponse(updatedCart));
};

exports.clearCart = async (req, res) => {
  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) {
    cart = await Cart.create({ user: req.user._id, items: [] });
  } else {
    cart.items = [];
    await cart.save();
  }
  let updatedCart = await loadCartWithProducts(req.user._id);
  updatedCart = await pruneMissingProducts(updatedCart);
  res.json(toCartResponse(updatedCart));
};


