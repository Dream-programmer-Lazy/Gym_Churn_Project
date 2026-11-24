const mongoose = require('mongoose');

/**
 * NHẬT KÝ GỬI ƯU ĐÃI GIA HẠN (mục 5.5)
 * Mỗi lần gửi cho 1 hội viên = 1 document. Đây cũng là dữ liệu đầu vào cho giai đoạn 6 (đo hiệu quả) sau này.
 * Kênh gửi hiện tại: cổng hội viên (ghi vào Customer.admin_message). Chưa gửi email thật (chế độ demo).
 */
const offerSchema = new mongoose.Schema({
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    region: { type: String, enum: ['vn', 'global'], required: true },
    fullName: { type: String },                  // chụp lại tên lúc gửi (hội viên bị xóa sau này vẫn đọc được nhật ký)

    // Tình trạng rủi ro LÚC GỬI
    risk_level: { type: String },                // 'Cao'
    probability_percent: { type: Number },

    // Nội dung ưu đãi
    Contract_period: { type: Number },           // gói được gia hạn (tháng)
    currency: { type: String, enum: ['VND', 'USD'] },
    plan_price: { type: Number },                // giá gói tham khảo (VND: đồng, USD: đô)
    discount_percent: { type: Number },          // 5 | 10 | 15
    discount_amount: { type: Number },           // = chi phí ưu đãi của phòng tập
    final_price: { type: Number },
    code: { type: String, required: true, unique: true },
    valid_days: { type: Number },
    expires_at: { type: Date },

    // Gửi
    channel: { type: String, default: 'portal' },   // 'portal' = cổng hội viên (chế độ demo, chưa có email)
    status: { type: String, enum: ['sent', 'failed'], default: 'sent' },
    error: { type: String },
    message: { type: String },                   // nội dung hiện cho hội viên
    batch_id: { type: String, index: true },     // mã đợt gửi (1 lần bấm "Gửi" = 1 đợt)
    sent_by: { type: String },                   // tên người duyệt gửi
}, { timestamps: true });                        // createdAt = ngày gửi

module.exports = mongoose.model('Offer', offerSchema);