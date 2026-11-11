import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { CalendarRange, Download } from 'lucide-react';

const COLORS = { high: '#e11d48', mid: '#f59e0b', low: '#10b981', bar: '#18181b' };

// Tooltip dùng chung cho cả 2 biểu đồ
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="ad-tooltip">
      <div style={{ opacity: 0.7 }}>{label || p.name}</div>
      <b className="ad-num">{Number(p.value).toLocaleString('vi-VN')}</b> hội viên
    </div>
  );
}

const pct = (part, total) => (total ? ((part / total) * 100).toFixed(1) : '0.0');

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
              { key: 'Cao', name: 'Nguy cơ cao', value: high, color: COLORS.high },
              { key: 'Trung bình', name: 'Nguy cơ trung bình', value: medium, color: COLORS.mid },
              { key: 'Thấp', name: 'Nguy cơ thấp', value: low, color: COLORS.low }
            ],
            contractData: [
              { name: 'Gói 1 tháng', count: month1 },
              { name: 'Gói 6 tháng', count: month6 },
              { name: 'Gói 12 tháng', count: month12 }
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
    if (rawCustomers.length === 0) return toast.error("Không có dữ liệu để xuất báo cáo.");
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
    toast.success(`Đã xuất báo cáo ${rawCustomers.length} hội viên.`);
  };

  const kpis = [
    { key: 'All', tone: 'tone-all', label: 'Tổng hội viên', value: stats.total, foot: dateFilter === '30days' ? 'Đăng ký trong 30 ngày qua' : 'Toàn bộ dữ liệu' },
    { key: 'Cao', tone: 'tone-high', label: 'Nguy cơ cao', value: stats.highRisk, foot: <><b>{pct(stats.highRisk, stats.total)}%</b> cần can thiệp ngay</> },
    { key: 'Trung bình', tone: 'tone-mid', label: 'Nguy cơ trung bình', value: stats.mediumRisk, foot: <><b>{pct(stats.mediumRisk, stats.total)}%</b> nên theo dõi</> },
    { key: 'Thấp', tone: 'tone-low', label: 'An toàn', value: stats.safe, foot: <><b>{pct(stats.safe, stats.total)}%</b> tương tác ổn định</> },
  ];

  const is30 = dateFilter === '30days';

  return (
    <>
      {/* ---------- Tiêu đề trang + hành động ---------- */}
      <div className="ad-page-head">
        <div>
          <h1 className="ad-h1">Tổng quan rủi ro rời bỏ</h1>
          <p className="ad-sub">Bấm vào từng nhóm rủi ro để lọc danh sách hội viên bên dưới.</p>
        </div>
        <div className="ad-actions">
          <button className={`ad-btn ${is30 ? 'is-on' : ''}`} aria-pressed={is30} onClick={() => setDateFilter(is30 ? 'all' : '30days')}>
            <CalendarRange size={15} /> {is30 ? 'Đang xem 30 ngày qua' : '30 ngày qua'}
          </button>
          <button className="ad-btn is-primary" onClick={handleExportCSV}>
            <Download size={15} /> Xuất báo cáo
          </button>
        </div>
      </div>

      {/* ---------- Dải KPI + phổ rủi ro ---------- */}
      <section className="ad-panel ad-overview" aria-label="Chỉ số tổng quan">
        <div className="ad-kpis">
          {kpis.map(k => (
            <button key={k.key} className={`ad-kpi ${k.tone}`} aria-pressed={activeFilter === k.key} onClick={() => onCardClick(k.key)}>
              <div className="ad-kpi-label"><span className="ad-kpi-swatch" />{k.label}</div>
              <div className="ad-kpi-value ad-num">{k.value.toLocaleString('vi-VN')}</div>
              <div className="ad-kpi-foot">{k.foot}</div>
            </button>
          ))}
        </div>

        <div className="ad-spectrum">
          <div className="ad-spectrum-bar" role="group" aria-label="Phân bố rủi ro">
            {stats.total > 0 && stats.riskData.filter(d => d.value > 0).map(d => (
              <button
                key={d.key}
                className="ad-spectrum-seg"
                style={{ flexGrow: d.value, background: d.color }}
                title={`${d.name}: ${d.value} (${pct(d.value, stats.total)}%)`}
                aria-label={`Lọc ${d.name}`}
                onClick={() => onCardClick(d.key)}
              />
            ))}
          </div>
          <div className="ad-spectrum-legend">
            <span>Rủi ro cao</span>
            <span>An toàn</span>
          </div>
        </div>
      </section>

      {/* ---------- Biểu đồ ---------- */}
      <div className="ad-charts">
        <section className="ad-panel">
          <div className="ad-panel-head">
            <div>
              <h3 className="ad-h3">Tỷ lệ nguy cơ rời bỏ</h3>
              <p className="ad-h3-sub">Phân loại bởi mô hình AI</p>
            </div>
          </div>
          <div className="ad-chart-body">
            <div className="ad-donut-wrap">
              <div className="ad-donut">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={stats.riskData} cx="50%" cy="50%" innerRadius={64} outerRadius={90} paddingAngle={stats.total ? 2 : 0} cornerRadius={4} dataKey="value" stroke="none">
                      {stats.riskData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="ad-donut-center">
                  <div className="ad-donut-total ad-num">{stats.total.toLocaleString('vi-VN')}</div>
                  <div className="ad-donut-cap">hội viên</div>
                </div>
              </div>

              <div className="ad-legend">
                {stats.riskData.map(d => (
                  <button key={d.key} className="ad-legend-row" aria-pressed={activeFilter === d.key} onClick={() => onCardClick(d.key)}>
                    <span className="ad-legend-dot" style={{ background: d.color }} />
                    <span>{d.name}</span>
                    <span className="ad-legend-val ad-num">{d.value.toLocaleString('vi-VN')}</span>
                    <span className="ad-legend-pct ad-num">{pct(d.value, stats.total)}%</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="ad-panel">
          <div className="ad-panel-head">
            <div>
              <h3 className="ad-h3">Phân bố thời hạn hợp đồng</h3>
              <p className="ad-h3-sub">Số lượng hội viên theo từng gói</p>
            </div>
          </div>
          <div className="ad-chart-body" style={{ height: 290 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.contractData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }} barSize={56}>
                <CartesianGrid vertical={false} stroke="#f1f1f3" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#71717a' }} dy={8} />
                <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 12, fill: '#a1a1aa' }} />
                <Tooltip cursor={{ fill: '#f4f4f5', radius: 6 }} content={<ChartTooltip />} />
                <Bar dataKey="count" fill={COLORS.bar} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </>
  );
}