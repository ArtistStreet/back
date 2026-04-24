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
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Product = require("../models/Product");
dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI ||
    "mongodb+srv://buituan15102004_db_user:Yiwo2hlClYpwbgNe@test-mongodb.z8g3jqd.mongodb.net/?appName=test-mongodb";
const products = [
    // MockData (id 1)
    {
        name: "Áo thun nam ngắn tay cổ tròn cotton 100% cao cấp co giãn thoáng khí",
        price: 89000,
        originalPrice: 150000,
        discount: 41,
        image: "https://picsum.photos/seed/p1/600/600",
        rating: 4.8,
        sold: 12500,
        category: "Thời Trang Nam",
        isMall: true,
        description: "Áo thun cotton 100% co giãn, thoáng khí, form dễ mặc.",
        stock: 500,
    },
    // MockData (id 2)
    {
        name: "Tai nghe Bluetooth không dây thế hệ mới âm thanh Hifi chống ồn",
        price: 250000,
        originalPrice: 450000,
        discount: 44,
        image: "https://picsum.photos/seed/p2/600/600",
        rating: 4.9,
        sold: 5400,
        category: "Thiết Bị Điện Tử",
        isMall: false,
        description: "Tai nghe true wireless âm thanh Hifi, chống ồn chủ động.",
        stock: 300,
    },
    // MockData (id 3)
    {
        name: "Sạc dự phòng 20000mAh sạc nhanh 22.5W dung lượng chuẩn",
        price: 189000,
        originalPrice: 320000,
        discount: 41,
        image: "https://picsum.photos/seed/p3/600/600",
        rating: 4.7,
        sold: 8900,
        category: "Điện Thoại & Phụ Kiện",
        isMall: true,
        description: "Pin dự phòng 20000mAh, hỗ trợ sạc nhanh nhiều chuẩn.",
        stock: 400,
    },
    // MockData (id 4)
    {
        name: "Giày Sneaker nam nữ thể thao phong cách Hàn Quốc bền đẹp",
        price: 120000,
        originalPrice: 250000,
        discount: 52,
        image: "https://picsum.photos/seed/p4/600/600",
        rating: 4.6,
        sold: 15200,
        category: "Giày Dép Nam",
        isMall: false,
        description: "Sneaker unisex bền đẹp, đa dụng cho đi học và đi chơi.",
        stock: 350,
    },
    // MockData (id 5)
    {
        name: "Bàn phím cơ không dây layout 75% có LED RGB hotswap",
        price: 599000,
        originalPrice: 850000,
        discount: 30,
        image: "https://picsum.photos/seed/p5/600/600",
        rating: 4.9,
        sold: 2100,
        category: "Máy Tính & Laptop",
        isMall: false,
        description: "Bàn phím cơ 75% không dây, LED RGB, hot-swap switch.",
        stock: 120,
    },
    // MockData (id 6)
    {
        name: "Chuột Gaming không dây siêu nhẹ cảm biến 26k DPI",
        price: 450000,
        originalPrice: 650000,
        discount: 31,
        image: "https://picsum.photos/seed/p6/600/600",
        rating: 4.8,
        sold: 3500,
        category: "Máy Tính & Laptop",
        isMall: true,
        description: "Chuột gaming siêu nhẹ, cảm biến 26k DPI, pin bền.",
        stock: 180,
    },
    {
        name: "iPhone 15 Pro Max 256GB - Hàng chính hãng VN/A",
        price: 29990000,
        originalPrice: 34990000,
        discount: 14,
        image: "https://picsum.photos/seed/iphone15pm/600/600",
        rating: 4.9,
        sold: 1520,
        category: "Điện Thoại & Phụ Kiện",
        isMall: true,
        description: "iPhone 15 Pro Max chính hãng VN/A, chip A17 Pro, khung titan, camera 48MP, hỗ trợ 5G, bảo hành 12 tháng.",
        stock: 120,
    },
    {
        name: "MacBook Air M2 13 inch 256GB 2024",
        price: 24990000,
        originalPrice: 29990000,
        discount: 17,
        image: "https://picsum.photos/seed/macbookairm2/600/600",
        rating: 4.8,
        sold: 830,
        category: "Laptop",
        isMall: true,
        description: "MacBook Air M2 13 inch, 8GB RAM, 256GB SSD, thiết kế mỏng nhẹ, pin lên đến 18 giờ, phù hợp học tập và làm việc.",
        stock: 60,
    },
    {
        name: "Tai nghe Bluetooth AirPods Pro 2 MagSafe",
        price: 5590000,
        originalPrice: 6490000,
        discount: 14,
        image: "https://picsum.photos/seed/airpodspro2/600/600",
        rating: 4.9,
        sold: 2350,
        category: "Thiết Bị Điện Tử",
        isMall: true,
        description: "Tai nghe AirPods Pro 2 chống ồn chủ động, Spatial Audio, sạc MagSafe, tương thích iOS và Android.",
        stock: 200,
    },
    {
        name: "Chuột Logitech MX Master 3S Không dây",
        price: 1990000,
        originalPrice: 2490000,
        discount: 20,
        image: "https://picsum.photos/seed/mxmaster3s/600/600",
        rating: 4.9,
        sold: 640,
        category: "Thiết Bị Điện Tử",
        isMall: false,
        description: "Chuột Logitech MX Master 3S, cảm biến 8K DPI, kết nối Bluetooth/Unifying, tối ưu cho công việc văn phòng.",
        stock: 80,
    },
    {
        name: "Bàn phím cơ Keychron K2 Version 2 RGB",
        price: 1890000,
        originalPrice: 2290000,
        discount: 17,
        image: "https://picsum.photos/seed/keychronk2/600/600",
        rating: 4.7,
        sold: 410,
        category: "Thiết Bị Điện Tử",
        isMall: false,
        description: "Bàn phím cơ Keychron K2 V2, layout 75%, hỗ trợ kết nối không dây và có dây, switch Gateron.",
        stock: 90,
    },
    {
        name: "Áo thun Unisex Oversize Basic",
        price: 159000,
        originalPrice: 199000,
        discount: 20,
        image: "https://picsum.photos/seed/tshirtoversize/600/600",
        rating: 4.6,
        sold: 980,
        category: "Thời Trang Nam",
        isMall: false,
        description: "Áo thun unisex form oversize, chất liệu cotton 2 chiều thoáng mát, nhiều màu sắc dễ phối đồ.",
        stock: 300,
    },
    {
        name: "Giày Sneaker Trắng Classic",
        price: 399000,
        originalPrice: 499000,
        discount: 20,
        image: "https://picsum.photos/seed/sneakerclassic/600/600",
        rating: 4.7,
        sold: 720,
        category: "Thời Trang Nữ",
        isMall: false,
        description: "Giày sneaker trắng đơn giản, dễ phối đồ, phù hợp đi học, đi làm, đi chơi.",
        stock: 150,
    },
];
const seedProducts = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield mongoose.connect(MONGODB_URI);
        console.log("✅ Kết nối MongoDB thành công");
        yield Product.deleteMany({});
        console.log("🧹 Đã xóa toàn bộ sản phẩm cũ");
        const created = yield Product.insertMany(products);
        console.log(`✅ Đã thêm ${created.length} sản phẩm mẫu vào cơ sở dữ liệu`);
    }
    catch (err) {
        console.error("❌ Lỗi seed sản phẩm:", err);
    }
    finally {
        yield mongoose.disconnect();
        console.log("🔌 Đã ngắt kết nối MongoDB");
    }
});
seedProducts();
