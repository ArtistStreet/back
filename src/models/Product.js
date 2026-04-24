const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    image: { type: String, required: true },
    images: [{ type: String }],
    videos: [{ type: String }],
    rating: { type: Number, default: 0 },
    sold: { type: Number, default: 0 },
    category: { type: String, required: true },
    isMall: { type: Boolean, default: false },
    description: { type: String },
    stock: { type: Number, default: 999 },
    detailSpecs: [
      {
        label: { type: String, required: true },
        value: { type: String, required: true },
      },
    ],
    optionGroups: [
      {
        name: { type: String, required: true },
        values: [{ type: String }],
      },
    ],
    seller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

productSchema.index({ seller: 1, createdAt: -1 });
productSchema.index({ seller: 1, sold: -1 });
productSchema.index({ category: 1 });
productSchema.index({ name: "text" });

module.exports = mongoose.model("Product", productSchema);

