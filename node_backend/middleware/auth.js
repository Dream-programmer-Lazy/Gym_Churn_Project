const jwt = require('jsonwebtoken');

// Chuỗi bí mật phải khớp với chuỗi lúc tạo token ở routes/auth.js
const JWT_SECRET = 'gym_churn_secret_key_2026'; 

const verifyToken = (req, res, next) => {
    // Lấy token từ header Authorization của request
    const authHeader = req.headers['authorization'];
    
    // Nếu không có header hoặc không bắt đầu bằng 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Truy cập bị từ chối! Vui lòng đăng nhập.' });
    }

    const token = authHeader.split(' ')[1]; // Cắt lấy phần mã token phía sau chữ Bearer

    try {
        // Giải mã token
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified; // Lưu thông tin user (id, role) vào req để các API sau sử dụng
        next(); // Cho phép đi tiếp vào API
    } catch (err) {
        res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
};

module.exports = verifyToken;