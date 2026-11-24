import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { CalendarRange, Download } from 'lucide-react';
import { API_URL } from '../config';
import { FORMS, regionOf, downloadCsv } from './predict/utils';

const COLORS = { high: '#e11d48', mid: '#f59e0b', low: '#10b981', pend: '#a1a1aa', bar: '#18181b' };
const MARKET_NAME = { vn: 'Việt Nam', global: 'Quốc tế' };

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
const isPending = (c) => c.status === 'Chờ duyệt' || !['Cao', 'Trung bình', 'Thấp'].includes(c.prediction?.risk_level);

/**
 * Dashboard của MỘT thị trường (trang "Hội viên Việt Nam" hoặc "Hội viên Quốc tế").
 * Props: region ('vn' | 'global', mặc định 'vn'), refreshFlag, onCardClick(filter), activeFilter, dateFilter, setDateFilter
 * - Chỉ đếm hội viên có region trùng (hồ sơ cũ chưa có region được coi là 'vn').
 * - Hội viên "Chờ duyệt" / chưa dự báo được đếm riêng, KHÔNG gộp vào "An toàn".
 * - Biểu đồ gói tập theo đúng gói của thị trường (VN: 1/3/6/12, Quốc tế: 1/6/12).
 */
export default function Dashboard({ region = 'vn', refreshFlag, onCardClick, activeFilter, dateFilter, setDateFilter }) {
  const [stats, setStats] = useState({ total: 0, highRisk: 0, safe: 0, mediumRisk: 0, pending: 0, riskData: [], contractData: [] });
  const [rawCustomers, setRawCustomers] = useState([]);
  const form = FORMS[region];
  const plans = form.plans;

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/customers`);
        let customers = response.data.filter((c) => regionOf(c) === region);

        if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          customers = customers.filter(c => new Date(c.createdAt) >= thirtyDaysAgo);
        }

        if (isMounted) {
          setRawCustomers(customers);
          let high = 0, medium = 0, low = 0, pending = 0;
          const byPlan = Object.fromEntries(plans.map((m) => [m, 0]));

          customers.forEach(cus => {
            if (isPending(cus)) pending++;
            else if (cus.prediction.risk_level === 'Cao') high++;
            else if (cus.prediction.risk_level === 'Trung bình') medium++;
            else low++;

            if (cus.Contract_period in byPlan) byPlan[cus.Contract_period]++;
          });

          setStats({
            total: customers.length, highRisk: high, safe: low, mediumRisk: medium, pending,
            riskData: [
              { key: 'Cao', name: 'Nguy cơ cao', value: high, color: COLORS.high },
              { key: 'Trung bình', name: 'Nguy cơ trung bình', value: medium, color: COLORS.mid },
              { key: 'Thấp', name: 'An toàn', value: low, color: COLORS.low },
              { key: 'pending', name: 'Chờ duyệt / chưa dự báo', value: pending, color: COLORS.pend },
            ],
            contractData: plans.map((m) => ({ name: `Gói ${m} tháng`, count: byPlan[m] })),
          });
        }
      } catch (error) {
        console.error("Lỗi khi tải thống kê:", error);
      }
    };

    fetchStats();
    return () => { isMounted = false; };
  }, [refreshFlag, dateFilter, region, plans]);

  const handleExportCSV = () => {
    if (rawCustomers.length === 0) return toast.error("Không có dữ liệu để xuất báo cáo.");
    const moneyUnit = region === 'vn' ? 'VNĐ' : 'USD';
    const header = [
      'Họ tên', 'SĐT', 'Tuổi', 'Gói tập (tháng)', 'Số tháng còn lại', 'Thời gian đã tập (tháng)',
      'Buổi/tuần từ khi đăng ký', 'Buổi/tuần tháng gần nhất', `Chi tiêu thêm/tháng (${moneyUnit})`,
      'Xác suất rời bỏ (%)', 'Mức độ rủi ro', 'Trạng thái',
    ];
    const rows = rawCustomers.map(cus => [
      cus.fullName, cus.actualPhoneNumber || '', cus.Age, cus.Contract_period, cus.Month_to_end_contract, cus.Lifetime,
      cus.Avg_class_frequency_total, cus.Avg_class_frequency_current_month,
      // Mô hình VN lưu tiền theo nghìn VNĐ -> nhân 1.000 để ra đồng
      Math.round((Number(cus.Avg_additional_charges_total) || 0) * form.money.modelScale * 100) / 100,
      isPending(cus) ? '' : cus.prediction?.probability_percent,
      isPending(cus) ? 'Chưa dự báo' : cus.prediction?.risk_level,
      cus.status || 'Đang hoạt động',
    ]);
    downloadCsv(`Bao_Cao_Hoi_Vien_${region}_${dateFilter}.csv`, header, rows);
    toast.success(`Đã xuất báo cáo ${rawCustomers.length} hội viên ${MARKET_NAME[region]}.`);
  };

  const kpis = [
    { key: 'All', tone: 'tone-all', label: 'Tổng hội viên', value: stats.total,
      foot: <>{dateFilter === '30days' ? 'Đăng ký trong 30 ngày qua' : 'Toàn bộ dữ liệu'}{stats.pending ? <> · <b>{stats.pending}</b> chờ duyệt</> : null}</> },
    { key: 'Cao', tone: 'tone-high', label: 'Nguy cơ cao', value: stats.highRisk, foot: <><b>{pct(stats.highRisk, stats.total)}%</b> cần can thiệp ngay</> },
    { key: 'Trung bình', tone: 'tone-mid', label: 'Nguy cơ trung bình', value: stats.mediumRisk, foot: <><b>{pct(stats.mediumRisk, stats.total)}%</b> nên theo dõi</> },
    { key: 'Thấp', tone: 'tone-low', label: 'An toàn', value: stats.safe, foot: <><b>{pct(stats.safe, stats.total)}%</b> tương tác ổn định</> },
  ];

  const is30 = dateFilter === '30days';
  const filterOf = (key) => (key === 'pending' ? 'All' : key);

  return (
    <>
      {/* ---------- Tiêu đề trang + hành động ---------- */}
      <div className="ad-page-head">
        <div>
          <h1 className="ad-h1">Hội viên {MARKET_NAME[region]}</h1>
          <p className="ad-sub">
            {region === 'vn' ? 'Gói 1, 3, 6, 12 tháng · tiền VNĐ.' : 'Gói 1, 6, 12 tháng · tiền USD.'} Bấm vào từng nhóm rủi ro để lọc danh sách bên dưới.
          </p>
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
                onClick={() => onCardClick(filterOf(d.key))}
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
              <p className="ad-h3-sub">Phân loại bởi mô hình AI thị trường {MARKET_NAME[region]}</p>
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
                  <button key={d.key} className="ad-legend-row" aria-pressed={activeFilter === d.key} onClick={() => onCardClick(filterOf(d.key))}>
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