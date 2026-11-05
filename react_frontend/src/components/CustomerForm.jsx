import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const initialState = {
  fullName: '', actualPhoneNumber: '', gender: 1, Near_Location: 1, Partner: 0, Promo_friends: 0,
  Phone: 1, Contract_period: 6, Group_visits: 1, Age: 25, Avg_additional_charges_total: 100,
  Month_to_end_contract: 5, Lifetime: 3, Avg_class_frequency_total: 2.5, Avg_class_frequency_current_month: 2.0,
  model_type: 'logistic' // Mặc định chọn Logistic Regression
};

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

    setFormData({ 
        ...formData, 
        [name]: value 
    });
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
    <div style={{ fontFamily: 'sans-serif' }}>
      <h3 style={{ margin: '0 0 20px 0', color: '#333' }}>
        {editingCustomer ? 'Sửa Thông Tin & Dự Báo Lại' : 'Thêm Khách Hàng Mới'}
      </h3>
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
        {/* Dropdown chọn thuật toán AI */}
        <div style={{ backgroundColor: '#f0f4f8', padding: '10px', borderRadius: '6px' }}>
          <label style={{ fontWeight: 'bold', color: '#1e88e5' }}>🤖 Thuật toán AI phân tích: </label>
          <select name="model_type" value={formData.model_type} onChange={handleChange} style={{width: '100%', padding: '8px', boxSizing: 'border-box', marginTop: '5px', border: '1px solid #1e88e5', borderRadius: '4px'}}>
            <option value="logistic">Logistic Regression (Nhanh - Khuyên dùng)</option>
            <option value="random_forest">Random Forest (Phân tích sâu)</option>
          </select>
        </div>

        <div>
          <label>Họ và tên: </label>
          <input type="text" name="fullName" value={formData.fullName} onChange={handleChange} required style={{width: '100%', padding: '8px', boxSizing: 'border-box'}} />
        </div>
        <div>
          <label>SĐT: </label>
          <input type="text" name="actualPhoneNumber" value={formData.actualPhoneNumber} onChange={handleChange} style={{width: '100%', padding: '8px', boxSizing: 'border-box'}} />
        </div>
        <div>
          <label>Tuổi: </label>
          <input type="number" name="Age" value={formData.Age} onChange={handleChange} required style={{width: '100%', padding: '8px', boxSizing: 'border-box'}} />
        </div>
        <div>
          <label>Thời hạn hợp đồng (Tháng): </label>
          <select name="Contract_period" value={formData.Contract_period} onChange={handleChange} style={{width: '100%', padding: '8px', boxSizing: 'border-box'}}>
            <option value={1}>1 Tháng</option>
            <option value={6}>6 Tháng</option>
            <option value={12}>12 Tháng</option>
          </select>
        </div>
        <div>
          <label>Tần suất tập tháng qua: </label>
          <input type="number" step="0.1" name="Avg_class_frequency_current_month" value={formData.Avg_class_frequency_current_month} onChange={handleChange} style={{width: '100%', padding: '8px', boxSizing: 'border-box'}} />
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button type="submit" disabled={loading} style={{ flex: 1, padding: '10px', backgroundColor: loading ? '#94a3b8' : (editingCustomer ? '#fb8c00' : '#1e88e5'), color: 'white', border: 'none', borderRadius: '4px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
            {loading ? 'Đang xử lý...' : (editingCustomer ? 'Cập Nhật' : 'Lưu & Dự Báo')}
          </button>
          
          {editingCustomer && (
            <button type="button" onClick={() => {setEditingCustomer(null); setFormData(initialState);}} style={{ flex: 1, padding: '10px', backgroundColor: '#e0e0e0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Hủy sửa
            </button>
          )}
        </div>
      </form>
    </div>
  );
}