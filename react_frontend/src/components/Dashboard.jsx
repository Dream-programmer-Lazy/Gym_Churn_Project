import { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Users, AlertTriangle, ShieldCheck, Calendar, Download, Info } from 'lucide-react';

export default function Dashboard({ refreshFlag, onCardClick, activeFilter, dateFilter, setDateFilter }) {
  const [stats, setStats] = useState({ total: 0, highRisk: 0, safe: 0, mediumRisk: 0, riskData: [], contractData: [] });
  const [rawCustomers, setRawCustomers] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/customers');
        let customers = response.data;
        
        if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          customers = customers.filter(c => new Date(c.createdAt) >= thirtyDaysAgo);
        }

        if (isMounted) {
          setRawCustomers(customers); 
          let high = 0, medium = 0, low = 0;
          let month1 = 0, month6 = 0, month12 = 0;

          customers.forEach(cus => {
            if (cus.prediction?.risk_level === 'Cao') high++;
            else if (cus.prediction?.risk_level === 'Trung bình') medium++;
            else low++;

            if (cus.Contract_period === 1) month1++;
            else if (cus.Contract_period === 6) month6++;
            else if (cus.Contract_period === 12) month12++;
          });

          setStats({
            total: customers.length, highRisk: high, safe: low, mediumRisk: medium,
            riskData: [
              { name: 'Nguy cơ cao', value: high, color: '#ef4444' },
              { name: 'Nguy cơ trung bình', value: medium, color: '#94a3b8' },
              { name: 'Nguy cơ thấp', value: low, color: '#22c55e' }
            ],
            contractData: [
              { name: 'Gói 1 Tháng', count: month1 },
              { name: 'Gói 6 Tháng', count: month6 },
              { name: 'Gói 12 Tháng', count: month12 }
            ]
          });
        }
      } catch (error) {
        console.error("Lỗi khi tải thống kê:", error);
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, [refreshFlag, dateFilter]);

  const handleExportCSV = () => {
    if (rawCustomers.length === 0) return alert("Không có dữ liệu để xuất!");
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Họ tên,SĐT,Tuổi,Gói tập (tháng),Tần suất tập/tuần,Thời gian gắn bó,Xác suất rời bỏ (%),Mức độ rủi ro,Mô hình AI,Trạng thái\n";
    rawCustomers.forEach(cus => {
      const row = [`"${cus.fullName}"`, `"${cus.actualPhoneNumber || ''}"`, cus.Age, cus.Contract_period, cus.Avg_class_frequency_current_month, cus.Lifetime, cus.prediction?.probability_percent || 0, `"${cus.prediction?.risk_level || 'Chưa phân tích'}"`, `"${cus.prediction?.model_used || 'Chưa xác định'}"`, `"${cus.status || 'Đang hoạt động'}"`];
      csvContent += row.join(",") + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Bao_Cao_Hoi_Vien_${dateFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const highRiskPercent = stats.total ? ((stats.highRisk / stats.total) * 100).toFixed(1) : 0;
  const safePercent = stats.total ? ((stats.safe / stats.total) * 100).toFixed(1) : 0;

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', fontSize: '13px', color: '#64748b' }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{width: '8px', height: '8px', backgroundColor: '#22c55e', borderRadius: '50%'}}></div> Hệ thống Quản lý Khách hàng</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setDateFilter(dateFilter === '30days' ? 'all' : '30days')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: dateFilter === '30days' ? '#eff6ff' : 'white', border: dateFilter === '30days' ? '1px solid #3b82f6' : '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: dateFilter === '30days' ? '#3b82f6' : '#334155', fontWeight: dateFilter === '30days' ? 'bold' : 'normal' }}>
            <Calendar size={14} /> {dateFilter === '30days' ? 'Bỏ lọc 30 ngày' : '30 ngày qua'}
          </button>
          <button onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', color: '#334155' }}>
            <Download size={14} /> Xuất báo cáo
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div onClick={() => onCardClick('All')} style={{ backgroundColor: activeFilter === 'All' ? '#eff6ff' : 'white', padding: '24px', borderRadius: '12px', borderTop: '4px solid #3b82f6', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Tổng Khách Hàng</p><h2 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#0f172a' }}>{stats.total.toLocaleString()}</h2></div>
            <div style={{ backgroundColor: '#eff6ff', padding: '8px', borderRadius: '8px' }}><Users size={20} color="#3b82f6" /></div>
          </div>
        </div>

        <div onClick={() => onCardClick('Cao')} style={{ backgroundColor: activeFilter === 'Cao' ? '#fef2f2' : 'white', padding: '24px', borderRadius: '12px', borderTop: '4px solid #ef4444', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Nguy Cơ Rời Bỏ Cao</p><h2 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#ef4444' }}>{stats.highRisk.toLocaleString()}</h2></div>
            <div style={{ backgroundColor: '#fef2f2', padding: '8px', borderRadius: '8px' }}><AlertTriangle size={20} color="#ef4444" /></div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}><span style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{highRiskPercent}% tổng số</span><span style={{ color: '#ef4444' }}>Cần can thiệp ngay</span></div>
        </div>

        <div onClick={() => onCardClick('Thấp')} style={{ backgroundColor: activeFilter === 'Thấp' ? '#f0fdf4' : 'white', padding: '24px', borderRadius: '12px', borderTop: '4px solid #22c55e', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div><p style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Khách Hàng An Toàn</p><h2 style={{ margin: 0, fontSize: '32px', fontWeight: 'bold', color: '#0f172a' }}>{stats.safe.toLocaleString()}</h2></div>
            <div style={{ backgroundColor: '#f0fdf4', padding: '8px', borderRadius: '8px' }}><ShieldCheck size={20} color="#22c55e" /></div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}><span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{safePercent}% tỷ lệ an toàn</span><span style={{ color: '#64748b' }}>Tương tác ổn định</span></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <div><h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>Tỉ lệ nguy cơ rời bỏ</h3><p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Phân loại bởi mô hình AI</p></div>
            <Info size={16} color="#cbd5e1" />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: '20px' }}>
            <div style={{ width: '160px', height: '160px', position: 'relative' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.riskData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} dataKey="value" stroke="none">
                    {stats.riskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}><div style={{ fontSize: '20px', fontWeight: 'bold', color: '#0f172a' }}>{stats.total}</div></div>
            </div>
            <div style={{ flex: 1, paddingLeft: '15px', display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{width:'8px', height:'8px', backgroundColor:'#ef4444', borderRadius:'50%'}}></div>Nguy cơ cao <strong style={{marginLeft:'auto'}}>{stats.highRisk}</strong></div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{width:'8px', height:'8px', backgroundColor:'#22c55e', borderRadius:'50%'}}></div>Nguy cơ thấp <strong style={{marginLeft:'auto'}}>{stats.safe}</strong></div>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div><h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>Phân bố thời hạn hợp đồng</h3><p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Tương quan số lượng hội viên theo gói thời hạn</p></div>
          </div>
          <div style={{ height: '180px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.contractData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}} />
                <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}