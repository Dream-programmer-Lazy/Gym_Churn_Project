const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Model User bạn đã tạo lúc trước

// Chuỗi bí mật để tạo Token (Trong thực tế nên để vào file .env)
const JWT_SECRET = 'gym_churn_secret_key_2026';

// 1. API: ĐĂNG KÝ TÀI KHOẢN (Dùng để tạo tài khoản Admin/Staff ban đầu)
router.post('/register', async (req, res) => {
    try {
        const { username, password, fullName, role } = req.body;

        // Kiểm tra xem tài khoản đã tồn tại chưa
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Tên đăng nhập đã tồn tại!" });
        }

        // Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Lưu user mới
        const newUser = new User({
            username,
            password: hashedPassword,
            fullName,
            role: role || 'Staff' // Mặc định là nhân viên nếu không truyền
        });

        await newUser.save();
        res.status(201).json({ message: "Tạo tài khoản thành công!" });

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        res.status(500).json({ error: "Lỗi server khi đăng ký." });
    }
});

// 2. API: ĐĂNG NHẬP
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Tìm user trong Database
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ error: "Tài khoản không tồn tại!" });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Sai mật khẩu!" });
        }

        // Tạo Token chứa thông tin quyền (role)
        const token = jwt.sign(
            { id: user._id, role: user.role, fullName: user.fullName }, 
            JWT_SECRET, 
            { expiresIn: '1d' } // Token sống 1 ngày
        );

        res.status(200).json({
            message: "Đăng nhập thành công!",
            token,
            user: {
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });

    } catch (error) {
        console.error("Lỗi đăng nhập:", error);
        res.status(500).json({ error: "Lỗi server khi đăng nhập." });
    }
});

module.exports = router;