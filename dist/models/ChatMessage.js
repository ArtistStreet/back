const mongoose = require("mongoose");
const chatMessageSchema = new mongoose.Schema({
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
    product: {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        image: String,
        price: Number,
    },
    sellerReadAt: {
        type: Date,
    },
    userReadAt: {
        type: Date,
    },
}, { timestamps: true });
chatMessageSchema.index({ seller: 1, customer: 1, createdAt: -1 });
chatMessageSchema.index({ isAI: 1, createdAt: -1 });
chatMessageSchema.index({ customer: 1, isRead: 1 });
module.exports = mongoose.model("ChatMessage", chatMessageSchema);
