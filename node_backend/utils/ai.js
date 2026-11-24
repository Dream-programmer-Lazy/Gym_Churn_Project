/**
 * TIỆN ÍCH DÙNG CHUNG CHO CÁC ROUTE GỌI AI (Flask)
 * ------------------------------------------------
 * Chỉ còn 1 mô hình: Logistic Regression cân bằng, 7 cột (flask_ai/train_model.py).
 *
 * - FEATURES / pickFeatures : lấy đúng 7 cột của mô hình, KHÔNG tự điền giá trị mặc định
 * - callFlask               : gọi Flask, chuyển lỗi của Flask thành lỗi có mã HTTP rõ ràng
 * - predictOne / predictBatch : dự báo 1 hội viên / nhiều hội viên (chia lô 1.000 dòng)
 * - toPredictionDoc         : chuẩn hóa kết quả Flask để lưu vào MongoDB
 * - parseCsv                : đọc CSV (dấu , hoặc ; — Excel tiếng Việt hay dùng ;), có ngoặc kép, BOM.
 *                             Chỉ BẮT BUỘC 7 cột; cột thừa (13 cột cũ, fullName, ...) tự bỏ qua.
 * - sendError               : trả lỗi về frontend với đúng mã + thông điệp
 */
const axios = require('axios');

const FLASK_URL = (process.env.FLASK_URL || 'http://127.0.0.1:5000').replace(/\/+$/, '');
const REGIONS = ['vn', 'global'];
const DEFAULT_REGION = 'vn';
const LANGS = ['vi', 'en'];
const MODEL_TYPE = 'logistic';

// 7 cột của mô hình — trùng thứ tự với flask_ai/train_model.py
const FEATURES = [
    'Lifetime',
    'Avg_class_frequency_current_month',
    'Avg_class_frequency_total',
    'Age',
    'Avg_additional_charges_total',
    'Month_to_end_contract',
    'Contract_period',
];

// Gói tập hợp lệ theo thị trường (giống dữ liệu huấn luyện)
const PLANS = { vn: [1, 3, 6, 12], global: [1, 6, 12] };

class AiError extends Error {
    constructor(status, message, details) {
        super(message);
        this.status = status;
        this.details = details;
    }
}

const normalizeRegion = (value) => {
    const r = String(value || DEFAULT_REGION).trim().toLowerCase();
    if (!REGIONS.includes(r)) throw new AiError(400, `Thị trường không hợp lệ: "${value}". Chỉ chấp nhận: vn, global.`);
    return r;
};

/** Ngôn ngữ của câu lý do / lời khuyên / lỗi. Bỏ trống -> Flask tự chọn theo thị trường (vn: vi, global: en). */
const normalizeLang = (value) => {
    const l = String(value || '').trim().toLowerCase();
    return LANGS.includes(l) ? l : undefined;
};

/**
 * Chuyển 1 giá trị về số. Ô trống -> undefined (để Flask báo "Thiếu ...").
 * Chấp nhận "2,5" (dấu phẩy thập phân kiểu Việt Nam) -> 2.5.
 * KHÔNG dùng `Number(x) || mặc định` vì sẽ biến số 0 hợp lệ thành giá trị mặc định.
 */
const toNumberOrUndefined = (value) => {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    const s = String(value).trim();
    if (s === '') return undefined;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : s; // giữ chuỗi sai để Flask báo đúng lỗi "phải là số"
};

/** Lấy đúng 7 cột từ một object bất kỳ (req.body, document Mongo, 1 dòng CSV). */
const pickFeatures = (source = {}) => {
    const out = {};
    FEATURES.forEach((f) => { out[f] = toNumberOrUndefined(source[f]); });
    return out;
};

/** Gọi Flask. Lỗi kết nối -> 503; lỗi dữ liệu (422) / tham số (400) -> giữ nguyên mã & thông điệp. */
const callFlask = async (method, path, data, params) => {
    try {
        const res = await axios({ method, url: `${FLASK_URL}${path}`, data, params, timeout: 60000 });
        return res.data;
    } catch (err) {
        if (err.response) {
            const body = err.response.data || {};
            throw new AiError(err.response.status, body.error || 'AI server trả về lỗi.', body.errors);
        }
        throw new AiError(503, 'Không kết nối được AI server (Flask, cổng 5000). Hãy kiểm tra app.py đã chạy chưa.');
    }
};

/** Dự báo 1 hội viên. features: object 7 cột (dùng pickFeatures). */
const predictOne = (features, region, lang) =>
    callFlask('post', '/predict', { ...features, region, lang });

/** Gọi /predict-batch theo từng lô để không gửi một request quá lớn. Kết quả giữ đúng thứ tự đầu vào. */
const predictBatch = async (featureRows, region, lang, chunkSize = 1000) => {
    const results = [];
    for (let start = 0; start < featureRows.length; start += chunkSize) {
        const chunk = featureRows.slice(start, start + chunkSize);
        const data = await callFlask('post', '/predict-batch', { region, lang, rows: chunk });
        results.push(...data.results);
    }
    return results;
};

/** Dữ liệu lưu vào Mongo: giữ 3 trường cũ + thông tin thêm (thị trường, lý do, cảnh báo). */
const toPredictionDoc = (result) => ({
    probability_percent: result.probability_percent,
    risk_level: result.risk_level,
    model_used: result.model_used,
    model_type: result.model_type || MODEL_TYPE,
    region: result.region,
    model_version: result.model_version,
    reasons: (result.reasons || []).map((r) => r.text),
    warnings: (result.warnings || []).map((w) => w.message),
    last_predicted_at: new Date(),
});

/* ----------------------------- ĐỌC CSV ----------------------------- */
const detectDelimiter = (headerLine) => {
    const commas = (headerLine.match(/,/g) || []).length;
    const semis = (headerLine.match(/;/g) || []).length;
    return semis > commas ? ';' : ',';
};

/** Tách 1 dòng CSV, hỗ trợ ô có ngoặc kép: "Nguyễn Văn A, Q1" */
const splitCsvLine = (line, delimiter) => {
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else cur += ch;
        } else if (ch === '"') inQuotes = true;
        else if (ch === delimiter) { cells.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
};

// Ký tự BOM do Excel thêm ở đầu file CSV UTF-8. Viết bằng mã số, KHÔNG dán ký tự vô hình vào code.
const BOM = String.fromCharCode(0xfeff);

/**
 * Trả về { headers, rows: [{ __line, ...cột }], missingColumns, delimiter }
 * __line = số dòng thật trong file (dòng tiêu đề là dòng 1) để báo lỗi cho người dùng.
 * missingColumns: chỉ tính trong 7 cột bắt buộc.
 */
const parseCsv = (buffer) => {
    let text = buffer.toString('utf8');
    if (text.startsWith(BOM)) text = text.slice(1);
    const lines = text.split(/\r?\n/);
    const headerIndex = lines.findIndex((l) => l.trim() !== '');
    if (headerIndex === -1) throw new AiError(400, 'File CSV trống.');

    const delimiter = detectDelimiter(lines[headerIndex]);
    const headers = splitCsvLine(lines[headerIndex], delimiter).map((h) => h.replace(/^"|"$/g, '').trim());
    const missingColumns = FEATURES.filter((f) => !headers.includes(f));

    const rows = [];
    for (let i = headerIndex + 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        const cells = splitCsvLine(lines[i], delimiter);
        const row = { __line: i + 1 };
        headers.forEach((h, idx) => { row[h] = cells[idx] !== undefined ? cells[idx] : ''; });
        rows.push(row);
    }
    if (rows.length === 0) throw new AiError(400, 'File CSV chỉ có dòng tiêu đề, chưa có dữ liệu.');
    return { headers, rows, missingColumns, delimiter };
};

const sendError = (res, err, fallbackMessage) => {
    if (err instanceof AiError) {
        return res.status(err.status).json({ error: err.message, errors: err.details });
    }
    console.error(`❌ ${fallbackMessage}:`, err.message);
    return res.status(500).json({ error: fallbackMessage });
};

module.exports = {
    FEATURES, REGIONS, DEFAULT_REGION, PLANS, MODEL_TYPE, AiError,
    normalizeRegion, normalizeLang, pickFeatures, toNumberOrUndefined,
    callFlask, predictOne, predictBatch, toPredictionDoc, parseCsv, sendError,
};