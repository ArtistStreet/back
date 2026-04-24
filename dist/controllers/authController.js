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
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");
const avatarUploadDir = path.join(__dirname, "..", "..", "uploads", "avatars");
const removeAvatarVariantsFromUrl = (urlValue) => __awaiter(void 0, void 0, void 0, function* () {
    if (!urlValue || typeof urlValue !== "string")
        return;
    try {
        const parsed = new URL(urlValue);
        const filePath = decodeURIComponent(parsed.pathname || "");
        if (!filePath.startsWith("/uploads/avatars/"))
            return;
        const ext = path.extname(filePath);
        const fileName = path.basename(filePath);
        if (!fileName || !ext)
            return;
        const baseName = fileName.slice(0, -ext.length);
        const variants = [".avif", ".webp", ".jpg", ".jpeg", ".png"];
        yield Promise.all(variants.map((variant) => __awaiter(void 0, void 0, void 0, function* () {
            const absPath = path.join(avatarUploadDir, `${baseName}${variant}`);
            try {
                yield fs.promises.unlink(absPath);
            }
            catch (_e) {
                return;
            }
        })));
    }
    catch (_e) {
        return;
    }
});
exports.register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { name, email, password } = req.body;
        const userExists = yield User.findOne({ email });
        if (userExists)
            return res.status(400).json({ message: "Email đã tồn tại" });
        const user = yield User.create({
            name,
            email,
            password,
            username: email.split("@")[0],
        });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "ShopBee_secret", { expiresIn: "7d" });
        res.status(201).json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                username: user.username,
                phone: user.phone,
                gender: user.gender,
                birthDate: user.birthDate,
                avatar: user.avatar,
                shopName: user.shopName,
                shopDescription: user.shopDescription,
                shopAvatar: user.shopAvatar,
                shopCover: user.shopCover,
                shopAddress: user.shopAddress,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, username, identifier, password } = req.body;
        const loginIdentifier = identifier || email || username;
        if (!loginIdentifier || !password) {
            return res
                .status(400)
                .json({ message: "Vui lòng nhập email/tên đăng nhập và mật khẩu" });
        }
        const user = yield User.findOne({
            $or: [{ email: loginIdentifier }, { username: loginIdentifier }],
        });
        if (!user || !(yield user.comparePassword(password))) {
            return res.status(401).json({
                message: "Email / tên đăng nhập hoặc mật khẩu không đúng",
            });
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "ShopBee_secret", { expiresIn: "7d" });
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                username: user.username,
                phone: user.phone,
                gender: user.gender,
                birthDate: user.birthDate,
                avatar: user.avatar,
                shopName: user.shopName,
                shopDescription: user.shopDescription,
                shopAvatar: user.shopAvatar,
                shopCover: user.shopCover,
                shopAddress: user.shopAddress,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.getProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.updateProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const { name, email, username, phone, gender, birthDate, avatar, shopName, shopDescription, shopAvatar, shopCover, shopAddress, } = req.body;
        if (email !== undefined && email !== user.email) {
            const exists = yield User.findOne({ email });
            if (exists && String(exists._id) !== String(user._id)) {
                return res.status(400).json({ message: "Email đã tồn tại" });
            }
        }
        if (username !== undefined && username !== user.username) {
            const exists = yield User.findOne({ username });
            if (exists && String(exists._id) !== String(user._id)) {
                return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });
            }
        }
        if (name !== undefined)
            user.name = name;
        if (email !== undefined)
            user.email = email;
        if (username !== undefined)
            user.username = username;
        if (phone !== undefined)
            user.phone = phone;
        if (gender !== undefined)
            user.gender = gender;
        if (birthDate !== undefined) {
            if (!birthDate) {
                user.birthDate = undefined;
            }
            else {
                user.birthDate = birthDate;
            }
        }
        if (avatar !== undefined)
            user.avatar = avatar;
        if (shopName !== undefined)
            user.shopName = shopName;
        if (shopDescription !== undefined)
            user.shopDescription = shopDescription;
        if (shopAvatar !== undefined)
            user.shopAvatar = shopAvatar;
        if (shopCover !== undefined)
            user.shopCover = shopCover;
        if (shopAddress !== undefined)
            user.shopAddress = shopAddress;
        yield user.save();
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "ShopBee_secret", { expiresIn: "7d" });
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                username: user.username,
                phone: user.phone,
                gender: user.gender,
                birthDate: user.birthDate,
                avatar: user.avatar,
                shopName: user.shopName,
                shopDescription: user.shopDescription,
                shopAvatar: user.shopAvatar,
                shopCover: user.shopCover,
                shopAddress: user.shopAddress,
            },
        });
    }
    catch (error) {
        if (error && error.code === 11000) {
            if (error.keyPattern && error.keyPattern.email) {
                return res.status(400).json({ message: "Email đã tồn tại" });
            }
            if (error.keyPattern && error.keyPattern.username) {
                return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });
            }
            return res
                .status(400)
                .json({ message: "Dữ liệu bị trùng, vui lòng thử lại" });
        }
        res.status(500).json({ message: error.message });
    }
});
exports.getAddresses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id).select("addresses");
        if (!user)
            return res.status(404).json({ message: "User not found" });
        res.json(user.addresses || []);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.addAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const { fullName, phone, province, district, ward, street, isDefault } = req.body || {};
        if (!fullName || !phone || !province || !district || !ward || !street) {
            return res.status(400).json({ message: "Thiếu thông tin địa chỉ" });
        }
        if (isDefault) {
            user.addresses = (user.addresses || []).map((a) => (Object.assign(Object.assign({}, a.toObject()), { isDefault: false })));
        }
        user.addresses.push({
            fullName,
            phone,
            province,
            district,
            ward,
            street,
            isDefault: Boolean(isDefault) || (user.addresses || []).length === 0,
        });
        yield user.save();
        res.status(201).json(user.addresses);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.updateAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const address = (user.addresses || []).id(req.params.id);
        if (!address)
            return res.status(404).json({ message: "Address not found" });
        const { fullName, phone, province, district, ward, street, isDefault } = req.body || {};
        if (fullName !== undefined)
            address.fullName = fullName;
        if (phone !== undefined)
            address.phone = phone;
        if (province !== undefined)
            address.province = province;
        if (district !== undefined)
            address.district = district;
        if (ward !== undefined)
            address.ward = ward;
        if (street !== undefined)
            address.street = street;
        if (isDefault === true) {
            user.addresses = user.addresses.map((a) => (Object.assign(Object.assign({}, a.toObject()), { isDefault: String(a._id) === String(address._id) })));
        }
        yield user.save();
        res.json(user.addresses);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.becomeSeller = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: "Không tìm thấy người dùng" });
        if (user.role === "admin") {
            return res.status(400).json({ message: "Admin đã có quyền bán hàng" });
        }
        user.role = "seller";
        yield user.save();
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "ShopBee_secret", { expiresIn: "7d" });
        res.json({
            message: "Chúc mừng! Bạn đã trở thành người bán hàng",
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                username: user.username,
                phone: user.phone,
                gender: user.gender,
                birthDate: user.birthDate,
                avatar: user.avatar,
                shopName: user.shopName,
                shopDescription: user.shopDescription,
                shopAvatar: user.shopAvatar,
                shopCover: user.shopCover,
                shopAddress: user.shopAddress,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.deleteAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const address = (user.addresses || []).id(req.params.id);
        if (!address)
            return res.status(404).json({ message: "Address not found" });
        const wasDefault = Boolean(address.isDefault);
        address.deleteOne();
        yield user.save();
        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
            yield user.save();
        }
        res.json(user.addresses);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.setDefaultAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const address = (user.addresses || []).id(req.params.id);
        if (!address)
            return res.status(404).json({ message: "Address not found" });
        user.addresses = user.addresses.map((a) => (Object.assign(Object.assign({}, a.toObject()), { isDefault: String(a._id) === String(address._id) })));
        yield user.save();
        res.json(user.addresses);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.changePassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const user = yield User.findById(req.user._id);
        if (!user)
            return res.status(404).json({ message: "User not found" });
        const { currentPassword, newPassword } = req.body || {};
        if (!currentPassword || !newPassword) {
            return res
                .status(400)
                .json({ message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới" });
        }
        const ok = yield user.comparePassword(String(currentPassword));
        if (!ok) {
            return res.status(401).json({ message: "Mật khẩu hiện tại không đúng" });
        }
        const nextPassword = String(newPassword);
        if (nextPassword.length < 6) {
            return res
                .status(400)
                .json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự" });
        }
        user.password = nextPassword;
        yield user.save();
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "ShopBee_secret", { expiresIn: "7d" });
        res.json({
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                username: user.username,
                phone: user.phone,
                gender: user.gender,
                birthDate: user.birthDate,
                avatar: user.avatar,
            },
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.uploadAvatar = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ message: "Không có file ảnh được tải lên" });
        }
        const user = yield User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const relativePath = `/uploads/avatars/${req.file.filename}`;
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const avatarUrl = new URL(relativePath, baseUrl).toString();
        if (user.avatar && user.avatar !== avatarUrl) {
            yield removeAvatarVariantsFromUrl(user.avatar);
        }
        user.avatar = avatarUrl;
        yield user.save();
        res.json({ avatar: avatarUrl });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.uploadShopAvatar = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ message: "Không có file ảnh được tải lên" });
        }
        const user = yield User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const relativePath = `/uploads/avatars/${req.file.filename}`;
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const avatarUrl = new URL(relativePath, baseUrl).toString();
        if (user.shopAvatar && user.shopAvatar !== avatarUrl) {
            yield removeAvatarVariantsFromUrl(user.shopAvatar);
        }
        user.shopAvatar = avatarUrl;
        yield user.save();
        res.json({ shopAvatar: avatarUrl });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.uploadShopCover = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        if (!req.file) {
            return res
                .status(400)
                .json({ message: "Không có file ảnh được tải lên" });
        }
        const user = yield User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const relativePath = `/uploads/avatars/${req.file.filename}`;
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        const coverUrl = new URL(relativePath, baseUrl).toString();
        if (user.shopCover && user.shopCover !== coverUrl) {
            yield removeAvatarVariantsFromUrl(user.shopCover);
        }
        user.shopCover = coverUrl;
        yield user.save();
        res.json({ shopCover: coverUrl });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
