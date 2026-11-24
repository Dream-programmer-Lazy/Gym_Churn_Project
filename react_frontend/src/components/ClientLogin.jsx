import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../config';

// Máy chủ miễn phí (Render) "ngủ" khi lâu không dùng: lần gọi đầu có thể mất 30–60 giây.
const SLOW_MS = 5000;

/** Thông báo lỗi dễ hiểu: sai tài khoản / chưa được duyệt khác với không kết nối được máy chủ */
const loginErrorText = (err) => {
  if (err.response) return err.response.data?.error || `Máy chủ trả lỗi ${err.response.status}.`;
  return 'Không kết nối được máy chủ. Vui lòng thử lại sau ít phút.';
};

const inputStyle = { width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '15px' };

/**
 * ĐĂNG NHẬP HỘI VIÊN
 * - Gọi POST {API_URL}/client/login (API_URL lấy từ config.js -> chạy được cả local lẫn khi triển khai).
 * - Props: onLoginSuccess(user), onBack(), onRegister() (tùy chọn: hiện dòng "Chưa có tài khoản? Đăng ký ngay")
 */
export default function ClientLogin({ onLoginSuccess, onBack, onRegister }) {
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
      // API đăng nhập dành riêng cho hội viên (routes/clientAuth.js)
      const response = await axios.post(`${API_URL}/client/login`, {
        username: username.trim(),
        password
      });

      const { token, user } = response.data;

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

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
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', 
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.85)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")',
      backgroundColor: '#111',   // nền dự phòng khi ảnh chưa tải được
      backgroundSize: 'cover', backgroundPosition: 'center', padding: '20px', boxSizing: 'border-box', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    }}>
      <div style={{ backgroundColor: 'rgba(20, 20, 20, 0.95)', padding: '45px 40px', borderRadius: '15px', boxShadow: '0 15px 35px rgba(0,0,0,0.6)', width: '100%', maxWidth: '420px', border: '1px solid #333', color: '#fff' }}>
        <h2 style={{ textAlign: 'center', color: '#ff3d00', marginBottom: '5px', fontSize: '26px', fontWeight: '900' }}>
          POWER GYM<span style={{color: '#fff'}}>.AI</span>
        </h2>
        <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>Đăng nhập dành cho hội viên</p>
        
        {error && <div role="alert" style={{ backgroundColor: 'rgba(229, 57, 53, 0.1)', border: '1px solid #e53935', color: '#ff5252', padding: '12px', borderRadius: '6px', marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="cl-username" style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px' }}>Tên đăng nhập</label>
            <input id="cl-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus
              autoComplete="username" placeholder="Tên đăng nhập bạn đã đăng ký" style={inputStyle} />
          </div>
          <div>
            <label htmlFor="cl-password" style={{ display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px' }}>Mật khẩu</label>
            <input id="cl-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              autoComplete="current-password" placeholder="Nhập mật khẩu" style={inputStyle} />
          </div>
          
          <button type="submit" disabled={loading} style={{ marginTop: '10px', padding: '14px', backgroundColor: '#ff3d00', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.75 : 1, fontWeight: 'bold', fontSize: '16px' }}>
            {loading ? 'ĐANG ĐĂNG NHẬP...' : 'ĐĂNG NHẬP HỘI VIÊN'}
          </button>

          {slow && (
            <p role="status" style={{ margin: 0, color: '#bbb', fontSize: '13px', textAlign: 'center', lineHeight: 1.5 }}>
              Máy chủ đang khởi động, lần đầu có thể mất 30–60 giây. Vui lòng chờ, không cần bấm lại.
            </p>
          )}

          {onRegister && (
            <p style={{ margin: '4px 0 0', textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
              Chưa có tài khoản?{' '}
              <button type="button" onClick={onRegister}
                style={{ background: 'none', border: 'none', padding: 0, color: '#ff3d00', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                Đăng ký ngay
              </button>
            </p>
          )}
          
          <button type="button" onClick={onBack} style={{ padding: '8px', backgroundColor: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '14px', textDecoration: 'underline' }}>
            ← Quay lại trang chủ
          </button>
        </form>
      </div>
    </div>
  );
}