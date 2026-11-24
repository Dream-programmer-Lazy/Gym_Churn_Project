import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, MapPin, Globe, RefreshCw } from 'lucide-react';
import { API_URL } from '../config';
import { regionOf } from './predict/utils';

/**
 * TRANG "TỔNG QUAN" — số liệu 2 thị trường đặt cạnh nhau.
 * - Không cộng gộp tiền giữa 2 thị trường (VNĐ và USD khác đơn vị).
 * - Bấm vào 1 nhóm rủi ro -> mở trang hội viên của thị trường đó, đã lọc sẵn nhóm.
 * Props: refreshFlag (đổi -> tải lại), onOpenMarket(region, filter)
 *        filter: 'All' | 'Cao' | 'Trung bình' | 'Thấp'
 */
const MARKETS = [
  { region: 'vn', name: 'Việt Nam', sub: 'Gói 1, 3, 6, 12 tháng · tiền VNĐ', Icon: MapPin },
  { region: 'global', name: 'Quốc tế', sub: 'Gói 1, 6, 12 tháng · tiền USD', Icon: Globe },
];

const ROWS = [
  { key: 'Cao', label: 'Nguy cơ cao', color: '#e11d48' },
  { key: 'Trung bình', label: 'Nguy cơ trung bình', color: '#f59e0b' },
  { key: 'Thấp', label: 'An toàn', color: '#10b981' },
  { key: 'pending', label: 'Chờ duyệt / chưa dự báo', color: '#a1a1aa' },
];

const pct = (part, total) => (total ? ((part / total) * 100).toFixed(1) : '0.0');

/** Đếm theo mức rủi ro. Hội viên "Chờ duyệt" hoặc chưa có kết quả được đếm riêng, không gộp vào "An toàn". */
const summarize = (customers) => {
  const s = { total: customers.length, 'Cao': 0, 'Trung bình': 0, 'Thấp': 0, pending: 0 };
  customers.forEach((c) => {
    const level = c.prediction?.risk_level;
    if (c.status === 'Chờ duyệt' || !['Cao', 'Trung bình', 'Thấp'].includes(level)) s.pending += 1;
    else s[level] += 1;
  });
  return s;
};

export default function Overview({ refreshFlag, onOpenMarket }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/customers`);
        if (!isMounted) return;
        const byRegion = { vn: [], global: [] };
        res.data.forEach((c) => { (byRegion[regionOf(c)] || byRegion.vn).push(c); });
        setStats({ vn: summarize(byRegion.vn), global: summarize(byRegion.global) });
        setError('');
      } catch (err) {
        if (isMounted && !err.sessionExpired) {
          setError(err.response?.data?.error || 'Không kết nối được máy chủ Node (cổng 3001).');
        }
      }
    };
    load();
    return () => { isMounted = false; };
  }, [refreshFlag, reloadKey]);

  return (
    <>
      <div className="ad-page-head">
        <div>
          <h1 className="ad-h1">Tổng quan 2 thị trường</h1>
          <p className="ad-sub">Mỗi thị trường dùng mô hình riêng. Bấm vào một nhóm để mở danh sách hội viên đã lọc sẵn.</p>
        </div>
        <div className="ad-actions">
          <button className="ad-btn" onClick={() => setReloadKey((k) => k + 1)}><RefreshCw size={15} /> Tải lại</button>
        </div>
      </div>

      {error && (
        <div className="ad-panel" role="alert" style={{ padding: 16, marginBottom: 20, color: 'var(--high-ink)', background: 'var(--high-bg)' }}>
          Không tải được số liệu: {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {MARKETS.map(({ region, name, sub, Icon }) => {
          const s = stats?.[region];
          const atRisk = s ? s['Cao'] + s['Trung bình'] : 0;
          return (
            <section key={region} className="ad-panel" aria-label={`Thị trường ${name}`}>
              <div className="ad-panel-head">
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--page)' }}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3 className="ad-h3">{name}</h3>
                    <p className="ad-h3-sub">{sub}</p>
                  </div>
                </div>
                <button className="ad-btn is-sm" onClick={() => onOpenMarket(region, 'All')}>
                  Mở danh sách <ArrowRight size={14} />
                </button>
              </div>

              <div className="ad-chart-body" style={{ paddingTop: 18 }}>
                {!s ? (
                  <div className="ad-skel" style={{ width: '60%', height: 28 }} />
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="ad-kpi-value ad-num" style={{ marginTop: 0 }}>{s.total.toLocaleString('vi-VN')}</span>
                      <span style={{ color: 'var(--muted)' }}>hội viên</span>
                    </div>
                    <p className="ad-kpi-foot" style={{ marginBottom: 14 }}>
                      <b>{atRisk.toLocaleString('vi-VN')}</b> người cần chăm sóc (Cao + Trung bình), chiếm <b>{pct(atRisk, s.total)}%</b>
                    </p>

                    <div className="ad-spectrum" style={{ padding: '0 0 14px' }}>
                      <div className="ad-spectrum-bar" role="group" aria-label={`Phân bố rủi ro ${name}`}>
                        {s.total > 0 && ROWS.filter((r) => s[r.key] > 0).map((r) => (
                          <button key={r.key} className="ad-spectrum-seg" style={{ flexGrow: s[r.key], background: r.color }}
                            title={`${r.label}: ${s[r.key]} (${pct(s[r.key], s.total)}%)`}
                            aria-label={`Lọc ${r.label}`}
                            onClick={() => onOpenMarket(region, r.key === 'pending' ? 'All' : r.key)} />
                        ))}
                      </div>
                    </div>

                    <div className="ad-legend">
                      {ROWS.map((r) => (
                        <button key={r.key} className="ad-legend-row" onClick={() => onOpenMarket(region, r.key === 'pending' ? 'All' : r.key)}>
                          <span className="ad-legend-dot" style={{ background: r.color }} />
                          <span>{r.label}</span>
                          <span className="ad-legend-val ad-num">{s[r.key].toLocaleString('vi-VN')}</span>
                          <span className="ad-legend-pct ad-num">{pct(s[r.key], s.total)}%</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="ad-sub" style={{ marginTop: 16, fontSize: 12.5 }}>
        Số liệu tiền (chi tiêu thêm) không được cộng gộp giữa 2 thị trường vì khác đơn vị: Việt Nam tính bằng VNĐ, Quốc tế tính bằng USD.
      </p>
    </>
  );
}