import { useState } from 'react';
import axios from 'axios';

export default function ClientLogin({ onLoginSuccess, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Gọi API đăng nhập dành riêng cho khách hàng mà chúng ta đã tạo ở routes/clientAuth.js
      const response = await axios.post('http://localhost:3001/api/client/login', {
        username,
        password
      });

      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      onLoginSuccess(user);
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi kết nối đến máy chủ!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', 
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.85)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")',
      backgroundSize: 'cover', backgroundPosition: 'center', padding: '20px', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    }}>
      <div style={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', padding: '45px 40px', borderRadius: '15px', boxShadow: '0 15px 35px rgba(0,0,0,0.6)', width: '100%', maxWidth: '420px', border: '1px solid #333', color: '#fff' }}>
        <h2 style={{ textAlign: 'center', color: '#ff3d00', marginBottom: '5px', fontSize: '26px', fontWeight: '900' }}>
          POWER GYM<span style={{color: '#fff'}}>.AI</span>
        </h2>
        <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>Đăng Nhập Dành Cho Khách Hàng</p>
        
        {error && <div style={{ backgroundColor: 'rgba(229, 57, 53, 0.1)', border: '1px solid #e53935', color: '#ff5252', padding: '12px', borderRadius: '6px', marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px' }}>Tài khoản</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px' }}>Mật khẩu</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box' }} />
          </div>
          
          <button type="submit" disabled={loading} style={{ marginTop: '10px', padding: '14px', backgroundColor: '#ff3d00', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>
            {loading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP HỘI VIÊN'}
          </button>
          
          <button type="button" onClick={onBack} style={{ padding: '8px', backgroundColor: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
            ← Quay lại trang chủ
          </button>
        </form>
      </div>
    </div>
  );
}