import { useState } from 'react';
import { PLANS_VN, PLAN_PRICES_VND, formatVnd, pricePerMonth, savingPercent } from '../pricing';

/**
 * TRANG CHỦ CÔNG KHAI (Landing Page)
 * Props: onNavigate(view, options?)
 *   view: 'client_login' | 'login' | 'client_register' | 'predict'
 *   options: { plan } khi bấm "Chọn gói" ở Bảng giá -> trang Đăng ký chọn sẵn gói đó
 * Bảng giá lấy từ pricing.js (trùng giá trang Ưu đãi gia hạn).
 */
export default function LandingPage({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('hcm'); // 'hcm' hoặc 'hn'
  const [hoverPlan, setHoverPlan] = useState(null);  // thẻ giá đang rê chuột

  // Hàm cuộn mượt mà đến các phần trên trang
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };


  return (
    <div style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', backgroundColor: '#0f0f0f', color: '#fff', width: '100%', overflowX: 'hidden' }}>
      
      {/* 1. HEADER (Thanh điều hướng tương tác) */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 50px', backgroundColor: 'rgba(0,0,0,0.9)', position: 'fixed', top: 0, left: 0, width: '100%', zIndex: 1000, boxSizing: 'border-box', borderBottom: '1px solid #222' }}>
        <div style={{ fontSize: '24px', fontWeight: '900', letterSpacing: '2px', color: '#ff3d00', cursor: 'pointer' }} onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}>
          POWER GYM<span style={{ color: '#fff' }}>.AI</span>
        </div>
        <nav style={{ display: 'flex', gap: '35px', fontWeight: '600', fontSize: '15px' }}>
          <span style={{ cursor: 'pointer', transition: '0.2s' }} onClick={() => scrollToSection('hero')} onMouseEnter={(e)=>e.target.style.color='#ff3d00'} onMouseLeave={(e)=>e.target.style.color='#fff'}>TRANG CHỦ</span>
          <span style={{ cursor: 'pointer', transition: '0.2s' }} onClick={() => scrollToSection('services')} onMouseEnter={(e)=>e.target.style.color='#ff3d00'} onMouseLeave={(e)=>e.target.style.color='#fff'}>DỊCH VỤ</span>
          <span style={{ cursor: 'pointer', transition: '0.2s' }} onClick={() => scrollToSection('pricing')} onMouseEnter={(e)=>e.target.style.color='#ff3d00'} onMouseLeave={(e)=>e.target.style.color='#fff'}>BẢNG GIÁ GÓI TẬP</span>
          <span style={{ cursor: 'pointer', transition: '0.2s' }} onClick={() => scrollToSection('locations')} onMouseEnter={(e)=>e.target.style.color='#ff3d00'} onMouseLeave={(e)=>e.target.style.color='#fff'}>HỆ THỐNG PHÒNG TẬP</span>
        </nav>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={() => onNavigate('client_login')} // Hội viên đăng nhập cổng hội viên
            title="Dành cho hội viên đã có tài khoản"
            style={{ backgroundColor: '#ff3d00', color: '#fff', border: '1px solid #ff3d00', padding: '10px 22px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}>
            ĐĂNG NHẬP HỘI VIÊN
          </button>
          <button 
            onClick={() => onNavigate('login')} // Chủ phòng tập / nhân viên vào trang quản trị
            title="Dành cho chủ phòng tập và nhân viên"
            style={{ backgroundColor: 'transparent', color: '#ccc', border: '1px solid #555', padding: '10px 22px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}>
            QUẢN LÝ
          </button>
        </div>
      </header>

      {/* 2. HERO BANNER */}
      <section id="hero" style={{ 
        height: '100vh', 
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.85)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")', 
        backgroundColor: '#111', // nền dự phòng khi ảnh chưa tải được
        backgroundSize: 'cover', 
        backgroundPosition: 'center',
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        alignItems: 'center',
        textAlign: 'center',
        padding: '0 20px',
        boxSizing: 'border-box'
      }}>
        <h1 style={{ fontSize: '55px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '1px' }}>
          THAY ĐỔI THỂ HÌNH, THAY ĐỔI CUỘC SỐNG
        </h1>
        <p style={{ fontSize: '18px', marginBottom: '40px', maxWidth: '700px', lineHeight: '1.6', color: '#ccc' }}>
          Hệ thống phòng tập thông minh: trí tuệ nhân tạo (AI) theo dõi thói quen tập luyện và cảnh báo sớm khi hội viên
          có nguy cơ bỏ tập, để đội ngũ huấn luyện kịp thời đồng hành cùng bạn.
        </p>
        <button 
          onClick={() => onNavigate('client_register')} 
          style={{ backgroundColor: '#ff3d00', color: '#fff', border: 'none', padding: '16px 45px', fontSize: '18px', fontWeight: 'bold', borderRadius: '30px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255, 61, 0, 0.5)', transition: '0.3s' }}
          onMouseEnter={(e)=>e.target.style.transform='scale(1.05)'}
          onMouseLeave={(e)=>e.target.style.transform='scale(1)'}>
           ĐĂNG KÝ GÓI TẬP NGAY
        </button>
        <button
          onClick={() => onNavigate('predict')}
          style={{ marginTop: '18px', backgroundColor: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.45)', padding: '12px 32px', fontSize: '15px', fontWeight: 'bold', borderRadius: '30px', cursor: 'pointer', transition: '0.3s' }}
          onMouseEnter={(e)=>{e.currentTarget.style.borderColor='#ff3d00'; e.currentTarget.style.color='#ff3d00';}}
          onMouseLeave={(e)=>{e.currentTarget.style.borderColor='rgba(255,255,255,0.45)'; e.currentTarget.style.color='#fff';}}>
          DÙNG THỬ AI DỰ BÁO RỜI BỎ
        </button>
        <p style={{ marginTop: '12px', fontSize: '13px', color: '#999', maxWidth: '520px', lineHeight: 1.5 }}>
          Dành cho chủ phòng tập: nhập số liệu một hội viên để xem AI dự báo. Không cần đăng nhập, dữ liệu không được lưu lại.
        </p>
      </section>

      {/* 3. DỊCH VỤ NỔI BẬT (Interactive Cards) */}
      <section id="services" style={{ padding: '100px 50px', backgroundColor: '#141414', textAlign: 'center' }}>
        <h2 style={{ fontSize: '38px', fontWeight: '900', marginBottom: '15px', textTransform: 'uppercase' }}>DỊCH VỤ ĐẲNG CẤP</h2>
        <p style={{ color: '#888', marginBottom: '60px', fontSize: '16px' }}>Nhấp chọn các dịch vụ để trải nghiệm không gian tập luyện chuẩn quốc tế</p>
        
        <div style={{ display: 'flex', gap: '30px', justifyContent: 'center', flexWrap: 'wrap' }}>
          
          {/* Card 1 */}
          <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', textAlign: 'left', transition: '0.3s' }}
               onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-10px)'; e.currentTarget.style.borderColor='#ff3d00'}}
               onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.borderColor='#333'}}>
            <img src="https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?q=80&w=1000&auto=format&fit=crop" alt="Gym" style={{ width: '100%', height: '250px', objectFit: 'cover' }} />
            <div style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>GYM & FITNESS</h3>
              <p style={{ color: '#aaa', marginBottom: '20px', lineHeight: '1.5' }}>Trang thiết bị nhập khẩu 100% từ các thương hiệu hàng đầu thế giới, không gian rộng rãi.</p>
              <button onClick={() => onNavigate('client_register')} style={{ background: 'none', border: 'none', color: '#ff3d00', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>Xem chi tiết & Đăng ký →</button>
            </div>
          </div>

          {/* Card 2 */}
          <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', textAlign: 'left', transition: '0.3s' }}
               onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-10px)'; e.currentTarget.style.borderColor='#ff3d00'}}
               onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.borderColor='#333'}}>
            <img src="https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?q=80&w=1000&auto=format&fit=crop" alt="Yoga" style={{ width: '100%', height: '250px', objectFit: 'cover' }} />
            <div style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>YOGA & THIỀN ĐỊNH</h3>
              <p style={{ color: '#aaa', marginBottom: '20px', lineHeight: '1.5' }}>Phòng tập yên tĩnh, ánh sáng tự nhiên giúp phục hồi năng lượng và cân bằng tâm trí.</p>
              <button onClick={() => onNavigate('client_register')} style={{ background: 'none', border: 'none', color: '#ff3d00', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>Xem chi tiết & Đăng ký →</button>
            </div>
          </div>

          {/* Card 3 */}
          <div style={{ flex: 1, minWidth: '300px', backgroundColor: '#1e1e1e', borderRadius: '12px', overflow: 'hidden', border: '1px solid #333', textAlign: 'left', transition: '0.3s' }}
               onMouseEnter={(e)=>{e.currentTarget.style.transform='translateY(-10px)'; e.currentTarget.style.borderColor='#ff3d00'}}
               onMouseLeave={(e)=>{e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.borderColor='#333'}}>
            <img src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=1000&auto=format&fit=crop" alt="PT" style={{ width: '100%', height: '250px', objectFit: 'cover' }} />
            <div style={{ padding: '30px' }}>
              <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', color: '#fff' }}>HUẤN LUYỆN VIÊN (PT)</h3>
              <p style={{ color: '#aaa', marginBottom: '20px', lineHeight: '1.5' }}>Lộ trình cá nhân hóa được hỗ trợ phân tích thông số cơ thể bằng công nghệ AI.</p>
              <button onClick={() => onNavigate('client_register')} style={{ background: 'none', border: 'none', color: '#ff3d00', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' }}>Xem chi tiết & Đăng ký →</button>
            </div>
          </div>

        </div>
      </section>

      {/* 4. BẢNG GIÁ (4 gói, có giá — bấm "Chọn gói" -> trang Đăng ký chọn sẵn gói đó) */}
      <section id="pricing" style={{ padding: '100px 50px', backgroundColor: '#0f0f0f', textAlign: 'center' }}>
        <h2 style={{ fontSize: '38px', fontWeight: '900', marginBottom: '15px', textTransform: 'uppercase' }}>BẢNG GIÁ HỘI VIÊN</h2>
        <p style={{ color: '#888', marginBottom: '50px', fontSize: '16px' }}>Lựa chọn gói tập phù hợp nhất với nhu cầu của bạn. Gói càng dài, giá mỗi tháng càng tốt.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px', maxWidth: '1300px', margin: '0 auto' }}>
          {PLANS_VN.map((p) => {
            const highlight = hoverPlan === null ? !!p.popular : hoverPlan === p.months;
            const saving = savingPercent(p.months);
            return (
              <div key={p.months}
                onMouseEnter={() => setHoverPlan(p.months)}
                onMouseLeave={() => setHoverPlan(null)}
                style={{
                  backgroundColor: '#1a1a1a', borderRadius: '15px', padding: '40px 26px 30px', position: 'relative', transition: '0.3s',
                  border: highlight ? '2px solid #ff3d00' : '2px solid #333', display: 'flex', flexDirection: 'column',
                }}>
                {p.popular && (
                  <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ff3d00', color: '#fff', padding: '4px 15px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>PHỔ BIẾN NHẤT</div>
                )}
                <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 6px', textTransform: 'uppercase' }}>{p.name}</h3>
                <div style={{ color: '#aaa', fontSize: '15px', marginBottom: '14px' }}>{p.months} tháng</div>
                <div style={{ fontSize: '34px', fontWeight: '900', color: '#ff3d00', lineHeight: 1.1 }}>{formatVnd(PLAN_PRICES_VND[p.months])}</div>
                <div style={{ fontSize: '14px', color: '#bbb', margin: '8px 0 4px', minHeight: '20px' }}>
                  {saving > 0 ? <>≈ {formatVnd(pricePerMonth(p.months))}/tháng</> : 'Thanh toán theo tháng'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#4caf50', minHeight: '18px', marginBottom: '16px' }}>
                  {saving > 0 ? `Tiết kiệm ${saving}% so với gói 1 tháng` : ''}
                </div>
                <p style={{ color: '#aaa', margin: '0 0 26px', lineHeight: 1.5, flexGrow: 1 }}>{p.note}</p>
                <button onClick={() => onNavigate('client_register', { plan: p.months })}
                  style={{ width: '100%', padding: '12px', backgroundColor: highlight ? '#ff3d00' : '#333', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: '0.3s' }}>
                  Chọn gói {p.months} tháng
                </button>
              </div>
            );
          })}
        </div>
        <p style={{ color: '#666', marginTop: '28px', fontSize: '13px' }}>Giá tham khảo phân khúc tầm trung, đã gồm toàn bộ khu tập và lớp nhóm. Thanh toán tại quầy khi nhân viên duyệt hồ sơ.</p>
      </section>

      {/* 5. HỆ THỐNG PHÒNG TẬP (Interactive Tabs) */}
      <section id="locations" style={{ padding: '100px 50px', backgroundColor: '#141414', textAlign: 'center' }}>
        <h2 style={{ fontSize: '38px', fontWeight: '900', marginBottom: '15px', textTransform: 'uppercase' }}>HỆ THỐNG CLB POWER GYM</h2>
        <p style={{ color: '#888', marginBottom: '40px', fontSize: '16px' }}>Hơn 50 câu lạc bộ tiêu chuẩn 5 sao trên toàn quốc</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginBottom: '40px' }}>
          <button 
            onClick={() => setActiveTab('hcm')}
            style={{ padding: '10px 25px', backgroundColor: activeTab === 'hcm' ? '#ff3d00' : '#222', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
            TP. HỒ CHÍ MINH
          </button>
          <button 
            onClick={() => setActiveTab('hn')}
            style={{ padding: '10px 25px', backgroundColor: activeTab === 'hn' ? '#ff3d00' : '#222', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}>
            HÀ NỘI
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap', maxWidth: '1000px', margin: '0 auto' }}>
          {activeTab === 'hcm' ? (
            <>
              <div style={{ flex: 1, minWidth: '280px', backgroundColor: '#1e1e1e', padding: '25px', borderRadius: '10px', textAlign: 'left', border: '1px solid #333' }}>
                <h4 style={{ fontSize: '18px', color: '#ff3d00', marginBottom: '10px' }}>Power Gym Quận 1</h4>
                <p style={{ color: '#aaa', fontSize: '14px' }}>Tòa nhà Saigon Centre, 65 Lê Lợi, Bến Nghé, Q.1</p>
              </div>
              <div style={{ flex: 1, minWidth: '280px', backgroundColor: '#1e1e1e', padding: '25px', borderRadius: '10px', textAlign: 'left', border: '1px solid #333' }}>
                <h4 style={{ fontSize: '18px', color: '#ff3d00', marginBottom: '10px' }}>Power Gym Quận 7</h4>
                <p style={{ color: '#aaa', fontSize: '14px' }}>Crescent Mall, 101 Tôn Dật Tượng, Tân Phú, Q.7</p>
              </div>
            </>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: '280px', backgroundColor: '#1e1e1e', padding: '25px', borderRadius: '10px', textAlign: 'left', border: '1px solid #333' }}>
                <h4 style={{ fontSize: '18px', color: '#ff3d00', marginBottom: '10px' }}>Power Gym Hoàn Kiếm</h4>
                <p style={{ color: '#aaa', fontSize: '14px' }}>Tòa nhà Vincom Center, 191 Bà Triệu, Hai Bà Trưng, Hà Nội</p>
              </div>
              <div style={{ flex: 1, minWidth: '280px', backgroundColor: '#1e1e1e', padding: '25px', borderRadius: '10px', textAlign: 'left', border: '1px solid #333' }}>
                <h4 style={{ fontSize: '18px', color: '#ff3d00', marginBottom: '10px' }}>Power Gym Cầu Giấy</h4>
                <p style={{ color: '#aaa', fontSize: '14px' }}>Indochina Plaza Hanoi, 241 Xuân Thủy, Cầu Giấy, Hà Nội</p>
              </div>
            </>
          )}
        </div>
      </section>

      {/* 6. FOOTER */}
      <footer style={{ backgroundColor: '#0a0a0a', color: '#fff', padding: '50px', textAlign: 'center', borderTop: '1px solid #222' }}>
        <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#ff3d00', marginBottom: '10px' }}>POWER GYM.AI</h2>
        <p style={{ color: '#777', fontSize: '14px' }}>Hệ thống quản lý phòng gym tích hợp AI dự báo rủi ro rời bỏ hội viên.</p>
        <p style={{ color: '#555', fontSize: '13px', marginTop: '20px' }}>© 2026 Power Gym. All rights reserved.</p>
      </footer>

    </div>
  );
}