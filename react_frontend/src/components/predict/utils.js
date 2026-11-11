// Logic dùng chung cho trang dự báo: kiểm tra dữ liệu, định dạng số/tiền, tạo CSV.
import formVN from './forms/form.vn';
import formGlobal from './forms/form.global';
import { t } from './i18n';

export const API_BASE = 'http://localhost:3001/api/predict';
export const FORMS = { vn: formVN, global: formGlobal };
export const MAX_FREQ = 7;

export const FEATURES = [
  'gender', 'Near_Location', 'Partner', 'Promo_friends', 'Phone',
  'Contract_period', 'Group_visits', 'Age',
  'Avg_additional_charges_total', 'Month_to_end_contract',
  'Lifetime', 'Avg_class_frequency_total', 'Avg_class_frequency_current_month',
];

export const allQuestions = (form) => form.sections.flatMap((s) => s.questions);

/** "2,5" hoặc "2.5" -> 2.5 ; rỗng -> NaN */
export const parseNum = (x) => {
  if (x === '' || x === null || x === undefined) return NaN;
  if (typeof x === 'number') return x;
  return Number(String(x).trim().replace(/\s/g, '').replace(',', '.'));
};

/** Số theo ngôn ngữ: vi -> 2,5 ; en -> 2.5 (tối đa 2 số lẻ) */
export const fmtNum = (n, lang) => {
  const s = String(Math.round(Number(n) * 100) / 100);
  return lang === 'vi' ? s.replace('.', ',') : s;
};

/** Tiền hiển thị: vnd -> 500.000đ ; usd -> $120 (giá trị theo đơn vị người dùng nhập) */
export const fmtMoney = (value, currency) => {
  const n = Math.round(Number(value) || 0);
  return currency === 'vnd' ? `${n.toLocaleString('de-DE')}đ` : `$${n.toLocaleString('en-US')}`;
};

/** Giá trị ban đầu: nút Có/Không điền giá trị phổ biến nhất của thị trường, ô số để trống. */
export const initialValues = (form, modelInfo) => {
  const v = {};
  allQuestions(form).forEach((q) => { v[q.name] = ''; });
  (modelInfo?.fields || []).forEach((fi) => { if (fi.binary && fi.name in v) v[fi.name] = fi.default; });
  return v;
};

/** Giá trị gửi cho mô hình (tiền VN chia 1.000 về nghìn VNĐ). */
export const toModelValue = (q, raw, form) => {
  const n = parseNum(raw);
  if (q.type === 'money') return n / form.money.modelScale;
  return n;
};

export const toPayload = (form, values) => {
  const p = {};
  allQuestions(form).forEach((q) => {
    if (q.type === 'text') return;
    p[q.name] = toModelValue(q, values[q.name], form);
  });
  if (values.fullName?.trim()) p.fullName = values.fullName.trim();
  return p;
};

/** Lỗi chặn (giống Flask) cho các câu hỏi của 1 phần. Trả về { name: message } */
export const validateSection = (form, sectionIndex, values, lang) => {
  const errors = {};
  form.sections[sectionIndex].questions.forEach((q) => {
    if (q.optional || q.type === 'text') return;
    const raw = values[q.name];
    if (raw === '' || raw === null || raw === undefined) { errors[q.name] = t(lang, 'required'); return; }
    const n = parseNum(raw);
    if (Number.isNaN(n)) { errors[q.name] = t(lang, 'notNumber'); return; }
    if (n < 0) { errors[q.name] = t(lang, 'negative'); return; }
    if (q.type === 'stepper' && !Number.isInteger(n)) { errors[q.name] = t(lang, 'integer'); return; }
    if (q.type === 'slider' && n > MAX_FREQ) { errors[q.name] = t(lang, 'freqMax', { n: MAX_FREQ }); return; }
    if (q.maxFrom) {
      const cap = parseNum(values[q.maxFrom]);
      if (!Number.isNaN(cap) && n > cap) errors[q.name] = t(lang, 'mteGt', { n: cap });
    }
  });
  return errors;
};

/** Cảnh báo mềm: giá trị nằm ngoài vùng dữ liệu mô hình đã học (vẫn cho dự báo). */
export const softWarning = (q, values, form, modelInfo, lang) => {
  if (!modelInfo || ['text', 'choice', 'plans'].includes(q.type)) return null;
  const raw = values[q.name];
  if (raw === '' || raw === null || raw === undefined) return null;
  const v = toModelValue(q, raw, form);
  if (Number.isNaN(v)) return null;
  const fi = modelInfo.fields.find((x) => x.name === q.name);
  if (!fi || (v >= fi.train_min && v <= fi.train_max)) return null;
  const show = (x) => (q.type === 'money' ? fmtMoney(x * form.money.modelScale, form.money.currency) : fmtNum(x, lang));
  return t(lang, 'outOfRange', { lo: show(fi.train_min), hi: show(fi.train_max) });
};

/* ------------------------------- CSV ------------------------------- */
const csvCell = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadCsv = (filename, header, rows) => {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadTemplate = (form) => {
  downloadCsv(`template_${form.region}.csv`, ['fullName', ...FEATURES], form.templateRows);
};

/** Tên gọi ngắn trong câu kết quả, theo THỊ TRƯỜNG (không theo ngôn ngữ hiển thị):
 *  tên Việt "Lê Hoàng Minh" -> "Minh" (chữ cuối) ; tên quốc tế "John Carter" -> "John" (chữ đầu). */
export const shortName = (fullName, region) => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return region === 'vn' ? parts[parts.length - 1] : parts[0];
};