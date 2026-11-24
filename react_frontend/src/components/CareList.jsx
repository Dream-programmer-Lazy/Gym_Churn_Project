import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { HeartPulse, RefreshCw, BellRing, ArrowRight, TrendingUp, PartyPopper } from 'lucide-react';
import { API_URL } from '../config';

/**
 * KHUNG "CẦN CHĂM SÓC TUẦN NÀY" (mục 4.4) + NÚT "CHẤM ĐIỂM NGAY" (phần cốt lõi mục 4.3)
 * Props: region ('vn' | 'global'), refreshFlag, onRescored() (chấm xong -> App làm mới trang),
 *        onViewAll() (bấm "Xem tất cả" -> lọc bảng hội viên theo mức Cao)
 * - Top 10 hội viên ĐANG HOẠT ĐỘNG ở mức Cao, % giảm dần, kèm lý do chính (GET /api/customers/care)
 * - Nhãn "↑ Mới lên Cao": lần dự báo trước còn Thấp/Trung bình, lần gần nhất lên Cao
 * - "Chấm điểm ngay": chấm lại cả thị trường từ 7 chỉ số đang lưu (POST /api/customers/rescore)
 */
const MARKET_NAME = { vn: 'Việt Nam', global: 'Quốc tế' };
const LIMIT = 10;

const fmtPct = (n) => `${Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%`;

export default function CareList({ region, refreshFlag, onRescored, onViewAll }) {
  const [data, setData] = useState(null);      // { totalHigh, newlyHighCount, items }
  const [error, setError] = useState('');
  const [rescoring, setRescoring] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const market = MARKET_NAME[region];

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const res = await axios.get(`${API_URL}/customers/care`, { params: { region, limit: LIMIT } });
        if (!isMounted) return;
        setData(res.data);
        setError('');
      } catch (err) {
        if (isMounted && !err.sessionExpired) {
          setError(err.response?.data?.error || 'Không kết nối được máy chủ Node (cổng 3001).');
        }
      }
    };
    load();
    return () => { isMounted = false; };
  }, [region, refreshFlag, reloadKey]);

  const rescore = async () => {
    if (!window.confirm(`Chấm điểm lại TOÀN BỘ hội viên đang hoạt động của thị trường ${market} từ số liệu đang lưu?\n\nMỗi hội viên sẽ có thêm 1 dòng trong lịch sử dự báo.`)) return;
    setRescoring(true);
    const loadingToast = toast.loading(`Đang chấm điểm lại hội viên ${market}...`);
    try {
      const res = await axios.post(`${API_URL}/customers/rescore`, { region });
      toast.success(res.data.message, { id: loadingToast, duration: 8000 });
      if (res.data.rowErrors?.length) console.table(res.data.rowErrors); // chi tiết người không chấm được (F12 > Console)
      onRescored?.();
    } catch (err) {
      if (err.sessionExpired) toast.dismiss(loadingToast);
      else toast.error(err.response?.data?.error || 'Lỗi khi chấm điểm lại.', { id: loadingToast });
    } finally {
      setRescoring(false);
    }
  };

  const notify = async (item) => {
    const msg = window.prompt(`Nhập lời nhắc nhở cho "${item.fullName}":`, 'Bạn đã lâu không đến phòng tập. Đừng bỏ cuộc nhé, hãy quay lại luyện tập để đạt kết quả tốt nhất!');
    if (!msg) return;
    try {
      await axios.post(`${API_URL}/customers/${item._id}/notify`, { message: msg });
      toast.success(`Đã gửi thông báo đến ${item.fullName}!`);
    } catch (err) {
      if (!err.sessionExpired) toast.error(err.response?.data?.error || 'Lỗi khi gửi thông báo.');
    }
  };

  const items = data?.items || [];

  return (
    <section className="ad-panel" style={{ marginBottom: 20 }} aria-label="Cần chăm sóc tuần này">
      <div className="ad-panel-head">
        <div>
          <h3 className="ad-h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HeartPulse size={16} color="var(--high)" /> Cần chăm sóc tuần này
            {data && <span className="ad-count ad-num">{data.totalHigh} người mức Cao</span>}
          </h3>
          <p className="ad-h3-sub">
            Hội viên mức Cao xếp theo % rủi ro giảm dần, kèm lý do chính.
            {data?.newlyHighCount ? <> <b style={{ color: 'var(--high-ink)' }}>{data.newlyHighCount} người mới lên Cao</b> so với lần chấm trước.</> : null}
          </p>
        </div>
        <div className="ad-actions">
          <button className="ad-btn" onClick={rescore} disabled={rescoring} title={`Chấm lại toàn bộ hội viên ${market} bằng mô hình hiện tại`}>
            <RefreshCw size={15} className={rescoring ? 'pw-spin' : undefined} /> {rescoring ? 'Đang chấm...' : 'Chấm điểm ngay'}
          </button>
        </div>
      </div>

      <div style={{ padding: '12px 24px 20px' }}>
        {error && (
          <div role="alert" style={{ padding: 12, borderRadius: 10, background: 'var(--high-bg)', color: 'var(--high-ink)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <span>Không tải được danh sách: {error}</span>
            <button className="ad-btn is-sm" onClick={() => setReloadKey((k) => k + 1)}>Thử lại</button>
          </div>
        )}

        {!error && !data && <div className="ad-skel" style={{ width: '50%', height: 14, margin: '8px 0' }} />}

        {!error && data && items.length === 0 && (
          <div className="ad-empty" style={{ padding: '18px 0' }}>
            <div className="ad-empty-icon"><PartyPopper size={20} /></div>
            <div className="ad-empty-title">Không có hội viên nào ở mức Cao</div>
            <div>Tiếp tục chăm sóc định kỳ. Nhớ bấm "Chấm điểm ngay" sau khi cập nhật số liệu.</div>
          </div>
        )}

        {items.length > 0 && (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((it, i) => (
              <li key={it._id} style={{ display: 'grid', gridTemplateColumns: '28px minmax(0, 1fr) auto', gap: 12, alignItems: 'center', padding: '12px 0', borderTop: i ? '1px solid var(--line-soft)' : 'none' }}>
                <span className="ad-num" style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--high-bg)', color: 'var(--high-ink)', fontWeight: 700, fontSize: 12.5 }}>
                  {i + 1}
                </span>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                    <strong>{it.fullName}</strong>
                    <span className="ad-num" style={{ color: 'var(--muted)', fontSize: 12.5 }}>{it.actualPhoneNumber || 'Chưa có SĐT'}</span>
                    {it.newlyHigh && (
                      <span title="Lần chấm trước còn Thấp/Trung bình" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: 'var(--high-bg)', color: 'var(--high-ink)', fontSize: 11.5, fontWeight: 600 }}>
                        <TrendingUp size={12} /> Mới lên Cao
                      </span>
                    )}
                    <span style={{ color: 'var(--muted)', fontSize: 12.5 }}>
                      · Gói {it.Contract_period} tháng · còn {it.Month_to_end_contract ?? '?'} tháng
                    </span>
                  </div>
                  <div style={{ marginTop: 3, color: 'var(--ink-2)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={it.mainReason}>
                    {it.mainReason || <span style={{ color: 'var(--muted)' }}>Không có yếu tố nổi bật</span>}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <b className="ad-num" style={{ color: 'var(--high)', fontSize: 15, minWidth: 56, textAlign: 'right' }}>{fmtPct(it.probability_percent)}</b>
                  <button className="ad-btn is-sm is-notify" onClick={() => notify(it)} title="Gửi lời nhắc tới cổng hội viên">
                    <BellRing size={14} /> Nhắc nhở
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        {data && data.totalHigh > items.length && (
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <button className="ad-btn is-sm" onClick={onViewAll}>
              Xem tất cả {data.totalHigh} người mức Cao <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}