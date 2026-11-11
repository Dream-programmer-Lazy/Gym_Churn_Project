/**
 * ROUTE CÔNG KHAI CHO LANDING PAGE — CHẾ ĐỘ DÙNG THỬ (KHÔNG LƯU DỮ LIỆU)
 * ---------------------------------------------------------------------
 * GET  /api/predict/model-info?region=vn&lang=vi -> khoảng giá trị, gói tập, đơn vị tiền (dựng form)
 * POST /api/predict                              -> dự báo 1 hội viên  (body: region, model_type, lang, 13 biến)
 * POST /api/predict/csv                          -> dự báo cả file CSV (form-data: file, region, model_type, lang)
 *
 * Không cần đăng nhập. Muốn LƯU vào hệ thống thì frontend gọi POST /api/customers (cần token).
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
    AiError, normalizeRegion, normalizeModelType, normalizeLang, pickFeatures,
    callFlask, predictOne, predictBatch, parseCsv, sendError,
} = require('../utils/ai');

const MAX_PUBLIC_ROWS = 2000; // giới hạn cho chế độ dùng thử công khai

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
const uploadCsv = (req, res, next) => upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const en = normalizeLang(req.query.lang) === 'en';
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: en ? 'The CSV file is larger than 2MB.' : 'File CSV vượt quá 2MB.' });
    return res.status(400).json({ error: `${en ? 'Upload error' : 'Lỗi tải file'}: ${err.message}` });
});

router.get('/model-info', async (req, res) => {
    try {
        const region = normalizeRegion(req.query.region);
        const lang = normalizeLang(req.query.lang);
        res.status(200).json(await callFlask('get', '/model-info', undefined, { region, lang }));
    } catch (error) {
        sendError(res, error, 'Không lấy được thông tin mô hình.');
    }
});

router.post('/', async (req, res) => {
    try {
        const body = req.body || {};
        const region = normalizeRegion(body.region);
        const modelType = normalizeModelType(body.model_type);
        const lang = normalizeLang(body.lang);
        res.status(200).json(await predictOne(pickFeatures(body), region, modelType, lang));
    } catch (error) {
        sendError(res, error, 'Lỗi khi dự báo.');
    }
});

router.post('/csv', uploadCsv, async (req, res) => {
    const lang = normalizeLang(req.body.lang || req.query.lang);
    const en = lang === 'en';
    try {
        if (!req.file) throw new AiError(400, en ? 'Please choose a CSV file.' : 'Vui lòng chọn một file CSV.');
        const region = normalizeRegion(req.body.region);
        const modelType = normalizeModelType(req.body.model_type);
        const { rows, missingColumns } = parseCsv(req.file.buffer);

        if (missingColumns.length) {
            throw new AiError(400, en
                ? `The CSV file is missing ${missingColumns.length} required column(s): ${missingColumns.join(', ')}.`
                : `File CSV thiếu ${missingColumns.length} cột bắt buộc: ${missingColumns.join(', ')}.`);
        }
        if (rows.length > MAX_PUBLIC_ROWS) {
            throw new AiError(413, en
                ? `The free trial accepts up to ${MAX_PUBLIC_ROWS} rows (this file has ${rows.length}).`
                : `Chế độ dùng thử tối đa ${MAX_PUBLIC_ROWS} dòng (file có ${rows.length} dòng).`);
        }

        const results = await predictBatch(rows.map(pickFeatures), region, modelType, lang);
        const summary = { total: rows.length, ok: 0, failed: 0, 'Cao': 0, 'Trung bình': 0, 'Thấp': 0 };

        // Gắn lại số dòng thật trong file + họ tên để frontend hiển thị và xuất file kết quả
        const merged = results.map((r, idx) => {
            const row = rows[idx];
            if (r.ok) { summary.ok += 1; summary[r.risk_level] += 1; } else { summary.failed += 1; }
            return {
                line: row.__line,
                fullName: row.fullName || '',
                input: pickFeatures(row),
                ...(r.ok
                    ? {
                        ok: true,
                        probability_percent: r.probability_percent,
                        risk_level: r.risk_level,
                        risk_word: r.risk_word,
                        model_used: r.model_used,
                        reasons: r.reasons.map((x) => ({ title: x.title, detail: x.detail, text: x.text })),
                        warnings: r.warnings.map((x) => x.message),
                    }
                    : { ok: false, errors: r.errors.map((e) => e.message) }),
            };
        });

        res.status(200).json({ region, lang: results.find((r) => r.ok)?.lang || lang, model_type: modelType, summary, results: merged });
    } catch (error) {
        sendError(res, error, en ? 'Could not process the CSV file.' : 'Lỗi khi xử lý file CSV.');
    }
});

module.exports = router;