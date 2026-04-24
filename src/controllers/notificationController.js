const Notification = require('../models/Notification');
const mongoose = require('mongoose');

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (notification && notification.user.toString() === req.user._id.toString()) {
      notification.isRead = true;
      await notification.save();
      res.json({ message: 'Notification marked as read' });
    } else {
      res.status(404).json({ message: 'Notification not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notificationId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification id' });
    }
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      user: req.user._id,
    });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true } },
    );
    res.json({
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteReadNotifications = async (req, res) => {
  try {
    const result = await Notification.deleteMany({
      user: req.user._id,
      isRead: true,
    });
    res.json({ message: 'Read notifications removed', deletedCount: result.deletedCount || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

