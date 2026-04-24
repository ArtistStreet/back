var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const express = require("express");
const router = express.Router();
const productController = require("../controllers/productController");
const authController = require("../controllers/authController");
const orderController = require("../controllers/orderController");
const voucherController = require("../controllers/voucherController");
const notificationController = require("../controllers/notificationController");
const reviewController = require("../controllers/reviewController");
const chatController = require("../controllers/chatController");
const { protect, admin, isSeller } = require("../middleware/authMiddleware");
const mongoose = require("mongoose");
const cartController = require("../controllers/cartController");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const crypto = require("crypto");
const avatarUploadDir = path.join(__dirname, "..", "..", "uploads", "avatars");
const productUploadDir = path.join(__dirname, "..", "..", "uploads", "products");
const reviewUploadDir = path.join(__dirname, "..", "..", "uploads", "reviews");
if (!fs.existsSync(avatarUploadDir)) {
    fs.mkdirSync(avatarUploadDir, { recursive: true });
}
if (!fs.existsSync(productUploadDir)) {
    fs.mkdirSync(productUploadDir, { recursive: true });
}
if (!fs.existsSync(reviewUploadDir)) {
    fs.mkdirSync(reviewUploadDir, { recursive: true });
}
const imageUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            cb(new Error("Chỉ chấp nhận file ảnh"));
            return;
        }
        cb(null, true);
    },
});
const buildDiskFilename = (prefix, file) => {
    const ext = path.extname(file.originalname || "") || "";
    const fallbackExt = file.mimetype.startsWith("video/")
        ? `.${file.mimetype.split("/")[1] || "mp4"}`
        : ".bin";
    const randomSuffix = crypto.randomBytes(5).toString("hex");
    return `${prefix}-${Date.now()}-${randomSuffix}${ext || fallbackExt}`;
};
const hasAllowedVideoExt = (name = "") => /\.(mp4|mov|webm|mkv|avi)$/i.test(String(name));
const isVideoUpload = (file) => Boolean(file &&
    ((typeof file.mimetype === "string" &&
        file.mimetype.startsWith("video/")) ||
        hasAllowedVideoExt(file.originalname)));
const handleMulterUpload = (middleware) => (req, res, next) => {
    middleware(req, res, (err) => {
        if (!err)
            return next();
        if (err instanceof multer.MulterError) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "File quá lớn. Vui lòng chọn file nhỏ hơn giới hạn cho phép."
                : err.message;
            return res.status(400).json({ message });
        }
        return res.status(400).json({ message: err.message || "Upload thất bại" });
    });
};
const productVideoUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, productUploadDir),
        filename: (_req, file, cb) => cb(null, buildDiskFilename("product-video", file)),
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!isVideoUpload(file)) {
            cb(new Error("Chỉ chấp nhận file video"));
            return;
        }
        cb(null, true);
    },
}).single("video");
const reviewMediaUpload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, reviewUploadDir),
        filename: (_req, file, cb) => cb(null, buildDiskFilename("review-media", file)),
    }),
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/") || isVideoUpload(file)) {
            cb(null, true);
            return;
        }
        cb(new Error("Chỉ chấp nhận ảnh hoặc video"));
    },
}).fields([
    { name: "images", maxCount: 8 },
    { name: "videos", maxCount: 3 },
]);
const optimizeUploadedImage = (options) => {
    const { targetDir, filenamePrefix, maxWidth, maxHeight } = options;
    return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
        if (!req.file) {
            res.status(400).json({ message: "No file uploaded" });
            return;
        }
        try {
            const randomSuffix = crypto.randomBytes(5).toString("hex");
            const baseName = `${filenamePrefix}-${Date.now()}-${randomSuffix}`;
            const avifFilename = `${baseName}.avif`;
            const webpFilename = `${baseName}.webp`;
            const processor = sharp(req.file.buffer, { failOn: "none" }).rotate();
            const metadata = yield processor.metadata();
            const needsResize = (metadata.width && metadata.width > maxWidth) ||
                (metadata.height && metadata.height > maxHeight);
            const outputBase = needsResize
                ? processor.resize({
                    width: maxWidth,
                    height: maxHeight,
                    fit: "inside",
                    withoutEnlargement: true,
                })
                : processor;
            const avifPath = path.join(targetDir, avifFilename);
            const webpPath = path.join(targetDir, webpFilename);
            yield Promise.all([
                outputBase.clone().avif({ quality: 52, effort: 4 }).toFile(avifPath),
                outputBase.clone().webp({ quality: 76, effort: 4 }).toFile(webpPath),
            ]);
            const preferred = String(req.headers["x-preferred-image-format"] || "").toLowerCase();
            const accepts = String(req.headers.accept || "");
            const useAvif = preferred === "avif" || accepts.includes("image/avif");
            req.file.filename = useAvif ? avifFilename : webpFilename;
            req.file.optimized = { avifFilename, webpFilename };
            next();
        }
        catch (error) {
            next(error);
        }
    });
};
const uploadAvatarRaw = imageUpload.single("avatar");
const uploadShopCoverRaw = imageUpload.single("cover");
const uploadProductRaw = imageUpload.single("image");
const optimizeAvatar = optimizeUploadedImage({
    targetDir: avatarUploadDir,
    filenamePrefix: "avatar",
    maxWidth: 640,
    maxHeight: 640,
});
const optimizeShopCover = optimizeUploadedImage({
    targetDir: avatarUploadDir,
    filenamePrefix: "shop-cover",
    maxWidth: 1800,
    maxHeight: 900,
});
const optimizeProduct = optimizeUploadedImage({
    targetDir: productUploadDir,
    filenamePrefix: "product",
    maxWidth: 1600,
    maxHeight: 1600,
});
// Auth routes
router.post("/auth/register", authController.register);
router.post("/auth/login", authController.login);
router.get("/auth/profile", protect, authController.getProfile);
router.put("/auth/profile", protect, authController.updateProfile);
router.put("/auth/password", protect, authController.changePassword);
router.post("/auth/avatar", protect, uploadAvatarRaw, optimizeAvatar, authController.uploadAvatar);
router.post("/auth/shop-avatar", protect, uploadAvatarRaw, optimizeAvatar, authController.uploadShopAvatar);
router.post("/auth/shop-cover", protect, uploadShopCoverRaw, optimizeShopCover, authController.uploadShopCover);
router.get("/auth/addresses", protect, authController.getAddresses);
router.post("/auth/addresses", protect, authController.addAddress);
router.put("/auth/addresses/:id", protect, authController.updateAddress);
router.delete("/auth/addresses/:id", protect, authController.deleteAddress);
router.put("/auth/addresses/:id/default", protect, authController.setDefaultAddress);
router.post("/auth/become-seller", protect, authController.becomeSeller);
// Product routes
router.post("/products/upload", protect, isSeller, uploadProductRaw, optimizeProduct, (req, res) => {
    if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const imageUrl = new URL(`/uploads/products/${req.file.filename}`, baseUrl).toString();
    const optimized = req.file.optimized || {};
    const sources = {
        avif: optimized.avifFilename
            ? new URL(`/uploads/products/${optimized.avifFilename}`, baseUrl).toString()
            : imageUrl,
        webp: optimized.webpFilename
            ? new URL(`/uploads/products/${optimized.webpFilename}`, baseUrl).toString()
            : imageUrl,
    };
    res.json({ imageUrl, sources });
});
router.post("/products/upload-video", protect, isSeller, handleMulterUpload(productVideoUpload), (req, res) => {
    if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const videoUrl = new URL(`/uploads/products/${req.file.filename}`, baseUrl).toString();
    res.json({ videoUrl });
});
router.get("/products", productController.getProducts);
router.get("/products/:id", productController.getProductById);
router.post("/products", protect, isSeller, productController.createProduct);
router.put("/products/:id", protect, isSeller, productController.updateProduct);
router.delete("/products/:id", protect, isSeller, productController.deleteProduct);
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
router.get("/dashboard/stats", protect, isSeller, orderController.getDashboardStats);
// Notification routes
router.get("/notifications", protect, notificationController.getNotifications);
router.put("/notifications/:id/read", protect, notificationController.markAsRead);
router.put("/notifications/read/all", protect, notificationController.markAllAsRead);
router.delete("/notifications/read", protect, notificationController.deleteReadNotifications);
router.delete("/notifications/:id", protect, notificationController.deleteNotification);
// Review routes
router.post("/reviews/upload-media", protect, handleMulterUpload(reviewMediaUpload), (req, res) => {
    const files = req.files || {};
    const imageFiles = Array.isArray(files.images) ? files.images : [];
    const videoFiles = Array.isArray(files.videos) ? files.videos : [];
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const images = imageFiles.map((file) => new URL(`/uploads/reviews/${file.filename}`, baseUrl).toString());
    const videos = videoFiles.map((file) => new URL(`/uploads/reviews/${file.filename}`, baseUrl).toString());
    res.json({ images, videos });
});
router.post("/reviews", protect, reviewController.createReview);
router.put("/reviews/:id", protect, reviewController.updateReview);
router.post("/reviews/:id/comments", protect, reviewController.addReviewComment);
router.put("/reviews/:id/reply", protect, isSeller, reviewController.replyReview);
router.get("/products/:productId/reviews", reviewController.getProductReviews);
router.get("/reviews/mine", protect, isSeller, reviewController.getSellerReviews);
router.get("/reviews", protect, admin, reviewController.getAllReviews);
router.delete("/reviews/:id", protect, admin, reviewController.deleteReview);
router.post("/chatbot", productController.chatbotResponse);
// Chat routes
router.get("/chat/messages", protect, chatController.getMessages);
router.post("/chat/messages", protect, chatController.sendMessage);
router.get("/chat/conversations", protect, chatController.getConversations);
// Voucher routes
router.get("/vouchers/my", protect, voucherController.getMyVouchers);
router.get("/vouchers/discover", protect, voucherController.getDiscover);
router.get("/vouchers/history", protect, voucherController.getHistory);
router.post("/vouchers/add", protect, voucherController.addVoucher);
// Health check - DB connection status
router.get("/health/db", (_req, res) => {
    const conn = mongoose.connection;
    const state = conn.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
    const stateText = state === 1
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
