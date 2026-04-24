var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const Review = require('../models/Review');
const Product = require('../models/Product');
const Notification = require('../models/Notification');
const normalizeMediaList = (value) => {
    if (value === undefined)
        return undefined;
    if (!value)
        return [];
    const source = Array.isArray(value) ? value : [value];
    return source
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
};
const shapeReviewPayload = (reviewDoc) => {
    const review = reviewDoc.toObject ? reviewDoc.toObject() : reviewDoc;
    const user = review.user && typeof review.user === "object" ? review.user : null;
    return Object.assign(Object.assign({}, review), { user: user ? String(user._id) : review.user, userName: review.userName || (user && user.name) || "Người dùng", userAvatar: user && user.avatar ? user.avatar : "", comments: Array.isArray(review.comments)
            ? review.comments.map((item) => (Object.assign(Object.assign({}, item), { userId: item && typeof item.userId === "object" && item.userId !== null
                    ? String(item.userId._id || item.userId)
                    : String(item.userId || "") })))
            : [] });
};
const recalculateProductRating = (productId) => __awaiter(this, void 0, void 0, function* () {
    const product = yield Product.findById(productId);
    if (!product)
        return;
    const reviews = yield Review.find({ product: productId }).select("rating");
    product.rating =
        reviews.length > 0
            ? reviews.reduce((acc, item) => Number(item.rating || 0) + acc, 0) /
                reviews.length
            : 0;
    yield product.save();
});
exports.createReview = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { rating, comment, productId } = req.body;
        const product = yield Product.findById(productId).populate('seller', '_id');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        const existingReview = yield Review.findOne({
            user: req.user._id,
            product: productId,
        });
        if (existingReview) {
            existingReview.rating = Number(rating);
            existingReview.comment = comment;
            const images = normalizeMediaList(req.body.images);
            const videos = normalizeMediaList(req.body.videos);
            if (images !== undefined)
                existingReview.images = images;
            if (videos !== undefined)
                existingReview.videos = videos;
            yield existingReview.save();
            yield recalculateProductRating(productId);
            return res.status(200).json({ message: 'Review updated', review: existingReview });
        }
        const review = new Review({
            user: req.user._id,
            product: productId,
            rating: Number(rating),
            comment,
            userName: req.user.name,
            images: normalizeMediaList(req.body.images) || [],
            videos: normalizeMediaList(req.body.videos) || [],
        });
        yield review.save();
        yield recalculateProductRating(productId);
        // Create notification for the seller
        if (product.seller && product.seller._id) {
            const sellerId = product.seller._id;
            const notification = new Notification({
                user: sellerId,
                title: 'Đánh giá sản phẩm mới',
                message: `Sản phẩm "${product.name}" của bạn vừa nhận được một đánh giá ${rating} sao từ khách hàng ${req.user.name}.`,
                type: 'review',
                link: `/product/${productId}?tab=reviews`
            });
            yield notification.save();
            const io = req.app.get('io');
            if (io) {
                io.to(String(sellerId)).emit('notification:new', notification.toObject());
                io.to(String(sellerId)).emit('dashboard:update');
            }
        }
        res.status(201).json({ message: 'Review added', review });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.updateReview = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const review = yield Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ message: 'Review not found' });
        }
        const isAdmin = req.user && req.user.role === "admin";
        const isOwner = req.user && String(review.user) === String(req.user._id);
        if (!isAdmin && !isOwner) {
            return res.status(403).json({ message: 'Bạn không có quyền sửa đánh giá này' });
        }
        if (req.body.rating !== undefined)
            review.rating = Number(req.body.rating);
        if (req.body.comment !== undefined)
            review.comment = req.body.comment;
        const images = normalizeMediaList(req.body.images);
        const videos = normalizeMediaList(req.body.videos);
        if (images !== undefined)
            review.images = images;
        if (videos !== undefined)
            review.videos = videos;
        yield review.save();
        yield recalculateProductRating(review.product);
        res.json({ message: 'Review updated', review });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getProductReviews = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const reviews = yield Review.find({ product: req.params.productId })
            .populate("user", "name avatar")
            .sort({ createdAt: -1 });
        res.json(reviews.map(shapeReviewPayload));
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getAllReviews = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const reviews = yield Review.find({})
            .populate("product", "name")
            .populate("user", "name avatar")
            .sort({ createdAt: -1 });
        res.json(reviews.map(shapeReviewPayload));
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getSellerReviews = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        if (!req.user || !req.user._id) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const isAdmin = req.user.role === "admin";
        if (isAdmin) {
            const reviews = yield Review.find({})
                .populate("product", "name image seller")
                .populate("user", "name avatar")
                .sort({ createdAt: -1 });
            return res.json(reviews.map(shapeReviewPayload));
        }
        const sellerProducts = yield Product.find({ seller: req.user._id })
            .select("_id")
            .lean();
        const productIds = sellerProducts.map((item) => item._id);
        if (productIds.length === 0) {
            return res.json([]);
        }
        const reviews = yield Review.find({ product: { $in: productIds } })
            .populate("product", "name image seller")
            .populate("user", "name avatar")
            .sort({ createdAt: -1 });
        res.json(reviews.map(shapeReviewPayload));
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.replyReview = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const message = String(req.body.message || "").trim();
        if (!message) {
            return res.status(400).json({ message: "Nội dung phản hồi không được để trống" });
        }
        const review = yield Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }
        const product = yield Product.findById(review.product).select("seller");
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        const isAdmin = req.user && req.user.role === "admin";
        const isOwnerSeller = req.user &&
            product.seller &&
            String(product.seller) === String(req.user._id);
        if (!isAdmin && !isOwnerSeller) {
            return res.status(403).json({ message: "Bạn không có quyền phản hồi đánh giá này" });
        }
        review.sellerReply = {
            message,
            sellerId: req.user._id,
            sellerName: req.user.shopName || req.user.name || "Người bán",
            repliedAt: new Date(),
        };
        yield review.save();
        const updated = yield Review.findById(review._id)
            .populate("product", "name image seller")
            .populate("user", "name avatar");
        res.json({ message: "Đã phản hồi đánh giá", review: shapeReviewPayload(updated) });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.addReviewComment = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const message = String(req.body.message || "").trim();
        if (!message) {
            return res.status(400).json({ message: "Nội dung bình luận không được để trống" });
        }
        const review = yield Review.findById(req.params.id);
        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }
        review.comments.push({
            userId: req.user._id,
            userName: req.user.name || "Người dùng",
            userAvatar: req.user.avatar || "",
            role: req.user.role === "admin" ? "admin" : req.user.role === "seller" ? "seller" : "user",
            message,
            createdAt: new Date(),
        });
        yield review.save();
        const updated = yield Review.findById(review._id)
            .populate("product", "name image seller")
            .populate("user", "name avatar");
        res.status(201).json({ message: "Đã thêm bình luận", review: shapeReviewPayload(updated) });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.deleteReview = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const review = yield Review.findById(req.params.id);
        if (review) {
            yield review.deleteOne();
            res.json({ message: 'Review removed' });
        }
        else {
            res.status(404).json({ message: 'Review not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
