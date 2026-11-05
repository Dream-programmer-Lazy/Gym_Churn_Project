import { useState } from 'react';
import axios from 'axios';

export default function ClientRegister({ onBack }) {
  const [formData, setFormData] = useState({
    username: '', password: '', fullName: '', actualPhoneNumber: '', Age: 18, Contract_period: 6
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === 'Age' || name === 'Contract_period' ? Number(value) : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('http://localhost:3001/api/client/register', formData);
      alert('Đăng ký gói tập thành công! Vui lòng chờ trung tâm liên hệ phê duyệt.');
      onBack(); // Quay lại trang chủ
    } catch (error) {
      alert(error.response?.data?.error || 'Có lỗi xảy ra khi đăng ký!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      // Hình nền phòng gym tối màu đồng bộ với toàn hệ thống
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.85)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '40px 20px',
      boxSizing: 'border-box',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    }}>
      
      {/* Khối Form Đăng Ký Dark Mode */}
      <div style={{ 
        backgroundColor: 'rgba(20, 20, 20, 0.95)', 
        padding: '45px 40px', 
        borderRadius: '15px', 
        boxShadow: '0 15px 35px rgba(0,0,0,0.6)', 
        width: '100%', 
        maxWidth: '480px',
        border: '1px solid #333',
        color: '#fff'
      }}>
        
        {/* Tiêu đề thương hiệu */}
        <h2 style={{ textAlign: 'center', color: '#ff3d00', marginBottom: '5px', fontSize: '26px', fontWeight: '900', letterSpacing: '2px' }}>
          POWER GYM<span style={{color: '#fff'}}>.AI</span>
        </h2>
        <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>
          Đăng ký thông tin hội viên & nhận lộ trình tập luyện thông minh
        </p>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px', fontWeight: '500' }}>Tài khoản đăng nhập</label>
            <input 
              type="text" 
              name="username" 
              value={formData.username} 
              onChange={handleChange} 
              required 
              placeholder="Chọn tên đăng nhập..."
              style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px', fontWeight: '500' }}>Mật khẩu</label>
            <input 
              type="password" 
              name="password" 
              value={formData.password} 
              onChange={handleChange} 
              required 
              placeholder="Nhập mật khẩu của bạn..."
              style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} 
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px', fontWeight: '500' }}>Họ và tên</label>
            <input 
              type="text" 
              name="fullName" 
              value={formData.fullName} 
              onChange={handleChange} 
              required 
              placeholder="Nguyễn Văn A"
              style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} 
            />
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px', fontWeight: '500' }}>SĐT liên hệ</label>
              <input 
                type="text" 
                name="actualPhoneNumber" 
                value={formData.actualPhoneNumber} 
                onChange={handleChange} 
                required 
                placeholder="0901234567"
                style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} 
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px', fontWeight: '500' }}>Độ tuổi</label>
              <input 
                type="number" 
                name="Age" 
                value={formData.Age} 
                onChange={handleChange} 
                required 
                style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }} 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px', fontWeight: '500' }}>Lựa chọn gói tập</label>
            <select 
              name="Contract_period" 
              value={formData.Contract_period} 
              onChange={handleChange} 
              style={{ width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '14px', outline: 'none' }}>
              <option value={1}>Gói 1 Tháng - Cơ bản</option>
              <option value={6}>Gói 6 Tháng - Phổ biến (Tiết kiệm)</option>
              <option value={12}>Gói 12 Tháng - VIP Đặc quyền</option>
            </select>
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            style={{ marginTop: '10px', padding: '14px', backgroundColor: '#ff3d00', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px', transition: '0.3s', boxShadow: '0 4px 15px rgba(255, 61, 0, 0.3)' }}>
            {loading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN ĐĂNG KÝ'}
          </button>
          
          <button 
            type="button" 
            onClick={onBack} 
            style={{ padding: '8px', backgroundColor: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
            ← Quay lại trang chủ
          </button>
        </form>
      </div>
    </div>
  );
}