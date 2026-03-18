const mongoose = require("mongoose");

const userVoucherSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    code: { type: String, required: true },
    description: { type: String, default: "" },
    discountType: {
      type: String,
      enum: ["percent"],
      default: "percent",
    },
    discountPercent: { type: Number, default: 0 },
    maxDiscountAmount: { type: Number, default: 0 },
    expiryDate: { type: Date },
    status: { type: String, enum: ["valid", "used", "expired"], default: "valid" },
    usedAt: { type: Date },
  },
  { timestamps: true }
);

userVoucherSchema.index({ user: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("UserVoucher", userVoucherSchema);

