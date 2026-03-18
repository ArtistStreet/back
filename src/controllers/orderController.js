const Order = require("../models/Order");
const UserVoucher = require("../models/UserVoucher");
const Notification = require("../models/Notification");
const { __catalogForServer } = require("./voucherController");

exports.createOrder = async (req, res) => {
  const { orderItems, voucherCode, shippingAddress } = req.body;

  if (orderItems && orderItems.length === 0) {
    return res.status(400).json({ message: "No order items" });
  }

  if (!shippingAddress) {
    return res.status(400).json({ message: "Địa chỉ giao hàng là bắt buộc" });
  }

  const baseTotal = (orderItems || []).reduce(
    (sum, i) => sum + Number(i.price || 0) * Number(i.quantity || 0),
    0
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
          catalog.minOrderTotal
        ).toLocaleString()}đ để dùng voucher này`,
      });
    }

    const percent = Number(
      userVoucher.discountPercent || catalog.discountPercent || 0
    );
    const cap = Number(
      userVoucher.maxDiscountAmount || catalog.maxDiscountAmount || 0
    );
    const raw = Math.round((baseTotal * percent) / 100);
    discountAmount = cap > 0 ? Math.min(raw, cap) : raw;
    appliedCode = normalizedCode;

    userVoucher.status = "used";
    userVoucher.usedAt = new Date();
    await userVoucher.save();
  }

  const totalPrice = Math.max(baseTotal - discountAmount, 0);

  const order = new Order({
    user: req.user._id,
    orderItems,
    shippingAddress,
    totalPrice,
    voucherCode: appliedCode,
    originalTotal: baseTotal,
    discountAmount,
  });

  const createdOrder = await order.save();

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
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const totalSales = await Order.aggregate([
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    const totalOrders = await Order.countDocuments({});

    const productsSold = await Order.aggregate([
      { $unwind: "$orderItems" },
      {
        $group: {
          _id: "$orderItems.name",
          totalQuantity: { $sum: "$orderItems.quantity" },
        },
      },
      { $sort: { totalQuantity: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      totalSales: totalSales.length > 0 ? totalSales[0].total : 0,
      totalOrders,
      productsSold,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
