require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const clientAuthRoutes = require('./routes/clientAuth'); // Import file mới

// Import bộ định tuyến (Router) khách hàng
const customerRoutes = require('./routes/customer');
const predictRoutes = require('./routes/predict'); // Landing Page: dự báo dùng thử, không lưu

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Kết nối Database
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ Đã kết nối thành công tới MongoDB Atlas!"))
    .catch((error) => {
        console.error("❌ Lỗi kết nối MongoDB Atlas:", error.message);
        process.exit(1);
    });

// Gắn các API vào hệ thống
// Bất kỳ yêu cầu nào bắt đầu bằng /api/customers sẽ được đưa vào customerRoutes xử lý
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/predict', predictRoutes);
app.use('/api/client', clientAuthRoutes); // Gắn endpoint cho khách
app.listen(PORT, () => {
    console.log(`🚀 Server Node.js đang chạy tại http://localhost:${PORT}`);
});