import { useState } from 'react';
import axios from 'axios';

export default function Login({ onLoginSuccess, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await axios.post('http://localhost:3001/api/auth/login', {
        username,
        password
      });

      const { token, user } = response.data;

      // Lưu token
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      // Gắn token vào axios
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Báo thành công
      onLoginSuccess(user);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Lỗi kết nối đến máy chủ!');
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
      // Hình nền phòng gym tối màu
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.75), rgba(0,0,0,0.85)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    }}>
      
      {/* Khối Form Đăng Nhập Dark Mode */}
      <div style={{ 
        backgroundColor: 'rgba(20, 20, 20, 0.95)', 
        padding: '50px 40px', 
        borderRadius: '15px', 
        boxShadow: '0 15px 35px rgba(0,0,0,0.6)', 
        width: '100%', 
        maxWidth: '420px',
        border: '1px solid #333'
      }}>
        
        {/* Tiêu đề */}
        <h2 style={{ textAlign: 'center', color: '#ff3d00', marginBottom: '5px', fontSize: '28px', fontWeight: '900', letterSpacing: '2px' }}>
          POWER GYM<span style={{color: '#fff'}}>.AI</span>
        </h2>
        <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '35px', fontSize: '15px' }}>
          Cổng Đăng Nhập Quản Trị Viên
        </p>
        
        {/* Hiển thị lỗi */}
        {error && (
          <div style={{ backgroundColor: 'rgba(229, 57, 53, 0.1)', border: '1px solid #e53935', color: '#ff5252', padding: '12px', borderRadius: '6px', marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Ô nhập Tài khoản */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#ddd', fontWeight: '500', fontSize: '14px' }}>Tài khoản Admin</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              placeholder="Nhập tên đăng nhập..."
              style={{ width: '100%', padding: '14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '15px', outline: 'none' }}
            />
          </div>

          {/* Ô nhập Mật khẩu */}
          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: '#ddd', fontWeight: '500', fontSize: '14px' }}>Mật khẩu</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Nhập mật khẩu..."
              style={{ width: '100%', padding: '14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '15px', outline: 'none' }}
            />
          </div>
          
          {/* Nút Đăng nhập */}
          <button 
            type="submit" 
            disabled={loading}
            style={{ marginTop: '10px', padding: '15px', backgroundColor: '#ff3d00', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px', transition: '0.3s', boxShadow: '0 4px 15px rgba(255, 61, 0, 0.3)' }}>
            {loading ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP'}
          </button>

          {/* Nút Quay lại trang chủ */}
          <button 
            type="button" 
            onClick={onBack}
            style={{ padding: '10px', backgroundColor: 'transparent', color: '#888', border: 'none', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
            ← Quay lại trang chủ
          </button>
          
        </form>
      </div>
    </div>
  );
}