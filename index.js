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

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

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

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: message,
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

    const systemInstruction = `Bạn là trợ lý bán hàng thân thiện và chuyên nghiệp cho một cửa hàng online. 
        Hãy trả lời khách hàng một cách lịch sự, nhiệt tình. 
        Nếu được hỏi về sản phẩm, hãy tư vấn chi tiết về tính năng, giá cả, khuyến mãi.
        Nếu không biết câu trả lời, hãy thành thật nói rằng bạn sẽ chuyển vấn đề cho nhân viên hỗ trợ.`;

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
    server.listen(PORT, () => {
      console.log(`Server (Database disconnected) đang chạy trên port ${PORT}`);
    });
  });
