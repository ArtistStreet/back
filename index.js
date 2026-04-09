const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const apiRoutes = require('./src/routes/api');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/api', apiRoutes);
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung tin nhắn' });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
    });

    const reply = response.text;
    res.json({ success: true, reply });

  } catch (error) {
    console.error('Lỗi Gemini API:', error);
    res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra khi xử lý yêu cầu'
    });
  }
});

app.post('/api/chat/assistant', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Vui lòng nhập nội dung tin nhắn' });
    }

    const systemInstruction = `Bạn là trợ lý bán hàng thân thiện và chuyên nghiệp cho một cửa hàng online. 
        Hãy trả lời khách hàng một cách lịch sự, nhiệt tình. 
        Nếu được hỏi về sản phẩm, hãy tư vấn chi tiết về tính năng, giá cả, khuyến mãi.
        Nếu không biết câu trả lời, hãy thành thật nói rằng bạn sẽ chuyển vấn đề cho nhân viên hỗ trợ.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: message }] }
      ],
      config: {
        systemInstruction: systemInstruction,
      }
    });

    const reply = response.text;
    res.json({ success: true, reply });

  } catch (error) {
    console.error('Lỗi Gemini API:', error);
    res.status(500).json({
      success: false,
      error: 'Có lỗi xảy ra khi xử lý yêu cầu'
    });
  }
});


const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/shopee-clone';

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Kết nối MongoDB thành công');
    app.listen(PORT, () => {
      console.log(`Server đang chạy trên port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Lỗi kết nối MongoDB:', err);
    // Vẫn cho server chạy để trả về lỗi thay vì crash (tùy chọn)
    app.listen(PORT, () => {
      console.log(`Server (Database disconnected) đang chạy trên port ${PORT}`);
    });
  });
