const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    // --- TÀI KHOẢN ĐĂNG NHẬP CHO KHÁCH HÀNG ---
    username: { type: String, unique: true, sparse: true }, 
    password: { type: String }, 
    status: { 
        type: String, 
        enum: ['Chờ duyệt', 'Đang hoạt động', 'Hết hạn'],
        default: 'Chờ duyệt' 
    },
    expectedStartDate: { type: Date }, 

    // --- THÔNG TIN ĐỊNH DANH CƠ BẢN ---
    fullName: { type: String, required: true },
    actualPhoneNumber: { type: String }, 
    
    // --- 13 THUỘC TÍNH PHỤC VỤ MACHINE LEARNING ---
    gender: { type: Number, enum: [0, 1], default: 1 }, 
    Near_Location: { type: Number, enum: [0, 1], default: 1 },
    Partner: { type: Number, enum: [0, 1], default: 0 },
    Promo_friends: { type: Number, enum: [0, 1], default: 0 },
    Phone: { type: Number, enum: [0, 1], default: 1 }, 
    Contract_period: { type: Number, required: true }, 
    Group_visits: { type: Number, enum: [0, 1], default: 0 },
    Age: { type: Number, required: true },
    Avg_additional_charges_total: { type: Number, default: 0 },
    Month_to_end_contract: { type: Number, default: 0 },
    Lifetime: { type: Number, default: 0 }, 
    Avg_class_frequency_total: { type: Number, default: 0 },
    Avg_class_frequency_current_month: { type: Number, default: 0 },

    // --- KẾT QUẢ DỰ BÁO TỪ FLASK AI ---
    prediction: {
        probability_percent: { type: Number, default: 0 }, 
        risk_level: { 
            type: String, 
            enum: ['Thấp', 'Trung bình', 'Cao', 'Chưa dự báo'],
            default: 'Chưa dự báo'
        },
        model_used: { type: String, default: 'Chưa xác định' },
        last_predicted_at: { type: Date } 
    },

    actual_churn: { type: Number, enum: [0, 1], default: 0 },
    admin_message: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);