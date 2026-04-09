const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const authController = require("../controllers/authController");
const orderController = require("../controllers/orderController");
const voucherController = require("../controllers/voucherController");
const notificationController = require("../controllers/notificationController");
const reviewController = require("../controllers/reviewController");
const { protect, admin } = require("../middleware/authMiddleware");
const mongoose = require("mongoose");
const cartController = require("../controllers/cartController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const avatarUploadDir = path.join(__dirname, "..", "..", "uploads", "avatars");
if (!fs.existsSync(avatarUploadDir)) {
  fs.mkdirSync(avatarUploadDir, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, avatarUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    const safeUserId =
      req.user && req.user._id ? String(req.user._id) : "anonymous";
    cb(null, `${safeUserId}-${Date.now()}${ext}`);
  },
});

const uploadAvatar = multer({ storage: avatarStorage });

// Auth routes
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.get("/auth/profile", protect, authController.getProfile);
router.put("/auth/profile", protect, authController.updateProfile);
router.put("/auth/password", protect, authController.changePassword);
router.post(
  "/auth/avatar",
  protect,
  uploadAvatar.single("avatar"),
  authController.uploadAvatar
);
router.get("/auth/addresses", protect, authController.getAddresses);
router.post("/auth/addresses", protect, authController.addAddress);
router.put("/auth/addresses/:id", protect, authController.updateAddress);
router.delete("/auth/addresses/:id", protect, authController.deleteAddress);
router.put(
  "/auth/addresses/:id/default",
  protect,
  authController.setDefaultAddress
);

// Product routes
router.get("/products", productController.getProducts);
router.get("/products/:id", productController.getProductById);
router.post("/products", protect, admin, productController.createProduct); // Protected for admin
router.put("/products/:id", protect, admin, productController.updateProduct); // Protected for admin
router.delete("/products/:id", protect, admin, productController.deleteProduct); // Protected for admin

// Order routes
router.post("/orders", protect, orderController.createOrder);
router.get("/orders/my", protect, orderController.getMyOrders);
router.put("/orders/:id/cancel", protect, orderController.cancelOrder);

// Cart routes
router.get("/cart", protect, cartController.getCart);
router.post("/cart/add", protect, cartController.addItem);
router.put("/cart/item/:productId", protect, cartController.updateItem);
router.delete("/cart/item/:productId", protect, cartController.removeItem);
router.delete("/cart", protect, cartController.clearCart);

// Dashboard routes
router.get(
  "/dashboard/stats",
  protect,
  admin,
  orderController.getDashboardStats
);

// Notification routes
router.get("/notifications", protect, notificationController.getNotifications);
router.put(
  "/notifications/:id/read",
  protect,
  notificationController.markAsRead
);

// Review routes
router.post("/reviews", protect, reviewController.createReview);
router.get("/products/:productId/reviews", reviewController.getProductReviews);
router.get("/reviews", protect, admin, reviewController.getAllReviews);
router.delete("/reviews/:id", protect, admin, reviewController.deleteReview);

router.post("/chatbot", productController.chatbotResponse);

// Voucher routes
router.get("/vouchers/my", protect, voucherController.getMyVouchers);
router.get("/vouchers/discover", protect, voucherController.getDiscover);
router.get("/vouchers/history", protect, voucherController.getHistory);
router.post("/vouchers/add", protect, voucherController.addVoucher);

// Health check - DB connection status
router.get("/health/db", (_req, res) => {
  const conn = mongoose.connection;
  const state = conn.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
  const stateText =
    state === 1
      ? "connected"
      : state === 2
        ? "connecting"
        : state === 3
          ? "disconnecting"
          : "disconnected";
  res.json({
    connected: state === 1,
    state,
    stateText,
    name: conn.name || null,
    host: conn.host || null,
    port: conn.port || null,
  });
});

module.exports = router;
