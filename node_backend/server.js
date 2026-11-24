// Nạp biến môi trường từ .env TRƯỚC mọi require khác (middleware/auth.js cần JWT_SECRET ngay khi nạp)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const { verifyToken, requireStaff } = require('./middleware/auth');
const authRoutes = require('./routes/auth');           // Admin/Staff: đăng nhập
const clientAuthRoutes = require('./routes/clientAuth'); // Hội viên: đăng ký, đăng nhập, hồ sơ của tôi
const customerRoutes = require('./routes/customer');   // Quản lý hội viên (chỉ Admin/Staff)
const predictRoutes = require('./routes/predict');     // Landing Page: dự báo dùng thử, không lưu

const app = express();
const PORT = Number(process.env.PORT) || 3001;

if (!process.env.MONGODB_URI) {
    console.error('❌ Thiếu MONGODB_URI trong node_backend/.env. Xem node_backend/.env.example.');
    process.exit(1);
}

// CORS: CORS_ORIGIN trống -> cho phép mọi nơi (chạy local); có giá trị -> chỉ các tên miền đó
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : undefined));
app.use(express.json({ limit: '5mb' })); // đủ cho "Lưu tất cả" vài nghìn dòng CSV

// Kết nối Database
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Đã kết nối thành công tới MongoDB Atlas!'))
    .catch((error) => {
        console.error('❌ Lỗi kết nối MongoDB Atlas:', error.message);
        process.exit(1);
    });

// Kiểm tra server còn sống (dùng khi triển khai / mở trước buổi bảo vệ)
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', mongo: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// Gắn các API vào hệ thống
app.use('/api/auth', authRoutes);
app.use('/api/client', clientAuthRoutes);
// /api/customers: phải đăng nhập VÀ là Admin/Staff (hội viên bị chặn, chỉ dùng /api/client/me)
app.use('/api/customers', verifyToken, requireStaff, customerRoutes);
app.use('/api/predict', predictRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server Node.js đang chạy tại http://localhost:${PORT}`);
    console.log(allowedOrigins.length ? `🔒 CORS chỉ cho phép: ${allowedOrigins.join(', ')}` : '🔓 CORS: cho phép mọi nơi (chạy local)');
});