import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../config';
import { PLANS_VN, PLAN_PRICES_VND, DEFAULT_PLAN, isValidPlan, formatVnd, pricePerMonth, savingPercent } from '../pricing';

const SLOW_MS = 5000; // máy chủ miễn phí "ngủ" lâu không dùng -> lần đầu có thể chậm

const labelStyle = { display: 'block', marginBottom: '6px', color: '#ddd', fontSize: '13px', fontWeight: '500' };
const inputStyle = { width: '100%', padding: '12px 14px', borderRadius: '6px', border: '1px solid #444', backgroundColor: '#222', color: '#fff', boxSizing: 'border-box', fontSize: '14px', outline: 'none' };
const errorInput = { ...inputStyle, border: '1px solid #e53935' };
const hintStyle = { margin: '6px 0 0', fontSize: '12px', color: '#ff5252' };

/** Kiểm tra trước khi gửi (máy chủ vẫn kiểm tra lại). Trả về { tên trường: câu báo lỗi } */
const validate = (f) => {
  const errors = {};
  if (!f.username.trim()) errors.username = 'Vui lòng chọn tên đăng nhập.';
  else if (/\s/.test(f.username.trim())) errors.username = 'Tên đăng nhập không được có khoảng trắng.';
  if (f.password.length < 6) errors.password = 'Mật khẩu cần ít nhất 6 ký tự.';
  if (!f.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
  const phone = f.actualPhoneNumber.replace(/[\s.-]/g, '');
  if (!/^(\+?84|0)\d{9,10}$/.test(phone)) errors.actualPhoneNumber = 'Số điện thoại chưa đúng (ví dụ 0901234567).';
  const age = Number(f.Age);
  if (!Number.isInteger(age) || age < 14 || age > 90) errors.Age = 'Tuổi từ 14 đến 90.';
  return errors;
};

/**
 * ĐĂNG KÝ HỘI VIÊN (thị trường Việt Nam)
 * Props:
 *   onBack()        : về trang chủ
 *   onLogin()       : (tùy chọn) sang trang đăng nhập hội viên — dùng sau khi đăng ký xong và ở dòng "Đã có tài khoản?"
 *   initialPlan     : (tùy chọn) gói đã bấm ở Bảng giá Landing (1 | 3 | 6 | 12) -> chọn sẵn
 * - Gọi POST {API_URL}/client/register. Thông báo bằng toast (không dùng alert()).
 * - 4 gói có giá lấy từ pricing.js (trùng bảng giá trang Ưu đãi).
 */
export default function ClientRegister({ onBack, onLogin, initialPlan }) {
  const [formData, setFormData] = useState(() => ({
    username: '', password: '', fullName: '', actualPhoneNumber: '', Age: '',
    Contract_period: isValidPlan(initialPlan) ? initialPlan : DEFAULT_PLAN,
  }));
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const setField = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }));
  };
  const handleChange = (e) => setField(e.target.name, e.target.value);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate(formData);
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Vui lòng kiểm tra lại các ô được tô đỏ.');
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Đang gửi đăng ký...');
    const slowTimer = setTimeout(() => {
      toast.loading('Máy chủ đang khởi động, lần đầu có thể mất 30–60 giây...', { id: toastId });
    }, SLOW_MS);
    try {
      await axios.post(`${API_URL}/client/register`, {
        ...formData,
        username: formData.username.trim(),
        fullName: formData.fullName.trim(),
        actualPhoneNumber: formData.actualPhoneNumber.replace(/[\s.-]/g, ''),
        Age: Number(formData.Age),
        Contract_period: Number(formData.Contract_period),
      });
      toast.success('Đăng ký thành công! Nhân viên sẽ duyệt hồ sơ, sau đó bạn đăng nhập để xem cổng hội viên.', { id: toastId, duration: 7000 });
      (onLogin || onBack)();
    } catch (error) {
      const msg = error.response
        ? (error.response.data?.error || `Máy chủ trả lỗi ${error.response.status}.`)
        : 'Không kết nối được máy chủ. Vui lòng thử lại sau ít phút.';
      toast.error(msg, { id: toastId, duration: 6000 });
      if (/tên đăng nhập/i.test(msg)) setErrors((prev) => ({ ...prev, username: msg }));
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
    }
  };

  const plan = Number(formData.Contract_period);

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      // Hình nền phòng gym tối màu đồng bộ với toàn hệ thống
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.85)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")',
      backgroundColor: '#111',   // nền dự phòng khi ảnh chưa tải được
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      padding: '40px 20px',
      boxSizing: 'border-box',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif'
    }}>
      
      {/* Khối Form Đăng Ký Dark Mode */}
      <div style={{ 
        backgroundColor: 'rgba(20, 20, 20, 0.95)', 
        padding: '40px', 
        borderRadius: '15px', 
        boxShadow: '0 15px 35px rgba(0,0,0,0.6)', 
        width: '100%', 
        maxWidth: '560px',
        border: '1px solid #333',
        color: '#fff',
        boxSizing: 'border-box'
      }}>
        
        {/* Tiêu đề thương hiệu */}
        <h2 style={{ textAlign: 'center', color: '#ff3d00', marginBottom: '5px', fontSize: '26px', fontWeight: '900', letterSpacing: '2px' }}>
          POWER GYM<span style={{color: '#fff'}}>.AI</span>
        </h2>
        <p style={{ textAlign: 'center', color: '#aaa', marginBottom: '28px', fontSize: '14px' }}>
          Đăng ký hội viên — chọn gói tập và để lại thông tin, nhân viên sẽ liên hệ duyệt hồ sơ
        </p>
        
        <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* ---- Chọn gói tập (4 thẻ có giá) ---- */}
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend style={{ ...labelStyle, marginBottom: '8px' }}>Chọn gói tập</legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
              {PLANS_VN.map((p) => {
                const active = plan === p.months;
                const saving = savingPercent(p.months);
                return (
                  <label key={p.months} style={{
                    position: 'relative', display: 'block', padding: '12px 14px', borderRadius: '8px', cursor: 'pointer',
                    border: active ? '2px solid #ff3d00' : '1px solid #444',
                    backgroundColor: active ? 'rgba(255, 61, 0, 0.08)' : '#1c1c1c',
                  }}>
                    <input type="radio" name="Contract_period" value={p.months} checked={active}
                      onChange={() => setField('Contract_period', p.months)}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
                    {p.popular && (
                      <span style={{ position: 'absolute', top: '-9px', right: '10px', backgroundColor: '#ff3d00', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 8px', borderRadius: '10px' }}>
                        PHỔ BIẾN
                      </span>
                    )}
                    <div style={{ fontSize: '13px', color: '#bbb' }}>{p.name}</div>
                    <div style={{ fontSize: '17px', fontWeight: 'bold', color: active ? '#ff3d00' : '#fff', margin: '2px 0' }}>
                      {p.months} tháng · {formatVnd(PLAN_PRICES_VND[p.months])}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      {saving > 0 ? <>≈ {formatVnd(pricePerMonth(p.months))}/tháng · <span style={{ color: '#4caf50' }}>tiết kiệm {saving}%</span></> : 'Thanh toán theo tháng'}
                    </div>
                  </label>
                );
              })}
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#888' }}>Giá tham khảo. Thanh toán tại quầy khi nhân viên duyệt hồ sơ.</p>
          </fieldset>

          <div>
            <label htmlFor="cr-fullName" style={labelStyle}>Họ và tên</label>
            <input id="cr-fullName" type="text" name="fullName" value={formData.fullName} onChange={handleChange}
              autoComplete="name" placeholder="Nguyễn Văn A" aria-invalid={!!errors.fullName}
              style={errors.fullName ? errorInput : inputStyle} />
            {errors.fullName && <p style={hintStyle}>{errors.fullName}</p>}
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1.4 }}>
              <label htmlFor="cr-phone" style={labelStyle}>Số điện thoại</label>
              <input id="cr-phone" type="tel" name="actualPhoneNumber" value={formData.actualPhoneNumber} onChange={handleChange}
                autoComplete="tel" inputMode="tel" placeholder="0901234567" aria-invalid={!!errors.actualPhoneNumber}
                style={errors.actualPhoneNumber ? errorInput : inputStyle} />
              {errors.actualPhoneNumber && <p style={hintStyle}>{errors.actualPhoneNumber}</p>}
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="cr-age" style={labelStyle}>Tuổi</label>
              <input id="cr-age" type="number" name="Age" min={14} max={90} value={formData.Age} onChange={handleChange}
                inputMode="numeric" placeholder="Ví dụ: 25" aria-invalid={!!errors.Age}
                style={errors.Age ? errorInput : inputStyle} />
              {errors.Age && <p style={hintStyle}>{errors.Age}</p>}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="cr-username" style={labelStyle}>Tên đăng nhập</label>
              <input id="cr-username" type="text" name="username" value={formData.username} onChange={handleChange}
                autoComplete="username" placeholder="Ví dụ: nguyenvana" aria-invalid={!!errors.username}
                style={errors.username ? errorInput : inputStyle} />
              {errors.username && <p style={hintStyle}>{errors.username}</p>}
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="cr-password" style={labelStyle}>Mật khẩu</label>
              <input id="cr-password" type="password" name="password" value={formData.password} onChange={handleChange}
                autoComplete="new-password" placeholder="Ít nhất 6 ký tự" aria-invalid={!!errors.password}
                style={errors.password ? errorInput : inputStyle} />
              {errors.password && <p style={hintStyle}>{errors.password}</p>}
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={loading} 
            style={{ marginTop: '6px', padding: '14px', backgroundColor: '#ff3d00', color: 'white', border: 'none', borderRadius: '6px', cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.75 : 1, fontWeight: 'bold', fontSize: '16px', letterSpacing: '1px', transition: '0.3s', boxShadow: '0 4px 15px rgba(255, 61, 0, 0.3)' }}>
            {loading ? 'ĐANG XỬ LÝ...' : `ĐĂNG KÝ GÓI ${plan} THÁNG`}
          </button>

          {onLogin && (
            <p style={{ margin: 0, textAlign: 'center', color: '#aaa', fontSize: '14px' }}>
              Đã có tài khoản?{' '}
              <button type="button" onClick={onLogin}
                style={{ background: 'none', border: 'none', padding: 0, color: '#ff3d00', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
                Đăng nhập
              </button>
            </p>
          )}
          
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