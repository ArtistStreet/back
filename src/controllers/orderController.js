const Order = require("../models/Order");
const Product = require("../models/Product");
const UserVoucher = require("../models/UserVoucher");
const Notification = require("../models/Notification");
const { __catalogForServer } = require("./voucherController");
const ChatMessage = require("../models/ChatMessage");

exports.createOrder = async (req, res) => {
  const { orderItems, voucherCode, shippingAddress } = req.body;

  if (orderItems && orderItems.length === 0) {
    return res.status(400).json({ message: "No order items" });
  }

  if (!shippingAddress) {
    return res.status(400).json({ message: "Địa chỉ giao hàng là bắt buộc" });
  }

  const quantityByProductId = new Map();
  for (const item of orderItems) {
    const productId = String(item?.product || "");
    const quantity = Number(item?.quantity || 0);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return res
        .status(400)
        .json({ message: "Dữ liệu sản phẩm trong đơn hàng không hợp lệ" });
    }
    const current = quantityByProductId.get(productId) || 0;
    quantityByProductId.set(productId, current + quantity);
  }

  const productIds = [...quantityByProductId.keys()];
  const products = await Product.find({ _id: { $in: productIds } })
    .select("_id stock seller name")
    .lean();
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  for (const [productId, quantity] of quantityByProductId.entries()) {
    const product = productMap.get(productId);
    if (!product) {
      return res.status(400).json({ message: "Có sản phẩm không còn tồn tại" });
    }
    const stock = Number(product.stock || 0);
    if (stock < quantity) {
      return res.status(400).json({
        message: `Sản phẩm "${product.name}" chỉ còn ${stock} trong kho`,
      });
    }
  }

  const baseTotal = (orderItems || []).reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
    0,
  );

  const normalizedCode = String(voucherCode || "")
    .trim()
    .toUpperCase();
  let appliedCode = undefined;
  let discountAmount = 0;

  if (normalizedCode) {
    const catalog = __catalogForServer.findCatalogVoucher(normalizedCode);
    if (!catalog) {
      return res.status(400).json({ message: "Voucher không hợp lệ" });
    }

    const userVoucher = await UserVoucher.findOne({
      user: req.user._id,
      code: normalizedCode,
    });
    if (!userVoucher) {
      return res.status(400).json({ message: "Voucher không có trong kho" });
    }

    if (userVoucher.status === "used") {
      return res.status(400).json({ message: "Voucher đã được sử dụng" });
    }

    if (
      userVoucher.expiryDate &&
      new Date(userVoucher.expiryDate).getTime() < Date.now()
    ) {
      userVoucher.status = "expired";
      await userVoucher.save();
      return res.status(400).json({ message: "Voucher đã hết hạn" });
    }

    if (catalog.minOrderTotal && baseTotal < Number(catalog.minOrderTotal)) {
      return res.status(400).json({
        message: `Đơn hàng tối thiểu ${Number(
          catalog.minOrderTotal,
        ).toLocaleString()}đ để dùng voucher này`,
      });
    }

    const percent = Number(
      userVoucher.discountPercent || catalog.discountPercent || 0,
    );
    const cap = Number(
      userVoucher.maxDiscountAmount || catalog.maxDiscountAmount || 0,
    );
    const raw = Math.round((baseTotal * percent) / 100);
    discountAmount = cap > 0 ? Math.min(raw, cap) : raw;
    appliedCode = normalizedCode;

    userVoucher.status = "used";
    userVoucher.usedAt = new Date();
    await userVoucher.save();
  }

  const totalPrice = Math.max(baseTotal - discountAmount, 0);

  const appliedStockUpdates = [];
  for (const [productId, quantity] of quantityByProductId.entries()) {
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, stock: { $gte: quantity } },
      { $inc: { stock: -quantity, sold: quantity } },
      { new: true, select: "_id stock sold" },
    ).lean();
    if (!updatedProduct) {
      for (const applied of appliedStockUpdates) {
        await Product.updateOne(
          { _id: applied.productId },
          { $inc: { stock: applied.quantity, sold: -applied.quantity } },
        );
      }
      await Product.updateMany(
        {
          _id: { $in: appliedStockUpdates.map((item) => item.productId) },
          sold: { $lt: 0 },
        },
        { $set: { sold: 0 } },
      );
      return res.status(400).json({
        message: "Tồn kho vừa thay đổi, vui lòng kiểm tra lại giỏ hàng",
      });
    }
    appliedStockUpdates.push({ productId, quantity });
  }

  let createdOrder;
  try {
    const order = new Order({
      user: req.user._id,
      orderItems,
      shippingAddress,
      totalPrice,
      voucherCode: appliedCode,
      originalTotal: baseTotal,
      discountAmount,
    });
    createdOrder = await order.save();
  } catch (error) {
    for (const applied of appliedStockUpdates) {
      await Product.updateOne(
        { _id: applied.productId },
        { $inc: { stock: applied.quantity, sold: -applied.quantity } },
      );
    }
    await Product.updateMany(
      {
        _id: { $in: appliedStockUpdates.map((item) => item.productId) },
        sold: { $lt: 0 },
      },
      { $set: { sold: 0 } },
    );
    return res
      .status(500)
      .json({ message: "Không thể tạo đơn hàng, vui lòng thử lại" });
  }

  // Find all sellers involved in this order
  const sellerIds = new Set();
  for (const product of products) {
    if (product && product.seller) {
      sellerIds.add(String(product.seller));
    }
  }

  const io = req.app.get("io");
  if (io) {
    sellerIds.forEach((sellerId) => {
      io.to(sellerId).emit("dashboard:update");
    });
  }

  try {
    await Notification.create({
      user: req.user._id,
      title: "Đặt hàng thành công",
      message: `Đơn hàng của bạn với tổng tiền ${totalPrice.toLocaleString()}đ đã được tạo thành công.`,
      type: "order",
    });
  } catch (err) {
    // ignore notification failure
    console.error("Failed to create order notification", err);
  }

  res.status(201).json(createdOrder);
};

exports.getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      user: req.user._id,
    });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.isPaid) {
      return res
        .status(400)
        .json({ message: "Không thể hủy đơn đã thanh toán" });
    }
    if (order.isCancelled) {
      return res.status(400).json({ message: "Đơn hàng đã được hủy trước đó" });
    }
    order.isCancelled = true;
    order.cancelledAt = new Date();
    await order.save();

    const quantityByProductId = new Map();
    for (const item of order.orderItems || []) {
      const productId = String(item.product || "");
      const quantity = Number(item.quantity || 0);
      if (!productId || !Number.isFinite(quantity) || quantity <= 0) continue;
      const current = quantityByProductId.get(productId) || 0;
      quantityByProductId.set(productId, current + quantity);
    }
    for (const [productId, quantity] of quantityByProductId.entries()) {
      await Product.updateOne(
        { _id: productId },
        { $inc: { stock: quantity, sold: -quantity } },
      );
    }
    if (quantityByProductId.size > 0) {
      await Product.updateMany(
        {
          _id: { $in: [...quantityByProductId.keys()] },
          sold: { $lt: 0 },
        },
        { $set: { sold: 0 } },
      );
    }

    try {
      const sellerProducts = await Product.find({
        _id: { $in: [...quantityByProductId.keys()] },
      })
        .select("seller")
        .lean();
      const io = req.app.get("io");
      if (io) {
        const sellerIds = new Set(
          sellerProducts
            .map((item) => (item?.seller ? String(item.seller) : ""))
            .filter(Boolean),
        );
        sellerIds.forEach((sellerId) => {
          io.to(sellerId).emit("dashboard:update");
        });
      }
    } catch (emitErr) {
      console.error(
        "Failed to emit dashboard update after cancellation",
        emitErr,
      );
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    if (require("mongoose").connection.readyState !== 1) {
      // Dữ liệu mock cho dashboard khi mất kết nối DB
      return res.json({
        totalSales: 15000000,
        totalOrders: 42,
        totalProductsSold: 128,
        productsSold: [
          { _id: "Sản phẩm mẫu A", totalQuantity: 25 },
          { _id: "Sản phẩm mẫu B", totalQuantity: 18 },
          { _id: "Sản phẩm mẫu C", totalQuantity: 12 },
        ],
        aiReplyTotal: 150,
        aiReplyToday: 12,
        aiReplyLast7Days: 85,
      });
    }

    const isSeller =
      req.user && (req.user.role === "seller" || req.user.role === "admin");

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const sevenDaysAgo = new Date(
      startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000,
    );

    const [aiReplyCountTotal, aiReplyToday, aiReplyLast7Days] =
      await Promise.all([
        ChatMessage.countDocuments({ isAI: true }),
        ChatMessage.countDocuments({
          isAI: true,
          createdAt: { $gte: startOfToday },
        }),
        ChatMessage.countDocuments({
          isAI: true,
          createdAt: { $gte: sevenDaysAgo },
        }),
      ]);

    if (!isSeller) {
      const [totalSales, totalOrders, totalProductsSoldAgg, productsSold] =
        await Promise.all([
          Order.aggregate([
            { $group: { _id: null, total: { $sum: "$totalPrice" } } },
          ]),
          Order.countDocuments({}),
          Order.aggregate([
            { $unwind: "$orderItems" },
            {
              $group: {
                _id: null,
                total: { $sum: "$orderItems.quantity" },
              },
            },
          ]),
          Order.aggregate([
            { $unwind: "$orderItems" },
            {
              $group: {
                _id: "$orderItems.name",
                totalQuantity: { $sum: "$orderItems.quantity" },
              },
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 5 },
          ]),
        ]);

      return res.json({
        totalSales: totalSales.length > 0 ? totalSales[0].total : 0,
        totalOrders,
        totalProductsSold:
          totalProductsSoldAgg.length > 0 ? totalProductsSoldAgg[0].total : 0,
        productsSold,
        aiReplyTotal: aiReplyCountTotal,
        aiReplyToday,
        aiReplyLast7Days,
      });
    }

    const sellerId = req.user._id;

    const sellerProducts = await Product.find({ seller: sellerId })
      .select("_id name")
      .lean();
    const productIdMap = new Map(
      sellerProducts.map((p) => [String(p._id), p.name]),
    );
    const sellerProductIds = sellerProducts.map((p) => p._id);

    if (sellerProductIds.length === 0) {
      return res.json({
        totalSales: 0,
        totalOrders: 0,
        productsSold: [],
        aiReplyTotal: aiReplyCountTotal,
        aiReplyToday,
        aiReplyLast7Days,
      });
    }

    const [totalOrders, sellerProductStats, lowStockProducts] = await Promise.all([
      Order.countDocuments({
        "orderItems.product": { $in: sellerProductIds },
      }),
      Order.aggregate([
        {
          $match: {
            "orderItems.product": { $in: sellerProductIds },
          },
        },
        { $unwind: "$orderItems" },
        {
          $match: {
            "orderItems.product": { $in: sellerProductIds },
          },
        },
        {
          $group: {
            _id: "$orderItems.product",
            totalQuantity: { $sum: "$orderItems.quantity" },
            totalSales: {
              $sum: {
                $multiply: ["$orderItems.price", "$orderItems.quantity"],
              },
            },
          },
        },
        { $sort: { totalQuantity: -1 } },
      ]),
      Product.find({
        seller: sellerId,
        stock: { $lte: 10 },
      })
        .select("name stock")
        .limit(5)
        .lean(),
    ]);

    const totalSales = sellerProductStats.reduce(
      (sum, item) => sum + Number(item.totalSales || 0),
      0,
    );
    const totalProductsSold = sellerProductStats.reduce(
      (sum, item) => sum + Number(item.totalQuantity || 0),
      0,
    );
    const productsSold = sellerProductStats.slice(0, 5).map((item) => {
      const productId = String(item._id);
      return {
        _id: productIdMap.get(productId) || productId,
        totalQuantity: Number(item.totalQuantity || 0),
      };
    });

    res.json({
      totalSales,
      totalOrders,
      totalProductsSold,
      productsSold,
      lowStockProducts,
      aiReplyTotal: aiReplyCountTotal,
      aiReplyToday,
      aiReplyLast7Days,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

