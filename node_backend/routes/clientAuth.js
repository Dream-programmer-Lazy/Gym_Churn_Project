const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

const JWT_SECRET = 'gym_churn_secret_key_2026'; // Dùng chung secret key với Admin

// 1. KHÁCH HÀNG TỰ ĐĂNG KÝ MUA GÓI TẬP
router.post('/register', async (req, res) => {
    try {
        const { username, password, fullName, actualPhoneNumber, Age, Contract_period, expectedStartDate } = req.body;

        // Kiểm tra username trùng
        const existingCustomer = await Customer.findOne({ username });
        if (existingCustomer) {
            return res.status(400).json({ error: "Tên đăng nhập đã được sử dụng!" });
        }

        // Băm mật khẩu của khách
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Tạo hồ sơ khách hàng mới (Trạng thái mặc định là "Chờ duyệt")
        // Các chỉ số ML như tần suất tập, chi phí bổ sung sẽ khởi tạo = 0
        const newCustomer = new Customer({
            username,
            password: hashedPassword,
            fullName,
            actualPhoneNumber,
            Age,
            Contract_period,
            Month_to_end_contract: Contract_period, // Mới đăng ký nên số tháng còn lại = số tháng hợp đồng
            expectedStartDate,
            status: 'Chờ duyệt'
        });

        await newCustomer.save();
        res.status(201).json({ message: "Đăng ký thành công! Vui lòng chờ nhân viên duyệt." });

    } catch (error) {
        console.error("Lỗi đăng ký khách hàng:", error);
        res.status(500).json({ error: "Lỗi hệ thống khi đăng ký." });
    }
});

// 2. KHÁCH HÀNG ĐĂNG NHẬP
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const customer = await Customer.findOne({ username });
        if (!customer) {
            return res.status(400).json({ error: "Tài khoản không tồn tại!" });
        }

        const isMatch = await bcrypt.compare(password, customer.password);
        if (!isMatch) {
            return res.status(400).json({ error: "Sai mật khẩu!" });
        }

        // Tạo Token chứa role là Customer
        const token = jwt.sign(
            { id: customer._id, role: 'Customer', fullName: customer.fullName }, 
            JWT_SECRET, 
            { expiresIn: '7d' }
        );

        res.status(200).json({
            message: "Đăng nhập thành công!",
            token,
            user: {
                id: customer._id,
                username: customer.username,
                fullName: customer.fullName,
                role: 'Customer',
                status: customer.status
            }
        });

    } catch (error) {
        res.status(500).json({ error: "Lỗi hệ thống khi đăng nhập." });
    }
});

module.exports = router;