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
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const protect = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    let token;
    if (req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")) {
        try {
            token = req.headers.authorization.split(" ")[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || "ShopBee_secret");
            req.user = yield User.findById(decoded.id).select("-password");
            next();
        }
        catch (error) {
            console.error(error);
            return res.status(401).json({ message: "Not authorized, token failed" });
        }
    }
    else {
        return res.status(401).json({ message: "Not authorized, no token" });
    }
});
const admin = (req, res, next) => {
    if (req.user && req.user.role === "admin") {
        next();
    }
    else {
        res.status(401).json({ message: "Not authorized as an admin" });
    }
};
const isSeller = (req, res, next) => {
    if (req.user && (req.user.role === "seller" || req.user.role === "admin")) {
        next();
    }
    else {
        res.status(401).json({ message: "Not authorized as a seller" });
    }
};
module.exports = { protect, admin, isSeller };
