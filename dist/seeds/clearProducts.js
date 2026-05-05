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
const clearProducts = () => __awaiter(this, void 0, void 0, function* () {
    try {
        yield mongoose.connect(process.env.MONGODB_URI);
        const before = yield Product.countDocuments();
        const result = yield Product.deleteMany({});
        const after = yield Product.countDocuments();
        console.log(`Da xoa san pham: truoc=${before}, da_xoa=${result.deletedCount}, sau=${after}`);
        process.exit(0);
    }
    catch (error) {
        console.error("Khong the xoa san pham:", error);
        process.exit(1);
    }
});
clearProducts();
