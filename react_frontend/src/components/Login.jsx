import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// Máy chủ miễn phí (Render) "ngủ" khi lâu không dùng: lần gọi đầu có thể mất 30–60 giây.
// Sau SLOW_MS mili giây chưa có trả lời -> hiện dòng giải thích để người dùng không tưởng web bị treo.
const SLOW_MS = 5000;

/** Thông báo lỗi dễ hiểu: sai tài khoản (401) khác với không kết nối được máy chủ */
const loginErrorText = (err) => {
  if (err.response) return err.response.data?.error || `Máy chủ trả lỗi ${err.response.status}.`;
  return 'Không kết nối được máy chủ. Hãy kiểm tra máy chủ Node đã chạy chưa (hoặc thử lại sau ít phút).';
};

/**
 * ĐĂNG NHẬP ADMIN / NHÂN VIÊN
 * - Gọi POST {API_URL}/auth/login (API_URL lấy từ config.js -> chạy được cả local lẫn khi triển khai).
 * - Lỗi hiện ngay trong khung (không dùng alert()).
 */
export default function Login({ onLoginSuccess, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [slow, setSlow] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSlow(false);
    setError('');
    const slowTimer = setTimeout(() => setSlow(true), SLOW_MS);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        username: username.trim(),
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
      setError(loginErrorText(err));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
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
      backgroundColor: '#111',   // nền dự phòng khi ảnh chưa tải được (mất mạng)
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
          <div role="alert" style={{ backgroundColor: 'rgba(229, 57, 53, 0.1)', border: '1px solid #e53935', color: '#ff5252', padding: '12px', borderRadius: '6px', marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>
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
              autoFocus
              autoComplete="username"
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
              autoComplete="current-password"
              placeholder="Nhập mật khẩu..."
              style={{ width: '100%', padding: '14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '15px', outline: 'none' }}
            />
          </div>
          
          {/* Nút Đăng nhập */}
          <button 
            type="submit" 
            disabled={loading}
            style={{ marginTop: '10px', padding: '15px', backgroundColor: '#ff3d00', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.75 : 1, fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px', transition: '0.3s', boxShadow: '0 4px 15px rgba(255, 61, 0, 0.3)' }}>
            {loading ? 'ĐANG XÁC THỰC...' : 'ĐĂNG NHẬP'}
          </button>

          {slow && (
            <p role="status" style={{ margin: 0, color: '#bbb', fontSize: '13px', textAlign: 'center', lineHeight: 1.5 }}>
              Máy chủ đang khởi động, lần đầu có thể mất 30–60 giây. Vui lòng chờ, không cần bấm lại.
            </p>
          )}

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