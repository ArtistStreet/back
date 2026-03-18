const UserVoucher = require("../models/UserVoucher");
const Notification = require("../models/Notification");

const nowDate = () => new Date();

const normalizeCode = (code) =>
  String(code || "")
    .trim()
    .toUpperCase();

const voucherCatalog = [
  {
    code: "GIAM10",
    description: "Giảm 10% tối đa 50.000đ cho mọi đơn hàng.",
    discountType: "percent",
    discountPercent: 10,
    maxDiscountAmount: 50000,
    expiryDate: new Date("2026-12-31T23:59:59.999Z"),
  },
  {
    code: "GIAM20",
    description: "Giảm 20% tối đa 100.000đ cho đơn từ 500.000đ.",
    discountType: "percent",
    discountPercent: 20,
    maxDiscountAmount: 100000,
    minOrderTotal: 500000,
    expiryDate: new Date("2026-12-31T23:59:59.999Z"),
  },
  {
    code: "SHOPA15",
    description: "Giảm 15% cho sản phẩm tại Shop A.",
    discountType: "percent",
    discountPercent: 15,
    maxDiscountAmount: 80000,
    expiryDate: new Date("2026-11-30T23:59:59.999Z"),
    shop: "Shop A",
  },
];

const findCatalogVoucher = (code) =>
  voucherCatalog.find((v) => v.code === normalizeCode(code));

const computeStatus = (voucher) => {
  if (voucher.status === "used") return "used";
  const exp = voucher.expiryDate ? new Date(voucher.expiryDate) : null;
  if (exp && exp.getTime() < nowDate().getTime()) return "expired";
  return "valid";
};

exports.getDiscover = async (_req, res) => {
  res.json(
    voucherCatalog.map((v) => ({
      code: v.code,
      description: v.description,
      discountType: v.discountType,
      discountPercent: v.discountPercent,
      maxDiscountAmount: v.maxDiscountAmount,
      minOrderTotal: v.minOrderTotal,
      expiry: v.expiryDate ? v.expiryDate.toISOString() : null,
      shop: v.shop,
    }))
  );
};

exports.getMyVouchers = async (req, res) => {
  const items = await UserVoucher.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  const mapped = items
    .map((v) => {
      const status = computeStatus(v);
      return {
        code: v.code,
        description: v.description,
        discountType: v.discountType,
        discountPercent: v.discountPercent,
        maxDiscountAmount: v.maxDiscountAmount,
        expiry: v.expiryDate ? new Date(v.expiryDate).toISOString() : null,
        status,
        usedAt: v.usedAt ? new Date(v.usedAt).toISOString() : null,
      };
    })
    .filter((v) => v.status === "valid");

  res.json(mapped);
};

exports.getHistory = async (req, res) => {
  const items = await UserVoucher.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .lean();

  res.json(
    items.map((v) => {
      const status = computeStatus(v);
      return {
        code: v.code,
        description: v.description,
        discountType: v.discountType,
        discountPercent: v.discountPercent,
        maxDiscountAmount: v.maxDiscountAmount,
        expiry: v.expiryDate ? new Date(v.expiryDate).toISOString() : null,
        status,
        usedAt: v.usedAt ? new Date(v.usedAt).toISOString() : null,
      };
    })
  );
};

exports.addVoucher = async (req, res) => {
  const code = normalizeCode(req.body?.code);
  if (!code) return res.status(400).json({ message: "Missing voucher code" });

  const catalog = findCatalogVoucher(code);
  if (!catalog) return res.status(404).json({ message: "Voucher not found" });

  const exp = catalog.expiryDate ? new Date(catalog.expiryDate) : null;
  if (exp && exp.getTime() < nowDate().getTime()) {
    return res.status(400).json({ message: "Voucher expired" });
  }

  try {
    const created = await UserVoucher.create({
      user: req.user._id,
      code: catalog.code,
      description: catalog.description,
      discountType: catalog.discountType,
      discountPercent: catalog.discountPercent,
      maxDiscountAmount: catalog.maxDiscountAmount,
      expiryDate: catalog.expiryDate,
      status: "valid",
    });
    try {
      await Notification.create({
        user: req.user._id,
        title: "Đã thêm voucher mới",
        message: `Voucher ${created.code} đã được thêm vào Kho voucher của bạn.`,
        type: "promotion",
      });
    } catch (err) {
      console.error("Failed to create voucher notification", err);
    }

    return res.status(201).json({
      code: created.code,
      description: created.description,
      discountType: created.discountType,
      discountPercent: created.discountPercent,
      maxDiscountAmount: created.maxDiscountAmount,
      expiry: created.expiryDate ? created.expiryDate.toISOString() : null,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      const existing = await UserVoucher.findOne({
        user: req.user._id,
        code: catalog.code,
      }).lean();
      if (existing) {
        const status = computeStatus(existing);
        if (status === "valid") {
          try {
            await Notification.create({
              user: req.user._id,
              title: "Voucher đã có trong kho",
              message: `Voucher ${existing.code} đã có trong Kho voucher của bạn.`,
              type: "promotion",
            });
          } catch (err) {
            console.error(
              "Failed to create existing voucher notification",
              err
            );
          }
        }
        return res.status(200).json({
          code: existing.code,
          description: existing.description,
          discountType: existing.discountType,
          discountPercent: existing.discountPercent,
          maxDiscountAmount: existing.maxDiscountAmount,
          expiry: existing.expiryDate
            ? new Date(existing.expiryDate).toISOString()
            : null,
          status,
        });
      }
    }
    return res.status(500).json({ message: error.message || "Server error" });
  }
};

exports.__catalogForServer = { voucherCatalog, findCatalogVoucher };
