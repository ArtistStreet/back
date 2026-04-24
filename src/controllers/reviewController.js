const Review = require('../models/Review');
const Product = require('../models/Product');
const Notification = require('../models/Notification');

const normalizeMediaList = (value) => {
  if (value === undefined) return undefined;
  if (!value) return [];
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
};

const shapeReviewPayload = (reviewDoc) => {
  const review = reviewDoc.toObject ? reviewDoc.toObject() : reviewDoc;
  const user = review.user && typeof review.user === "object" ? review.user : null;
  return {
    ...review,
    user: user ? String(user._id) : review.user,
    userName: review.userName || (user && user.name) || "Người dùng",
    userAvatar: user && user.avatar ? user.avatar : "",
    comments: Array.isArray(review.comments)
      ? review.comments.map((item) => ({
          ...item,
          userId:
            item && typeof item.userId === "object" && item.userId !== null
              ? String(item.userId._id || item.userId)
              : String(item.userId || ""),
        }))
      : [],
  };
};

const recalculateProductRating = async (productId) => {
  const product = await Product.findById(productId);
  if (!product) return;
  const reviews = await Review.find({ product: productId }).select("rating");
  product.rating =
    reviews.length > 0
      ? reviews.reduce((acc, item) => Number(item.rating || 0) + acc, 0) /
        reviews.length
      : 0;
  await product.save();
};

exports.createReview = async (req, res) => {
  try {
    const { rating, comment, productId } = req.body;
    const product = await Product.findById(productId).populate('seller', '_id');

    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const existingReview = await Review.findOne({
      user: req.user._id,
      product: productId,
    });

    if (existingReview) {
      existingReview.rating = Number(rating);
      existingReview.comment = comment;
      const images = normalizeMediaList(req.body.images);
      const videos = normalizeMediaList(req.body.videos);
      if (images !== undefined) existingReview.images = images;
      if (videos !== undefined) existingReview.videos = videos;
      await existingReview.save();
      await recalculateProductRating(productId);
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

    await review.save();
    await recalculateProductRating(productId);

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
      await notification.save();

      const io = req.app.get('io');
      if (io) {
        io.to(String(sellerId)).emit('notification:new', notification.toObject());
        io.to(String(sellerId)).emit('dashboard:update');
      }
    }

    res.status(201).json({ message: 'Review added', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const isAdmin = req.user && req.user.role === "admin";
    const isOwner =
      req.user && String(review.user) === String(req.user._id);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Bạn không có quyền sửa đánh giá này' });
    }

    if (req.body.rating !== undefined) review.rating = Number(req.body.rating);
    if (req.body.comment !== undefined) review.comment = req.body.comment;
    const images = normalizeMediaList(req.body.images);
    const videos = normalizeMediaList(req.body.videos);
    if (images !== undefined) review.images = images;
    if (videos !== undefined) review.videos = videos;

    await review.save();
    await recalculateProductRating(review.product);
    res.json({ message: 'Review updated', review });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProductReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });
    res.json(reviews.map(shapeReviewPayload));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find({})
      .populate("product", "name")
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });
    res.json(reviews.map(shapeReviewPayload));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getSellerReviews = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const isAdmin = req.user.role === "admin";
    if (isAdmin) {
      const reviews = await Review.find({})
        .populate("product", "name image seller")
        .populate("user", "name avatar")
        .sort({ createdAt: -1 });
      return res.json(reviews.map(shapeReviewPayload));
    }

    const sellerProducts = await Product.find({ seller: req.user._id })
      .select("_id")
      .lean();
    const productIds = sellerProducts.map((item) => item._id);

    if (productIds.length === 0) {
      return res.json([]);
    }

    const reviews = await Review.find({ product: { $in: productIds } })
      .populate("product", "name image seller")
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });

    res.json(reviews.map(shapeReviewPayload));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.replyReview = async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Nội dung phản hồi không được để trống" });
    }

    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }

    const product = await Product.findById(review.product).select("seller");
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const isAdmin = req.user && req.user.role === "admin";
    const isOwnerSeller =
      req.user &&
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

    await review.save();

    const updated = await Review.findById(review._id)
      .populate("product", "name image seller")
      .populate("user", "name avatar");
    res.json({ message: "Đã phản hồi đánh giá", review: shapeReviewPayload(updated) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addReviewComment = async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();
    if (!message) {
      return res.status(400).json({ message: "Nội dung bình luận không được để trống" });
    }

    const review = await Review.findById(req.params.id);
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

    await review.save();

    const updated = await Review.findById(review._id)
      .populate("product", "name image seller")
      .populate("user", "name avatar");
    res.status(201).json({ message: "Đã thêm bình luận", review: shapeReviewPayload(updated) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (review) {
      await review.deleteOne();
      res.json({ message: 'Review removed' });
    } else {
      res.status(404).json({ message: 'Review not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

