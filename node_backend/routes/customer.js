const express = require('express');
const router = express.Router();
const multer = require('multer');
const Customer = require('../models/Customer');
const verifyToken = require('../middleware/auth');
const {
    DEFAULT_REGION, AiError, normalizeRegion, normalizeModelType, pickFeatures,
    callFlask, predictOne, predictBatch, toPredictionDoc, parseCsv, sendError,
} = require('../utils/ai');

// CSV đọc thẳng trong RAM (không tạo file tạm trong uploads/), tối đa 5MB
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
// Bọc multer để lỗi upload (file quá lớn, sai tên trường) trả JSON rõ ràng thay vì lỗi 500
const uploadCsv = (req, res, next) => upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File CSV vượt quá 5MB.' });
    return res.status(400).json({ error: `Lỗi tải file: ${err.message}` });
});

const ADMIN_LANG = 'vi'; // giao diện Admin là tiếng Việt -> lý do lưu vào Mongo luôn bằng tiếng Việt
const HISTORY_LIMIT = 50; // giữ tối đa 50 lần dự báo gần nhất cho mỗi hội viên
const historyPush = (prediction) => ({ predictionHistory: { $each: [prediction], $slice: -HISTORY_LIMIT } });

// Các trường Admin được phép sửa (chặn ghi đè _id, prediction, password, ...)
const EDITABLE_FIELDS = ['fullName', 'actualPhoneNumber'];

// --- 0. CHỈ SỐ ĐÁNH GIÁ MÔ HÌNH (theo thị trường, mặc định vn) ---
router.get('/metrics', verifyToken, async (req, res) => {
    try {
        const region = normalizeRegion(req.query.region);
        const data = await callFlask('get', '/metrics', undefined, { region });
        res.status(200).json(data);
    } catch (error) {
        sendError(res, error, 'Lỗi kết nối đến AI Server để lấy metrics.');
    }
});

// --- 1. THÊM HỘI VIÊN MỚI & DỰ BÁO ---
router.post('/', verifyToken, async (req, res) => {
    try {
        const body = req.body || {};
        if (!body.fullName || !String(body.fullName).trim()) throw new AiError(400, 'Vui lòng nhập họ và tên.');

        const region = normalizeRegion(body.region);
        const modelType = normalizeModelType(body.model_type);
        const features = pickFeatures(body);
        console.log(`➡️ Dự báo hội viên mới | thị trường: ${region} | mô hình: ${modelType}`);

        const prediction = toPredictionDoc(await predictOne(features, region, modelType, ADMIN_LANG));
        const newCustomer = new Customer({
            fullName: String(body.fullName).trim(),
            actualPhoneNumber: body.actualPhoneNumber,
            ...features,
            region,
            status: 'Đang hoạt động', // Admin tự thêm -> hội viên đã hoạt động, không cần duyệt
            prediction,
            predictionHistory: [prediction],
        });

        const savedCustomer = await newCustomer.save();
        res.status(201).json({ message: 'Thêm hội viên và dự báo thành công!', customer: savedCustomer });
    } catch (error) {
        sendError(res, error, 'Lỗi server khi thêm hội viên.');
    }
});

// --- 2. LẤY DANH SÁCH HỘI VIÊN (không trả mật khẩu & lịch sử dự báo cho nhẹ) ---
router.get('/', verifyToken, async (req, res) => {
    try {
        const customers = await Customer.find()
            .select('-password -predictionHistory')
            .sort({ createdAt: -1 });
        res.status(200).json(customers);
    } catch (error) {
        sendError(res, error, 'Lỗi khi lấy danh sách hội viên.');
    }
});

// --- 3. XÓA HỘI VIÊN ---
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
        if (!deletedCustomer) return res.status(404).json({ error: 'Không tìm thấy hội viên để xóa.' });
        res.status(200).json({ message: 'Đã xóa hội viên thành công!' });
    } catch (error) {
        sendError(res, error, 'Lỗi server khi xóa hội viên.');
    }
});

// --- 4. CẬP NHẬT & DỰ BÁO LẠI ---
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const existing = await Customer.findById(req.params.id).select('region');
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy hội viên.' });

        const body = req.body || {};
        const region = normalizeRegion(body.region || existing.region || DEFAULT_REGION);
        const modelType = normalizeModelType(body.model_type);
        const features = pickFeatures(body);

        const prediction = toPredictionDoc(await predictOne(features, region, modelType, ADMIN_LANG));

        const $set = { ...features, region, prediction };
        EDITABLE_FIELDS.forEach((f) => { if (body[f] !== undefined) $set[f] = body[f]; });

        const updatedCustomer = await Customer.findByIdAndUpdate(
            req.params.id,
            { $set, $push: historyPush(prediction) },
            { new: true, runValidators: true },
        ).select('-password -predictionHistory');

        res.status(200).json({ message: 'Cập nhật và dự báo lại thành công!', customer: updatedCustomer });
    } catch (error) {
        sendError(res, error, 'Lỗi server khi cập nhật hội viên.');
    }
});

// --- 5. DUYỆT HỘI VIÊN TỰ ĐĂNG KÝ (Admin) ---
router.put('/:id/approve', verifyToken, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) return res.status(404).json({ error: 'Không tìm thấy hội viên!' });
        if (customer.status === 'Đang hoạt động') return res.status(400).json({ error: 'Hội viên này đã được duyệt rồi!' });

        const body = req.body || {};
        const region = normalizeRegion(customer.region || body.region || DEFAULT_REGION);
        const modelType = normalizeModelType(body.model_type);

        const prediction = toPredictionDoc(await predictOne(pickFeatures(customer.toObject()), region, modelType, ADMIN_LANG));

        customer.status = 'Đang hoạt động';
        customer.region = region;
        customer.prediction = prediction;
        if (Array.isArray(customer.predictionHistory)) {
            customer.predictionHistory.push(prediction);
            if (customer.predictionHistory.length > HISTORY_LIMIT) customer.predictionHistory.shift();
        }

        await customer.save();
        const plain = customer.toObject();
        delete plain.password;
        delete plain.predictionHistory;
        res.status(200).json({ message: 'Đã duyệt và đánh giá rủi ro thành công!', customer: plain });
    } catch (error) {
        sendError(res, error, 'Lỗi server khi duyệt hội viên.');
    }
});

// --- 6. NHẬP HỘI VIÊN TỪ CSV & DỰ BÁO HÀNG LOẠT ---
router.post('/upload-csv', verifyToken, uploadCsv, async (req, res) => {
    try {
        if (!req.file) throw new AiError(400, 'Vui lòng chọn một file CSV.');

        const region = normalizeRegion(req.body.region);
        const modelType = normalizeModelType(req.body.model_type);
        const { rows, missingColumns } = parseCsv(req.file.buffer);

        if (missingColumns.length) {
            throw new AiError(400, `File CSV thiếu ${missingColumns.length} cột bắt buộc: ${missingColumns.join(', ')}.`);
        }

        const featureRows = rows.map(pickFeatures);
                const results = await predictBatch(featureRows, region, modelType, ADMIN_LANG);

        const docs = [];
        const rowErrors = [];
        results.forEach((r, idx) => {
            const row = rows[idx];
            if (!r.ok) {
                rowErrors.push({ line: row.__line, message: r.errors.map((e) => e.message).join(' ') });
                return;
            }
            const prediction = toPredictionDoc(r);
            docs.push({
                fullName: (row.fullName || '').trim() || `Hội viên CSV dòng ${row.__line}`,
                actualPhoneNumber: (row.actualPhoneNumber || '').trim() || undefined,
                ...featureRows[idx],
                region,
                status: 'Đang hoạt động',
                prediction,
                predictionHistory: [prediction],
            });
        });

        if (docs.length) await Customer.insertMany(docs, { ordered: false });

        const message = `Đã nhập ${docs.length}/${rows.length} hội viên (thị trường ${region}, mô hình ${modelType}).`
            + (rowErrors.length ? ` ${rowErrors.length} dòng bị lỗi và không được lưu.` : '');
        res.status(docs.length ? 200 : 422).json({
            message,
            ...(docs.length ? {} : { error: 'Không có dòng nào hợp lệ để lưu. Xem chi tiết lỗi từng dòng.' }),
            imported: docs.length,
            failed: rowErrors.length,
            rowErrors: rowErrors.slice(0, 100), // tối đa 100 lỗi đầu tiên
        });
    } catch (error) {
        sendError(res, error, 'Lỗi khi xử lý file CSV.');
    }
});

// --- 7. GỬI LỜI NHẮC ---
router.post('/:id/notify', verifyToken, async (req, res) => {
    try {
        const { message } = req.body || {};
        const customer = await Customer.findByIdAndUpdate(req.params.id, { admin_message: message }, { new: true });
        if (!customer) return res.status(404).json({ error: 'Không tìm thấy hội viên.' });
        res.status(200).json({ message: 'Đã gửi thông báo đến hội viên!' });
    } catch (error) {
        sendError(res, error, 'Lỗi server khi gửi thông báo.');
    }
});

module.exports = router;