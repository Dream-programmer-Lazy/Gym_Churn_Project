import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { UserPlus, PenLine, Sparkles } from 'lucide-react';

const initialState = {
  fullName: '', actualPhoneNumber: '', gender: 1, Near_Location: 1, Partner: 0, Promo_friends: 0,
  Phone: 1, Contract_period: 6, Group_visits: 1, Age: 25, Avg_additional_charges_total: 100,
  Month_to_end_contract: 5, Lifetime: 3, Avg_class_frequency_total: 2.5, Avg_class_frequency_current_month: 2.0,
  model_type: 'logistic' // Mặc định chọn Logistic Regression
};

const CONTRACTS = [1, 6, 12];

export default function CustomerForm({ editingCustomer, setEditingCustomer, onSuccess }) {
  const [formData, setFormData] = useState(editingCustomer ? { ...editingCustomer, model_type: 'logistic' } : initialState);
  const [prevEditing, setPrevEditing] = useState(editingCustomer);
  const [loading, setLoading] = useState(false);

  // Kỹ thuật "Derived State"
  if (editingCustomer !== prevEditing) {
    setFormData(editingCustomer ? { ...editingCustomer, model_type: 'logistic' } : initialState);
    setPrevEditing(editingCustomer);
  }

  const handleChange = (e) => {
    let { name, value } = e.target;

    // Tự động cắt bỏ số 0 vô nghĩa ở đầu (VD: "012" -> "12")
    if (e.target.type === 'number') {
      if (value.length > 1 && value.startsWith('0') && !value.startsWith('0.')) {
        value = value.replace(/^0+/, '');
        if (value === '') value = '0';
      }
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const loadingToast = toast.loading('Đang xử lý dữ liệu và gọi AI...');

    // Ép kiểu các trường số về định dạng Number trước khi gửi lên API
    const payload = { ...formData };
    const numberFields = ['Age', 'Contract_period', 'Lifetime', 'Avg_class_frequency_current_month', 'gender'];
    numberFields.forEach(field => {
      if (payload[field] !== undefined && payload[field] !== '') {
        payload[field] = Number(payload[field]);
      }
    });

    try {
      if (editingCustomer) {
        await axios.put(`http://localhost:3001/api/customers/${editingCustomer._id}`, payload);
        toast.success('Cập nhật và Dự báo lại thành công!', { id: loadingToast });
        setEditingCustomer(null);
      } else {
        await axios.post('http://localhost:3001/api/customers', payload);
        toast.success('Thêm mới và Dự báo thành công!', { id: loadingToast });
        setFormData(initialState);
      }
      onSuccess();
    } catch (error) {
      console.error(error);
      toast.error('Có lỗi xảy ra khi lưu dữ liệu!', { id: loadingToast });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="ad-panel-head">
        <div>
          {editingCustomer && <span className="ad-form-mode"><PenLine size={12} /> Đang sửa</span>}
          <h3 className="ad-h3" style={{ marginTop: editingCustomer ? 8 : 0 }}>
            {editingCustomer ? editingCustomer.fullName : 'Thêm hội viên mới'}
          </h3>
          <p className="ad-h3-sub">
            {editingCustomer ? 'Lưu thay đổi để AI chấm lại điểm rủi ro.' : 'Nhập thông tin, AI sẽ chấm điểm rủi ro ngay khi lưu.'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="ad-form">
        <div className="ad-field">
          <label className="ad-label" htmlFor="cf-name">Họ và tên</label>
          <input id="cf-name" className="ad-input" type="text" name="fullName" value={formData.fullName} onChange={handleChange} required placeholder="Nguyễn Văn A" />
        </div>

        <div className="ad-row-2">
          <div className="ad-field">
            <label className="ad-label" htmlFor="cf-phone">Số điện thoại</label>
            <input id="cf-phone" className="ad-input ad-num" type="text" name="actualPhoneNumber" value={formData.actualPhoneNumber} onChange={handleChange} placeholder="09xx xxx xxx" />
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="cf-age">Tuổi</label>
            <input id="cf-age" className="ad-input ad-num" type="number" name="Age" value={formData.Age} onChange={handleChange} required />
          </div>
        </div>

        <div className="ad-field">
          <span className="ad-label">Thời hạn hợp đồng</span>
          <div className="ad-seg-choice" role="group" aria-label="Thời hạn hợp đồng">
            {CONTRACTS.map(m => (
              <button
                key={m}
                type="button"
                aria-pressed={Number(formData.Contract_period) === m}
                onClick={() => setFormData({ ...formData, Contract_period: m })}
              >
                {m} tháng
              </button>
            ))}
          </div>
        </div>

        <div className="ad-field">
          <label className="ad-label" htmlFor="cf-freq">Tần suất tập tháng này</label>
          <input id="cf-freq" className="ad-input ad-num" type="number" step="0.1" name="Avg_class_frequency_current_month" value={formData.Avg_class_frequency_current_month} onChange={handleChange} />
          <span className="ad-hint">Số buổi trung bình mỗi tuần</span>
        </div>

        <div className="ad-model-box ad-field">
          <label className="ad-label" htmlFor="cf-model" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={13} /> Thuật toán AI phân tích
          </label>
          <select id="cf-model" className="ad-select" name="model_type" value={formData.model_type} onChange={handleChange}>
            <option value="logistic">Logistic Regression (nhanh, khuyên dùng)</option>
            <option value="random_forest">Random Forest (phân tích sâu)</option>
          </select>
        </div>

        <div className="ad-form-actions">
          <button type="submit" disabled={loading} className="ad-btn is-primary is-block" style={{ height: 42 }}>
            {loading ? 'Đang xử lý...' : editingCustomer ? <><PenLine size={15} /> Cập nhật & dự báo lại</> : <><UserPlus size={15} /> Lưu & dự báo</>}
          </button>

          {editingCustomer && (
            <button type="button" className="ad-btn" style={{ height: 42 }} onClick={() => { setEditingCustomer(null); setFormData(initialState); }}>
              Hủy
            </button>
          )}
        </div>
      </form>
    </>
  );
}