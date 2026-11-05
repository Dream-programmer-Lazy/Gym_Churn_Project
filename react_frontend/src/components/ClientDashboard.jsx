import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ClientDashboard({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});

  const fetchMyProfile = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/customers');
      const myData = response.data.find(cus => cus.username === user.username || cus.fullName === user.fullName);
      if (myData) {
        setProfile(myData);
        setFormData(myData);
      }
    } catch (error) {
      console.error("Lỗi tải thông tin cá nhân:", error);
    } finally {
      setLoading(false);
    }
  };

  // Gọi API lấy dữ liệu thông qua cơ chế an toàn chuẩn React 19
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/customers');
        const myData = response.data.find(cus => cus.username === user.username || cus.fullName === user.fullName);
        if (isMounted && myData) {
          setProfile(myData);
          setFormData(myData);
        }
      } catch (error) {
        console.error("Lỗi tải thông tin cá nhân:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    loadData();
    return () => { isMounted = false; };
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: name === 'Age' || name === 'Contract_period' || name === 'Avg_class_frequency_current_month' ? Number(value) : value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`http://localhost:3001/api/customers/${profile._id}`, formData);
      alert('Cập nhật thông tin và hệ thống AI đã phân tích lại rủi ro thành công!');
      setIsEditing(false);
      fetchMyProfile();
    } catch (error) {
      console.error("Lỗi cập nhật:", error);
      alert('Lỗi khi cập nhật thông tin!');
    }
  };

  const handleRequestChangePackage = async (months) => {
    if (window.confirm(`Xác nhận đổi sang gói tập ${months} Tháng? Yêu cầu này sẽ được gửi về bộ phận quản trị.`)) {
      try {
        const updated = { ...profile, Contract_period: months, status: 'Chờ duyệt' };
        await axios.put(`http://localhost:3001/api/customers/${profile._id}`, updated);
        alert('Đã gửi yêu cầu đổi gói tập về cho Admin phê duyệt!');
        fetchMyProfile();
      } catch (error) {
        console.error("Lỗi đổi gói tập:", error);
        alert('Lỗi khi gửi yêu cầu!');
      }
    }
  };

  if (loading) return <p style={{textAlign: 'center', color: '#fff', marginTop: '50px'}}>Đang tải dữ liệu hội viên...</p>;

  const currentMonthSessions = Math.round((profile?.Avg_class_frequency_current_month || 0) * 4);
  const totalSessionsEstimated = Math.round((profile?.Avg_class_frequency_total || 0) * 4 * (profile?.Lifetime || 1));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0f0f0f', color: '#fff', fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', paddingBottom: '50px' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 50px', backgroundColor: '#141414', borderBottom: '1px solid #333' }}>
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
      {/* NẾU CÓ THÔNG BÁO TỪ ADMIN (NHẮC NHỞ TẬP LUYỆN) */}
      {profile?.admin_message && (
        <div style={{ maxWidth: '1100px', margin: '20px auto 0 auto', padding: '0 20px' }}>
          <div style={{ backgroundColor: 'rgba(229, 57, 53, 0.1)', border: '1px solid #ef4444', padding: '15px 20px', borderRadius: '8px', color: '#ffb3b3', display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ fontSize: '24px' }}>🔔</span>
            <div>
              <strong style={{ display: 'block', color: '#ef4444', marginBottom: '5px' }}>THÔNG BÁO TỪ QUẢN LÝ PHÒNG TẬP:</strong>
              {profile.admin_message}
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: '1100px', margin: '40px auto', padding: '0 20px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          <div style={{ backgroundColor: '#1a1a1a', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
            <span style={{ color: '#888', fontSize: '13px', textTransform: 'uppercase' }}>Trạng thái tài khoản</span>
            <h3 style={{ color: profile?.status === 'Đang hoạt động' ? '#4caf50' : '#ff9800', margin: '8px 0 0 0' }}>{profile?.status}</h3>
          </div>
          <div style={{ backgroundColor: '#1a1a1a', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
            <span style={{ color: '#888', fontSize: '13px', textTransform: 'uppercase' }}>Thời gian đã tập</span>
            <h3 style={{ margin: '8px 0 0 0', color: '#1e88e5' }}>{profile?.Lifetime || 0} Tháng ({totalSessionsEstimated} buổi tổng)</h3>
          </div>
          <div style={{ backgroundColor: '#1a1a1a', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
            <span style={{ color: '#888', fontSize: '13px', textTransform: 'uppercase' }}>Tháng này đã tập</span>
            <h3 style={{ margin: '8px 0 0 0', color: '#ff9800' }}>~ {currentMonthSessions} buổi / tháng</h3>
          </div>
          <div style={{ backgroundColor: '#1a1a1a', padding: '25px', borderRadius: '12px', border: '1px solid #333' }}>
            <span style={{ color: '#888', fontSize: '13px', textTransform: 'uppercase' }}>Đánh giá rủi ro (AI)</span>
            <h3 style={{ color: profile?.prediction?.risk_level === 'Cao' ? '#e53935' : '#4caf50', margin: '8px 0 0 0' }}>
              {profile?.prediction?.risk_level || 'Chưa đánh giá'} ({profile?.prediction?.probability_percent || 0}%)
            </h3>
          </div>
        </div>

        <div style={{ backgroundColor: '#1a1a1a', padding: '35px', borderRadius: '15px', border: '1px solid #333', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h3 style={{ margin: 0, fontSize: '20px', color: '#ff3d00' }}>Thông Tin Hội Viên & Thói quen tập luyện</h3>
            {!isEditing && (
              <button onClick={() => setIsEditing(true)} style={{ padding: '8px 20px', backgroundColor: '#1e88e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                Cập nhật thông số tập
              </button>
            )}
          </div>

          {!isEditing ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', fontSize: '15px' }}>
              <div><strong style={{color: '#888'}}>Họ và tên:</strong> <p style={{margin: '5px 0 0 0'}}>{profile?.fullName}</p></div>
              <div><strong style={{color: '#888'}}>Số điện thoại:</strong> <p style={{margin: '5px 0 0 0'}}>{profile?.actualPhoneNumber || 'Chưa cập nhật'}</p></div>
              <div><strong style={{color: '#888'}}>Gói tập hiện tại:</strong> <p style={{margin: '5px 0 0 0'}}>{profile?.Contract_period} Tháng</p></div>
              <div><strong style={{color: '#888'}}>Tần suất tập tháng qua:</strong> <p style={{margin: '5px 0 0 0'}}>{profile?.Avg_class_frequency_current_month || 0} buổi/tuần</p></div>
            </div>
          ) : (
            <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>Họ và tên</label>
                <input type="text" name="fullName" value={formData.fullName || ''} onChange={handleChange} style={{ width: '100%', padding: '10px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px' }} required />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>Số điện thoại</label>
                <input type="text" name="actualPhoneNumber" value={formData.actualPhoneNumber || ''} onChange={handleChange} style={{ width: '100%', padding: '10px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '5px', color: '#aaa' }}>Tần suất tập tháng qua (Số buổi/tuần - Dùng để AI tính rủi ro)</label>
                <input type="number" step="0.1" name="Avg_class_frequency_current_month" value={formData.Avg_class_frequency_current_month || 0} onChange={handleChange} style={{ width: '100%', padding: '10px', backgroundColor: '#222', border: '1px solid #444', color: '#fff', borderRadius: '6px' }} required />
              </div>

              <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '12px', backgroundColor: '#ff3d00', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Lưu & Gửi AI phân tích lại
                </button>
                <button type="button" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                  Hủy
                </button>
              </div>
            </form>
          )}
        </div>

        <div style={{ backgroundColor: '#1a1a1a', padding: '35px', borderRadius: '15px', border: '1px solid #333' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '20px', color: '#ff3d00' }}>Khám Phá Các Gói Tập Khác</h3>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            
            <div style={{ flex: 1, minWidth: '250px', backgroundColor: '#222', padding: '20px', borderRadius: '10px', border: profile?.Contract_period === 1 ? '2px solid #ff3d00' : '1px solid #444' }}>
              <h4>Gói Cơ Bản (1 Tháng)</h4>
              <p style={{ color: '#aaa', fontSize: '13px', margin: '10px 0 20px 0' }}>Trải nghiệm ngắn hạn, tự do tập luyện.</p>
              <button onClick={() => handleRequestChangePackage(1)} style={{ width: '100%', padding: '10px', backgroundColor: '#ff3d00', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {profile?.Contract_period === 1 ? 'Gói Hiện Tại' : 'Đăng Ký Đổi Gói'}
              </button>
            </div>

            <div style={{ flex: 1, minWidth: '250px', backgroundColor: '#222', padding: '20px', borderRadius: '10px', border: profile?.Contract_period === 6 ? '2px solid #ff3d00' : '1px solid #444' }}>
              <h4>Gói Tiết Kiệm (6 Tháng)</h4>
              <p style={{ color: '#aaa', fontSize: '13px', margin: '10px 0 20px 0' }}>Lộ trình chuẩn hóa thể hình.</p>
              <button onClick={() => handleRequestChangePackage(6)} style={{ width: '100%', padding: '10px', backgroundColor: '#ff3d00', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {profile?.Contract_period === 6 ? 'Gói Hiện Tại' : 'Đăng Ký Đổi Gói'}
              </button>
            </div>

            <div style={{ flex: 1, minWidth: '250px', backgroundColor: '#222', padding: '20px', borderRadius: '10px', border: profile?.Contract_period === 12 ? '2px solid #ff3d00' : '1px solid #444' }}>
              <h4>Gói VIP (12 Tháng)</h4>
              <p style={{ color: '#aaa', fontSize: '13px', margin: '10px 0 20px 0' }}>Đặc quyền phân tích AI trọn gói.</p>
              <button onClick={() => handleRequestChangePackage(12)} style={{ width: '100%', padding: '10px', backgroundColor: '#ff3d00', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                {profile?.Contract_period === 12 ? 'Gói Hiện Tại' : 'Đăng Ký Đổi Gói'}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}