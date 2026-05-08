const Banner = require("../models/Banner");

// Get all active banners (public)
exports.getActiveBanners = async (req, res) => {
  try {
    const now = new Date();
    const banners = await Banner.find({
      isActive: true,
      $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }],
      $and: [
        {
          $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }],
        },
      ],
    })
      .sort({ order: 1, createdAt: -1 })
      .lean();
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all banners (admin)
exports.getAllBanners = async (req, res) => {
  try {
    const banners = await Banner.find()
      .sort({ order: 1, createdAt: -1 })
      .populate("createdBy", "name email")
      .lean();
    res.json(banners);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create banner (admin)
exports.createBanner = async (req, res) => {
  try {
    const { title, subtitle, image, link, position, isActive, order, startDate, endDate } =
      req.body;

    if (!title || !image) {
      return res.status(400).json({ message: "Tiêu đề và hình ảnh là bắt buộc" });
    }

    const banner = await Banner.create({
      title,
      subtitle: subtitle || "",
      image,
      link: link || "",
      position: position || "main",
      isActive: isActive !== undefined ? isActive : true,
      order: order || 0,
      startDate: startDate || null,
      endDate: endDate || null,
      createdBy: req.user._id,
    });

    res.status(201).json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update banner (admin)
exports.updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: "Không tìm thấy banner" });
    }

    const fields = ["title", "subtitle", "image", "link", "position", "isActive", "order", "startDate", "endDate"];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        banner[field] = req.body[field];
      }
    });

    await banner.save();
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete banner (admin)
exports.deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);
    if (!banner) {
      return res.status(404).json({ message: "Không tìm thấy banner" });
    }

    await banner.deleteOne();
    res.json({ message: "Đã xóa banner thành công" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Upload banner image (admin)
exports.uploadBannerImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Không có file ảnh được tải lên" });
    }
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const imageUrl = new URL(
      `/uploads/banners/${req.file.filename}`,
      baseUrl,
    ).toString();
    const optimized = req.file.optimized || {};
    const sources = {
      avif: optimized.avifFilename
        ? new URL(`/uploads/banners/${optimized.avifFilename}`, baseUrl).toString()
        : imageUrl,
      webp: optimized.webpFilename
        ? new URL(`/uploads/banners/${optimized.webpFilename}`, baseUrl).toString()
        : imageUrl,
    };
    res.json({ imageUrl, sources });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
