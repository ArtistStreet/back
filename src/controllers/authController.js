const User = require("../models/User");
const jwt = require("jsonwebtoken");
const path = require("path");

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const userExists = await User.findOne({ email });
    if (userExists)
      return res.status(400).json({ message: "Email đã tồn tại" });

    const user = await User.create({
      name,
      email,
      password,
      username: email.split("@")[0],
    });
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "shopee_secret",
      { expiresIn: "7d" }
    );

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
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, username, identifier, password } = req.body;
    const loginIdentifier = identifier || email || username;

    if (!loginIdentifier || !password) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập email/tên đăng nhập và mật khẩu" });
    }

    const user = await User.findOne({
      $or: [{ email: loginIdentifier }, { username: loginIdentifier }],
    });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        message: "Email / tên đăng nhập hoặc mật khẩu không đúng",
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "shopee_secret",
      { expiresIn: "7d" }
    );
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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, email, username, phone, gender, birthDate, avatar } =
      req.body;

    if (email !== undefined && email !== user.email) {
      const exists = await User.findOne({ email });
      if (exists && String(exists._id) !== String(user._id)) {
        return res.status(400).json({ message: "Email đã tồn tại" });
      }
    }

    if (username !== undefined && username !== user.username) {
      const exists = await User.findOne({ username });
      if (exists && String(exists._id) !== String(user._id)) {
        return res.status(400).json({ message: "Tên đăng nhập đã tồn tại" });
      }
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (username !== undefined) user.username = username;
    if (phone !== undefined) user.phone = phone;
    if (gender !== undefined) user.gender = gender;
    if (birthDate !== undefined) {
      if (!birthDate) {
        user.birthDate = undefined;
      } else {
        user.birthDate = birthDate;
      }
    }
    if (avatar !== undefined) user.avatar = avatar;

    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "shopee_secret",
      { expiresIn: "7d" }
    );

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
  } catch (error) {
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
};

exports.getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("addresses");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user.addresses || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { fullName, phone, province, district, ward, street, isDefault } =
      req.body || {};

    if (!fullName || !phone || !province || !district || !ward || !street) {
      return res.status(400).json({ message: "Thiếu thông tin địa chỉ" });
    }

    if (isDefault) {
      user.addresses = (user.addresses || []).map((a) => ({
        ...a.toObject(),
        isDefault: false,
      }));
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

    await user.save();
    res.status(201).json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const address = (user.addresses || []).id(req.params.id);
    if (!address) return res.status(404).json({ message: "Address not found" });

    const { fullName, phone, province, district, ward, street, isDefault } =
      req.body || {};

    if (fullName !== undefined) address.fullName = fullName;
    if (phone !== undefined) address.phone = phone;
    if (province !== undefined) address.province = province;
    if (district !== undefined) address.district = district;
    if (ward !== undefined) address.ward = ward;
    if (street !== undefined) address.street = street;

    if (isDefault === true) {
      user.addresses = user.addresses.map((a) => ({
        ...a.toObject(),
        isDefault: String(a._id) === String(address._id),
      }));
    }

    await user.save();
    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const address = (user.addresses || []).id(req.params.id);
    if (!address) return res.status(404).json({ message: "Address not found" });

    const wasDefault = Boolean(address.isDefault);
    address.deleteOne();
    await user.save();

    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
      await user.save();
    }

    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const address = (user.addresses || []).id(req.params.id);
    if (!address) return res.status(404).json({ message: "Address not found" });

    user.addresses = user.addresses.map((a) => ({
      ...a.toObject(),
      isDefault: String(a._id) === String(address._id),
    }));
    await user.save();
    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập mật khẩu hiện tại và mật khẩu mới" });
    }

    const ok = await user.comparePassword(String(currentPassword));
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
    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "shopee_secret",
      { expiresIn: "7d" }
    );

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
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file ảnh được tải lên" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const relativePath = `/uploads/avatars/${req.file.filename}`;
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const avatarUrl = new URL(relativePath, baseUrl).toString();

    user.avatar = avatarUrl;
    await user.save();

    res.json({ avatar: avatarUrl });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
