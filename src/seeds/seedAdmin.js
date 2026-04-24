const mongoose = require("mongoose");
const dotenv = require("dotenv");
const User = require("../models/User");

dotenv.config();

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://buituan15102004_db_user:Yiwo2hlClYpwbgNe@test-mongodb.z8g3jqd.mongodb.net/?appName=test-mongodb";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shop.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";

const seedAdmin = async () => {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Kết nối MongoDB thành công");

    let admin = await User.findOne({ email: ADMIN_EMAIL });
    if (admin) {
      if (admin.role !== "admin") {
        admin.role = "admin";
        await admin.save();
        console.log(`🔁 Đã cập nhật quyền admin cho ${ADMIN_EMAIL}`);
      } else {
        console.log(`ℹ️ Admin đã tồn tại: ${ADMIN_EMAIL}`);
      }
    } else {
      admin = await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: "admin",
      });
      console.log(`✅ Đã tạo admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    }
  } catch (err) {
    console.error("❌ Lỗi seed admin:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Đã ngắt kết nối MongoDB");
  }
};

seedAdmin();

