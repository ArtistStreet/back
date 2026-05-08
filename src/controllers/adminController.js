const User = require("../models/User");
const jwt = require("jsonwebtoken");

// Get all admin users
exports.getAdminUsers = async (req, res) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create a new admin account
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password, permissions } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Tên, email và mật khẩu là bắt buộc" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã tồn tại" });
    }

    const validPermissions = [
      "manage_products",
      "manage_orders",
      "manage_users",
      "manage_banners",
      "manage_reviews",
      "manage_chat",
      "manage_vouchers",
      "view_dashboard",
    ];

    const adminPermissions = Array.isArray(permissions)
      ? permissions.filter((p) => validPermissions.includes(p))
      : validPermissions;

    const user = await User.create({
      name,
      email,
      password,
      role: "admin",
      username: email.split("@")[0],
      adminPermissions,
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        adminPermissions: user.adminPermissions,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update admin permissions
exports.updateAdminPermissions = async (req, res) => {
  try {
    const { permissions } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (user.role !== "admin") {
      return res.status(400).json({ message: "Người dùng không phải admin" });
    }

    // Prevent self-modification
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: "Không thể thay đổi quyền của chính mình" });
    }

    const validPermissions = [
      "manage_products",
      "manage_orders",
      "manage_users",
      "manage_banners",
      "manage_reviews",
      "manage_chat",
      "manage_vouchers",
      "view_dashboard",
    ];

    user.adminPermissions = Array.isArray(permissions)
      ? permissions.filter((p) => validPermissions.includes(p))
      : user.adminPermissions;

    await user.save();

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        adminPermissions: user.adminPermissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Change user role (promote/demote)
exports.changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: "Không thể thay đổi vai trò của chính mình" });
    }

    if (!["user", "seller", "admin"].includes(role)) {
      return res.status(400).json({ message: "Vai trò không hợp lệ" });
    }

    user.role = role;

    if (role === "admin" && !user.adminPermissions?.length) {
      user.adminPermissions = [
        "manage_products",
        "manage_orders",
        "manage_banners",
        "manage_reviews",
        "manage_chat",
        "manage_vouchers",
        "view_dashboard",
      ];
    }

    await user.save();

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        adminPermissions: user.adminPermissions,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }

    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: "Không thể xóa chính mình" });
    }

    await user.deleteOne();
    res.json({ message: "Đã xóa người dùng thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
