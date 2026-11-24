/**
 * QUẢN LÝ HỘI VIÊN (CHỈ ADMIN / STAFF — server.js đã chặn hội viên)
 * ----------------------------------------------------------------
 * GET    /api/customers/metrics?region=vn  -> chỉ số mô hình (tab Metrics)
 * POST   /api/customers                    -> thêm hội viên + dự báo
 * GET    /api/customers                    -> danh sách (không kèm mật khẩu, lịch sử)
 * DELETE /api/customers/:id                -> xóa
 * PUT    /api/customers/:id                -> sửa + dự báo lại (thêm 1 dòng lịch sử)
 * PUT    /api/customers/:id/approve        -> duyệt hội viên tự đăng ký + dự báo
 * POST   /api/customers/upload-csv         -> nhập CSV + dự báo + LƯU NGAY (form-data: file, region, onDuplicate?)
 * POST   /api/customers/bulk               -> "Lưu tất cả" từ trang Dự báo (JSON: region, rows, onDuplicate?)
 * POST   /api/customers/:id/notify         -> gửi lời nhắc (admin_message)
 *
 * LUẬT TRÙNG (dùng chung cho upload-csv và bulk):
 *   "Trùng" = cùng họ tên (không phân biệt hoa/thường, bỏ khoảng trắng thừa) + cùng thị trường.
 *   - Chưa gửi onDuplicate mà có trùng -> trả 409 kèm danh sách tên trùng, CHƯA lưu gì;
 *     frontend hỏi người dùng rồi gửi lại với onDuplicate = 'update' | 'skip'.
 *   - 'update': ghi 7 cột mới + kết quả dự báo mới vào hồ sơ cũ, thêm 1 dòng lịch sử (không tạo người mới).
 *   - 'skip'  : giữ nguyên hồ sơ cũ.
 *   - Dòng lỗi dữ liệu không bao giờ được lưu.
 *   - BẮT BUỘC có họ tên (cột fullName) mới được LƯU. Dòng không có tên báo lỗi, không lưu.
 *     (Trang dự báo dùng thử / mục Dự báo vẫn chấp nhận file không có tên — chỉ là không lưu được.)
 *
 * Chỉ còn 1 mô hình (Logistic Regression cân bằng, 7 cột). Trường "model_type" cũ gửi lên sẽ bị bỏ qua.
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const Customer = require('../models/Customer');
const verifyToken = require('../middleware/auth');
const {
    DEFAULT_REGION, PLANS, AiError, normalizeRegion, pickFeatures,
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
const REGION_NAME = { vn: 'Việt Nam', global: 'Quốc tế' };

// Các trường thông tin cá nhân Admin được phép sửa (chặn ghi đè _id, prediction, password, ...)
const EDITABLE_FIELDS = ['fullName', 'actualPhoneNumber'];

/** Gói tập phải đúng với thị trường (VN: 1/3/6/12, Quốc tế: 1/6/12). Ô trống để Flask báo "Thiếu ...". */
const checkPlan = (features, region) => {
    const plan = features.Contract_period;
    if (plan === undefined || typeof plan !== 'number') return;
    if (!PLANS[region].includes(plan)) {
        throw new AiError(400, `Gói ${plan} tháng không có ở thị trường ${REGION_NAME[region]}. Chỉ có gói ${PLANS[region].join(', ')} tháng.`,
            [{ field: 'Contract_period', message: `Chỉ có gói ${PLANS[region].join(', ')} tháng.` }]);
    }
};

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
        const features = pickFeatures(body);
        checkPlan(features, region);
        console.log(`➡️ Dự báo hội viên mới | thị trường: ${region}`);

        const prediction = toPredictionDoc(await predictOne(features, region, ADMIN_LANG));
        const newCustomer = new Customer({
            fullName: String(body.fullName).trim(),
            actualPhoneNumber: body.actualPhoneNumber ? String(body.actualPhoneNumber).trim() : undefined,
            ...features,
            region,
            status: 'Đang hoạt động', // Admin tự thêm -> hội viên đã hoạt động, không cần duyệt
            prediction,
            predictionHistory: [prediction],
        });

        const saved = (await newCustomer.save()).toObject();
        delete saved.password;
        delete saved.predictionHistory;
        res.status(201).json({ message: 'Thêm hội viên và dự báo thành công!', customer: saved });
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

// --- 4. CẬP NHẬT & DỰ BÁO LẠI (lịch sử có thêm 1 dòng, không ghi đè) ---
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const existing = await Customer.findById(req.params.id).select('region');
        if (!existing) return res.status(404).json({ error: 'Không tìm thấy hội viên.' });

        const body = req.body || {};
        const region = normalizeRegion(body.region || existing.region || DEFAULT_REGION);
        const features = pickFeatures(body);
        checkPlan(features, region);

        const prediction = toPredictionDoc(await predictOne(features, region, ADMIN_LANG));

        const $set = { ...features, region, prediction };
        EDITABLE_FIELDS.forEach((f) => { if (body[f] !== undefined) $set[f] = String(body[f]).trim(); });
        if ($set.fullName === '') throw new AiError(400, 'Họ và tên không được để trống.');

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

        const prediction = toPredictionDoc(await predictOne(pickFeatures(customer.toObject()), region, ADMIN_LANG));

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

/* ===================== LƯU HÀNG LOẠT + LUẬT TRÙNG ===================== */
const MAX_SAVE_ROWS = 5000;
const DUPLICATE_MODES = ['update', 'skip'];
const NEED_NAME_MSG = 'File cần có cột fullName (họ tên hội viên) để lưu vào hệ thống.';

/** "  Nguyễn  Văn An " -> "nguyễn văn an" (NFC: gộp dấu tiếng Việt gõ kiểu tổ hợp từ Excel/Mac) */
const nameKey = (name) => String(name || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeDuplicateMode = (value) => {
    if (value === undefined || value === null || value === '') return undefined;
    const v = String(value).trim().toLowerCase();
    if (!DUPLICATE_MODES.includes(v)) throw new AiError(400, 'onDuplicate chỉ nhận "update" hoặc "skip".');
    return v;
};

/** Map tên (đã chuẩn hóa) -> hồ sơ mới nhất có tên đó, trong cùng thị trường */
const findExistingByName = async (region) => {
    // Hồ sơ cũ (tạo trước khi có trường region) được coi là thị trường mặc định 'vn'
    const filter = region === DEFAULT_REGION ? { $or: [{ region }, { region: { $exists: false } }] } : { region };
    const existing = await Customer.find(filter).select('_id fullName createdAt').sort({ createdAt: 1 }).lean();
    const map = new Map();
    existing.forEach((c) => map.set(nameKey(c.fullName), c)); // sắp tăng dần -> giữ bản mới nhất
    return map;
};

/**
 * Lưu nhiều hội viên của 1 thị trường.
 * items: [{ line, fullName, actualPhoneNumber, source }]  (source = object chứa 7 cột, dạng bất kỳ)
 * Trả về { needsDecision, duplicates } nếu có trùng mà chưa chọn cách xử lý; ngược lại trả kết quả lưu.
 */
const saveMany = async (region, items, onDuplicate) => {
    const existingMap = await findExistingByName(region);

    // 1) Phát hiện trùng TRƯỚC khi gọi AI (chưa lưu gì)
    const seenInFile = new Set();
    const duplicateNames = [];
    items.forEach((it) => {
        const key = nameKey(it.fullName);
        if (!key) return; // dòng không có tên -> sẽ báo lỗi ở bước 3, không xét trùng
        if (existingMap.has(key) || seenInFile.has(key)) duplicateNames.push(String(it.fullName).trim());
        seenInFile.add(key);
    });
    const uniqueDuplicates = [...new Set(duplicateNames)];
    if (uniqueDuplicates.length && !onDuplicate) {
        return { needsDecision: true, duplicateCount: duplicateNames.length, duplicates: uniqueDuplicates.slice(0, 50) };
    }

    // 2) Chấm điểm bằng AI (lý do lưu bằng tiếng Việt)
    const featureRows = items.map((it) => pickFeatures(it.source));
    const results = await predictBatch(featureRows, region, ADMIN_LANG);

    // 3) Chia thành: tạo mới / cập nhật / bỏ qua / lỗi
    const rowErrors = [];
    const newDocs = new Map();     // key -> doc (dòng sau cùng tên trong file: update thì thay, skip thì bỏ)
    const updates = new Map();     // _id -> { $set, prediction }
    let skipped = 0;
    let updatedRows = 0;           // số dòng đi theo nhánh "cập nhật" (kể cả dòng trùng tên ngay trong file)

    results.forEach((r, idx) => {
        const it = items[idx];
        if (!r.ok) {
            rowErrors.push({ line: it.line, fullName: it.fullName || '', message: r.errors.map((e) => e.message).join(' ') });
            return;
        }
        const features = featureRows[idx];
        if (!PLANS[region].includes(features.Contract_period)) {
            rowErrors.push({ line: it.line, fullName: it.fullName || '', message: `Gói ${features.Contract_period} tháng không có ở thị trường ${REGION_NAME[region]}.` });
            return;
        }
        const prediction = toPredictionDoc(r);
        const fullName = String(it.fullName || '').trim();
        const phone = String(it.actualPhoneNumber || '').trim() || undefined;
        const key = nameKey(fullName);

        if (!key) {
            rowErrors.push({ line: it.line, fullName: '', message: 'Thiếu họ tên (cột fullName), không lưu được.' });
            return;
        }

        const existing = existingMap.get(key);
        const isDuplicate = existing || newDocs.has(key);
        if (isDuplicate && onDuplicate === 'skip') { skipped += 1; return; }

        if (existing) {
            const $set = { ...features, prediction };
            if (phone) $set.actualPhoneNumber = phone;
            updates.set(String(existing._id), { $set, prediction });   // trùng nhiều dòng -> dòng sau cùng thắng
            updatedRows += 1;
            return;
        }
        if (isDuplicate) updatedRows += 1;                            // trùng với dòng phía trên trong file -> dòng sau thay dòng trước
        newDocs.set(key, {
            fullName, actualPhoneNumber: phone, ...features, region,
            status: 'Đang hoạt động', prediction, predictionHistory: [prediction],
        });
    });

    // 4) Ghi vào MongoDB
    const toInsert = [...newDocs.values()];
    if (toInsert.length) await Customer.insertMany(toInsert, { ordered: false });
    if (updates.size) {
        await Customer.bulkWrite([...updates.entries()].map(([id, u]) => ({
            updateOne: { filter: { _id: id }, update: { $set: u.$set, $push: historyPush(u.prediction) } },
        })));
    }

    return {
        needsDecision: false,
        total: items.length,
        created: toInsert.length,
        updated: updatedRows,
        skipped,
        failed: rowErrors.length,
        rowErrors,
    };
};

/** Gửi kết quả lưu hàng loạt về frontend (409 = cần người dùng chọn Cập nhật / Bỏ qua) */
const sendSaveResult = (res, region, result) => {
    if (result.needsDecision) {
        return res.status(409).json({
            needsDecision: true,
            error: `${result.duplicateCount} dòng trùng tên với hội viên đã có (thị trường ${REGION_NAME[region]}). Chọn Cập nhật hoặc Bỏ qua.`,
            duplicateCount: result.duplicateCount,
            duplicates: result.duplicates,
        });
    }
    const parts = [];
    if (result.created || (!result.updated && !result.skipped)) parts.push(`thêm ${result.created} hội viên mới`);
    if (result.updated) parts.push(`cập nhật ${result.updated} dòng trùng tên`);
    if (result.skipped) parts.push(`bỏ qua ${result.skipped} dòng trùng tên`);
    if (result.failed) parts.push(`${result.failed} dòng lỗi không được lưu`);
    const saved = result.created + result.updated;
    return res.status(saved || result.skipped ? 200 : 422).json({
        message: `Đã ${parts.join(', ')} (thị trường ${REGION_NAME[region]}).`,
        ...(saved || result.skipped ? {} : { error: 'Không có dòng nào hợp lệ để lưu. Xem chi tiết lỗi từng dòng.' }),
        imported: saved,               // giữ tên trường cũ
        created: result.created,
        updated: result.updated,
        skipped: result.skipped,
        failed: result.failed,
        rowErrors: result.rowErrors.slice(0, 100), // tối đa 100 lỗi đầu tiên
    });
};

// --- 6. NHẬP HỘI VIÊN TỪ CSV & LƯU NGAY (nút "Tải lên CSV" ở trang Hội viên VN / Quốc tế) ---
router.post('/upload-csv', verifyToken, uploadCsv, async (req, res) => {
    try {
        if (!req.file) throw new AiError(400, 'Vui lòng chọn một file CSV.');

        const region = normalizeRegion(req.body.region);
        const onDuplicate = normalizeDuplicateMode(req.body.onDuplicate);
        const { headers, rows, missingColumns } = parseCsv(req.file.buffer);

        if (missingColumns.length) {
            throw new AiError(400, `File CSV thiếu ${missingColumns.length} cột bắt buộc: ${missingColumns.join(', ')}.`);
        }
        if (rows.length > MAX_SAVE_ROWS) throw new AiError(413, `Tối đa ${MAX_SAVE_ROWS} dòng mỗi lần (file có ${rows.length} dòng).`);
        if (!headers.includes('fullName')) throw new AiError(400, NEED_NAME_MSG);

        const items = rows.map((row) => ({
            line: row.__line, fullName: row.fullName, actualPhoneNumber: row.actualPhoneNumber, source: row,
        }));
        sendSaveResult(res, region, await saveMany(region, items, onDuplicate));
    } catch (error) {
        sendError(res, error, 'Lỗi khi xử lý file CSV.');
    }
});

// --- 6b. "LƯU TẤT CẢ" TỪ TRANG DỰ BÁO (đã xem kết quả trước, giờ mới lưu) ---
// Body: { region, onDuplicate?, rows: [{ line, fullName, actualPhoneNumber, input: {7 cột} }] }
router.post('/bulk', verifyToken, async (req, res) => {
    try {
        const body = req.body || {};
        const region = normalizeRegion(body.region);
        const onDuplicate = normalizeDuplicateMode(body.onDuplicate);
        if (!Array.isArray(body.rows) || !body.rows.length) throw new AiError(400, 'Không có dòng nào để lưu.');
        if (body.rows.length > MAX_SAVE_ROWS) throw new AiError(413, `Tối đa ${MAX_SAVE_ROWS} dòng mỗi lần.`);
        if (!body.rows.some((r) => nameKey(r?.fullName))) throw new AiError(400, NEED_NAME_MSG);

        const items = body.rows.map((r, idx) => ({
            line: r?.line ?? idx + 2,
            fullName: r?.fullName,
            actualPhoneNumber: r?.actualPhoneNumber,
            source: r?.input || r || {},
        }));
        sendSaveResult(res, region, await saveMany(region, items, onDuplicate));
    } catch (error) {
        sendError(res, error, 'Lỗi khi lưu danh sách hội viên.');
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