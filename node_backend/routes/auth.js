/**
 * ĐĂNG NHẬP / TẠO TÀI KHOẢN CHO ADMIN & NHÂN VIÊN
 * -----------------------------------------------
 * POST /api/auth/login     -> công khai: đăng nhập, trả token + user
 * POST /api/auth/register  -> CHỈ ADMIN đã đăng nhập mới tạo được tài khoản Admin/Staff
 *                             (tài khoản Admin đầu tiên tạo bằng: node seed.js)
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { verifyToken, requireAdmin, signToken, STAFF_ROLES } = require('../middleware/auth');

const STAFF_TOKEN_TTL = '1d'; // Token Admin/Staff sống 1 ngày

// 1. API: TẠO TÀI KHOẢN ADMIN/STAFF (chỉ Admin)
router.post('/register', verifyToken, requireAdmin, async (req, res) => {
    try {
        const { username, password, fullName, role } = req.body || {};

        if (!username || !String(username).trim() || !password || !fullName) {
            return res.status(400).json({ error: 'Vui lòng nhập đủ tên đăng nhập, mật khẩu và họ tên.' });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ error: 'Mật khẩu cần ít nhất 6 ký tự.' });
        }
        const finalRole = role || 'Staff'; // Mặc định là nhân viên nếu không truyền
        if (!STAFF_ROLES.includes(finalRole)) {
            return res.status(400).json({ error: `Vai trò không hợp lệ. Chỉ chấp nhận: ${STAFF_ROLES.join(', ')}.` });
        }

        // Kiểm tra xem tài khoản đã tồn tại chưa
        const existingUser = await User.findOne({ username: String(username).trim() });
        if (existingUser) {
            return res.status(400).json({ error: 'Tên đăng nhập đã tồn tại!' });
        }

        // Mã hóa mật khẩu
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(String(password), salt);

        const newUser = new User({
            username: String(username).trim(),
            password: hashedPassword,
            fullName,
            role: finalRole,
        });

        await newUser.save();
        res.status(201).json({ message: 'Tạo tài khoản thành công!' });
    } catch (error) {
        console.error('Lỗi đăng ký:', error);
        res.status(500).json({ error: 'Lỗi server khi đăng ký.' });
    }
});

// 2. API: ĐĂNG NHẬP
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
        }

        // Tìm user trong Database
        const user = await User.findOne({ username: String(username).trim() });
        if (!user) {
            return res.status(400).json({ error: 'Tài khoản không tồn tại!' });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(String(password), user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Sai mật khẩu!' });
        }

        // Tạo Token chứa thông tin quyền (role)
        const token = signToken({ id: user._id, role: user.role, fullName: user.fullName }, STAFF_TOKEN_TTL);

        res.status(200).json({
            message: 'Đăng nhập thành công!',
            token,
            user: {
                username: user.username,
                fullName: user.fullName,
                role: user.role,
            },
        });
    } catch (error) {
        console.error('Lỗi đăng nhập:', error);
        res.status(500).json({ error: 'Lỗi server khi đăng nhập.' });
    }
});

module.exports = router;