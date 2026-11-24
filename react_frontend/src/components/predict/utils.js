// Logic dùng chung cho trang dự báo (Landing + Admin) và form hội viên trong Admin:
// kiểm tra dữ liệu, định dạng số/tiền, đổi qua lại giữa "giá trị form" và "giá trị mô hình", tạo CSV.
import formVN from './forms/form.vn';
import formGlobal from './forms/form.global';
import { t } from './i18n';
import { API_URL } from '../../config';

export const API_BASE = `${API_URL}/predict`;          // dự báo dùng thử (không lưu)
export const CUSTOMERS_API = `${API_URL}/customers`;   // lưu vào hệ thống (cần đăng nhập Admin/Staff)
export const FORMS = { vn: formVN, global: formGlobal };
export const MAX_FREQ = 7;

// 7 cột của mô hình — trùng thứ tự với flask_ai/train_model.py và node_backend/utils/ai.js
export const FEATURES = [
  'Lifetime',
  'Avg_class_frequency_current_month',
  'Avg_class_frequency_total',
  'Age',
  'Avg_additional_charges_total',
  'Month_to_end_contract',
  'Contract_period',
];

// Câu hỏi dạng chữ (không gửi cho mô hình, chỉ dùng để hiển thị / lưu hồ sơ)
export const TEXT_FIELDS = ['fullName', 'actualPhoneNumber'];

/** Thị trường của 1 hồ sơ hội viên (hồ sơ cũ chưa có trường region được coi là Việt Nam) */
export const regionOf = (customer) => customer?.region || 'vn';

/** Lỗi 409 "trùng tên, cần chọn Cập nhật / Bỏ qua" từ /api/customers/upload-csv hoặc /bulk */
export const isDuplicateConflict = (err) => err?.response?.status === 409 && !!err.response.data?.needsDecision;

/** Bỏ các câu chỉ dùng trong Admin (vd. số điện thoại) khi hiển thị ở trang công khai. */
export const formForMode = (form, isAdmin) => (isAdmin ? form : {
  ...form,
  sections: form.sections.map((s) => ({ ...s, questions: s.questions.filter((q) => !q.adminOnly) })),
});

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

/** Giá trị ban đầu của form: mọi ô để trống (người dùng tự trả lời). */
export const initialValues = (form) => {
  const v = {};
  allQuestions(form).forEach((q) => { v[q.name] = ''; });
  return v;
};

/** Giá trị gửi cho mô hình (tiền VN: người dùng nhập đồng -> chia 1.000 thành nghìn VNĐ). */
export const toModelValue = (q, raw, form) => {
  const n = parseNum(raw);
  if (q.type === 'money') return n / form.money.modelScale;
  return n;
};

/** Giá trị form -> body gửi API: 7 cột (đúng đơn vị mô hình) + họ tên, số điện thoại nếu có. */
export const toPayload = (form, values) => {
  const p = {};
  allQuestions(form).forEach((q) => {
    if (q.type === 'text') {
      const s = String(values[q.name] ?? '').trim();
      if (s) p[q.name] = s;
      return;
    }
    p[q.name] = toModelValue(q, values[q.name], form);
  });
  return p;
};

/** Hồ sơ hội viên trong MongoDB -> giá trị form (tiền VN: nghìn VNĐ -> đồng). Dùng khi "Sửa". */
export const customerToValues = (form, customer) => {
  const v = initialValues(form);
  allQuestions(form).forEach((q) => {
    const raw = customer?.[q.name];
    if (raw === undefined || raw === null) return;
    if (q.type === 'money') v[q.name] = Math.round(Number(raw) * form.money.modelScale);
    else v[q.name] = raw;
  });
  return v;
};

/** Lỗi chặn (giống Flask) cho các câu hỏi của 1 phần. Trả về { name: message } */
export const validateSection = (form, sectionIndex, values, lang) => {
  const errors = {};
  form.sections[sectionIndex].questions.forEach((q) => {
    if (q.type === 'text') {
      if (!q.optional && !String(values[q.name] ?? '').trim()) errors[q.name] = t(lang, 'required');
      return;
    }
    if (q.optional) return;
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

/** Kiểm tra cả form một lượt (form hội viên trong Admin). */
export const validateAll = (form, values, lang) =>
  form.sections.reduce((acc, _s, i) => ({ ...acc, ...validateSection(form, i, values, lang) }), {});

/** Cảnh báo mềm: giá trị nằm ngoài vùng dữ liệu mô hình đã học (vẫn cho dự báo). */
export const softWarning = (q, values, form, modelInfo, lang) => {
  if (!modelInfo || ['text', 'choice', 'plans'].includes(q.type)) return null;
  const raw = values[q.name];
  if (raw === '' || raw === null || raw === undefined) return null;
  const v = toModelValue(q, raw, form);
  if (Number.isNaN(v)) return null;
  const fi = (modelInfo.fields || []).find((x) => x.name === q.name);
  if (!fi || (v >= fi.train_min && v <= fi.train_max)) return null;
  const show = (x) => (q.type === 'money' ? fmtMoney(x * form.money.modelScale, form.money.currency) : fmtNum(x, lang));
  return t(lang, 'outOfRange', { lo: show(fi.train_min), hi: show(fi.train_max) });
};

/* ------------------------------- CSV ------------------------------- */
// Ký tự BOM đầu file để Excel đọc đúng tiếng Việt (UTF-8). Viết bằng mã số, không dán ký tự vô hình.
const BOM = String.fromCharCode(0xfeff);

const csvCell = (v) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const downloadCsv = (filename, header, rows) => {
  const body = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([BOM + body], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/** File mẫu: fullName, actualPhoneNumber (không bắt buộc cho dự báo) + 7 cột của mô hình */
export const TEMPLATE_HEADER = ['fullName', 'actualPhoneNumber', ...FEATURES];

export const downloadTemplate = (form) => {
  downloadCsv(`template_${form.region}.csv`, TEMPLATE_HEADER, form.templateRows);
};

/** Tên gọi ngắn trong câu kết quả, theo THỊ TRƯỜNG (không theo ngôn ngữ hiển thị):
 *  tên Việt "Lê Hoàng Minh" -> "Minh" (chữ cuối) ; tên quốc tế "John Carter" -> "John" (chữ đầu). */
export const shortName = (fullName, region) => {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  return region === 'vn' ? parts[parts.length - 1] : parts[0];
};