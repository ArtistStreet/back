const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sender: {
      type: String,
      enum: ["customer", "seller"],
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isAI: {
      type: Boolean,
      default: false,
    },
    sellerReadAt: {
      type: Date,
    },
    userReadAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatMessage", chatMessageSchema);

