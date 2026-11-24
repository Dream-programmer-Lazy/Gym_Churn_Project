import { useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Download, RotateCcw, TriangleAlert, CircleAlert, DatabaseZap, CircleCheck, LoaderCircle } from 'lucide-react';
import { t } from './i18n';
import { FEATURES, CUSTOMERS_API, downloadCsv, fmtNum, isDuplicateConflict } from './utils';
import { DuplicateDialog } from './SaveToSystem';

const TONE = { 'Cao': 'high', 'Trung bình': 'mid', 'Thấp': 'low' };
const PAGE = 100;

/**
 * Kết quả dự báo cả file CSV.
 * Props: data (JSON từ /api/predict/csv), fileName, lang, onNew()
 *        canSave (tùy chọn, chỉ trong Admin): hiện nút "Lưu tất cả vào hệ thống"
 *        market  : tên thị trường hiển thị (dùng trong câu hỏi xác nhận)
 *
 * "Lưu tất cả" (mục 3.3): gửi các dòng dự báo thành công tới POST /api/customers/bulk.
 *   - Server trả 409 nếu có tên trùng -> hiện hộp thoại Cập nhật tất cả / Bỏ qua tất cả -> gửi lại.
 *   - Dòng lỗi không gửi; dòng không có tên được server báo lỗi, không lưu.
 */
export default function CsvResults({ data, fileName, lang, onNew, canSave = false, market = '' }) {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(null);   // dữ liệu 409 (tên trùng) đang chờ người dùng chọn
  const [savedText, setSavedText] = useState('');
  const { summary, results } = data;
  const badge = t(lang, 'levelBadge');

  const okRows = useMemo(() => results.filter((r) => r.ok), [results]);
  const hasNames = useMemo(() => okRows.some((r) => String(r.fullName || '').trim()), [okRows]);

  const sendBulk = async (onDuplicate) => {
    setSaving(true);
    try {
      const rows = okRows.map((r) => ({ line: r.line, fullName: r.fullName, actualPhoneNumber: r.actualPhoneNumber, input: r.input }));
      const res = await axios.post(`${CUSTOMERS_API}/bulk`, { region: data.region, rows, ...(onDuplicate ? { onDuplicate } : {}) });
      setConflict(null);
      const d = res.data;
      const text = t(lang, 'savedSummary', { created: d.created, updated: d.updated, skipped: d.skipped, failed: d.failed });
      setSavedText(text);
      toast.success(text, { duration: 6000 });
    } catch (err) {
      if (isDuplicateConflict(err)) { setConflict(err.response.data); return; }
      if (!err.sessionExpired) toast.error(err.response?.data?.error || t(lang, 'serverDown'));
    } finally {
      setSaving(false);
    }
  };

  const saveAll = () => {
    if (!hasNames) { toast.error(t(lang, 'saveAllNeedName'), { duration: 6000 }); return; }
    if (!window.confirm(t(lang, 'saveAllConfirm', { n: okRows.length, market }))) return;
    sendBulk();
  };

  const sorted = useMemo(() => {
    const list = filter === 'all' ? results
      : filter === 'err' ? results.filter((r) => !r.ok)
        : results.filter((r) => r.ok && r.risk_level === filter);
    // Rủi ro cao lên đầu, dòng lỗi xuống cuối -> thấy ngay ai cần chăm sóc
    return [...list].sort((a, b) => (b.ok ? b.probability_percent : -1) - (a.ok ? a.probability_percent : -1));
  }, [results, filter]);

  const exportResults = () => {
    const header = ['line', 'fullName', ...FEATURES, 'probability_percent', 'risk_level', 'model_used', 'reasons', 'warnings', 'errors'];
    const rows = results.map((r) => [
      r.line, r.fullName, ...FEATURES.map((f) => r.input?.[f] ?? ''),
      r.ok ? r.probability_percent : '', r.ok ? badge[r.risk_level] : '', r.ok ? r.model_used : '',
      r.ok ? r.reasons.map((x) => x.text).join(' | ') : '', r.ok ? r.warnings.join(' | ') : '', r.ok ? '' : r.errors.join(' | '),
    ]);
    downloadCsv(fileName.replace(/\.csv$/i, '') + (lang === 'vi' ? '_ket_qua.csv' : '_results.csv'), header, rows);
  };

  const chips = [
    { key: 'all', label: t(lang, 'all'), count: summary.total },
    { key: 'Cao', label: t(lang, 'high'), count: summary['Cao'], tone: 'high' },
    { key: 'Trung bình', label: t(lang, 'medium'), count: summary['Trung bình'], tone: 'mid' },
    { key: 'Thấp', label: t(lang, 'low'), count: summary['Thấp'], tone: 'low' },
    ...(summary.failed ? [{ key: 'err', label: t(lang, 'errors'), count: summary.failed, tone: 'err' }] : []),
  ];

  return (
    <div className="pw-box pw-csv-result">
      <div className="pw-csv-head">
        <div>
          <h2 className="pw-h2">{t(lang, 'csvResult')}</h2>
          <p className="pw-muted">
            {t(lang, 'csvSummary', { file: fileName, ok: summary.ok, total: summary.total })}
            {summary.failed ? t(lang, 'csvFailed', { n: summary.failed }) : ''}.
          </p>
        </div>
        <div className="pw-actions-row">
          <button type="button" className="pw-btn" onClick={onNew} disabled={saving}><RotateCcw size={16} /> {t(lang, 'otherFile')}</button>
          <button type="button" className={`pw-btn ${canSave ? '' : 'is-primary'}`} onClick={exportResults}><Download size={16} /> {t(lang, 'downloadResult')}</button>
          {canSave && !savedText && (
            <button type="button" className="pw-btn is-primary" onClick={saveAll} disabled={saving || okRows.length === 0}
              title={hasNames ? undefined : t(lang, 'saveAllNeedName')}>
              {saving ? <LoaderCircle size={16} className="pw-spin" /> : <DatabaseZap size={16} />} {saving ? t(lang, 'saving') : t(lang, 'saveAll')}
            </button>
          )}
        </div>
      </div>

      {savedText && (
        <p className="pw-saved" role="status" style={{ height: 'auto', padding: '8px 14px', margin: '0 0 14px' }}>
          <CircleCheck size={16} /> {savedText}
        </p>
      )}

      {conflict && (
        <DuplicateDialog lang={lang} market={market} conflict={conflict} busy={saving}
          onChoose={(mode) => sendBulk(mode)} onCancel={() => setConflict(null)} />
      )}

      {summary.ok > 0 && (
        <div className="pw-dist" aria-hidden>
          {['Cao', 'Trung bình', 'Thấp'].map((k) => summary[k] > 0 && (
            <span key={k} className={`tone-${TONE[k]}`} style={{ flexGrow: summary[k] }} />
          ))}
        </div>
      )}

      <div className="pw-chips" role="group">
        {chips.map((c) => (
          <button key={c.key} type="button" className={`pw-chip ${c.tone ? `tone-${c.tone}` : ''}`}
            aria-pressed={filter === c.key} onClick={() => { setFilter(c.key); setLimit(PAGE); }}>
            {c.tone && c.tone !== 'err' && <span className="pw-dot" />}
            {c.label} <b className="pw-num">{c.count}</b>
          </button>
        ))}
      </div>

      <div className="pw-table-wrap">
        <table className="pw-table">
          <thead>
            <tr><th>{t(lang, 'colLine')}</th><th>{t(lang, 'colMember')}</th><th>{t(lang, 'colRisk')}</th><th>{t(lang, 'colReason')}</th></tr>
          </thead>
          <tbody>
            {sorted.slice(0, limit).map((r) => (
              <tr key={r.line} className={r.ok ? undefined : 'is-error'}>
                <td className="pw-num pw-muted">{r.line}</td>
                <td>{r.fullName || <span className="pw-muted">{t(lang, 'noName')}</span>}</td>
                <td>
                  {r.ok ? (
                    <span className={`pw-badge tone-${TONE[r.risk_level]}`}>
                      <b className="pw-num">{fmtNum(r.probability_percent, lang)}%</b> {badge[r.risk_level]}
                    </span>
                  ) : <span className="pw-badge tone-err"><CircleAlert size={12} /> {t(lang, 'error')}</span>}
                </td>
                <td className="pw-reason-cell">
                  {r.ok ? (
                    <>
                      {r.reasons[0] ? <><b>{r.reasons[0].title}</b>{r.reasons[0].detail && <span className="pw-muted"> {r.reasons[0].detail}</span>}</>
                        : <span className="pw-muted">{t(lang, 'noReason')}</span>}
                      {r.warnings.length > 0 && <span className="pw-warn-inline" title={r.warnings.join('\n')}><TriangleAlert size={12} /> {t(lang, 'notes', { n: r.warnings.length })}</span>}
                    </>
                  ) : <span className="pw-error">{r.errors.join(' ')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sorted.length === 0 && <div className="pw-empty">{t(lang, 'emptyGroup')}</div>}
      </div>

      {sorted.length > limit && (
        <button type="button" className="pw-btn pw-more" onClick={() => setLimit(limit + PAGE)}>
          {t(lang, 'showMore', { n: Math.min(PAGE, sorted.length - limit) })}
        </button>
      )}
    </div>
  );
}