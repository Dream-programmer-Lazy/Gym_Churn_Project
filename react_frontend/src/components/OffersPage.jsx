import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Gift, Send, MapPin, Globe, RefreshCw, Inbox, Info } from 'lucide-react';
import { API_URL } from '../config';

/**
 * TRANG "ƯU ĐÃI" — duyệt gửi ưu đãi gia hạn (mục 5.2) + nhật ký gửi (mục 5.5)
 * Luồng: chọn thị trường -> xem danh sách ĐỀ XUẤT (mức Cao, chưa nhận ưu đãi trong 30 ngày)
 *        -> hệ thống TỰ TICK từ người rủi ro cao nhất xuống, dừng khi chạm ngân sách
 *        -> chủ phòng tập tick / bỏ tick thêm nếu muốn -> thấy tổng chi phí -> Gửi.
 * Đổi mức giảm hoặc ngân sách -> tự chọn lại theo ngân sách mới.
 * Không bao giờ tự gửi khi chưa duyệt. Vượt ngân sách -> nút Gửi bị khóa (server cũng kiểm tra lại).
 * Chế độ demo: chưa gửi email thật; ưu đãi (kèm mã riêng) hiện trong cổng hội viên.
 */
const MARKETS = [
  { region: 'vn', name: 'Việt Nam', Icon: MapPin, defaultBudget: 2000000 },
  { region: 'global', name: 'Quốc tế', Icon: Globe, defaultBudget: 200 },
];

const fmtMoney = (v, region) => (region === 'vn'
  ? `${Math.round(Number(v) || 0).toLocaleString('de-DE')}đ`
  : `$${Math.round(Number(v) || 0).toLocaleString('en-US')}`);
// Làm tròn giống server: VND tới 1.000đ, USD tới 1 đô
const roundMoney = (v, region) => (region === 'vn' ? Math.round(v / 1000) * 1000 : Math.round(v));
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');
const costOfItem = (it, discount, region) => (it.plan_price ? roundMoney(it.plan_price * discount / 100, region) : 0);

/**
 * Tự chọn theo ngân sách: đi từ người rủi ro cao nhất xuống (items đã xếp sẵn),
 * ai còn vừa ngân sách thì tick; người không vừa thì bỏ qua, xét tiếp người sau (có thể gói rẻ hơn).
 */
const autoPick = (items, discount, region, budget) => {
  const picked = new Set();
  if (!(budget > 0)) return picked;
  let total = 0;
  items.forEach((it) => {
    if (!it.plan_price) return;
    const cost = costOfItem(it, discount, region);
    if (total + cost <= budget) {
      picked.add(String(it._id));
      total += cost;
    }
  });
  return picked;
};

export default function OffersPage() {
  const [region, setRegion] = useState('vn');
  const [data, setData] = useState(null);           // kết quả /proposals
  const [log, setLog] = useState([]);
  const [error, setError] = useState('');
  // null = đang ở chế độ "tự chọn theo ngân sách"; Set = chủ phòng tập đã tick / bỏ tick bằng tay
  const [manual, setManual] = useState(null);
  const [discount, setDiscount] = useState(10);
  const [validDays, setValidDays] = useState(14);
  const [budget, setBudget] = useState(String(MARKETS[0].defaultBudget));
  const [sending, setSending] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const market = MARKETS.find((m) => m.region === region);

  // Tải đề xuất + nhật ký; danh sách tick do autoPick tính (rủi ro cao nhất trước, vừa ngân sách)
  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const [p, l] = await Promise.all([
          axios.get(`${API_URL}/offers/proposals`, { params: { region } }),
          axios.get(`${API_URL}/offers/log`, { params: { region, limit: 100 } }),
        ]);
        if (!isMounted) return;
        setData(p.data);
        setLog(l.data.items || []);
        setManual(null);   // tải mới -> quay về tự chọn theo ngân sách
        setError('');
      } catch (err) {
        if (isMounted && !err.sessionExpired) setError(err.response?.data?.error || 'Không kết nối được máy chủ Node (cổng 3001).');
      }
    };
    load();
    return () => { isMounted = false; };
  }, [region, reloadKey]);

  const switchRegion = (r) => {
    if (r === region) return;
    setRegion(r);
    setData(null);
    setBudget(String(MARKETS.find((m) => m.region === r).defaultBudget));
    setManual(null);
  };
  // Đổi mức giảm / ngân sách -> chi phí từng người đổi -> tự chọn lại theo ngân sách
  const changeDiscount = (d) => { setDiscount(d); setManual(null); };
  const changeBudget = (v) => { setBudget(v); setManual(null); };

  const items = useMemo(() => data?.items || [], [data]);
  const costOf = (it) => costOfItem(it, discount, region);
  const budgetNum = Number(String(budget).replace(/[^\d.]/g, ''));
  const autoSelected = useMemo(() => autoPick(items, discount, region, budgetNum), [items, discount, region, budgetNum]);
  const selected = manual ?? autoSelected;
  const isAuto = manual === null;
  const chosen = items.filter((it) => selected.has(String(it._id)));
  const totalCost = chosen.reduce((s, it) => s + costOf(it), 0);
  const overBudget = !(budgetNum > 0) || totalCost > budgetNum;
  const selectable = items.filter((it) => it.plan_price);
  const allChecked = selectable.length > 0 && selectable.every((it) => selected.has(String(it._id)));

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setManual(next);
  };
  const toggleAll = () => setManual(allChecked ? new Set() : new Set(selectable.map((it) => String(it._id))));
  const notPicked = selectable.length - chosen.length;

  const send = async () => {
    if (!chosen.length || overBudget) return;
    const ok = window.confirm(
      `Gửi ưu đãi giảm ${discount}% (hạn dùng ${validDays} ngày) cho ${chosen.length} hội viên ${market.name}?\n`
      + `Tổng chi phí ước tính: ${fmtMoney(totalCost, region)} / ngân sách ${fmtMoney(budgetNum, region)}.\n\n`
      + 'Mỗi người nhận 1 mã riêng, hiện trong cổng hội viên. Thao tác này được ghi vào nhật ký.',
    );
    if (!ok) return;
    setSending(true);
    const loadingToast = toast.loading('Đang tạo mã và gửi ưu đãi...');
    try {
      const res = await axios.post(`${API_URL}/offers/send`, {
        region, customerIds: chosen.map((it) => it._id), discountPercent: discount, validDays, budget: budgetNum,
      });
      toast.success(res.data.message, { id: loadingToast, duration: 8000 });
      if (res.data.skipped?.length || res.data.failed?.length) console.table([...(res.data.skipped || []), ...(res.data.failed || [])]);
      setReloadKey((k) => k + 1);
    } catch (err) {
      if (err.sessionExpired) toast.dismiss(loadingToast);
      else toast.error(err.response?.data?.error || 'Lỗi khi gửi ưu đãi.', { id: loadingToast, duration: 8000 });
    } finally {
      setSending(false);
    }
  };

  const chip = (active) => ({ 'aria-pressed': active });

  return (
    <>
      <div className="ad-page-head">
        <div>
          <h1 className="ad-h1">Ưu đãi gia hạn</h1>
          <p className="ad-sub">
            Đề xuất gửi cho hội viên <b>mức Cao</b> chưa nhận ưu đãi trong {data?.cooldownDays ?? 30} ngày. Không gửi tự động: bạn duyệt rồi mới gửi.
          </p>
        </div>
        <div className="ad-actions">
          <div className="ad-tabs" role="group" aria-label="Chọn thị trường">
            {MARKETS.map(({ region: r, name, Icon }) => (
              <button key={r} className="ad-tab tone-all" aria-pressed={region === r} onClick={() => switchRegion(r)}>
                <Icon size={14} /> {name}
              </button>
            ))}
          </div>
          <button className="ad-btn" onClick={() => setReloadKey((k) => k + 1)}><RefreshCw size={15} /> Tải lại</button>
        </div>
      </div>

      <div className="ad-panel" style={{ padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--page)' }}>
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>
          <b>Chế độ demo:</b> chưa gửi email thật. Mỗi hội viên nhận 1 mã riêng (dạng GYM-XXXXXX), nội dung ưu đãi hiện trong <b>cổng hội viên</b>.
          Giá gói là <b>giá tham khảo phân khúc tầm trung</b>{data?.prices ? ` (${Object.entries(data.prices).map(([m, p]) => `${m} tháng ${fmtMoney(p, region)}`).join(' · ')})` : ''}.
        </span>
      </div>

      {error && (
        <div className="ad-panel" role="alert" style={{ padding: 16, marginBottom: 16, color: 'var(--high-ink)', background: 'var(--high-bg)' }}>
          Không tải được dữ liệu: {error}
        </div>
      )}

      {/* ---------- Thiết lập đợt gửi ---------- */}
      <section className="ad-panel" style={{ marginBottom: 16 }} aria-label="Thiết lập đợt gửi">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, padding: 20 }}>
          <div className="ad-field">
            <span className="ad-label">Mức giảm (trên giá gia hạn đúng gói hiện tại)</span>
            <div className="ad-seg-choice" role="group" aria-label="Mức giảm">
              {(data?.discountOptions || [5, 10, 15]).map((d) => (
                <button key={d} type="button" {...chip(discount === d)} onClick={() => changeDiscount(d)}>{d}%</button>
              ))}
            </div>
          </div>
          <div className="ad-field">
            <span className="ad-label">Hạn dùng mã</span>
            <div className="ad-seg-choice" role="group" aria-label="Hạn dùng mã">
              {(data?.validDaysOptions || [7, 14, 30]).map((d) => (
                <button key={d} type="button" {...chip(validDays === d)} onClick={() => setValidDays(d)}>{d} ngày</button>
              ))}
            </div>
          </div>
          <div className="ad-field">
            <label className="ad-label" htmlFor="offer-budget">Ngân sách đợt này ({region === 'vn' ? 'VNĐ' : 'USD'})</label>
            <input id="offer-budget" className="ad-input ad-num" type="number" min="0" step={region === 'vn' ? 100000 : 10}
              value={budget} onChange={(e) => changeBudget(e.target.value)} />
            <span className="ad-hint">{budgetNum > 0 ? fmtMoney(budgetNum, region) : 'Nhập số tiền lớn hơn 0'}</span>
          </div>
        </div>
      </section>

      {/* ---------- Danh sách đề xuất ---------- */}
      <section className="ad-panel" style={{ marginBottom: 16 }} aria-label="Danh sách đề xuất">
        <div className="ad-panel-head">
          <div>
            <h3 className="ad-h3" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Gift size={16} /> Đề xuất gửi · {market.name}
              {data && <span className="ad-count ad-num">{items.length} người</span>}
            </h3>
            <p className="ad-h3-sub">
              Xếp theo % rủi ro giảm dần. Hệ thống tự tick người rủi ro cao nhất cho vừa ngân sách; bạn có thể tick / bỏ tick thêm.
              {data?.recentlyOffered ? ` Đã ẩn ${data.recentlyOffered} người vừa nhận ưu đãi trong ${data.cooldownDays} ngày.` : ''}
            </p>
          </div>
          {!isAuto && selectable.length > 0 && (
            <button className="ad-btn is-sm" onClick={() => setManual(null)} title="Bỏ các lựa chọn tay, tick lại theo ngân sách">
              <RefreshCw size={14} /> Chọn lại theo ngân sách
            </button>
          )}
        </div>

        <div className="ad-table-scroll" style={{ maxHeight: 460 }}>
          <table className="ad-table">
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Chọn tất cả" disabled={!selectable.length} />
                </th>
                <th>Hội viên</th>
                <th>Rủi ro</th>
                <th>Gói hiện tại</th>
                <th>Giảm ({discount}%)</th>
                <th style={{ textAlign: 'left' }}>Lý do chính</th>
              </tr>
            </thead>
            <tbody>
              {data && items.length === 0 && (
                <tr><td colSpan="6" style={{ padding: 0 }}>
                  <div className="ad-empty">
                    <div className="ad-empty-icon"><Inbox size={20} /></div>
                    <div className="ad-empty-title">Không có hội viên nào cần gửi ưu đãi</div>
                    <div>Chỉ hội viên mức Cao, chưa nhận ưu đãi trong {data.cooldownDays} ngày mới được đề xuất.</div>
                  </div>
                </td></tr>
              )}
              {items.map((it) => {
                const id = String(it._id);
                const disabled = !it.plan_price;
                return (
                  <tr key={id} style={{ opacity: disabled ? 0.5 : 1 }}>
                    <td><input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} disabled={disabled} aria-label={`Chọn ${it.fullName}`} /></td>
                    <td>
                      <div className="ad-member-name">{it.fullName}</div>
                      <div className="ad-member-phone ad-num">{it.actualPhoneNumber || 'Chưa có SĐT'}</div>
                    </td>
                    <td><b className="ad-num" style={{ color: 'var(--high)' }}>{Number(it.probability_percent || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</b></td>
                    <td>
                      <div className="ad-cell-strong">Gói {it.Contract_period} tháng</div>
                      <div className="ad-cell-sub ad-num">{disabled ? 'Không có trong bảng giá' : fmtMoney(it.plan_price, region)}</div>
                    </td>
                    <td className="ad-num">{disabled ? '—' : fmtMoney(costOf(it), region)}</td>
                    <td style={{ textAlign: 'left', minWidth: 280, maxWidth: 460, fontSize: 12.5, lineHeight: 1.45, color: 'var(--ink-2)', whiteSpace: 'normal' }}>
                      {it.mainReason || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ---------- Tổng chi phí + nút Gửi ---------- */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '14px 20px', borderTop: '1px solid var(--line)' }}>
          <div style={{ fontSize: 14 }}>
            Đã chọn <b className="ad-num">{chosen.length}</b> người · Tổng chi phí{' '}
            <b className="ad-num" style={{ color: overBudget && chosen.length ? 'var(--high)' : 'var(--ink)' }}>{fmtMoney(totalCost, region)}</b>
            {' / '}ngân sách <b className="ad-num">{budgetNum > 0 ? fmtMoney(budgetNum, region) : '—'}</b>
            {chosen.length > 0 && totalCost > budgetNum && budgetNum > 0 && (
              <span style={{ color: 'var(--high-ink)', marginLeft: 8 }}>Vượt {fmtMoney(totalCost - budgetNum, region)}: bỏ bớt người hoặc giảm mức ưu đãi.</span>
            )}
            {!overBudget && notPicked > 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 4 }}>
                {isAuto
                  ? <>Đã tự chọn những người rủi ro cao nhất vừa đủ ngân sách. Còn <b className="ad-num">{notPicked}</b> người chưa chọn: tăng ngân sách hoặc giảm mức ưu đãi để gửi thêm.</>
                  : <>Còn <b className="ad-num">{notPicked}</b> người chưa chọn.</>}
              </div>
            )}
          </div>
          <button className="ad-btn is-primary" onClick={send} disabled={sending || !chosen.length || overBudget}>
            <Send size={15} /> {sending ? 'Đang gửi...' : `Gửi ưu đãi cho ${chosen.length} người`}
          </button>
        </div>
      </section>

      {/* ---------- Nhật ký gửi ---------- */}
      <section className="ad-panel" aria-label="Nhật ký gửi">
        <div className="ad-panel-head">
          <div>
            <h3 className="ad-h3">Nhật ký gửi · {market.name} <span className="ad-count ad-num">{log.length}</span></h3>
            <p className="ad-h3-sub">100 lần gửi gần nhất. Đây là dữ liệu để đo hiệu quả ưu đãi sau này.</p>
          </div>
        </div>
        <div className="ad-table-scroll" style={{ maxHeight: 420 }}>
          <table className="ad-table">
            <thead>
              <tr>
                <th>Ngày gửi</th>
                <th>Hội viên</th>
                <th>Rủi ro lúc gửi</th>
                <th>Ưu đãi</th>
                <th>Mã</th>
                <th>Hạn dùng</th>
                <th>Kênh · Người gửi</th>
              </tr>
            </thead>
            <tbody>
              {log.length === 0 && (
                <tr><td colSpan="7" style={{ padding: 20, color: 'var(--muted)', textAlign: 'center' }}>Chưa gửi ưu đãi nào ở thị trường này.</td></tr>
              )}
              {log.map((o) => (
                <tr key={o._id}>
                  <td className="ad-num" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(o.createdAt)}</td>
                  <td>{o.fullName}</td>
                  <td className="ad-num">{o.risk_level} · {Number(o.probability_percent || 0).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</td>
                  <td>
                    <div className="ad-cell-strong">Giảm {o.discount_percent}% gói {o.Contract_period} tháng</div>
                    <div className="ad-cell-sub ad-num">{fmtMoney(o.final_price, region)} thay vì {fmtMoney(o.plan_price, region)}</div>
                  </td>
                  <td><code className="ad-num" style={{ fontWeight: 600 }}>{o.code}</code></td>
                  <td className="ad-num">{fmtDate(o.expires_at)}</td>
                  <td style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>
                    {o.channel === 'portal' ? 'Cổng hội viên' : o.channel} · {o.status === 'sent' ? 'Đã gửi' : 'Lỗi'}
                    <div style={{ color: 'var(--muted)' }}>{o.sent_by}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}