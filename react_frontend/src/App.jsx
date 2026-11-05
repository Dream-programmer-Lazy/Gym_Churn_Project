import { useState, useEffect } from 'react';
import axios from 'axios';
import { Bell, LogOut, User, Settings, UserCircle } from 'lucide-react';
import { Toaster } from 'react-hot-toast'; // IMPORT THƯ VIỆN TOAST

import CustomerForm from './components/CustomerForm';
import CustomerList from './components/CustomerList';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import ClientRegister from './components/ClientRegister';
import ClientLogin from './components/ClientLogin';
import LandingPage from './components/LandingPage';
import ClientDashboard from './components/ClientDashboard';
import ModelMetricsDashboard from './components/ModelMetricsDashboard';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      return JSON.parse(user);
    }
    return null;
  });

  const [view, setView] = useState('landing'); 
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [activeFilter, setActiveFilter] = useState('All');
  const [editingCustomer, setEditingCustomer] = useState(null); 
  
  const [pendingUsers, setPendingUsers] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [dateFilter, setDateFilter] = useState('all'); 
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Quản lý Tab hiển thị trên giao diện Admin
  const [adminTab, setAdminTab] = useState('prediction'); 

  const handleRefresh = () => setRefreshFlag(prev => prev + 1);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'Customer') {
      axios.get('http://localhost:3001/api/customers')
        .then(res => {
          const pending = res.data.filter(c => c.status === 'Chờ duyệt');
          setPendingUsers(pending);
        })
        .catch(err => console.error(err));
    }
  }, [refreshFlag, currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setCurrentUser(null);
    setView('landing');
    setShowUserMenu(false);
  };

  if (currentUser && currentUser.role === 'Customer') return <ClientDashboard user={currentUser} onLogout={handleLogout} />;
  if (!currentUser && view === 'landing') return <LandingPage onNavigate={setView} />;
  if (!currentUser && view === 'client_register') return <ClientRegister onBack={() => setView('landing')} />;
  if (!currentUser && view === 'client_login') return <ClientLogin onLoginSuccess={setCurrentUser} onBack={() => setView('landing')} />;
  if (!currentUser && view === 'login') return <Login onLoginSuccess={setCurrentUser} onBack={() => setView('landing')} />;

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', paddingBottom: '40px', fontFamily: '"Helvetica Neue", Helvetica, sans-serif' }}>
      
      {/* KHUNG HIỂN THỊ THÔNG BÁO TOÀN CỤC */}
      <Toaster position="top-right" reverseOrder={false} />

      <header style={{ backgroundColor: '#1e293b', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', height: '64px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', backgroundColor: '#3b82f6', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>AI</div>
            <h1 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', lineHeight: '1.2' }}>HỆ THỐNG QUẢN LÝ DỰ BÁO<br/>RỜI BỎ</h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          
          <div style={{ position: 'relative' }}>
            <div onClick={() => {setShowNotif(!showNotif); setShowUserMenu(false);}} style={{ position: 'relative', cursor: 'pointer' }}>
              <Bell size={20} color="#cbd5e1" />
              {pendingUsers.length > 0 && (
                <span style={{ position: 'absolute', top: '-6px', right: '-6px', backgroundColor: '#ef4444', color: 'white', fontSize: '10px', fontWeight: 'bold', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {pendingUsers.length}
                </span>
              )}
            </div>
            
            {showNotif && (
              <div style={{ position: 'absolute', top: '35px', right: '-10px', width: '320px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1000, color: '#333' }}>
                <div style={{ padding: '15px', borderBottom: '1px solid #eee', fontWeight: 'bold', fontSize: '14px', display: 'flex', justifyContent: 'space-between' }}>
                  Thông báo mới
                  <span style={{ fontSize: '12px', color: '#3b82f6', cursor: 'pointer' }} onClick={() => setShowNotif(false)}>Đóng</span>
                </div>
                <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                  {pendingUsers.length === 0 ? (
                    <div style={{ padding: '20px', fontSize: '13px', color: '#666', textAlign: 'center' }}>Tuyệt vời! Không có khách hàng chờ duyệt.</div>
                  ) : (
                    pendingUsers.map(u => (
                      <div key={u._id} style={{ padding: '12px 15px', borderBottom: '1px solid #f1f5f9', fontSize: '13px' }}>
                        <strong style={{ color: '#0f172a' }}>{u.fullName}</strong> vừa đăng ký gói {u.Contract_period} tháng.<br/>
                        <span style={{ color: '#f59e0b', fontWeight: '500' }}>Vui lòng cuộn xuống danh sách để duyệt!</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div style={{ position: 'relative', borderLeft: '1px solid #334155', paddingLeft: '20px' }}>
            <div 
              onClick={() => {setShowUserMenu(!showUserMenu); setShowNotif(false);}} 
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            >
              <div style={{ width: '36px', height: '36px', backgroundColor: '#3b82f6', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <User size={20} color="#fff" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '14px', fontWeight: 'bold' }}>{currentUser.fullName}</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>{currentUser.role === 'Admin' ? 'Quản trị viên Hệ thống' : 'Quản lý phòng tập'}</span>
              </div>
            </div>

            {showUserMenu && (
              <div style={{ position: 'absolute', top: '50px', right: '0', width: '220px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)', zIndex: 1000, color: '#333', overflow: 'hidden' }}>
                <div style={{ padding: '15px', borderBottom: '1px solid #f1f5f9', backgroundColor: '#f8fafc' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#0f172a' }}>{currentUser.fullName}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>@{currentUser.username}</div>
                </div>
                
                <div style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#334155' }} onMouseEnter={(e)=>e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseLeave={(e)=>e.currentTarget.style.backgroundColor='transparent'}>
                    <UserCircle size={16} /> Hồ sơ cá nhân
                  </div>
                  <div style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#334155' }} onMouseEnter={(e)=>e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseLeave={(e)=>e.currentTarget.style.backgroundColor='transparent'}>
                    <Settings size={16} /> Cài đặt hệ thống
                  </div>
                </div>

                <div 
                  onClick={handleLogout} 
                  style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '14px', color: '#ef4444', fontWeight: '500' }} 
                  onMouseEnter={(e)=>e.currentTarget.style.backgroundColor='#fef2f2'} 
                  onMouseLeave={(e)=>e.currentTarget.style.backgroundColor='transparent'}
                >
                  <LogOut size={16} /> Đăng xuất
                </div>
              </div>
            )}
          </div>

        </div>
      </header>

      <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
        
        {/* THANH ĐIỀU HƯỚNG TAB */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px' }}>
          <button 
            onClick={() => setAdminTab('prediction')}
            style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none', transition: '0.2s', backgroundColor: adminTab === 'prediction' ? '#3b82f6' : 'transparent', color: adminTab === 'prediction' ? 'white' : '#64748b' }}
          >
            📊 Giao diện Dự báo
          </button>
          <button 
            onClick={() => setAdminTab('metrics')}
            style={{ padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', border: 'none', transition: '0.2s', backgroundColor: adminTab === 'metrics' ? '#10b981' : 'transparent', color: adminTab === 'metrics' ? 'white' : '#64748b' }}
          >
            🤖 Chỉ số Đánh giá AI
          </button>
        </div>

        {/* NỘI DUNG THAY ĐỔI THEO TAB */}
        {adminTab === 'prediction' ? (
          <>
            <Dashboard refreshFlag={refreshFlag} onCardClick={setActiveFilter} activeFilter={activeFilter} dateFilter={dateFilter} setDateFilter={setDateFilter} />
            
            <div style={{ display: 'flex', gap: '25px', marginTop: '25px', alignItems: 'flex-start' }}>
              <div style={{ flex: '1', backgroundColor: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                <CustomerForm editingCustomer={editingCustomer} setEditingCustomer={setEditingCustomer} onSuccess={handleRefresh} />
              </div>
              <div style={{ flex: '2.5', backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <CustomerList setEditingCustomer={setEditingCustomer} refreshFlag={refreshFlag} onSuccess={handleRefresh} externalFilter={activeFilter} onFilterChange={setActiveFilter} dateFilter={dateFilter} />
              </div>
            </div>
          </>
        ) : (
          <ModelMetricsDashboard />
        )}

      </main>
    </div>
  );
}

export default App;