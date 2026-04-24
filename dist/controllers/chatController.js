var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const ChatMessage = require("../models/ChatMessage");
const User = require("../models/User");
const Product = require("../models/Product");
const Notification = require("../models/Notification");
const mongoose = require("mongoose");
const normalizeId = (value) => {
    if (!value)
        return "";
    if (typeof value === "string")
        return value.trim();
    if (value instanceof mongoose.Types.ObjectId)
        return value.toString();
    if (typeof value === "object") {
        if (typeof value.$oid === "string")
            return value.$oid.trim();
        if (Object.prototype.hasOwnProperty.call(value, "_id") &&
            value._id &&
            value._id !== value) {
            return normalizeId(value._id);
        }
    }
    if (typeof (value === null || value === void 0 ? void 0 : value.toString) === "function") {
        const asText = value.toString();
        if (asText && asText !== "[object Object]")
            return asText.trim();
    }
    return "";
};
const resolveSellerIdFromPartner = (partnerId) => __awaiter(this, void 0, void 0, function* () {
    const normalizedPartnerId = normalizeId(partnerId);
    if (!mongoose.Types.ObjectId.isValid(normalizedPartnerId)) {
        return null;
    }
    const partnerUser = yield User.findById(normalizedPartnerId)
        .select("role")
        .lean();
    if (partnerUser && ["seller", "admin"].includes(partnerUser.role)) {
        return normalizedPartnerId;
    }
    const partnerProduct = yield Product.findById(normalizedPartnerId)
        .select("seller")
        .lean();
    if (partnerProduct && partnerProduct.seller) {
        return String(partnerProduct.seller);
    }
    return null;
});
exports.getMessages = (req, res) => __awaiter(this, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const { user, query } = req;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const partnerId = normalizeId(query.partnerId);
        if (!partnerId) {
            return res.status(400).json({ message: "partnerId is required" });
        }
        const isSupport = user.role === "admin" || user.role === "seller";
        const isAdmin = user.role === "admin";
        const customerId = normalizeId(isSupport ? partnerId : user._id);
        const sellerId = isSupport
            ? normalizeId(isAdmin && query.sellerId ? query.sellerId : user._id)
            : yield resolveSellerIdFromPartner(partnerId);
        if (!sellerId) {
            return res.status(404).json({ message: "Không tìm thấy shop hợp lệ" });
        }
        if (!mongoose.Types.ObjectId.isValid(customerId) ||
            !mongoose.Types.ObjectId.isValid(sellerId)) {
            return res.status(400).json({ message: "ID chat không hợp lệ" });
        }
        const customerObjectId = new mongoose.Types.ObjectId(customerId);
        const sellerObjectId = new mongoose.Types.ObjectId(sellerId);
        let messages = [];
        try {
            messages = yield ChatMessage.find({
                customer: customerObjectId,
                seller: sellerObjectId,
            })
                .sort({ createdAt: 1 })
                .lean();
        }
        catch (primaryError) {
            const fallbackRaw = yield ChatMessage.find({})
                .sort({ createdAt: 1 })
                .limit(2000)
                .lean();
            messages = fallbackRaw.filter((m) => String(m.customer) === customerId && String(m.seller) === sellerId);
            console.error("Primary chat query failed, used fallback query", primaryError);
        }
        const normalized = messages.map((m) => {
            var _a, _b;
            return ({
                id: String(m._id),
                text: m.text,
                sender: m.sender,
                createdAt: m.createdAt,
                isRead: (_a = m.isRead) !== null && _a !== void 0 ? _a : false,
                isAI: (_b = m.isAI) !== null && _b !== void 0 ? _b : false,
                sellerReadAt: m.sellerReadAt || null,
                userReadAt: m.userReadAt || null,
            });
        });
        const otherSender = isSupport ? "customer" : "seller";
        const now = new Date();
        let updateResult = { modifiedCount: 0 };
        try {
            updateResult = yield ChatMessage.updateMany({
                customer: customerObjectId,
                seller: sellerObjectId,
                sender: otherSender,
                isRead: false,
            }, {
                $set: Object.assign({ isRead: true }, (isSupport ? { sellerReadAt: now } : { userReadAt: now })),
            });
        }
        catch (updateError) {
            console.error("Primary chat update failed", updateError);
        }
        const io = req.app.get("io");
        if (io && updateResult.modifiedCount > 0) {
            io.to(String(customerId)).emit("chat:read", {
                customerId: String(customerId),
                sellerId: String(sellerId),
                reader: isSupport ? "seller" : "customer",
            });
            io.to(String(sellerId)).emit("chat:read", {
                customerId: String(customerId),
                sellerId: String(sellerId),
                reader: isSupport ? "seller" : "customer",
            });
        }
        res.json(normalized);
    }
    catch (error) {
        console.error("getMessages failed", {
            message: error === null || error === void 0 ? void 0 : error.message,
            stack: error === null || error === void 0 ? void 0 : error.stack,
            userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) ? String(req.user._id) : null,
            role: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) || null,
            partnerId: ((_c = req.query) === null || _c === void 0 ? void 0 : _c.partnerId) || null,
            sellerId: ((_d = req.query) === null || _d === void 0 ? void 0 : _d.sellerId) || null,
        });
        res.json([]);
    }
});
exports.sendMessage = (req, res) => __awaiter(this, void 0, void 0, function* () {
    var _a, _b;
    try {
        const { user, body } = req;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (!text) {
            return res.status(400).json({ message: "Text is required" });
        }
        const partnerId = normalizeId(body.partnerId);
        if (!partnerId) {
            return res.status(400).json({ message: "partnerId is required" });
        }
        const isSupport = user.role === "admin" || user.role === "seller";
        const isAdmin = user.role === "admin";
        const customerId = normalizeId(isSupport ? partnerId : user._id);
        const sellerId = isSupport
            ? normalizeId(isAdmin && body.sellerId ? body.sellerId : user._id)
            : yield resolveSellerIdFromPartner(partnerId);
        if (!sellerId) {
            return res.status(404).json({ message: "Không tìm thấy shop hợp lệ" });
        }
        if (!mongoose.Types.ObjectId.isValid(String(customerId)) ||
            !mongoose.Types.ObjectId.isValid(String(sellerId))) {
            return res.status(400).json({ message: "ID chat không hợp lệ" });
        }
        const [customerExists, sellerExists, sellerUser] = yield Promise.all([
            User.exists({ _id: customerId }),
            User.exists({ _id: sellerId }),
            User.findById(sellerId).select("role").lean(),
        ]);
        if (!customerExists) {
            return res.status(404).json({ message: "Customer user not found" });
        }
        if (!sellerExists) {
            return res.status(404).json({ message: "Seller user not found" });
        }
        if (!sellerUser || !["seller", "admin"].includes(sellerUser.role)) {
            return res.status(400).json({ message: "Seller không hợp lệ" });
        }
        const message = yield ChatMessage.create({
            customer: new mongoose.Types.ObjectId(customerId),
            seller: new mongoose.Types.ObjectId(sellerId),
            sender: isSupport ? "seller" : "customer",
            text,
        });
        const payload = {
            id: String(message._id),
            text: message.text,
            sender: message.sender,
            createdAt: message.createdAt,
            isRead: false,
            customerId,
            sellerId,
        };
        const io = req.app.get("io");
        if (io) {
            io.to(customerId).emit("chat:newMessage", payload);
            io.to(sellerId).emit("chat:newMessage", payload);
        }
        const receiverId = isSupport ? customerId : sellerId;
        const senderName = user.name || user.email || "Người dùng";
        const chatNotification = yield Notification.create({
            user: receiverId,
            title: isSupport ? "Phản hồi mới từ shop" : "Tin nhắn mới từ khách hàng",
            message: `${senderName}: ${text}`,
            type: "chat",
            link: isSupport
                ? "/notifications"
                : `/admin/chat?partnerId=${customerId}&sellerId=${sellerId}`,
        });
        if (io) {
            io.to(String(receiverId)).emit("notification:new", chatNotification.toObject());
        }
        res.status(201).json(payload);
    }
    catch (error) {
        console.error("getConversations failed", {
            message: error === null || error === void 0 ? void 0 : error.message,
            stack: error === null || error === void 0 ? void 0 : error.stack,
            userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a._id) ? String(req.user._id) : null,
            role: ((_b = req.user) === null || _b === void 0 ? void 0 : _b.role) || null,
        });
        res.json([]);
    }
});
exports.getConversations = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const { user } = req;
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        const isSupport = user.role === "admin" || user.role === "seller";
        const isAdmin = user.role === "admin";
        const groupKey = isSupport
            ? { customer: "$customer", seller: "$seller" }
            : "$seller";
        const summaries = yield ChatMessage.aggregate([
            {
                $match: isSupport
                    ? isAdmin
                        ? {}
                        : { seller: user._id }
                    : { customer: user._id },
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: groupKey,
                    lastMessage: { $first: "$text" },
                    lastSender: { $first: "$sender" },
                    lastAt: { $first: "$createdAt" },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: [`$sender`, isSupport ? "customer" : "seller"] },
                                        { $eq: ["$isRead", false] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                },
            },
            { $sort: { lastAt: -1 } },
        ]);
        const partnerIds = summaries.map((s) => String(isSupport ? s._id.customer : s._id));
        const partners = yield User.find({ _id: { $in: partnerIds } })
            .select("name email avatar")
            .lean();
        const partnerMap = new Map(partners.map((p) => [String(p._id), p]));
        const result = summaries.map((s) => {
            const customerId = String(isSupport ? s._id.customer : s._id);
            const sellerId = String(isSupport ? s._id.seller : user._id);
            const info = partnerMap.get(customerId);
            return {
                partnerId: customerId,
                sellerId,
                name: (info === null || info === void 0 ? void 0 : info.name) || "Người dùng",
                email: (info === null || info === void 0 ? void 0 : info.email) || "",
                avatar: (info === null || info === void 0 ? void 0 : info.avatar) || "",
                lastMessage: s.lastMessage,
                lastSender: s.lastSender,
                lastAt: s.lastAt,
                unreadCount: s.unreadCount || 0,
            };
        });
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
