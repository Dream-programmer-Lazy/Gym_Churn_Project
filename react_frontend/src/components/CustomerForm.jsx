import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { UserPlus, PenLine } from 'lucide-react';
import { API_URL } from '../config';
import { FORMS, initialValues, customerToValues, toPayload, validateAll, parseNum, fmtMoney } from './predict/utils';

/**
 * FORM THÊM / SỬA HỘI VIÊN TRONG ADMIN — đủ 7 chỉ số của mô hình (mục 3.4)
 * Props: region ('vn' | 'global', mặc định 'vn' — lấy từ menu, không tự chọn),
 *        editingCustomer, setEditingCustomer, onSuccess
 * - Dùng chung cấu hình câu hỏi với trang Dự báo (predict/forms/), chỉ đổi nhãn cho gọn.
 * - VN: nhập tiền theo ĐỒNG (350000) -> tự chia 1.000 thành nghìn VNĐ trước khi gửi. Quốc tế: USD.
 * - Không còn giá trị ẩn điền sẵn: mọi chỉ số đều do người dùng nhập.
 */
const LABELS = {
  fullName: 'Họ và tên',
  actualPhoneNumber: 'Số điện thoại',
  Age: 'Tuổi',
  Contract_period: 'Thời hạn gói tập',
  Month_to_end_contract: 'Số tháng còn lại',
  Lifetime: 'Đã tập (tháng)',
  Avg_class_frequency_total: 'Buổi/tuần từ khi đăng ký',
  Avg_class_frequency_current_month: 'Buổi/tuần tháng gần nhất',
  Avg_additional_charges_total: 'Chi tiêu thêm mỗi tháng',
};

const startValues = (form, customer) => (customer ? customerToValues(form, customer) : initialValues(form));

export default function CustomerForm({ region = 'vn', editingCustomer, setEditingCustomer, onSuccess }) {
  const form = FORMS[region];
  const isVN = region === 'vn';
  const stateKey = `${region}|${editingCustomer?._id || 'new'}`;

  const [values, setValues] = useState(() => startValues(form, editingCustomer));
  const [errors, setErrors] = useState({});
  const [prevKey, setPrevKey] = useState(stateKey);
  const [loading, setLoading] = useState(false);

  // Kỹ thuật "Derived State": đổi người đang sửa hoặc đổi thị trường -> nạp lại form
  if (stateKey !== prevKey) {
    setPrevKey(stateKey);
    setValues(startValues(form, editingCustomer));
    setErrors({});
  }

  const setField = (name, value) => {
    setValues((v) => {
      const next = { ...v, [name]: value };
      // Đổi sang gói ngắn hơn số tháng còn lại -> xóa số tháng còn lại để nhập lại
      if (name === 'Contract_period' && next.Month_to_end_contract !== '' && parseNum(next.Month_to_end_contract) > Number(value)) {
        next.Month_to_end_contract = '';
      }
      return next;
    });
    if (errors[name]) setErrors((e) => { const n = { ...e }; delete n[name]; return n; });
  };

  const reset = () => { setValues(initialValues(form)); setErrors({}); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validateAll(form, values, 'vi');
    if (!String(values.fullName ?? '').trim()) errs.fullName = 'Vui lòng nhập họ và tên.';
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error('Vui lòng kiểm tra lại các ô được đánh dấu đỏ.');
      return;
    }

    setLoading(true);
    const loadingToast = toast.loading('Đang lưu và chấm điểm rủi ro...');
    const payload = { ...toPayload(form, values), region };
    if (editingCustomer && !payload.actualPhoneNumber) payload.actualPhoneNumber = ''; // cho phép xóa SĐT khi sửa

    try {
      if (editingCustomer) {
        await axios.put(`${API_URL}/customers/${editingCustomer._id}`, payload);
        toast.success('Cập nhật và dự báo lại thành công!', { id: loadingToast });
        setEditingCustomer(null);
      } else {
        await axios.post(`${API_URL}/customers`, payload);
        toast.success('Thêm mới và dự báo thành công!', { id: loadingToast });
        reset();
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      const data = error.response?.data;
      if (data?.errors?.length) {
        const map = {};
        data.errors.forEach((x) => { if (x.field) map[x.field] = x.message; });
        setErrors(map);
      }
      if (error.sessionExpired) toast.dismiss(loadingToast);
      else toast.error(data?.error || 'Có lỗi xảy ra khi lưu dữ liệu!', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  const err = (name) => errors[name] && <span className="ad-hint" style={{ color: 'var(--high)' }}>{errors[name]}</span>;

  const numberInput = (name, props = {}) => (
    <input id={`cf-${name}`} className="ad-input ad-num" type="number" name={name} value={values[name] ?? ''}
      onChange={(e) => setField(name, e.target.value)} aria-invalid={!!errors[name]} {...props} />
  );

  const money = parseNum(values.Avg_additional_charges_total);

  return (
    <>
      <div className="ad-panel-head">
        <div>
          {editingCustomer && <span className="ad-form-mode"><PenLine size={12} /> Đang sửa</span>}
          <h3 className="ad-h3" style={{ marginTop: editingCustomer ? 8 : 0 }}>
            {editingCustomer ? editingCustomer.fullName : `Thêm hội viên ${isVN ? 'Việt Nam' : 'Quốc tế'}`}
          </h3>
          <p className="ad-h3-sub">
            {editingCustomer ? 'Lưu thay đổi để AI chấm lại điểm rủi ro.' : 'Nhập đủ 7 chỉ số, AI sẽ chấm điểm rủi ro ngay khi lưu.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ad-form" noValidate>
        <div className="ad-field">
          <label className="ad-label" htmlFor="cf-fullName">{LABELS.fullName}</label>
          <input id="cf-fullName" className="ad-input" type="text" value={values.fullName ?? ''} placeholder={isVN ? 'Nguyễn Văn A' : 'John Carter'}
            onChange={(e) => setField('fullName', e.target.value)} aria-invalid={!!errors.fullName} />
          {err('fullName')}
        </div>

        <div className="ad-row-2">
          <div className="ad-field">
            <label className="ad-label" htmlFor="cf-actualPhoneNumber">{LABELS.actualPhoneNumber}</label>
            <input id="cf-actualPhoneNumber" className="ad-input ad-num" type="text" value={values.actualPhoneNumber ?? ''}
              placeholder={isVN ? '09xx xxx xxx' : '+1 555 0100'} onChange={(e) => setField('actualPhoneNumber', e.target.value)} />
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="cf-Age">{LABELS.Age}</label>
            {numberInput('Age', { min: 14, max: 90, step: 1 })}
            {err('Age')}
          </div>
        </div>

        <div className="ad-field">
          <span className="ad-label">{LABELS.Contract_period}</span>
          <div className="ad-seg-choice" role="group" aria-label={LABELS.Contract_period}
            style={{ gridTemplateColumns: `repeat(${form.plans.length}, 1fr)` }}>
            {form.plans.map((m) => (
              <button key={m} type="button" aria-pressed={Number(values.Contract_period) === m} onClick={() => setField('Contract_period', m)}>
                {m} tháng
              </button>
            ))}
          </div>
          {err('Contract_period')}
        </div>

        <div className="ad-row-2">
          <div className="ad-field">
            <label className="ad-label" htmlFor="cf-Month_to_end_contract">{LABELS.Month_to_end_contract}</label>
            {numberInput('Month_to_end_contract', { min: 0, max: values.Contract_period || undefined, step: 1 })}
            {err('Month_to_end_contract')}
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="cf-Lifetime">{LABELS.Lifetime}</label>
            {numberInput('Lifetime', { min: 0, step: 1 })}
            {err('Lifetime')}
          </div>
        </div>

        <div className="ad-row-2">
          <div className="ad-field">
            <label className="ad-label" htmlFor="cf-Avg_class_frequency_total">{LABELS.Avg_class_frequency_total}</label>
            {numberInput('Avg_class_frequency_total', { min: 0, max: 7, step: 0.1 })}
            {err('Avg_class_frequency_total')}
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="cf-Avg_class_frequency_current_month">{LABELS.Avg_class_frequency_current_month}</label>
            {numberInput('Avg_class_frequency_current_month', { min: 0, max: 7, step: 0.1 })}
            {err('Avg_class_frequency_current_month')}
          </div>
        </div>

        <div className="ad-field">
          <label className="ad-label" htmlFor="cf-Avg_additional_charges_total">
            {LABELS.Avg_additional_charges_total} ({isVN ? 'VNĐ' : 'USD'})
          </label>
          {numberInput('Avg_additional_charges_total', { min: 0, step: isVN ? 1000 : 1, placeholder: isVN ? '350000' : '80' })}
          <span className="ad-hint">
            {!Number.isNaN(money) ? `${fmtMoney(money, form.money.currency)} · ` : ''}Không tính tiền gói tập.
          </span>
          {err('Avg_additional_charges_total')}
        </div>

        <div className="ad-form-actions">
          <button type="submit" disabled={loading} className="ad-btn is-primary is-block" style={{ height: 42 }}>
            {loading ? 'Đang xử lý...' : editingCustomer ? <><PenLine size={15} /> Cập nhật & dự báo lại</> : <><UserPlus size={15} /> Lưu & dự báo</>}
          </button>

          {editingCustomer && (
            <button type="button" className="ad-btn" style={{ height: 42 }} onClick={() => { setEditingCustomer(null); reset(); }}>
              Hủy
            </button>
          )}
        </div>
      </form>
    </>
  );
}