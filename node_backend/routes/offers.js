/**
 * ƯU ĐÃI GIA HẠN (mục 5.2 màn hình duyệt, 5.5 nhật ký) — CHỈ ADMIN / STAFF (server.js chặn)
 * ---------------------------------------------------------------------------------------
 * GET  /api/offers/proposals?region=vn  -> danh sách ĐỀ XUẤT: hội viên đang hoạt động, mức Cao,
 *                                          chưa nhận ưu đãi trong 30 ngày; kèm giá gói để tính chi phí
 * POST /api/offers/send                 -> gửi cho những người đã được DUYỆT (tick)
 *        body: { region, customerIds: [...], discountPercent: 5|10|15, validDays: 7|14|30, budget }
 *        - Tổng chi phí ưu đãi vượt ngân sách -> từ chối, không gửi ai.
 *        - Mỗi người 1 mã riêng, có hạn dùng; ghi nhật ký; hiện trong cổng hội viên (admin_message).
 * GET  /api/offers/log?region=vn        -> nhật ký các lần gửi (mới nhất trước)
 *
 * Quyết định đã chốt: chỉ mức Cao; 1 mức giảm chung 5/10/15% (mặc định 10%) trên giá gia hạn ĐÚNG GÓI hiện tại;
 * ngân sách nhập theo từng đợt; không gửi lại cùng 1 người trong 30 ngày; hạn dùng 7/14/30 ngày (mặc định 14).
 * Chế độ demo: KHÔNG gửi email thật — ưu đãi hiện trong cổng hội viên.
 */
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Offer = require('../models/Offer');
const { AiError, DEFAULT_REGION, normalizeRegion, sendError } = require('../utils/ai');

// Giá gói THAM KHẢO phân khúc tầm trung (dùng để ước tính chi phí ưu đãi; ghi rõ trong báo cáo)
// VN: đồng (tham khảo CITIGYM, UP GYM, Fit24) | Quốc tế: USD (tham khảo Anytime Fitness, Gold's Gym)
const PLAN_PRICES = {
    vn: { 1: 500000, 3: 1350000, 6: 2500000, 12: 4500000 },
    global: { 1: 50, 6: 270, 12: 480 },
};
const CURRENCY = { vn: 'VND', global: 'USD' };
const DISCOUNT_OPTIONS = [5, 10, 15];
const DEFAULT_DISCOUNT = 10;
const VALID_DAYS_OPTIONS = [7, 14, 30];
const DEFAULT_VALID_DAYS = 14;
const COOLDOWN_DAYS = 30;           // không gửi lại cùng 1 người trong 30 ngày
const MAX_PER_BATCH = 500;
const ACTIVE = 'Đang hoạt động';

const regionFilter = (region) => (region === DEFAULT_REGION
    ? { $or: [{ region }, { region: { $exists: false } }] }
    : { region });

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/** Làm tròn chi phí: VND tới 1.000đ, USD tới 1 đô */
const roundMoney = (value, region) => (region === 'vn' ? Math.round(value / 1000) * 1000 : Math.round(value));

const fmtMoney = (value, region) => (region === 'vn'
    ? `${Math.round(value).toLocaleString('de-DE')}đ`
    : `$${Math.round(value).toLocaleString('en-US')}`);

const fmtDate = (d, region) => d.toLocaleDateString(region === 'vn' ? 'vi-VN' : 'en-GB',
    { day: '2-digit', month: region === 'vn' ? '2-digit' : 'short', year: 'numeric' });

/** Mã ưu đãi dạng GYM-XXXXXX (bỏ các ký tự dễ nhầm 0/O, 1/I) */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => {
    const bytes = crypto.randomBytes(6);
    let s = '';
    for (let i = 0; i < 6; i += 1) s += CODE_CHARS[bytes[i] % CODE_CHARS.length];
    return `GYM-${s}`;
};

/** Nội dung hiện trong cổng hội viên: VN tiếng Việt, Quốc tế tiếng Anh */
const offerMessage = ({ region, plan, price, finalPrice, discount, code, expiresAt }) => (region === 'vn'
    ? `ƯU ĐÃI GIA HẠN DÀNH RIÊNG CHO BẠN: giảm ${discount}% khi gia hạn gói ${plan} tháng `
      + `(chỉ còn ${fmtMoney(finalPrice, region)} thay vì ${fmtMoney(price, region)}). `
      + `Mã ưu đãi: ${code}, dùng đến hết ngày ${fmtDate(expiresAt, region)}. Đưa mã này cho quầy lễ tân khi gia hạn.`
    : `EXCLUSIVE RENEWAL OFFER: ${discount}% off when you renew your ${plan}-month plan `
      + `(${fmtMoney(finalPrice, region)} instead of ${fmtMoney(price, region)}). `
      + `Code: ${code}, valid until ${fmtDate(expiresAt, region)}. Show this code at reception when you renew.`);

/** Id những hội viên đã nhận ưu đãi trong COOLDOWN_DAYS ngày gần đây (cùng thị trường) */
const recentlyOfferedIds = async (region) => {
    const recent = await Offer.find({ region, status: 'sent', createdAt: { $gte: daysAgo(COOLDOWN_DAYS) } })
        .select('customer').lean();
    return new Set(recent.map((o) => String(o.customer)));
};

// --- 1. DANH SÁCH ĐỀ XUẤT (chưa gửi gì) ---
router.get('/proposals', async (req, res) => {
    try {
        const region = normalizeRegion(req.query.region);
        const [highs, recentIds] = await Promise.all([
            Customer.find({ ...regionFilter(region), status: ACTIVE, 'prediction.risk_level': 'Cao' })
                .select('fullName actualPhoneNumber Contract_period Month_to_end_contract prediction')
                .lean(),
            recentlyOfferedIds(region),
        ]);

        const items = [];
        let recentlyOffered = 0;
        highs.forEach((c) => {
            if (recentIds.has(String(c._id))) { recentlyOffered += 1; return; }
            items.push({
                _id: c._id,
                fullName: c.fullName,
                actualPhoneNumber: c.actualPhoneNumber,
                Contract_period: c.Contract_period,
                Month_to_end_contract: c.Month_to_end_contract,
                probability_percent: c.prediction?.probability_percent,
                mainReason: (c.prediction?.reasons || [])[0] || '',
                plan_price: PLAN_PRICES[region][c.Contract_period] ?? null,   // null = gói không có trong bảng giá
            });
        });
        items.sort((a, b) => (b.probability_percent ?? 0) - (a.probability_percent ?? 0));

        res.status(200).json({
            region,
            currency: CURRENCY[region],
            prices: PLAN_PRICES[region],
            discountOptions: DISCOUNT_OPTIONS,
            defaultDiscount: DEFAULT_DISCOUNT,
            validDaysOptions: VALID_DAYS_OPTIONS,
            defaultValidDays: DEFAULT_VALID_DAYS,
            cooldownDays: COOLDOWN_DAYS,
            recentlyOffered,          // số người mức Cao bị bỏ qua vì đã nhận ưu đãi trong 30 ngày
            items,
        });
    } catch (error) {
        sendError(res, error, 'Lỗi khi lấy danh sách đề xuất ưu đãi.');
    }
});

// --- 2. GỬI ƯU ĐÃI (chỉ những người đã được duyệt) ---
router.post('/send', async (req, res) => {
    try {
        const body = req.body || {};
        const region = normalizeRegion(body.region);
        const discount = Number(body.discountPercent ?? DEFAULT_DISCOUNT);
        const validDays = Number(body.validDays ?? DEFAULT_VALID_DAYS);
        const budget = Number(body.budget);
        const ids = Array.isArray(body.customerIds) ? [...new Set(body.customerIds.map(String))] : [];

        if (!DISCOUNT_OPTIONS.includes(discount)) throw new AiError(400, `Mức giảm chỉ được chọn ${DISCOUNT_OPTIONS.join(' / ')}%.`);
        if (!VALID_DAYS_OPTIONS.includes(validDays)) throw new AiError(400, `Hạn dùng chỉ được chọn ${VALID_DAYS_OPTIONS.join(' / ')} ngày.`);
        if (!Number.isFinite(budget) || budget <= 0) throw new AiError(400, 'Vui lòng nhập ngân sách đợt này (lớn hơn 0).');
        if (!ids.length) throw new AiError(400, 'Chưa chọn hội viên nào để gửi.');
        if (ids.length > MAX_PER_BATCH) throw new AiError(400, `Tối đa ${MAX_PER_BATCH} hội viên mỗi đợt.`);

        // Kiểm tra lại điều kiện ở server (không tin dữ liệu từ trình duyệt)
        const [members, recentIds] = await Promise.all([
            Customer.find({ _id: { $in: ids } }).select('fullName region status Contract_period prediction').lean(),
            recentlyOfferedIds(region),
        ]);
        const skipped = [];
        const eligible = [];
        members.forEach((c) => {
            const reason = ((c.region || DEFAULT_REGION) !== region && 'khác thị trường')
                || (c.status !== ACTIVE && 'chưa hoạt động')
                || (c.prediction?.risk_level !== 'Cao' && 'không còn ở mức Cao')
                || (recentIds.has(String(c._id)) && `đã nhận ưu đãi trong ${COOLDOWN_DAYS} ngày`)
                || (!PLAN_PRICES[region][c.Contract_period] && `gói ${c.Contract_period} tháng không có trong bảng giá`);
            if (reason) skipped.push({ fullName: c.fullName, reason });
            else eligible.push(c);
        });
        if (members.length < ids.length) skipped.push({ fullName: '(không tìm thấy)', reason: `${ids.length - members.length} hội viên đã bị xóa` });
        if (!eligible.length) throw new AiError(400, 'Không có hội viên nào đủ điều kiện để gửi.', skipped);

        // Chi phí = mức giảm × giá gói hiện tại; vượt ngân sách -> không gửi ai
        const plans = eligible.map((c) => {
            const price = PLAN_PRICES[region][c.Contract_period];
            const amount = roundMoney(price * discount / 100, region);
            return { c, price, amount, finalPrice: price - amount };
        });
        const totalCost = plans.reduce((s, p) => s + p.amount, 0);
        if (totalCost > budget) {
            throw new AiError(400, `Tổng chi phí ưu đãi ${fmtMoney(totalCost, region)} vượt ngân sách ${fmtMoney(budget, region)}. Hãy bỏ bớt người hoặc giảm mức ưu đãi.`);
        }

        const batchId = `${region}-${Date.now()}`;
        const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
        const sentBy = req.user?.fullName || 'Admin';
        const sent = [];
        const failed = [];

        for (const { c, price, amount, finalPrice } of plans) {
            let code = makeCode();
            const msg = () => offerMessage({ region, plan: c.Contract_period, price, finalPrice, discount, code, expiresAt });
            try {
                let offer;
                for (let attempt = 0; attempt < 3 && !offer; attempt += 1) {
                    try {
                        offer = await Offer.create({
                            customer: c._id, region, fullName: c.fullName,
                            risk_level: c.prediction?.risk_level, probability_percent: c.prediction?.probability_percent,
                            Contract_period: c.Contract_period, currency: CURRENCY[region],
                            plan_price: price, discount_percent: discount, discount_amount: amount, final_price: finalPrice,
                            code, valid_days: validDays, expires_at: expiresAt,
                            channel: 'portal', status: 'sent', message: msg(), batch_id: batchId, sent_by: sentBy,
                        });
                    } catch (e) {
                        if (e?.code === 11000) { code = makeCode(); continue; }   // trùng mã (rất hiếm) -> tạo mã khác
                        throw e;
                    }
                }
                if (!offer) throw new Error('Không tạo được mã ưu đãi.');
                // Hiện trong cổng hội viên (dùng lại admin_message đã có)
                await Customer.findByIdAndUpdate(c._id, { admin_message: offer.message });
                sent.push({ fullName: c.fullName, code: offer.code, discount_amount: amount });
            } catch (e) {
                failed.push({ fullName: c.fullName, reason: e.message });
            }
        }

        const sentCost = sent.reduce((s, x) => s + x.discount_amount, 0);
        const message = `Đã gửi ưu đãi giảm ${discount}% cho ${sent.length} hội viên (chi phí ${fmtMoney(sentCost, region)} / ngân sách ${fmtMoney(budget, region)}).`
            + (skipped.length ? ` Bỏ qua ${skipped.length} người không đủ điều kiện.` : '')
            + (failed.length ? ` ${failed.length} người gửi lỗi.` : '');
        res.status(200).json({ message, batchId, sent, skipped, failed, totalCost: sentCost, expiresAt });
    } catch (error) {
        sendError(res, error, 'Lỗi khi gửi ưu đãi.');
    }
});

// --- 3. NHẬT KÝ GỬI (mới nhất trước) ---
router.get('/log', async (req, res) => {
    try {
        const region = normalizeRegion(req.query.region);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
        const items = await Offer.find({ region }).sort({ createdAt: -1 }).limit(limit).lean();
        res.status(200).json({ region, items });
    } catch (error) {
        sendError(res, error, 'Lỗi khi lấy nhật ký ưu đãi.');
    }
});

module.exports = router;