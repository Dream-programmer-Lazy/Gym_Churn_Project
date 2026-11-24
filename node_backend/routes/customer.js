/**
 * QUẢN LÝ HỘI VIÊN (CHỈ ADMIN / STAFF — server.js đã chặn hội viên)
 * ----------------------------------------------------------------
 * GET    /api/customers/metrics?region=vn  -> chỉ số mô hình (tab Metrics)
 * POST   /api/customers                    -> thêm hội viên + dự báo
 * GET    /api/customers?region=vn          -> danh sách 1 thị trường, chỉ các trường màn hình cần (nhẹ)
 *                                             (không gửi region -> cả 2 thị trường, như cũ)
 * GET    /api/customers/pending            -> chuông "Khách chờ duyệt": chỉ người chờ duyệt, vài trường
 * GET    /api/customers/summary            -> trang Tổng quan: MongoDB đếm sẵn theo thị trường + mức rủi ro
 * DELETE /api/customers/:id                -> xóa
 * PUT    /api/customers/:id                -> sửa + dự báo lại (thêm 1 dòng lịch sử)
 * PUT    /api/customers/:id/approve        -> duyệt hội viên tự đăng ký + dự báo
 * POST   /api/customers/upload-csv         -> nhập CSV + dự báo + LƯU NGAY (form-data: file, region, onDuplicate?)
 * POST   /api/customers/bulk               -> "Lưu tất cả" từ trang Dự báo (JSON: region, rows, onDuplicate?)
 * POST   /api/customers/:id/notify         -> gửi lời nhắc (admin_message)
 * GET    /api/customers/care?region=vn     -> "Cần chăm sóc tuần này": top hội viên mức Cao (mục 4.4)
 * POST   /api/customers/rescore            -> "Chấm điểm ngay": chấm lại cả 1 thị trường (cốt lõi mục 4.3)
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
    FEATURES, DEFAULT_REGION, PLANS, AiError, normalizeRegion, pickFeatures,
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
const ACTIVE = 'Đang hoạt động';
const LEVELS = ['Cao', 'Trung bình', 'Thấp'];

/** Điều kiện lọc theo thị trường. Hồ sơ cũ (tạo trước khi có trường region) được coi là 'vn'. */
const regionFilter = (region) => (region === DEFAULT_REGION
    ? { $or: [{ region }, { region: { $exists: false } }] }
    : { region });

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

// --- 2. LẤY DANH SÁCH HỘI VIÊN ---
// Tối ưu tốc độ: lọc theo thị trường ngay trong MongoDB, bỏ các trường màn hình không dùng
// (mật khẩu, lịch sử, lý do/cảnh báo, 6 cột cũ của mô hình 13 cột), dùng .lean() (trả object thường, nhanh hơn).
const LIST_EXCLUDE = [
    '-password', '-predictionHistory', '-prediction.reasons', '-prediction.warnings',
    '-gender', '-Near_Location', '-Partner', '-Promo_friends', '-Phone', '-Group_visits', '-actual_churn', '-__v',
].join(' ');

router.get('/', verifyToken, async (req, res) => {
    try {
        const filter = req.query.region ? regionFilter(normalizeRegion(req.query.region)) : {};
        const customers = await Customer.find(filter)
            .select(LIST_EXCLUDE)
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json(customers);
    } catch (error) {
        sendError(res, error, 'Lỗi khi lấy danh sách hội viên.');
    }
});

// --- 2b. CHUÔNG "KHÁCH CHỜ DUYỆT": chỉ người đang chờ duyệt, vài trường để hiển thị ---
router.get('/pending', verifyToken, async (req, res) => {
    try {
        const pending = await Customer.find({ status: 'Chờ duyệt' })
            .select('fullName actualPhoneNumber Contract_period region createdAt')
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        res.status(200).json(pending);
    } catch (error) {
        sendError(res, error, 'Lỗi khi lấy danh sách chờ duyệt.');
    }
});

// --- 2c. TỔNG QUAN 2 THỊ TRƯỜNG: MongoDB tự đếm, không gửi cả danh sách về trình duyệt ---
// Trả về: { vn: { total, Cao, 'Trung bình', Thấp, pending }, global: { ... } }
// "pending" = Chờ duyệt HOẶC chưa có kết quả dự báo (không gộp vào "An toàn").
router.get('/summary', verifyToken, async (req, res) => {
    try {
        const groups = await Customer.aggregate([
            {
                $group: {
                    _id: {
                        region: { $ifNull: ['$region', DEFAULT_REGION] },   // hồ sơ cũ chưa có region -> 'vn'
                        level: {
                            $cond: [
                                { $or: [
                                    { $eq: ['$status', 'Chờ duyệt'] },
                                    { $not: [{ $in: ['$prediction.risk_level', LEVELS] }] },
                                ] },
                                'pending',
                                '$prediction.risk_level',
                            ],
                        },
                    },
                    count: { $sum: 1 },
                },
            },
        ]);

        const empty = () => ({ total: 0, 'Cao': 0, 'Trung bình': 0, 'Thấp': 0, pending: 0 });
        const result = { vn: empty(), global: empty() };
        groups.forEach(({ _id, count }) => {
            const bucket = result[_id.region] || result[DEFAULT_REGION];
            bucket[_id.level] += count;
            bucket.total += count;
        });
        res.status(200).json(result);
    } catch (error) {
        sendError(res, error, 'Lỗi khi tổng hợp số liệu.');
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
    const existing = await Customer.find(regionFilter(region)).select('_id fullName createdAt').sort({ createdAt: 1 }).lean();
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

/* ===================== CẦN CHĂM SÓC (4.4) + CHẤM ĐIỂM NGAY (4.3) ===================== */
const CARE_DEFAULT_LIMIT = 10;
const CARE_MAX_LIMIT = 50;
const RESCORE_CHUNK = 1000;

/**
 * "Mới lên Cao": lần dự báo TRƯỚC là Thấp/Trung bình, lần GẦN NHẤT là Cao.
 * history: mảng predictionHistory (chỉ cần 2 phần tử cuối).
 */
const isNewlyHigh = (history = []) => {
    if (history.length < 2) return false;
    const prev = history[history.length - 2]?.risk_level;
    const last = history[history.length - 1]?.risk_level;
    return last === 'Cao' && (prev === 'Thấp' || prev === 'Trung bình');
};

// --- 8. CẦN CHĂM SÓC TUẦN NÀY: hội viên mức Cao, % giảm dần (bằng % thì ai còn ít tháng hơn đứng trước) ---
// GET /api/customers/care?region=vn&limit=10
router.get('/care', verifyToken, async (req, res) => {
    try {
        const region = normalizeRegion(req.query.region);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || CARE_DEFAULT_LIMIT, 1), CARE_MAX_LIMIT);

        // Chỉ lấy các trường cần hiển thị + 2 lần dự báo cuối (để biết "Mới lên Cao") -> nhẹ
        const highs = await Customer.find({ ...regionFilter(region), status: ACTIVE, 'prediction.risk_level': 'Cao' })
            .select({
                fullName: 1, actualPhoneNumber: 1, Contract_period: 1, Month_to_end_contract: 1,
                prediction: 1, predictionHistory: { $slice: -2 },
            })
            .lean();

        const sorted = highs.sort((a, b) =>
            (b.prediction?.probability_percent ?? 0) - (a.prediction?.probability_percent ?? 0)
            || (a.Month_to_end_contract ?? 0) - (b.Month_to_end_contract ?? 0));

        const items = sorted.slice(0, limit).map((c) => ({
            _id: c._id,
            fullName: c.fullName,
            actualPhoneNumber: c.actualPhoneNumber,
            Contract_period: c.Contract_period,
            Month_to_end_contract: c.Month_to_end_contract,
            probability_percent: c.prediction?.probability_percent,
            mainReason: (c.prediction?.reasons || [])[0] || '',
            last_predicted_at: c.prediction?.last_predicted_at,
            newlyHigh: isNewlyHigh(c.predictionHistory),
        }));

        res.status(200).json({
            region,
            totalHigh: highs.length,
            newlyHighCount: highs.filter((c) => isNewlyHigh(c.predictionHistory)).length,
            items,
        });
    } catch (error) {
        sendError(res, error, 'Lỗi khi lấy danh sách cần chăm sóc.');
    }
});

// --- 9. CHẤM ĐIỂM NGAY: chấm lại toàn bộ hội viên ĐANG HOẠT ĐỘNG của 1 thị trường từ 7 chỉ số đang lưu ---
// POST /api/customers/rescore   body: { region }
// Mỗi người: cập nhật prediction + thêm 1 dòng predictionHistory. Người "Chờ duyệt" không bị chấm.
router.post('/rescore', verifyToken, async (req, res) => {
    try {
        const region = normalizeRegion((req.body || {}).region);
        const fields = ['_id', 'fullName', 'prediction', ...FEATURES].join(' ');
        const members = await Customer.find({ ...regionFilter(region), status: ACTIVE }).select(fields).lean();
        if (!members.length) {
            return res.status(200).json({ message: `Không có hội viên đang hoạt động nào ở thị trường ${REGION_NAME[region]}.`, total: 0, scored: 0, failed: 0 });
        }

        const results = await predictBatch(members.map(pickFeatures), region, ADMIN_LANG);

        const counts = { 'Cao': 0, 'Trung bình': 0, 'Thấp': 0 };
        const rowErrors = [];
        let newlyHigh = 0;
        const ops = [];
        results.forEach((r, idx) => {
            const c = members[idx];
            if (!r.ok) {
                rowErrors.push({ fullName: c.fullName, message: r.errors.map((e) => e.message).join(' ') });
                return;
            }
            const prediction = toPredictionDoc(r);
            counts[prediction.risk_level] += 1;
            const before = c.prediction?.risk_level;
            if (prediction.risk_level === 'Cao' && (before === 'Thấp' || before === 'Trung bình')) newlyHigh += 1;
            ops.push({ updateOne: { filter: { _id: c._id }, update: { $set: { prediction }, $push: historyPush(prediction) } } });
        });

        for (let i = 0; i < ops.length; i += RESCORE_CHUNK) {
            await Customer.bulkWrite(ops.slice(i, i + RESCORE_CHUNK), { ordered: false });
        }

        const scored = ops.length;
        const message = `Đã chấm lại ${scored} hội viên ${REGION_NAME[region]}: `
            + LEVELS.map((l) => `${counts[l]} ${l}`).join(', ') + '.'
            + (newlyHigh ? ` ${newlyHigh} người vừa chuyển lên Cao.` : '')
            + (rowErrors.length ? ` ${rowErrors.length} hội viên thiếu/sai số liệu nên không chấm được.` : '');
        res.status(200).json({
            message, total: members.length, scored, failed: rowErrors.length,
            counts, newlyHigh, rowErrors: rowErrors.slice(0, 100),
        });
    } catch (error) {
        sendError(res, error, 'Lỗi khi chấm điểm lại.');
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