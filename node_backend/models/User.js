const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true
    },
    password: { 
        type: String, 
        required: true 
        // Lưu ý: Khi tạo API đăng ký, bạn cần dùng thư viện bcrypt để mã hóa password này
    },
    fullName: {
        type: String,
        required: true
    },
    role: { 
        type: String, 
        enum: ['Admin', 'Staff'], // Phân quyền Quản trị viên hoặc Nhân viên
        default: 'Staff' 
    }
}, { 
    timestamps: true // Tự động sinh ra createdAt và updatedAt
});

module.exports = mongoose.model('User', userSchema);