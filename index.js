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
