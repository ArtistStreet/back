const Product = require("../models/Product");
const path = require("path");
const OpenAI = require("openai");
const jwt = require("jsonwebtoken");
const ChatMessage = require("../models/ChatMessage");

const normalizeOptionGroups = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((group) => {
      const name =
        group && typeof group.name === "string" ? group.name.trim() : "";
      const values = Array.isArray(group?.values)
        ? group.values
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean)
        : [];
      if (!name || values.length === 0) return null;
      return {
        name,
        values: Array.from(new Set(values)),
      };
    })
    .filter(Boolean);
};

const normalizeDetailSpecs = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const label =
        item && typeof item.label === "string" ? item.label.trim() : "";
      const specValue =
        item && typeof item.value === "string" ? item.value.trim() : "";
      if (!label || !specValue) return null;
      return { label, value: specValue };
    })
    .filter(Boolean);
};

// Cấu hình OpenAI (Tạm thời để trống API Key để bạn tự điền)
const openai = new OpenAI({
  apiKey: "1",
});

// Hàm lấy dữ liệu mock an toàn
const getMockData = () => {
  try {
    // Thử require mockData từ frontend
    const { PRODUCTS } = require("../../../src/utils/mockData");
    return PRODUCTS;
  } catch (err) {
    console.log("Không thể tải mockData từ frontend, dùng dữ liệu mặc định");
    return [];
  }
};

exports.getProducts = async (req, res) => {
  try {
    const { category, search, sort, limit, page, sellerOnly, sellerId } =
      req.query;
    const lim = Number(limit);
    const hasLimit = !Number.isNaN(lim) && lim > 0;
    const pg = Math.max(1, Number(page) || 1);
    const skip = hasLimit ? (pg - 1) * lim : 0;

    if (require("mongoose").connection.readyState !== 1) {
      const PRODUCTS = getMockData();
      let filtered = [...PRODUCTS];
      if (category) filtered = filtered.filter((p) => p.category === category);
      if (search)
        filtered = filtered.filter((p) =>
          p.name.toLowerCase().includes(search.toLowerCase()),
        );
      if (sort === "sold") {
        filtered.sort((a, b) => (b.sold || 0) - (a.sold || 0));
      } else if (sort === "new") {
        filtered.sort((a, b) => String(b.id).localeCompare(String(a.id)));
      }
      const limited = hasLimit ? filtered.slice(skip, skip + lim) : filtered;
      return res.json(limited.map((p) => ({ ...p, _id: p.id.toString() })));
    }

    const query = {};
    if (category) query.category = category;
    if (search) query.name = { $regex: search, $options: "i" };

    if (
      String(sellerOnly || "").toLowerCase() === "true" &&
      req.user &&
      req.user._id
    ) {
      query.seller = req.user._id;
    }
    if (sellerId) {
      query.seller = sellerId;
    }

    const sortOption =
      sort === "sold" ? { sold: -1 } : sort === "new" ? { createdAt: -1 } : {};
    let cursor = Product.find(query).lean();
    if (Object.keys(sortOption).length) {
      cursor = cursor.sort(sortOption);
    }
    if (hasLimit) {
      cursor = cursor.skip(skip).limit(lim);
    }
    cursor = cursor.populate(
      "seller",
      "shopName name shopDescription shopAvatar shopCover shopAddress",
    );
    const products = await cursor;

    const shaped = products.map((obj) => {
      const seller = obj.seller;
      const shopName =
        seller && (seller.shopName || seller.name)
          ? seller.shopName || seller.name
          : undefined;
      const shopDescription =
        seller && seller.shopDescription ? seller.shopDescription : undefined;
      const shopAvatar =
        seller && seller.shopAvatar ? seller.shopAvatar : undefined;
      const shopCover =
        seller && seller.shopCover ? seller.shopCover : undefined;
      const shopAddress =
        seller && seller.shopAddress ? seller.shopAddress : undefined;
      const sellerId = seller ? String(seller._id) : undefined;
      delete obj.seller;
      return {
        ...obj,
        shopName,
        shopDescription,
        shopAvatar,
        shopCover,
        shopAddress,
        sellerId,
      };
    });

    res.json(shaped);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProductById = async (req, res) => {
  try {
    if (require("mongoose").connection.readyState !== 1) {
      const PRODUCTS = getMockData();
      const product = PRODUCTS.find(
        (p) => p.id.toString() === req.params.id.toString(),
      );
      if (!product)
        return res.status(404).json({ message: "Sản phẩm không tồn tại" });
      return res.json({ ...product, _id: product.id.toString() });
    }

    const product = await Product.findById(req.params.id)
      .populate(
        "seller",
        "shopName name shopDescription shopAvatar shopCover shopAddress",
      )
      .lean();
    if (!product)
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    const obj = product;
    const seller = obj.seller;
    const shopName =
      seller && (seller.shopName || seller.name)
        ? seller.shopName || seller.name
        : undefined;
    const shopDescription =
      seller && seller.shopDescription ? seller.shopDescription : undefined;
    const shopAvatar =
      seller && seller.shopAvatar ? seller.shopAvatar : undefined;
    const shopCover = seller && seller.shopCover ? seller.shopCover : undefined;
    const shopAddress =
      seller && seller.shopAddress ? seller.shopAddress : undefined;
    const sellerId = seller ? String(seller._id) : undefined;
    delete obj.seller;
    res.json({
      ...obj,
      shopName,
      shopDescription,
      shopAvatar,
      shopCover,
      shopAddress,
      sellerId,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    if (require("mongoose").connection.readyState !== 1) {
      return res
        .status(503)
        .json({ message: "Cơ sở dữ liệu chưa sẵn sàng để tạo sản phẩm" });
    }

    const data = req.body || {};
    const normalizeMediaList = (value) => {
      if (!value) return [];
      const source = Array.isArray(value) ? value : [value];
      return source
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    };
    const images = normalizeMediaList(data.images);
    const videos = normalizeMediaList(data.videos);
    const primaryImage = (data.image || images[0] || "").trim();
    const payload = {
      name: data.name,
      price: data.price,
      originalPrice: data.originalPrice,
      discount: data.discount,
      image: primaryImage,
      images: images.length > 0 ? images : primaryImage ? [primaryImage] : [],
      videos,
      rating: data.rating || 0,
      sold: data.sold || 0,
      category: data.category,
      isMall: !!data.isMall,
      description: data.description,
      stock: data.stock || 0,
      detailSpecs: normalizeDetailSpecs(data.detailSpecs),
      optionGroups: normalizeOptionGroups(data.optionGroups),
      seller: req.user && req.user._id ? req.user._id : null,
    };

    if (!payload.seller) {
      return res.status(400).json({
        message: "Thiếu thông tin người bán. Vui lòng đăng nhập lại.",
      });
    }

    const product = new Product(payload);
    const newProduct = await product.save();

    const io = req.app.get("io");
    if (io && payload.seller) {
      io.to(String(payload.seller)).emit("dashboard:update");
    }

    res.status(201).json(newProduct);
  } catch (error) {
    console.error("Lỗi tạo sản phẩm:", error);
    res.status(400).json({ message: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    if (require("mongoose").connection.readyState !== 1) {
      return res
        .status(503)
        .json({ message: "Cơ sở dữ liệu chưa sẵn sàng để cập nhật" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    const isAdmin = req.user && req.user.role === "admin";
    const isOwner =
      req.user &&
      product.seller &&
      String(product.seller) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res
        .status(403)
        .json({ message: "Không có quyền sửa sản phẩm này" });
    }

    const normalizeMediaList = (value) => {
      if (value === undefined) return undefined;
      if (value === null) return [];
      const source = Array.isArray(value) ? value : [value];
      return source
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);
    };

    // Cập nhật từng trường một cách an toàn
    if (req.body.name !== undefined) product.name = req.body.name;
    if (req.body.price !== undefined) product.price = req.body.price;
    if (req.body.originalPrice !== undefined)
      product.originalPrice = req.body.originalPrice;
    if (req.body.discount !== undefined) product.discount = req.body.discount;
    if (req.body.image !== undefined) product.image = req.body.image;
    const nextImages = normalizeMediaList(req.body.images);
    if (nextImages !== undefined) {
      product.images = nextImages;
      if (nextImages.length > 0) {
        product.image = nextImages[0];
      }
    }
    const nextVideos = normalizeMediaList(req.body.videos);
    if (nextVideos !== undefined) {
      product.videos = nextVideos;
    }
    if (req.body.category !== undefined) product.category = req.body.category;
    if (req.body.isMall !== undefined) product.isMall = req.body.isMall;
    if (req.body.stock !== undefined) product.stock = req.body.stock;
    if (req.body.description !== undefined)
      product.description = req.body.description;
    if (req.body.detailSpecs !== undefined) {
      product.detailSpecs = normalizeDetailSpecs(req.body.detailSpecs);
    }
    if (req.body.optionGroups !== undefined) {
      product.optionGroups = normalizeOptionGroups(req.body.optionGroups);
    }

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    console.error("Lỗi cập nhật sản phẩm:", error);
    res.status(400).json({ message: error.message });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    if (require("mongoose").connection.readyState !== 1) {
      return res.status(503).json({ message: "Cơ sở dữ liệu chưa sẵn sàng" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Sản phẩm không tồn tại" });
    }

    const isAdmin = req.user && req.user.role === "admin";
    const isOwner =
      req.user &&
      product.seller &&
      String(product.seller) === String(req.user._id);

    if (!isAdmin && !isOwner) {
      return res
        .status(403)
        .json({ message: "Không có quyền xóa sản phẩm này" });
    }

    await product.deleteOne();
    res.json({ message: "Đã xóa sản phẩm thành công" });
  } catch (error) {
    console.error("Lỗi xóa sản phẩm:", error);
    res.status(500).json({ message: error.message });
  }
};

exports.chatbotResponse = async (req, res) => {
  const { message, partnerId } = req.body || {};
  if (!message || typeof message !== "string") {
    return res.status(400).json({ message: "Thiếu nội dung tin nhắn" });
  }

  let reply = "";

  if (process.env.OPENAI_API_KEY) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Bạn là trợ lý ảo hỗ trợ khách hàng cho trang thương mại điện tử ShopBee (phiên bản Blue Glass). Hãy trả lời thân thiện, chuyên nghiệp và ngắn gọn.",
          },
          { role: "user", content: message },
        ],
      });
      reply = completion.choices[0].message.content || "";
    } catch (err) {
      console.error("OpenAI Error:", err);
    }
  }

  if (!reply) {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes("giá") || lowerMsg.includes("bao nhiêu")) {
      reply =
        "Chào bạn! Giá các sản phẩm bên mình đang có ưu đãi rất tốt. Bạn quan tâm đến sản phẩm cụ thể nào không?";
    } else if (lowerMsg.includes("ship") || lowerMsg.includes("vận chuyển")) {
      reply =
        "Bên mình miễn phí vận chuyển cho đơn hàng từ 50k trên toàn quốc nhé!";
    } else if (lowerMsg.includes("đổi trả")) {
      reply = "Bạn có thể đổi trả trong vòng 7 ngày nếu có lỗi sản xuất ạ.";
    } else {
      reply =
        "Chào bạn! Tôi là trợ lý AI của ShopBee. Tôi có thể giúp bạn tìm kiếm sản phẩm hoặc giải đáp thắc mắc về đơn hàng.";
    }
  }

  let userId = null;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    const token = auth.split(" ")[1];
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "ShopBee_secret",
      );
      userId = decoded.id;
    } catch (err) {
      console.error("JWT decode failed in chatbotResponse:", err);
    }
  }

  if (userId && partnerId) {
    try {
      const chatMsg = await ChatMessage.create({
        customer: userId,
        seller: partnerId,
        sender: "seller",
        text: reply,
        isAI: true,
      });

      const payload = {
        id: String(chatMsg._id),
        text: chatMsg.text,
        sender: chatMsg.sender,
        createdAt: chatMsg.createdAt,
        isRead: false,
        customerId: String(userId),
        sellerId: String(partnerId),
        isAI: true,
      };

      const io = req.app.get("io");
      if (io) {
        io.to(String(userId)).emit("chat:newMessage", payload);
        io.to(String(partnerId)).emit("chat:newMessage", payload);
      }
    } catch (err) {
      console.error("Failed to save or broadcast AI reply:", err);
    }
  }

  res.json({ response: reply });
};

