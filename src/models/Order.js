const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderItems: [
      {
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        image: { type: String, required: true },
        price: { type: Number, required: true },
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
      },
    ],
    voucherCode: { type: String },
    originalTotal: { type: Number },
    discountAmount: { type: Number, default: 0 },
    totalPrice: { type: Number, required: true },
    shippingAddress: {
      fullName: { type: String, required: true },
      phoneNumber: { type: String, required: true },
      addressLine: { type: String, required: true },
      isDefault: { type: Boolean, default: false },
    },
    isPaid: { type: Boolean, default: false },
    paidAt: { type: Date },
    paymentMethod: {
      type: String,
      enum: ["cod", "online"],
      default: "cod",
    },
    isCancelled: { type: Boolean, default: false },
    cancelledAt: { type: Date },
  },
  { timestamps: true }
);

orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ "orderItems.product": 1 });
orderSchema.index({ isPaid: 1 });
orderSchema.index({ isCancelled: 1 });
orderSchema.index({ paymentMethod: 1 });

module.exports = mongoose.model("Order", orderSchema);


