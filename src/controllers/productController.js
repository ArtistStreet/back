const Product = require("../models/Product");
const path = require("path");
const OpenAI = require("openai");

// Cấu hình OpenAI (Tạm thời để trống API Key để bạn tự điền)
const openai = new OpenAI({
    apiKey: "1"
});

// Hàm lấy dữ liệu mock an toàn
const getMockData = () => {
    try {
        // Thử require mockData từ frontend
        const { PRODUCTS } = require("../../../src/utils/mockData");
        return PRODUCTS;
    } catch (err) {
        console.log("Không thể tải mockData từ frontend, dùng dữ liệu mặc định");
        return [
            {
                id: 1,
                name: "Sản phẩm mẫu 1",
                price: 100000,
                originalPrice: 150000,
                discount: 33,
                image: "https://picsum.photos/seed/1/400/400",
                rating: 5,
                sold: 100,
                category: "Thời Trang Nam",
            },
            {
                id: 2,
                name: "Sản phẩm mẫu 2",
                price: 200000,
                originalPrice: 300000,
                discount: 33,
                image: "https://picsum.photos/seed/2/400/400",
                rating: 4,
                sold: 50,
                category: "Thiết Bị Điện Tử",
            },
        ];
    }
};

exports.getProducts = async (req, res) => {
    try {
        const { category, search, sort, limit, page } = req.query;
        const lim = Number(limit);
        const hasLimit = !Number.isNaN(lim) && lim > 0;
        const pg = Math.max(1, Number(page) || 1);
        const skip = hasLimit ? (pg - 1) * lim : 0;

        // Kiểm tra kết nối DB
        if (require("mongoose").connection.readyState !== 1) {
            console.log("Sử dụng dữ liệu Mock vì DB chưa kết nối");
            const PRODUCTS = getMockData();
            let filtered = [...PRODUCTS];
            if (category) filtered = filtered.filter((p) => p.category === category);
            if (search)
                filtered = filtered.filter((p) =>
                    p.name.toLowerCase().includes(search.toLowerCase())
                );
            if (sort === "sold") {
                filtered.sort((a, b) => (b.sold || 0) - (a.sold || 0));
            } else if (sort === "new") {
                // Mock không có createdAt, tạm dùng id giảm dần như gần tương đương
                filtered.sort((a, b) => String(b.id).localeCompare(String(a.id)));
            }
            const limited = hasLimit ? filtered.slice(skip, skip + lim) : filtered;
            return res.json(limited.map((p) => ({ ...p, _id: p.id.toString() })));
        }

        let query = {};
        if (category) query.category = category;
        if (search) query.name = { $regex: search, $options: "i" };

        const sortOption =
            sort === "sold" ? { sold: -1 } : sort === "new" ? { createdAt: -1 } : {};
        let cursor = Product.find(query);
        if (Object.keys(sortOption).length) {
            cursor = cursor.sort(sortOption);
        }
        if (hasLimit) {
            cursor = cursor.skip(skip).limit(lim);
        }
        const products = await cursor;
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProductById = async (req, res) => {
    try {
        if (require("mongoose").connection.readyState !== 1) {
            const PRODUCTS = getMockData();
            const product = PRODUCTS.find(
                (p) => p.id.toString() === req.params.id.toString()
            );
            if (!product)
                return res.status(404).json({ message: "Sản phẩm không tồn tại" });
            return res.json({ ...product, _id: product.id.toString() });
        }

        const product = await Product.findById(req.params.id);
        if (!product)
            return res.status(404).json({ message: "Sản phẩm không tồn tại" });
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createProduct = async (req, res) => {
    const product = new Product(req.body);
    try {
        const newProduct = await product.save();
        res.status(201).json(newProduct);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            product.name = req.body.name || product.name;
            product.price = req.body.price || product.price;
            product.originalPrice = req.body.originalPrice || product.originalPrice;
            product.discount = req.body.discount || product.discount;
            product.image = req.body.image || product.image;
            product.category = req.body.category || product.category;
            product.isMall = req.body.isMall || product.isMall;
            product.stock = req.body.stock || product.stock;

            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: "Product not found" });
        }
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (product) {
            await product.remove();
            res.json({ message: "Product removed" });
        } else {
            res.status(404).json({ message: "Product not found" });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.chatbotResponse = async (req, res) => {
    const { message } = req.body;

    // Nếu có OpenAI API Key, sử dụng AI thật
    if (
        process.env.OPENAI_API_KEY
    ) {
        try {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content:
                            "Bạn là trợ lý ảo hỗ trợ khách hàng cho trang thương mại điện tử Shopee (phiên bản Blue Glass). Hãy trả lời thân thiện, chuyên nghiệp và ngắn gọn.",
                    },
                    { role: "user", content: message },
                ],
            });
            return res.json({ response: completion.choices[0].message.content });
        } catch (err) {
            console.error("OpenAI Error:", err);
            // Fallback nếu AI lỗi
        }
    }

    // Logic fallback (Mock AI)
    const lowerMsg = message.toLowerCase();
    let response = "";
    if (lowerMsg.includes("giá") || lowerMsg.includes("bao nhiêu")) {
        response =
            "Chào bạn! Giá các sản phẩm bên mình đang có ưu đãi rất tốt. Bạn quan tâm đến sản phẩm cụ thể nào không?";
    } else if (lowerMsg.includes("ship") || lowerMsg.includes("vận chuyển")) {
        response =
            "Bên mình miễn phí vận chuyển cho đơn hàng từ 50k trên toàn quốc nhé!";
    } else if (lowerMsg.includes("đổi trả")) {
        response = "Bạn có thể đổi trả trong vòng 7 ngày nếu có lỗi sản xuất ạ.";
    } else {
        response =
            "Chào bạn! Tôi là trợ lý AI của Shopee. Tôi có thể giúp bạn tìm kiếm sản phẩm hoặc giải đáp thắc mắc về đơn hàng.";
    }

    res.json({ response });
};
