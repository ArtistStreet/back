"use strict";
const mongoose = require("mongoose");
const reviewCommentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    userName: { type: String, required: true },
    userAvatar: { type: String, default: "" },
    role: {
        type: String,
        enum: ["user", "seller", "admin"],
        default: "user",
    },
    message: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
}, { _id: true });
const reviewSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    userName: { type: String, required: true },
    images: [{ type: String }],
    videos: [{ type: String }],
    sellerReply: {
        message: { type: String, default: "" },
        sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        sellerName: { type: String, default: "" },
        repliedAt: { type: Date },
    },
    comments: { type: [reviewCommentSchema], default: [] },
}, { timestamps: true });
module.exports = mongoose.model("Review", reviewSchema);
