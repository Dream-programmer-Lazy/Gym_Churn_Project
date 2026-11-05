require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Import model User

async function seedAdmin() {
    try {
        // 1. Kết nối DB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ Đã kết nối MongoDB Atlas!");

        // 2. Kiểm tra xem admin đã tồn tại chưa
        const existingAdmin = await User.findOne({ username: 'admin' });
        if (existingAdmin) {
            console.log("⚠️ Tài khoản admin đã tồn tại trên hệ thống. Không cần tạo lại.");
            process.exit(0);
        }

        // 3. Mã hóa mật khẩu (Đổi 'Admin@123' thành mật khẩu bạn muốn)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('Admin@123', salt); 

        // 4. Tạo tài khoản
        const adminUser = new User({
            username: 'admin',
            password: hashedPassword,
            fullName: 'Quản trị viên Hệ thống',
            role: 'Admin'
        });

        await adminUser.save();
        console.log("✅ Tạo tài khoản Admin gốc thành công!");
        process.exit(0); // Tắt script sau khi chạy xong

    } catch (error) {
        console.error("❌ Lỗi khởi tạo dữ liệu:", error);
        process.exit(1);
    }
}

// Thực thi hàm
seedAdmin();