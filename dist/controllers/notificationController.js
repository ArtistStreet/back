var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
exports.getNotifications = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const notifications = yield Notification.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        res.json(notifications);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.markAsRead = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const notification = yield Notification.findById(req.params.id);
        if (notification && notification.user.toString() === req.user._id.toString()) {
            notification.isRead = true;
            yield notification.save();
            res.json({ message: 'Notification marked as read' });
        }
        else {
            res.status(404).json({ message: 'Notification not found' });
        }
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.deleteNotification = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const notificationId = req.params.id;
        if (!mongoose.Types.ObjectId.isValid(notificationId)) {
            return res.status(400).json({ message: 'Invalid notification id' });
        }
        const notification = yield Notification.findOneAndDelete({
            _id: notificationId,
            user: req.user._id,
        });
        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }
        res.json({ message: 'Notification removed' });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.markAllAsRead = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const result = yield Notification.updateMany({ user: req.user._id, isRead: false }, { $set: { isRead: true } });
        res.json({
            message: 'All notifications marked as read',
            modifiedCount: result.modifiedCount || 0,
        });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
exports.deleteReadNotifications = (req, res) => __awaiter(this, void 0, void 0, function* () {
    try {
        const result = yield Notification.deleteMany({
            user: req.user._id,
            isRead: true,
        });
        res.json({ message: 'Read notifications removed', deletedCount: result.deletedCount || 0 });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
});
