import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { API_URL } from '../config';

// Gói tập theo thị trường (khớp với backend routes/clientAuth.js)
const PLAN_OPTIONS = {
  vn: [
    { months: 1, title: 'Gói Cơ Bản (1 Tháng)', text: 'Trải nghiệm ngắn hạn, tự do tập luyện.' },
    { months: 3, title: 'Gói Khởi Động (3 Tháng)', text: 'Đủ thời gian để hình thành thói quen.' },
    { months: 6, title: 'Gói Tiết Kiệm (6 Tháng)', text: 'Lộ trình chuẩn hóa thể hình.' },
    { months: 12, title: 'Gói VIP (12 Tháng)', text: 'Đặc quyền phân tích AI trọn gói.' },
  ],
  global: [
    { months: 1, title: 'Gói Cơ Bản (1 Tháng)', text: 'Trải nghiệm ngắn hạn, tự do tập luyện.' },
    { months: 6, title: 'Gói Tiết Kiệm (6 Tháng)', text: 'Lộ trình chuẩn hóa thể hình.' },
    { months: 12, title: 'Gói VIP (12 Tháng)', text: 'Đặc quyền phân tích AI trọn gói.' },
  ],
};

const RISK_COLOR = { 'Cao': '#e53935', 'Trung bình': '#ff9800', 'Thấp': '#4caf50' };

const inputStyle = { width: '100%', padding: '10px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px', boxSizing: 'border-box' };
const cardStyle = { backgroundColor: '#1a1a1a', padding: '25px', borderRadius: '12px', border: '1px solid #333' };
const labelStyle = { color: '#888', fontSize: '13px', textTransform: 'uppercase' };

// Lỗi do hết phiên đã được App.jsx báo và chuyển về màn hình đăng nhập -> không báo trùng
const errorText = (error, fallback) => error.response?.data?.error || fallback;

export default function ClientDashboard({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ fullName: '', actualPhoneNumber: '' });
  const [saving, setSaving] = useState(false);

  // Chỉ tải hồ sơ CỦA CHÍNH MÌNH (server lấy id từ token). isActive() = component còn hiển thị không.
  const loadProfile = useCallback(async (isActive = () => true) => {
    try {
      const response = await axios.get(`${API_URL}/client/me`);
      if (!isActive()) return;
      setProfile(response.data);
      setLoadError('');
    } catch (error) {
      console.error('Lỗi tải thông tin cá nhân:', error);
      if (isActive() && !error.sessionExpired) {
        setLoadError(errorText(error, 'Không kết nối được máy chủ Node (cổng 3001).'));
      }
    } finally {
      if (isActive()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => { await loadProfile(() => isMounted); };
    load();
    return () => { isMounted = false; };
  }, [loadProfile, user]);

  const retryLoad = () => {
    setLoading(true);
    loadProfile();
  };

  const startEdit = () => {
    setFormData({ fullName: profile?.fullName || '', actualPhoneNumber: profile?.actualPhoneNumber || '' });
    setIsEditing(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await axios.put(`${API_URL}/client/me`, formData);
      setProfile(res.data.customer);
      setIsEditing(false);
      toast.success(res.data.message || 'Đã cập nhật thông tin cá nhân!');
    } catch (error) {
      console.error('Lỗi cập nhật:', error);
      if (!error.sessionExpired) toast.error(errorText(error, 'Lỗi khi cập nhật thông tin!'));
    } finally {
      setSaving(false);
    }
  };

  const handleRequestChangePackage = async (months) => {
    if (!window.confirm(`Xác nhận đổi sang gói tập ${months} tháng? Yêu cầu này sẽ được gửi về bộ phận quản trị để duyệt.`)) return;
    try {
      const res = await axios.post(`${API_URL}/client/me/change-plan`, { months });
      setProfile(res.data.customer);
      toast.success(res.data.message || 'Đã gửi yêu cầu đổi gói tập!');
    } catch (error) {
      console.error('Lỗi đổi gói tập:', error);
      if (!error.sessionExpired) toast.error(errorText(error, 'Lỗi khi gửi yêu cầu!'));
    }
  };

  if (loading) return <p style={{ textAlign: 'center', color: '#fff', marginTop: '50px' }}>Đang tải dữ liệu hội viên...</p>;

  const isPending = profile?.status === 'Chờ duyệt';
  const riskLevel = profile?.prediction?.risk_level;
  const hasPrediction = !isPending && riskLevel && riskLevel !== 'Chưa dự báo';
  const plans = PLAN_OPTIONS[profile?.region] || PLAN_OPTIONS.vn;
  const currentMonthSessions = Math.round((profile?.Avg_class_frequency_current_month || 0) * 4);
  const totalSessionsEstimated = Math.round((profile?.Avg_class_frequency_total || 0) * 4 * (profile?.Lifetime || 1));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', paddingBottom: '50px' }}>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '20px 50px', backgroundColor: '#141414', borderBottom: '1px solid #333' }}>
        <div style={{ fontSize: '22px', fontWeight: '900', letterSpacing: '2px', color: '#ff3d00' }}>
          POWER GYM<span style={{ color: '#fff' }}>.AI</span> (CỔNG HỘI VIÊN)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span>Xin chào, <strong>{profile?.fullName || user.fullName}</strong></span>
          <button onClick={onLogout} style={{ padding: '8px 20px', backgroundColor: '#e53935', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* KHÔNG TẢI ĐƯỢC HỒ SƠ */}
      {loadError && (
        <div style={{ maxWidth: '1100px', margin: '20px auto 0 auto', padding: '0 20px' }}>
          <div style={{ backgroundColor: 'rgba(229, 57, 53, 0.1)', border: '1px solid #ef4444', padding: '15px 20px', borderRadius: '8px', color: '#ffb3b3', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '15px' }}>
            <span>Không tải được hồ sơ: {loadError}</span>
            <button onClick={retryLoad} style={{ padding: '8px 16px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
              Thử lại
            </button>
          </div>
        </div>
      )}

      {/* NẾU CÓ THÔNG BÁO TỪ ADMIN (NHẮC NHỞ TẬP LUYỆN) */}
      {profile?.admin_message && (
        <div style={{ maxWidth: '1100px', margin: '20px auto 0 auto', padding: '0 20px' }}>
          <div style={{ backgroundColor: 'rgba(229, 57, 53, 0.1)', border: '1px solid #ef4444', padding: '15px 20px', borderRadius: '8px', color: '#ffb3b3', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '24px' }} aria-hidden>🔔</span>
            <div>
              <strong style={{ display: 'block', color: '#ef4444', marginBottom: '5px' }}>THÔNG BÁO TỪ QUẢN LÝ PHÒNG TẬP:</strong>
              {profile.admin_message}
            </div>
          </div>
        </div>
      )}

      {profile && (
        <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={cardStyle}>
              <span style={labelStyle}>Trạng thái tài khoản</span>
              <h3 style={{ color: profile.status === 'Đang hoạt động' ? '#4caf50' : '#ff9800', margin: '8px 0 0 0' }}>{profile.status}</h3>
            </div>
            <div style={cardStyle}>
              <span style={labelStyle}>Thời gian đã tập</span>
              <h3 style={{ margin: '8px 0 0 0', color: '#1e88e5' }}>{profile.Lifetime || 0} Tháng ({totalSessionsEstimated} buổi tổng)</h3>
            </div>
            <div style={cardStyle}>
              <span style={labelStyle}>Tháng này đã tập</span>
              <h3 style={{ margin: '8px 0 0 0', color: '#ff9800' }}>~ {currentMonthSessions} buổi / tháng</h3>
            </div>
            <div style={cardStyle}>
              <span style={labelStyle}>Đánh giá rủi ro (AI)</span>
              <h3 style={{ color: hasPrediction ? (RISK_COLOR[riskLevel] || '#4caf50') : '#888', margin: '8px 0 0 0' }}>
                {hasPrediction ? `${riskLevel} (${profile.prediction?.probability_percent ?? 0}%)` : 'Chưa đánh giá'}
              </h3>
            </div>
          </div>

          <div style={{ backgroundColor: '#1a1a1a', padding: '35px', borderRadius: '15px', border: '1px solid #333', marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', gap: '12px', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '20px', color: '#ff3d00' }}>Thông Tin Hội Viên & Thói quen tập luyện</h3>
              {!isEditing && (
                <button onClick={startEdit} style={{ padding: '8px 20px', backgroundColor: '#1e88e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Sửa thông tin cá nhân
                </button>
              )}
            </div>

            {!isEditing ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', fontSize: '15px' }}>
                <div><strong style={{ color: '#888' }}>Họ và tên:</strong> <p style={{ margin: '5px 0 0 0' }}>{profile.fullName}</p></div>
                <div><strong style={{ color: '#888' }}>Số điện thoại:</strong> <p style={{ margin: '5px 0 0 0' }}>{profile.actualPhoneNumber || 'Chưa cập nhật'}</p></div>
                <div><strong style={{ color: '#888' }}>Gói tập hiện tại:</strong> <p style={{ margin: '5px 0 0 0' }}>{profile.Contract_period} Tháng</p></div>
                <div><strong style={{ color: '#888' }}>Tần suất tập tháng qua:</strong> <p style={{ margin: '5px 0 0 0' }}>{profile.Avg_class_frequency_current_month || 0} buổi/tuần</p></div>
              </div>
            ) : (
              <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <label htmlFor="cd-name" style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>Họ và tên</label>
                  <input id="cd-name" type="text" name="fullName" value={formData.fullName} onChange={handleChange} style={inputStyle} required />
                </div>
                <div>
                  <label htmlFor="cd-phone" style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>Số điện thoại</label>
                  <input id="cd-phone" type="text" name="actualPhoneNumber" value={formData.actualPhoneNumber} onChange={handleChange} style={inputStyle} />
                </div>
                <p style={{ margin: 0, color: '#888', fontSize: '13px' }}>
                  Số buổi tập do phòng tập ghi nhận; nếu thấy chưa đúng, vui lòng báo quầy lễ tân.
                </p>

                <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                  <button type="submit" disabled={saving} style={{ flex: 1, padding: '12px', backgroundColor: '#ff3d00', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                  <button type="button" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Hủy
                  </button>
                </div>
              </form>
            )}
          </div>

          <div style={{ backgroundColor: '#1a1a1a', padding: '35px', borderRadius: '15px', border: '1px solid #333' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '20px', color: '#ff3d00' }}>Khám Phá Các Gói Tập Khác</h3>
            {isPending && (
              <p style={{ margin: '0 0 20px 0', color: '#ff9800', fontSize: '14px' }}>
                Hồ sơ đang chờ quản trị duyệt. Bạn vẫn có thể đổi lựa chọn gói trước khi được duyệt.
              </p>
            )}
            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: isPending ? 0 : '20px' }}>
              {plans.map((p) => {
                const isCurrent = profile.Contract_period === p.months;
                return (
                  <div key={p.months} style={{ flex: 1, minWidth: '220px', backgroundColor: '#222', padding: '20px', borderRadius: '10px', border: isCurrent ? '2px solid #ff3d00' : '1px solid #444' }}>
                    <h4 style={{ margin: 0 }}>{p.title}</h4>
                    <p style={{ color: '#aaa', fontSize: '13px', margin: '10px 0 20px 0' }}>{p.text}</p>
                    <button
                      onClick={() => handleRequestChangePackage(p.months)}
                      disabled={isCurrent}
                      style={{ width: '100%', padding: '10px', backgroundColor: isCurrent ? '#444' : '#ff3d00', color: '#fff', border: 'none', borderRadius: '6px', cursor: isCurrent ? 'default' : 'pointer', fontWeight: 'bold' }}>
                      {isCurrent ? 'Gói Hiện Tại' : 'Đăng Ký Đổi Gói'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}