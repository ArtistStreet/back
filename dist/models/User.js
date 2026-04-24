"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const addressSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true },
    province: { type: String, required: true },
    district: { type: String, required: true },
    ward: { type: String, required: true },
    street: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
}, { timestamps: true });
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin", "seller"], default: "user" },
    username: { type: String },
    phone: { type: String },
    gender: {
        type: String,
        enum: ["male", "female", "other"],
        default: "other",
    },
    birthDate: { type: Date },
    avatar: { type: String },
    shopName: { type: String },
    shopDescription: { type: String },
    shopAvatar: { type: String },
    shopCover: { type: String },
    shopAddress: { type: String },
    addresses: { type: [addressSchema], default: [] },
}, { timestamps: true });
userSchema.pre("save", function () {
    return __awaiter(this, void 0, void 0, function* () {
        if (!this.isModified("password"))
            return;
        this.password = yield bcrypt.hash(this.password, 10);
    });
});
userSchema.methods.comparePassword = function (candidatePassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield bcrypt.compare(candidatePassword, this.password);
    });
};
module.exports = mongoose.model("User", userSchema);
