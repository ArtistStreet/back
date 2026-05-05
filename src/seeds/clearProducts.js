const mongoose = require("mongoose");
const dotenv = require("dotenv");
const Product = require("../models/Product");

dotenv.config();

const clearProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const before = await Product.countDocuments();
    const result = await Product.deleteMany({});
    const after = await Product.countDocuments();
    console.log(
      `Da xoa san pham: truoc=${before}, da_xoa=${result.deletedCount}, sau=${after}`,
    );
    process.exit(0);
  } catch (error) {
    console.error("Khong the xoa san pham:", error);
    process.exit(1);
  }
};

clearProducts();
