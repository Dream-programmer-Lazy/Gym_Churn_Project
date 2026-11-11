import { useState } from 'react';

export default function LandingPage({ onNavigate }) {
  // State quản lý gói tập được chọn khi khách hàng click
  const [selectedPackage, setSelectedPackage] = useState(6);
  const [activeTab, setActiveTab] = useState('hcm'); // 'hcm' hoặc 'hn'

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
            onClick={() => onNavigate('client_login')} // Chuyển đến trang đăng nhập khách hàng
            style={{ backgroundColor: 'transparent', color: '#ff3d00', border: '1px solid #ff3d00', padding: '10px 20px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}>
            ĐĂNG NHẬP (KHÁCH HÀNG)
          </button>
          <button 
            onClick={() => onNavigate('login')} 
            style={{ backgroundColor: '#ff3d00', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '30px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s' }}>
            ĐĂNG NHẬP (ADMIN)
          </button>
        </div>
      </header>

      {/* 2. HERO BANNER */}
      <section id="hero" style={{ 
        height: '100vh', 
        backgroundImage: 'linear-gradient(rgba(0,0,0,0.65), rgba(0,0,0,0.85)), url("https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=2070&auto=format&fit=crop")', 
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
          Hệ thống phòng tập thông minh tích hợp trí tuệ nhân tạo (AI) phân tích lộ trình tập luyện và dự báo sức khỏe cá nhân.
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

      {/* 4. BẢNG CHỌN GÓI TẬP THỰC TẾ (Clickable Pricing Table) */}
      <section id="pricing" style={{ padding: '100px 50px', backgroundColor: '#0f0f0f', textAlign: 'center' }}>
        <h2 style={{ fontSize: '38px', fontWeight: '900', marginBottom: '15px', textTransform: 'uppercase' }}>BẢNG GIÁ HỘI VIÊN</h2>
        <p style={{ color: '#888', marginBottom: '40px', fontSize: '16px' }}>Lựa chọn gói tập phù hợp nhất với nhu cầu của bạn</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '30px', flexWrap: 'wrap' }}>
          
          {/* Gói 1 Tháng */}
          <div 
            onClick={() => setSelectedPackage(1)}
            style={{ 
              flex: 1, minWidth: '280px', maxWidth: '350px', backgroundColor: '#1a1a1a', borderRadius: '15px', padding: '40px 30px', cursor: 'pointer',
              border: selectedPackage === 1 ? '2px solid #ff3d00' : '2px solid #333', position: 'relative', transition: '0.3s'
            }}>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px' }}>GÓI CƠ BẢN</h3>
            <div style={{ fontSize: '36px', fontWeight: '900', color: '#ff3d00', marginBottom: '20px' }}>1 Tháng</div>
            <p style={{ color: '#aaa', marginBottom: '30px' }}>Phù hợp cho người muốn trải nghiệm ngắn hạn toàn bộ dịch vụ.</p>
            <button onClick={() => onNavigate('client_register')} style={{ width: '100%', padding: '12px', backgroundColor: selectedPackage === 1 ? '#ff3d00' : '#333', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Chọn Gói Này
            </button>
          </div>

          {/* Gói 6 Tháng */}
          <div 
            onClick={() => setSelectedPackage(6)}
            style={{ 
              flex: 1, minWidth: '280px', maxWidth: '350px', backgroundColor: '#1a1a1a', borderRadius: '15px', padding: '40px 30px', cursor: 'pointer',
              border: selectedPackage === 6 ? '2px solid #ff3d00' : '2px solid #333', position: 'relative', transition: '0.3s'
            }}>
            <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#ff3d00', color: '#fff', padding: '4px 15px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold' }}>PHỔ BIẾN NHẤT</div>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px' }}>GÓI TIẾT KIỆM</h3>
            <div style={{ fontSize: '36px', fontWeight: '900', color: '#ff3d00', marginBottom: '20px' }}>6 Tháng</div>
            <p style={{ color: '#aaa', marginBottom: '30px' }}>Lộ trình chuẩn hóa giúp bạn thấy rõ sự thay đổi của cơ thể.</p>
            <button onClick={() => onNavigate('client_register')} style={{ width: '100%', padding: '12px', backgroundColor: selectedPackage === 6 ? '#ff3d00' : '#333', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Chọn Gói Này
            </button>
          </div>

          {/* Gói 12 Tháng */}
          <div 
            onClick={() => setSelectedPackage(12)}
            style={{ 
              flex: 1, minWidth: '280px', maxWidth: '350px', backgroundColor: '#1a1a1a', borderRadius: '15px', padding: '40px 30px', cursor: 'pointer',
              border: selectedPackage === 12 ? '2px solid #ff3d00' : '2px solid #333', position: 'relative', transition: '0.3s'
            }}>
            <h3 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '15px' }}>GÓI VIP ĐẶC QUYỀN</h3>
            <div style={{ fontSize: '36px', fontWeight: '900', color: '#ff3d00', marginBottom: '20px' }}>12 Tháng</div>
            <p style={{ color: '#aaa', marginBottom: '30px' }}>Tối ưu chi phí kèm theo đặc quyền phân tích chỉ số AI trọn gói.</p>
            <button onClick={() => onNavigate('client_register')} style={{ width: '100%', padding: '12px', backgroundColor: selectedPackage === 12 ? '#ff3d00' : '#333', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Chọn Gói Này
            </button>
          </div>

        </div>
      </section>

      {/* 5. HỆ THỐNG PHÒNG TẬP (Interactive Tabs) */}
      <section id="locations" style={{ padding: '100px 50px', backgroundColor: '#141414', textAlign: 'center' }}>
        <h2 style={{ fontSize: '38px', fontWeight: '900', marginBottom: '15px', textTransform: 'uppercase' }}>HỆ THỐNG CLB POWER GYM</h2>
        <p style={{ color: '#888', marginBottom: '40px', fontSize: '16px' }}>Hơn 50+ câu lạc bộ tiêu chuẩn 5 sao trên toàn quốc</p>

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
        <p style={{ color: '#777', fontSize: '14px' }}>Hệ thống quản lý và dự báo rủi ro khách hàng bằng Machine Learning.</p>
        <p style={{ color: '#555', fontSize: '13px', marginTop: '20px' }}>© 2026 Power Gym. All rights reserved.</p>
      </footer>

    </div>
  );
}