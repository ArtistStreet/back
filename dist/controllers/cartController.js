"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const Cart = require('../models/Cart');
const Product = require('../models/Product');
exports.getCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let cart = yield Cart.findOne({ user: req.user._id }).populate("items.product", "stock");
    if (!cart) {
        cart = yield Cart.create({ user: req.user._id, items: [] });
    }
    const items = (cart.items || []).map((item) => {
        const obj = item.toObject();
        if (item.product && typeof item.product === "object") {
            obj.stock = item.product.stock;
            obj.product = item.product._id;
        }
        else {
            obj.stock = 0;
        }
        return obj;
    });
    res.json(Object.assign(Object.assign({}, cart.toObject()), { items }));
});
exports.addItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { productId, quantity } = req.body;
    const qty = Math.max(1, Number(quantity || 1));
    const product = yield Product.findById(productId);
    if (!product)
        return res.status(404).json({ message: "Product not found" });
    let cart = yield Cart.findOne({ user: req.user._id });
    if (!cart) {
        cart = yield Cart.create({ user: req.user._id, items: [] });
    }
    const idx = cart.items.findIndex((i) => String(i.product) === String(productId));
    if (idx >= 0) {
        cart.items[idx].quantity += qty;
    }
    else {
        cart.items.push({
            product: product._id,
            name: product.name,
            image: product.image,
            price: product.price,
            quantity: qty,
        });
    }
    yield cart.save();
    // Return updated cart with stock
    const updatedCart = yield Cart.findById(cart._id).populate("items.product", "stock");
    const items = (updatedCart.items || []).map((item) => {
        const obj = item.toObject();
        if (item.product && typeof item.product === "object") {
            obj.stock = item.product.stock;
            obj.product = item.product._id;
        }
        else {
            obj.stock = 0;
        }
        return obj;
    });
    res.status(200).json(Object.assign(Object.assign({}, updatedCart.toObject()), { items }));
});
exports.updateItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const productId = req.params.productId;
    const { quantity } = req.body;
    let cart = yield Cart.findOne({ user: req.user._id });
    if (!cart)
        return res.status(404).json({ message: "Cart not found" });
    const idx = cart.items.findIndex((i) => String(i.product) === String(productId));
    if (idx < 0)
        return res.status(404).json({ message: "Item not found" });
    const product = yield Product.findById(productId);
    if (!product)
        return res.status(404).json({ message: "Product not found" });
    const qty = Number(quantity);
    if (qty <= 0) {
        cart.items.splice(idx, 1);
    }
    else {
        if (qty > product.stock) {
            return res.status(400).json({
                message: `Chỉ còn ${product.stock} sản phẩm trong kho`,
                stock: product.stock,
            });
        }
        cart.items[idx].quantity = qty;
    }
    yield cart.save();
    const updatedCart = yield Cart.findById(cart._id).populate("items.product", "stock");
    const items = (updatedCart.items || []).map((item) => {
        const obj = item.toObject();
        if (item.product && typeof item.product === "object") {
            obj.stock = item.product.stock;
            obj.product = item.product._id;
        }
        else {
            obj.stock = 0;
        }
        return obj;
    });
    res.json(Object.assign(Object.assign({}, updatedCart.toObject()), { items }));
});
exports.removeItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const productId = req.params.productId;
    let cart = yield Cart.findOne({ user: req.user._id });
    if (!cart)
        return res.status(404).json({ message: 'Cart not found' });
    cart.items = cart.items.filter((i) => String(i.product) !== String(productId));
    yield cart.save();
    res.json(cart);
});
exports.clearCart = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    let cart = yield Cart.findOne({ user: req.user._id });
    if (!cart) {
        cart = yield Cart.create({ user: req.user._id, items: [] });
    }
    else {
        cart.items = [];
        yield cart.save();
    }
    res.json(cart);
});
