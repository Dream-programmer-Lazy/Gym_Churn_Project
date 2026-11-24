import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Bell, LogOut, Settings, UserCircle, LayoutDashboard, MapPin, Globe, Sparkles, Gift, Activity, X } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

import { API_URL } from './config';
import CustomerForm from './components/CustomerForm';
import CustomerList from './components/CustomerList';
import Dashboard from './components/Dashboard';
import Overview from './components/Overview';
import CareList from './components/CareList';
import OffersPage from './components/OffersPage';
import Login from './components/Login';
import ClientRegister from './components/ClientRegister';
import ClientLogin from './components/ClientLogin';
import LandingPage from './components/LandingPage';
import ClientDashboard from './components/ClientDashboard';
import PredictWizard from './components/predict/PredictWizard';
import { regionOf } from './components/predict/utils';
import './styles/admin.css';

// Đọc hạn dùng (exp) trong JWT mà không cần thư viện. Token hỏng cũng coi như hết hạn.
const isTokenExpired = (token) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return !payload.exp || payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const clearSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  delete axios.defaults.headers.common['Authorization'];
};

// Màn hình đăng nhập phù hợp: hội viên -> client_login, nhân viên/admin -> login
const loginViewFor = (user) => (user?.role === 'Customer' ? 'client_login' : 'login');

const readStoredUser = () => {
  try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
};

// Kiểm tra phiên MỘT LẦN khi tải trang (trước khi bất kỳ component nào gọi API)
const initialSession = (() => {
  const token = localStorage.getItem('token');
  const user = readStoredUser();
  if (!token || !user) return { user: null, expiredView: null };
  if (isTokenExpired(token)) {
    clearSession();
    return { user: null, expiredView: loginViewFor(user) };
  }
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  return { user, expiredView: null };
})();

// Interceptor gắn ở cấp module -> có hiệu lực TRƯỚC mọi request của component con.
// App đăng ký hàm xử lý (đổi state) qua sessionExpiredHandler.
let sessionExpiredHandler = null;
if (!axios.__gymSessionInterceptor) {
  axios.__gymSessionInterceptor = true; // tránh gắn trùng khi Vite hot-reload
  axios.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err.response?.status;
      if ((status === 401 || status === 403) && localStorage.getItem('token')) {
        const nextView = loginViewFor(readStoredUser());
        clearSession();
        err.sessionExpired = true; // để component bỏ qua toast lỗi của riêng nó
        toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', { id: 'session-expired' });
        sessionExpiredHandler?.(nextView);
      } else if ((status === 401 || status === 403) && !localStorage.getItem('token')) {
        err.sessionExpired = true; // request cùng đợt, phiên vừa bị xóa
      }
      return Promise.reject(err);
    }
  );
}

const TOAST_OPTIONS = {
  style: { fontFamily: 'inherit', fontSize: '13px', borderRadius: '10px', border: '1px solid #e4e4e7', boxShadow: '0 12px 32px -8px rgba(24,24,27,.18)', color: '#18181b' },
  success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
  error: { iconTheme: { primary: '#e11d48', secondary: '#fff' } },
};

// Menu Admin: Tổng quan | Hội viên Việt Nam | Hội viên Quốc tế | Dự báo | Ưu đãi
const NAV = [
  { key: 'overview', label: 'Tổng quan', title: 'Tổng quan 2 thị trường', Icon: LayoutDashboard },
  { key: 'vn', label: 'Hội viên Việt Nam', title: 'Hội viên Việt Nam', Icon: MapPin },
  { key: 'global', label: 'Hội viên Quốc tế', title: 'Hội viên Quốc tế', Icon: Globe },
  { key: 'predict', label: 'Dự báo', title: 'Dự báo & lưu vào hệ thống', Icon: Sparkles },
  { key: 'offers', label: 'Ưu đãi', title: 'Ưu đãi gia hạn', Icon: Gift },
];
const MARKET_TABS = ['vn', 'global'];

const getInitials = (name = '') =>
  name.trim().split(/\s+/).slice(-2).map(n => n[0]).join('').toUpperCase() || 'AD';

function App() {
  const [currentUser, setCurrentUser] = useState(initialSession.user);
  const [view, setView] = useState(initialSession.expiredView || 'landing');
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [activeFilter, setActiveFilter] = useState('All');
  const [editingCustomer, setEditingCustomer] = useState(null);

  const [pendingUsers, setPendingUsers] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [dateFilter, setDateFilter] = useState('all');
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Trang đang mở trong Admin: 'overview' | 'vn' | 'global' | 'predict' | 'offers'
  const [adminTab, setAdminTab] = useState('overview');

  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const handleRefresh = () => setRefreshFlag(prev => prev + 1);

  // Đổi trang: bỏ lọc cũ và bỏ trạng thái "đang sửa" của trang trước
  const openTab = (tab, filter = 'All') => {
    setAdminTab(tab);
    setActiveFilter(filter);
    setEditingCustomer(null);
  };

  useEffect(() => {
    if (currentUser && currentUser.role !== 'Customer') {
      axios.get(`${API_URL}/customers`)
        .then(res => {
          const pending = res.data.filter(c => c.status === 'Chờ duyệt');
          setPendingUsers(pending);
        })
        .catch(err => console.error(err));
    }
  }, [refreshFlag, currentUser]);

  // Phiên hết hạn ngay lúc tải trang -> báo 1 lần trên màn hình đăng nhập
  useEffect(() => {
    if (initialSession.expiredView) {
      toast.error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', { id: 'session-expired' });
    }
  }, []);

  // Phiên hết hạn giữa chừng (server trả 401/403) -> đăng xuất và về màn hình đăng nhập
  useEffect(() => {
    sessionExpiredHandler = (nextView) => {
      setCurrentUser(null);
      setView(nextView);
    };
    return () => { sessionExpiredHandler = null; };
  }, []);

  // Đóng popover khi click ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!showNotif && !showUserMenu) return;
    const onDown = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setShowNotif(false); setShowUserMenu(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [showNotif, showUserMenu]);

  const handleLogout = () => {
    clearSession();
    setCurrentUser(null);
    setView('landing');
    setShowUserMenu(false);
    setAdminTab('overview');
  };

  // "Xem tất cả người mức Cao" trong khung Cần chăm sóc -> lọc bảng hội viên + cuộn tới bảng
  const viewAllHigh = () => {
    setActiveFilter('Cao');
    setTimeout(() => {
      document.getElementById('customer-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  // Click 1 thông báo → mở trang thị trường của hội viên đó và cuộn tới bảng để duyệt
  const goToPending = (customer) => {
    setShowNotif(false);
    openTab(regionOf(customer));
    setTimeout(() => {
      document.getElementById('customer-list-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  // Toaster dùng chung cho MỌI màn hình (kể cả đăng nhập, landing)
  const toaster = <Toaster position="top-right" reverseOrder={false} toastOptions={TOAST_OPTIONS} />;

  if (currentUser && currentUser.role === 'Customer') return <>{toaster}<ClientDashboard user={currentUser} onLogout={handleLogout} /></>;
  if (!currentUser && view === 'landing') return <>{toaster}<LandingPage onNavigate={setView} /></>;
  if (!currentUser && view === 'client_register') return <>{toaster}<ClientRegister onBack={() => setView('landing')} /></>;
  if (!currentUser && view === 'client_login') return <>{toaster}<ClientLogin onLoginSuccess={setCurrentUser} onBack={() => setView('landing')} /></>;
  if (!currentUser && view === 'login') return <>{toaster}<Login onLoginSuccess={setCurrentUser} onBack={() => setView('landing')} /></>;
  // Trang dùng thử công khai (không lưu) — phương án A: vẫn giữ ở Landing Page
  if (!currentUser && view === 'predict') return <>{toaster}<PredictWizard onBack={() => setView('landing')} /></>;
  if (!currentUser) return <>{toaster}<LandingPage onNavigate={setView} /></>;

  const roleLabel = currentUser.role === 'Admin' ? 'Quản trị viên hệ thống' : 'Quản lý phòng tập';
  const pageTitle = NAV.find((n) => n.key === adminTab)?.title || '';
  const isMarketTab = MARKET_TABS.includes(adminTab);
  const marketName = { vn: 'Việt Nam', global: 'Quốc tế' };

  return (
    <div className="ad-root">
      {toaster}

      {/* ============ SIDEBAR ============ */}
      <aside className="ad-sidebar">
        <div className="ad-brand">
          <div className="ad-brand-mark"><Activity size={18} strokeWidth={2.4} /></div>
          <div>
            <div className="ad-brand-name">Gym Retention AI</div>
            <div className="ad-brand-sub">Dự báo rời bỏ hội viên</div>
          </div>
        </div>

        <nav className="ad-nav" aria-label="Điều hướng quản trị">
          <div className="ad-nav-title">Không gian làm việc</div>
          {NAV.map(({ key, label, Icon }) => (
            <button key={key} className="ad-nav-item" aria-current={adminTab === key ? 'page' : undefined} onClick={() => openTab(key)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>

        <div className="ad-sidebar-foot">
          <span className="ad-live-dot" /> Máy chủ AI đang hoạt động
        </div>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="ad-main">
        <header className="ad-topbar">
          <div className="ad-crumb">Quản trị <span aria-hidden>/</span> <strong>{pageTitle}</strong></div>

          <div className="ad-topbar-right">
            {/* --- Chuông thông báo khách chờ duyệt --- */}
            <div className="ad-pop-anchor" ref={notifRef}>
              <button
                className="ad-icon-btn"
                aria-label={`Thông báo, ${pendingUsers.length} khách chờ duyệt`}
                aria-expanded={showNotif}
                onClick={() => { setShowNotif(!showNotif); setShowUserMenu(false); }}
              >
                <Bell size={18} />
                {pendingUsers.length > 0 && <span className="ad-bell-count ad-num">{pendingUsers.length}</span>}
              </button>

              {showNotif && (
                <div className="ad-popover" style={{ width: 340 }} role="dialog" aria-label="Thông báo">
                  <div className="ad-pop-head">
                    <span>Khách chờ duyệt <span className="ad-count ad-num">{pendingUsers.length}</span></span>
                    <button className="ad-link-btn" onClick={() => setShowNotif(false)} aria-label="Đóng"><X size={15} /></button>
                  </div>
                  <div className="ad-notif-list">
                    {pendingUsers.length === 0 ? (
                      <div className="ad-empty-mini">Không có hội viên nào đang chờ duyệt.</div>
                    ) : (
                      pendingUsers.map(u => (
                        <button key={u._id} className="ad-notif-item" onClick={() => goToPending(u)}>
                          <span className="ad-notif-dot" />
                          <span>
                            <strong>{u.fullName}</strong> vừa đăng ký gói {u.Contract_period} tháng
                            <div className="ad-notif-meta">Thị trường {marketName[regionOf(u)]} · bấm để tới danh sách và duyệt</div>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* --- Menu người dùng --- */}
            <div className="ad-pop-anchor" ref={userMenuRef}>
              <button
                className="ad-user-btn"
                aria-expanded={showUserMenu}
                onClick={() => { setShowUserMenu(!showUserMenu); setShowNotif(false); }}
              >
                <span className="ad-avatar">{getInitials(currentUser.fullName)}</span>
                <span className="ad-user-meta">
                  <div className="ad-user-name">{currentUser.fullName}</div>
                  <div className="ad-user-role">{roleLabel}</div>
                </span>
              </button>

              {showUserMenu && (
                <div className="ad-popover" style={{ width: 230 }} role="menu">
                  <div className="ad-menu-id">
                    <div className="ad-user-name">{currentUser.fullName}</div>
                    <div className="ad-user-role">@{currentUser.username}</div>
                  </div>
                  <div className="ad-menu-group">
                    <button className="ad-menu-item" role="menuitem"><UserCircle size={16} /> Hồ sơ cá nhân</button>
                    <button className="ad-menu-item" role="menuitem"><Settings size={16} /> Cài đặt hệ thống</button>
                  </div>
                  <div className="ad-menu-group">
                    <button className="ad-menu-item is-danger" role="menuitem" onClick={handleLogout}><LogOut size={16} /> Đăng xuất</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="ad-content">
          {adminTab === 'overview' && (
            <Overview refreshFlag={refreshFlag} onOpenMarket={(region, filter) => openTab(region, filter)} />
          )}

          {/* Trang VN và Quốc tế dùng CHUNG component, chỉ khác region */}
          {isMarketTab && (
            <div key={adminTab}>
              <Dashboard region={adminTab} refreshFlag={refreshFlag} onCardClick={setActiveFilter} activeFilter={activeFilter} dateFilter={dateFilter} setDateFilter={setDateFilter} />

              {/* Cần chăm sóc tuần này (4.4) + Chấm điểm ngay (4.3) */}
              <CareList region={adminTab} refreshFlag={refreshFlag} onRescored={handleRefresh} onViewAll={viewAllHigh} />

              <div className="ad-workspace">
                <section className="ad-panel ad-form-panel" id="customer-form-panel"
                  style={{ maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
                  <CustomerForm region={adminTab} editingCustomer={editingCustomer} setEditingCustomer={setEditingCustomer} onSuccess={handleRefresh} />
                </section>
                <section className="ad-panel ad-table-panel">
                  <CustomerList region={adminTab} setEditingCustomer={setEditingCustomer} refreshFlag={refreshFlag} onSuccess={handleRefresh} externalFilter={activeFilter} onFilterChange={setActiveFilter} dateFilter={dateFilter} />
                </section>
              </div>
            </div>
          )}

          {/* Dự báo trong Admin (3.1) — có nút "Lưu vào hệ thống" (3.2) và "Lưu tất cả" (3.3) */}
          {adminTab === 'predict' && <PredictWizard embedded />}

          {/* Ưu đãi gia hạn: duyệt gửi (5.2) + nhật ký (5.5) */}
          {adminTab === 'offers' && <OffersPage />}
        </main>
      </div>
    </div>
  );
}

export default App;