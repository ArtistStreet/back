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
const dotenv = require("dotenv");
const User = require("../models/User");
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI ||
    "mongodb+srv://buituan15102004_db_user:Yiwo2hlClYpwbgNe@test-mongodb.z8g3jqd.mongodb.net/?appName=test-mongodb";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@shop.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const ADMIN_NAME = process.env.ADMIN_NAME || "Admin";
const seedAdmin = () => __awaiter(this, void 0, void 0, function* () {
    try {
        yield mongoose.connect(MONGODB_URI);
        console.log("✅ Kết nối MongoDB thành công");
        let admin = yield User.findOne({ email: ADMIN_EMAIL });
        if (admin) {
            if (admin.role !== "admin") {
                admin.role = "admin";
                yield admin.save();
                console.log(`🔁 Đã cập nhật quyền admin cho ${ADMIN_EMAIL}`);
            }
            else {
                console.log(`ℹ️ Admin đã tồn tại: ${ADMIN_EMAIL}`);
            }
        }
        else {
            admin = yield User.create({
                name: ADMIN_NAME,
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                role: "admin",
            });
            console.log(`✅ Đã tạo admin: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
        }
    }
    catch (err) {
        console.error("❌ Lỗi seed admin:", err);
    }
    finally {
        yield mongoose.disconnect();
        console.log("🔌 Đã ngắt kết nối MongoDB");
    }
});
seedAdmin();
