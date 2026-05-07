const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const apiRoutes = require("./src/routes/api");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", apiRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const userSocketCounts = new Map();

const emitPresence = (userId, isOnline) => {
  io.emit("chat:presence", {
    userId: String(userId),
    isOnline: !!isOnline,
  });
};

const markUserConnected = (userId) => {
  const normalizedUserId = String(userId);
  const nextCount = (userSocketCounts.get(normalizedUserId) || 0) + 1;
  userSocketCounts.set(normalizedUserId, nextCount);
  if (nextCount === 1) {
    emitPresence(normalizedUserId, true);
  }
};

const markUserDisconnected = (userId) => {
  const normalizedUserId = String(userId);
  const currentCount = userSocketCounts.get(normalizedUserId) || 0;
  if (currentCount <= 1) {
    userSocketCounts.delete(normalizedUserId);
    emitPresence(normalizedUserId, false);
    return;
  }
  userSocketCounts.set(normalizedUserId, currentCount - 1);
};

io.on("connection", (socket) => {
  socket.on("chat:join", (payload) => {
    const { userId } = payload || {};
    if (userId) {
      const nextUserId = String(userId);
      const previousUserId = socket.data.userId
        ? String(socket.data.userId)
        : "";
      if (previousUserId && previousUserId !== nextUserId) {
        socket.leave(previousUserId);
        markUserDisconnected(previousUserId);
      }

      socket.data.userId = nextUserId;
      socket.join(nextUserId);
      markUserConnected(nextUserId);

      socket.emit("chat:presence:list", {
        userIds: [...userSocketCounts.keys()],
      });
    }
  });

  socket.on("chat:typing", (payload) => {
    const { customerId, sellerId, typing, isFromCustomer } = payload || {};
    if (customerId && sellerId) {
      const targetRoom = isFromCustomer ? String(sellerId) : String(customerId);
      io.to(targetRoom).emit("chat:typing", {
        customerId,
        sellerId,
        typing: !!typing,
        isFromCustomer: !!isFromCustomer,
      });
    }
  });

  socket.on("disconnect", () => {
    const userId = socket.data.userId ? String(socket.data.userId) : "";
    if (userId) {
      markUserDisconnected(userId);
    }
  });
});

app.set("io", io);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", apiRoutes);
const { GoogleGenAI } = require("@google/genai");
const Product = require("./src/models/Product");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/**
 * Extract search keywords from user message for product lookup.
 * Strips common Vietnamese question words / filler so the DB query is more precise.
 */
const extractSearchKeywords = (message) => {
  const stopWords = [
    "có", "không", "bao nhiêu", "giá", "là", "gì", "nào", "cho",
    "tôi", "mình", "shop", "cửa hàng", "bán", "sản phẩm", "hàng",
    "xin", "chào", "ơi", "vậy", "thế", "được", "muốn", "mua",
    "tìm", "kiếm", "xem", "hỏi", "về", "của", "và", "hoặc",
    "hay", "với", "trong", "trên", "dưới", "này", "đó", "kia",
    "còn", "hết", "rồi", "chưa", "đã", "sẽ", "đang", "cái",
    "chiếc", "bộ", "cặp", "đôi", "ai", "giúp", "nhé", "ạ",
  ];
  const words = message
    .toLowerCase()
    .replace(/[?!.,;:]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.includes(w));
  return words.join(" ");
};

app.post("/api/chat", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Thiếu cấu hình GEMINI_API_KEY",
      });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Vui lòng nhập nội dung tin nhắn" });
    }

    // --- 1. Search products in DB matching user query ---
    let productContext = "";
    try {
      const keywords = extractSearchKeywords(message);

      let matchedProducts = [];

      if (keywords.trim()) {
        // Try regex search on product name with each keyword
        const keywordList = keywords.split(/\s+/).filter(Boolean);
        const regexPatterns = keywordList.map(
          (kw) => new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
        );

        // Search products matching ANY keyword in name, category or description
        matchedProducts = await Product.find({
          $or: [
            { name: { $regex: keywords, $options: "i" } },
            ...keywordList.map((kw) => ({
              name: { $regex: kw, $options: "i" },
            })),
            ...keywordList.map((kw) => ({
              category: { $regex: kw, $options: "i" },
            })),
            ...keywordList.map((kw) => ({
              description: { $regex: kw, $options: "i" },
            })),
          ],
        })
          .populate("seller", "shopName name")
          .limit(10)
          .lean();
      }

      // If no keyword-specific match, fetch some popular products as general context
      if (matchedProducts.length === 0) {
        matchedProducts = await Product.find({})
          .sort({ sold: -1 })
          .populate("seller", "shopName name")
          .limit(8)
          .lean();
      }

      if (matchedProducts.length > 0) {
        const productList = matchedProducts
          .map((p, i) => {
            const seller = p.seller;
            const shopName =
              seller && (seller.shopName || seller.name)
                ? seller.shopName || seller.name
                : "Không rõ";
            const specs =
              p.detailSpecs && p.detailSpecs.length > 0
                ? p.detailSpecs.map((s) => `${s.label}: ${s.value}`).join(", ")
                : "Không có";
            const options =
              p.optionGroups && p.optionGroups.length > 0
                ? p.optionGroups
                    .map((g) => `${g.name}: ${g.values.join(", ")}`)
                    .join("; ")
                : "Không có";
            return `${i + 1}. Tên: ${p.name}
   - Giá: ${p.price?.toLocaleString("vi-VN")}đ
   - Giá gốc: ${p.originalPrice?.toLocaleString("vi-VN")}đ
   - Giảm giá: ${p.discount || 0}%
   - Danh mục: ${p.category}
   - Đánh giá: ${p.rating}/5 sao
   - Đã bán: ${p.sold || 0}
   - Tồn kho: ${p.stock || 0}
   - Shop: ${shopName}
   - Mô tả: ${(p.description || "Không có mô tả").substring(0, 200)}
   - Thông số: ${specs}
   - Tùy chọn: ${options}
   - ID: ${p._id}`;
          })
          .join("\n\n");

        productContext = `\n\n=== DỮ LIỆU SẢN PHẨM TỪ CƠ SỞ DỮ LIỆU CỦA CỬA HÀNG ===\nDưới đây là các sản phẩm tìm thấy liên quan đến câu hỏi của khách hàng:\n\n${productList}\n\n=== HẾT DỮ LIỆU SẢN PHẨM ===`;
      }
    } catch (dbError) {
      console.error("Lỗi truy vấn sản phẩm cho chatbot:", dbError);
      // Continue without product context if DB query fails
    }

    // --- 2. Build system instruction with product context ---
    const systemInstruction = `Bạn là trợ lý bán hàng AI thân thiện và chuyên nghiệp cho cửa hàng trực tuyến ShopBee.

NHIỆM VỤ CỦA BẠN:
- Trả lời khách hàng một cách lịch sự, nhiệt tình và chuyên nghiệp bằng tiếng Việt.
- Khi khách hỏi về sản phẩm, hãy sử dụng DỮ LIỆU SẢN PHẨM bên dưới (nếu có) để trả lời chính xác với thông tin thực tế từ cửa hàng.
- Giới thiệu sản phẩm với đầy đủ thông tin: tên, giá, giảm giá, đánh giá, mô tả, tùy chọn, tồn kho...
- Nếu khách hỏi về sản phẩm mà KHÔNG có trong dữ liệu, hãy nói rằng hiện tại cửa hàng chưa có sản phẩm đó và gợi ý khách tìm kiếm trên trang chủ.
- Nếu khách hỏi về vận chuyển, đổi trả, thanh toán... hãy trả lời chung theo chính sách thương mại điện tử thông thường.
- Trả lời ngắn gọn, dễ đọc, có thể dùng emoji cho sinh động.
- Khi liệt kê sản phẩm, hãy format đẹp và dễ đọc.
- Nếu có nhiều sản phẩm phù hợp, hãy giới thiệu tối đa 5 sản phẩm nổi bật nhất.

CHÍNH SÁCH CỬA HÀNG:
- Miễn phí vận chuyển cho đơn hàng từ 50.000đ
- Đổi trả miễn phí trong 7 ngày
- Hỗ trợ thanh toán: COD, chuyển khoản ngân hàng, ví điện tử
- Bảo hành theo chính sách từng sản phẩm${productContext}`;

    // --- 3. Call Gemini AI with product context ---
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const reply =
      response?.text ||
      response?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("")
        .trim();
    if (!reply) {
      return res.status(502).json({
        success: false,
        error: "AI chưa trả về nội dung hợp lệ",
      });
    }
    res.json({ success: true, reply });
  } catch (error) {
    console.error("Lỗi Gemini API:", error);
    res.status(500).json({
      success: false,
      error: "Có lỗi xảy ra khi xử lý yêu cầu",
    });
  }
});

app.post("/api/chat/assistant", async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: "Thiếu cấu hình GEMINI_API_KEY",
      });
    }

    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Vui lòng nhập nội dung tin nhắn" });
    }

    // Search products in DB for context
    let productContext = "";
    try {
      const keywords = extractSearchKeywords(message);
      let matchedProducts = [];

      if (keywords.trim()) {
        const keywordList = keywords.split(/\s+/).filter(Boolean);
        matchedProducts = await Product.find({
          $or: [
            { name: { $regex: keywords, $options: "i" } },
            ...keywordList.map((kw) => ({
              name: { $regex: kw, $options: "i" },
            })),
            ...keywordList.map((kw) => ({
              category: { $regex: kw, $options: "i" },
            })),
          ],
        })
          .populate("seller", "shopName name")
          .limit(10)
          .lean();
      }

      if (matchedProducts.length === 0) {
        matchedProducts = await Product.find({})
          .sort({ sold: -1 })
          .populate("seller", "shopName name")
          .limit(8)
          .lean();
      }

      if (matchedProducts.length > 0) {
        const productList = matchedProducts
          .map((p, i) => {
            const seller = p.seller;
            const shopName =
              seller && (seller.shopName || seller.name)
                ? seller.shopName || seller.name
                : "Không rõ";
            return `${i + 1}. ${p.name} - Giá: ${p.price?.toLocaleString("vi-VN")}đ (Giảm ${p.discount || 0}%) - Đánh giá: ${p.rating}/5 - Đã bán: ${p.sold || 0} - Shop: ${shopName}`;
          })
          .join("\n");

        productContext = `\n\nSẢN PHẨM TRONG CỬA HÀNG:\n${productList}`;
      }
    } catch (dbError) {
      console.error("Lỗi truy vấn sản phẩm cho assistant:", dbError);
    }

    const systemInstruction = `Bạn là trợ lý bán hàng thân thiện và chuyên nghiệp cho cửa hàng online ShopBee. 
        Hãy trả lời khách hàng một cách lịch sự, nhiệt tình. 
        Nếu được hỏi về sản phẩm, hãy sử dụng dữ liệu sản phẩm bên dưới để tư vấn chi tiết về tính năng, giá cả, khuyến mãi.
        Nếu không biết câu trả lời, hãy thành thật nói rằng bạn sẽ chuyển vấn đề cho nhân viên hỗ trợ.${productContext}`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: message }] }],
      config: {
        systemInstruction: systemInstruction,
      },
    });

    const reply =
      response?.text ||
      response?.candidates?.[0]?.content?.parts
        ?.map((part) => part?.text || "")
        .join("")
        .trim();
    if (!reply) {
      return res.status(502).json({
        success: false,
        error: "AI chưa trả về nội dung hợp lệ",
      });
    }
    res.json({ success: true, reply });
  } catch (error) {
    console.error("Lỗi Gemini API:", error);
    res.status(500).json({
      success: false,
      error: "Có lỗi xảy ra khi xử lý yêu cầu",
    });
  }
});

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ShopBee-clone";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Kết nối MongoDB thành công");
    server.listen(PORT, () => {
      console.log(`Server đang chạy trên port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Lỗi kết nối MongoDB:", err);
    process.exit(1);
  });
