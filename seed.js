const axios = require("axios");

const products = [
  {
    name: "Áo thun nam ngắn tay cổ tròn cotton 100% cao cấp co giãn thoáng khí",
    price: 89000,
    originalPrice: 150000,
    discount: 41,
    image: "https://picsum.photos/seed/p1/400/400",
    rating: 4.8,
    sold: 12500,
    category: "Thời Trang Nam",
    isMall: true,
  },
  {
    name: "Tai nghe Bluetooth không dây thế hệ mới âm thanh Hifi chống ồn",
    price: 250000,
    originalPrice: 450000,
    discount: 44,
    image: "https://picsum.photos/seed/p2/400/400",
    rating: 4.9,
    sold: 5400,
    category: "Thiết Bị Điện Tử",
  },
  {
    name: "Sạc dự phòng 20000mAh sạc nhanh 22.5W dung lượng chuẩn",
    price: 189000,
    originalPrice: 320000,
    discount: 41,
    image: "https://picsum.photos/seed/p3/400/400",
    rating: 4.7,
    sold: 8900,
    category: "Điện Thoại & Phụ Kiện",
    isMall: true,
  },
  {
    name: "Giày Sneaker nam nữ thể thao phong cách Hàn Quốc bền đẹp",
    price: 120000,
    originalPrice: 250000,
    discount: 52,
    image: "https://picsum.photos/seed/p4/400/400",
    rating: 4.6,
    sold: 15200,
    category: "Giày Dép Nam",
  },
  {
    name: "Bàn phím cơ không dây layout 75% có LED RGB hotswap",
    price: 599000,
    originalPrice: 850000,
    discount: 30,
    image: "https://picsum.photos/seed/p5/400/400",
    rating: 4.9,
    sold: 2100,
    category: "Máy Tính & Laptop",
  },
  {
    name: "Chuột Gaming không dây siêu nhẹ cảm biến 26k DPI",
    price: 450000,
    originalPrice: 650000,
    discount: 31,
    image: "https://picsum.photos/seed/p6/400/400",
    rating: 4.8,
    sold: 3500,
    category: "Máy Tính & Laptop",
    isMall: true,
  },
  {
    name: "iPhone 15 Pro Max 256GB - Hàng chính hãng VN/A",
    price: 29990000,
    originalPrice: 34990000,
    discount: 14,
    image: "https://picsum.photos/seed/iphone15/400/400",
    rating: 5.0,
    sold: 1200,
    category: "Điện Thoại & Phụ Kiện",
    isMall: true,
  },
  {
    name: "Laptop Gaming ASUS ROG Zephyrus G14 2024 - RTX 4060",
    price: 45990000,
    originalPrice: 49990000,
    discount: 8,
    image: "https://picsum.photos/seed/rog/400/400",
    rating: 4.9,
    sold: 450,
    category: "Máy Tính & Laptop",
    isMall: true,
  },
  {
    name: "Máy ảnh Mirrorless Sony A7 Mark IV - Body Only",
    price: 54990000,
    originalPrice: 59990000,
    discount: 8,
    image: "https://picsum.photos/seed/sonya7/400/400",
    rating: 5.0,
    sold: 200,
    category: "Máy Ảnh - Máy Quay Phim",
    isMall: true,
  },
  {
    name: "Nồi chiên không dầu Philips HD9280/90 - 6.2 Lít",
    price: 3290000,
    originalPrice: 4500000,
    discount: 27,
    image: "https://picsum.photos/seed/philips/400/400",
    rating: 4.8,
    sold: 3500,
    category: "Thiết Bị Gia Dụng",
    isMall: true,
  },
  {
    name: "Loa Bluetooth Marshall Emberton II - Chính hãng",
    price: 3990000,
    originalPrice: 4500000,
    discount: 11,
    image: "https://picsum.photos/seed/marshall/400/400",
    rating: 4.9,
    sold: 800,
    category: "Thiết Bị Điện Tử",
    isMall: true,
  },
  {
    name: "Đồng hồ thông minh Apple Watch Series 9 GPS 41mm",
    price: 9490000,
    originalPrice: 10490000,
    discount: 10,
    image: "https://picsum.photos/seed/aw9/400/400",
    rating: 4.9,
    sold: 1200,
    category: "Đồng Hồ",
    isMall: true,
  },
  {
    name: "Giày Chạy Bộ Nam Nike Air Zoom Pegasus 40",
    price: 2800000,
    originalPrice: 3500000,
    discount: 20,
    image: "https://picsum.photos/seed/nike/400/400",
    rating: 4.8,
    sold: 2500,
    category: "Giày Dép Nam",
    isMall: true,
  },
];

async function seed() {
  for (const product of products) {
    try {
      const res = await axios.post(
        "http://localhost:5000/api/products",
        product
      );
      console.log(`Đã thêm: ${product.name}`);
    } catch (err) {
      if (err.response) {
        console.error(
          `Lỗi server (${err.response.status}): ${JSON.stringify(
            err.response.data
          )}`
        );
      } else {
        console.error(`Lỗi kết nối: ${err.message}`);
      }
    }
  }
}

seed();
