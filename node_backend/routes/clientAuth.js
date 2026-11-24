/**
 * CỔNG HỘI VIÊN (KHÁCH HÀNG)
 * --------------------------
 * POST /api/client/register        -> công khai: hội viên tự đăng ký (trạng thái "Chờ duyệt")
 * POST /api/client/login           -> công khai: đăng nhập, trả token role = Customer
 * GET  /api/client/me              -> hội viên: xem hồ sơ CỦA CHÍNH MÌNH + ưu đãi gia hạn còn hạn (nếu có)
 * PUT  /api/client/me              -> hội viên: sửa họ tên, số điện thoại của chính mình
 * POST /api/client/me/change-plan  -> hội viên: gửi yêu cầu đổi gói (chờ Admin duyệt lại)
 *
 * Hội viên KHÔNG được gọi /api/customers (danh sách toàn bộ hội viên) — server.js đã chặn.
 *
 * KHÔNG trả kết quả dự báo rủi ro (prediction) cho hội viên: % "khả năng bỏ tập" là thông tin nội bộ
 * để phòng tập chăm sóc khách, nói thẳng với khách dễ gây phản cảm. Chỉ Admin/Staff xem được.
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Customer = require('../models/Customer');
const Offer = require('../models/Offer');
const { verifyToken, requireCustomer, signToken } = require('../middleware/auth');

const CUSTOMER_TOKEN_TTL = '7d';
// Gói tập hợp lệ theo thị trường (khớp với dữ liệu huấn luyện của từng mô hình)
const PLANS = { vn: [1, 3, 6, 12], global: [1, 6, 12] };
// Hội viên chỉ được tự sửa các trường này (không được tự sửa số liệu dùng cho AI)
const SELF_EDITABLE = ['fullName', 'actualPhoneNumber'];
// Không bao giờ trả mật khẩu; kết quả dự báo + lịch sử chỉ dành cho Admin/Staff
const PUBLIC_SELECT = '-password -predictionHistory -prediction';
const toPublic = (doc) => {
    const plain = doc.toObject ? doc.toObject() : { ...doc };
    delete plain.password;
    delete plain.predictionHistory;
    delete plain.prediction;
    return plain;
};

/**
 * Ưu đãi gia hạn của hội viên (trang Ưu đãi gửi qua cổng hội viên).
 * - offer: ưu đãi MỚI NHẤT còn hạn -> hiện thành thẻ ưu đãi riêng (mã, giá, hạn dùng).
 * - Trang Ưu đãi cũng ghi nội dung ưu đãi vào admin_message; nếu admin_message chính là nội dung ưu đãi
 *   thì không trả lại nữa (tránh hiện 2 lần, và không hiện ưu đãi đã hết hạn như một "thông báo").
 */
// Chỉ các trường của ưu đãi mà hội viên được xem (KHÔNG có mức rủi ro / % lúc gửi)
const OFFER_FIELDS = ['code', 'discount_percent', 'discount_amount', 'plan_price', 'final_price', 'currency',
    'Contract_period', 'valid_days', 'expires_at', 'createdAt'];

const withOffer = async (me) => {
    const plain = toPublic(me);
    const latest = await Offer.findOne({ customer: plain._id, status: 'sent' })
        .sort({ createdAt: -1 })
        .select([...OFFER_FIELDS, 'message'].join(' '))
        .lean();
    if (latest && plain.admin_message && plain.admin_message === latest.message) delete plain.admin_message;
    const active = latest && latest.expires_at && new Date(latest.expires_at) > new Date();
    plain.offer = active ? Object.fromEntries(OFFER_FIELDS.map((f) => [f, latest[f]])) : null;
    return plain;
};

const toInt = (v) => {
    const n = Number(v);
    return Number.isInteger(n) ? n : NaN;
};

// 1. KHÁCH HÀNG TỰ ĐĂNG KÝ MUA GÓI TẬP
router.post('/register', async (req, res) => {
    try {
        const { username, password, fullName, actualPhoneNumber, Age, Contract_period, expectedStartDate } = req.body || {};

        if (!username || !String(username).trim() || !password || !fullName || !String(fullName).trim()) {
            return res.status(400).json({ error: 'Vui lòng nhập đủ tên đăng nhập, mật khẩu và họ tên.' });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ error: 'Mật khẩu cần ít nhất 6 ký tự.' });
        }
        const age = toInt(Age);
        if (Number.isNaN(age) || age < 14 || age > 90) {
            return res.status(400).json({ error: 'Tuổi phải là số nguyên từ 14 đến 90.' });
        }
        const plan = toInt(Contract_period);
        if (!PLANS.vn.includes(plan)) {
            return res.status(400).json({ error: `Gói tập không hợp lệ. Chỉ có gói ${PLANS.vn.join(', ')} tháng.` });
        }

        // Kiểm tra username trùng
        const existingCustomer = await Customer.findOne({ username: String(username).trim() });
        if (existingCustomer) {
            return res.status(400).json({ error: 'Tên đăng nhập đã được sử dụng!' });
        }

        // Băm mật khẩu của khách
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(String(password), salt);

        // Tạo hồ sơ khách hàng mới (Trạng thái mặc định là "Chờ duyệt")
        // Các chỉ số ML như tần suất tập, chi phí bổ sung sẽ khởi tạo = 0
        const newCustomer = new Customer({
            username: String(username).trim(),
            password: hashedPassword,
            fullName: String(fullName).trim(),
            actualPhoneNumber,
            Age: age,
            Contract_period: plan,
            Month_to_end_contract: plan, // Mới đăng ký nên số tháng còn lại = số tháng hợp đồng
            expectedStartDate,
            status: 'Chờ duyệt',
        });

        await newCustomer.save();
        res.status(201).json({ message: 'Đăng ký thành công! Vui lòng chờ nhân viên duyệt.' });
    } catch (error) {
        console.error('Lỗi đăng ký khách hàng:', error);
        res.status(500).json({ error: 'Lỗi hệ thống khi đăng ký.' });
    }
});

// 2. KHÁCH HÀNG ĐĂNG NHẬP
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
        }

        const customer = await Customer.findOne({ username: String(username).trim() });
        // Hội viên do Admin nhập (không có mật khẩu) thì không đăng nhập được
        if (!customer || !customer.password) {
            return res.status(400).json({ error: 'Tài khoản không tồn tại!' });
        }

        const isMatch = await bcrypt.compare(String(password), customer.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Sai mật khẩu!' });
        }

        // Tạo Token chứa role là Customer
        const token = signToken({ id: customer._id, role: 'Customer', fullName: customer.fullName }, CUSTOMER_TOKEN_TTL);

        res.status(200).json({
            message: 'Đăng nhập thành công!',
            token,
            user: {
                id: customer._id,
                username: customer.username,
                fullName: customer.fullName,
                role: 'Customer',
                status: customer.status,
            },
        });
    } catch (error) {
        console.error('Lỗi đăng nhập khách hàng:', error);
        res.status(500).json({ error: 'Lỗi hệ thống khi đăng nhập.' });
    }
});

// 3. XEM HỒ SƠ CỦA CHÍNH MÌNH (id lấy từ token, không lấy từ URL -> không xem được người khác)
router.get('/me', verifyToken, requireCustomer, async (req, res) => {
    try {
        const me = await Customer.findById(req.user.id).select(PUBLIC_SELECT);
        if (!me) return res.status(404).json({ error: 'Không tìm thấy hồ sơ hội viên.' });
        res.status(200).json(await withOffer(me));
    } catch (error) {
        console.error('Lỗi tải hồ sơ hội viên:', error);
        res.status(500).json({ error: 'Lỗi hệ thống khi tải hồ sơ.' });
    }
});

// 4. SỬA HỌ TÊN / SỐ ĐIỆN THOẠI CỦA CHÍNH MÌNH
router.put('/me', verifyToken, requireCustomer, async (req, res) => {
    try {
        const body = req.body || {};
        const $set = {};
        SELF_EDITABLE.forEach((f) => {
            if (body[f] !== undefined) $set[f] = String(body[f]).trim();
        });
        if ($set.fullName === '') return res.status(400).json({ error: 'Họ và tên không được để trống.' });
        if (!Object.keys($set).length) return res.status(400).json({ error: 'Không có thông tin nào để cập nhật.' });

        const me = await Customer.findByIdAndUpdate(req.user.id, { $set }, { new: true, runValidators: true })
            .select(PUBLIC_SELECT);
        if (!me) return res.status(404).json({ error: 'Không tìm thấy hồ sơ hội viên.' });
        res.status(200).json({ message: 'Đã cập nhật thông tin cá nhân!', customer: await withOffer(me) });
    } catch (error) {
        console.error('Lỗi cập nhật hồ sơ hội viên:', error);
        res.status(500).json({ error: 'Lỗi hệ thống khi cập nhật hồ sơ.' });
    }
});

// 5. YÊU CẦU ĐỔI GÓI TẬP -> chuyển về "Chờ duyệt"; Admin bấm Duyệt thì AI chấm lại điểm
router.post('/me/change-plan', verifyToken, requireCustomer, async (req, res) => {
    try {
        const me = await Customer.findById(req.user.id);
        if (!me) return res.status(404).json({ error: 'Không tìm thấy hồ sơ hội viên.' });

        const months = toInt((req.body || {}).months);
        const allowed = PLANS[me.region] || PLANS.vn;
        if (!allowed.includes(months)) {
            return res.status(400).json({ error: `Gói tập không hợp lệ. Chỉ có gói ${allowed.join(', ')} tháng.` });
        }
        if (months === me.Contract_period) {
            return res.status(400).json({ error: 'Bạn đang dùng gói này rồi.' });
        }

        me.Contract_period = months;
        me.Month_to_end_contract = months; // gói mới -> tính lại từ đầu
        me.status = 'Chờ duyệt';
        await me.save();

        res.status(200).json({
            message: `Đã gửi yêu cầu đổi sang gói ${months} tháng. Vui lòng chờ quản trị duyệt.`,
            customer: await withOffer(me),
        });
    } catch (error) {
        console.error('Lỗi đổi gói tập:', error);
        res.status(500).json({ error: 'Lỗi hệ thống khi gửi yêu cầu đổi gói.' });
    }
});

module.exports = router;