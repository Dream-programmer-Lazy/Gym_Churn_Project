import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { LoaderCircle, Search } from 'lucide-react';
import { t, pick } from './i18n';
import { CUSTOMERS_API, FEATURES, toPayload } from './utils';
import '../../styles/wizard.css';
import '../../styles/predict-admin.css';

/* ======================================================================
   HỘP THOẠI DÙNG TRONG ADMIN
   - SaveDialog      : "Lưu vào hệ thống" cho 1 hội viên (mục 3.2)
                       ① Tạo hội viên mới  -> POST /api/customers
                       ② Gắn vào hội viên đã có (tìm theo tên / SĐT, cùng thị trường) -> PUT /api/customers/:id
   - DuplicateDialog : hỏi "Cập nhật tất cả / Bỏ qua tất cả" khi lưu nhiều dòng bị trùng tên (mục 3.3).
                       Nơi gọi tự nhận biết lỗi trùng: err.response.status === 409 && err.response.data.needsDecision
   ====================================================================== */

/** Bỏ dấu tiếng Việt + chữ thường để tìm kiếm dễ hơn: "Phạm Thanh" ~ "pham thanh" */
const fold = (s) => String(s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'd').toLowerCase().trim();

const MAX_MATCHES = 30;

/** Khung chung: nền mờ + hộp giữa màn hình, đưa ra ngoài <body> để không bị khung cha che */
function Modal({ titleId, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="pw-root pw-dialog-host">
      <div className="pw-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
        <div className="pw-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Option({ checked, onClick, title, text }) {
  return (
    <button type="button" role="radio" aria-checked={checked} className="pw-option" onClick={onClick}>
      <span className="pw-radio" />
      <span>
        <span className="pw-option-title">{title}</span>
        <span className="pw-option-text">{text}</span>
      </span>
    </button>
  );
}

/* ============================== LƯU 1 HỘI VIÊN ============================== */
/**
 * Props:
 *   form    : forms/form.vn.js hoặc form.global.js (quyết định thị trường + đơn vị tiền)
 *   values  : câu trả lời trong ManualForm (tiền theo đơn vị người dùng nhập)
 *   lang    : 'vi' | 'en'
 *   onClose : đóng hộp thoại
 *   onSaved : ({ mode: 'new' | 'attach', customer }) => void
 */
export default function SaveDialog({ form, values, lang, onClose, onSaved }) {
  const region = form.region;
  const market = pick(form.label, lang);

  const [mode, setMode] = useState('new');
  const [fullName, setFullName] = useState(values.fullName || '');
  const [phone, setPhone] = useState(values.actualPhoneNumber || '');
  const [query, setQuery] = useState(values.fullName || '');
  const [members, setMembers] = useState(null);        // null = chưa tải
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Chỉ tải danh sách hội viên khi người dùng chọn "Gắn vào hội viên đã có"
  const chooseAttach = async () => {
    setMode('attach');
    setError('');
    if (members || loadingMembers) return;
    setLoadingMembers(true);
    try {
      const res = await axios.get(CUSTOMERS_API);
      setMembers(res.data.filter((c) => (c.region || 'vn') === region));
    } catch (err) {
      if (!err.sessionExpired) setError(err.response?.data?.error || t(lang, 'serverDown'));
    } finally {
      setLoadingMembers(false);
    }
  };

  const matches = useMemo(() => {
    if (!members) return [];
    const q = fold(query);
    const digits = query.replace(/\D/g, '');
    if (!q) return members;
    return members.filter((c) => fold(c.fullName).includes(q)
      || (digits.length >= 3 && String(c.actualPhoneNumber || '').replace(/\D/g, '').includes(digits)));
  }, [members, query]);

  const submit = async () => {
    setError('');
    const payload = toPayload(form, values);   // 7 cột theo đơn vị mô hình (+ họ tên, SĐT nếu có)
    const features = {};
    FEATURES.forEach((f) => { features[f] = payload[f]; });

    if (mode === 'new') {
      if (!fullName.trim()) { setError(t(lang, 'needName')); return; }
    } else if (!selectedId) {
      setError(t(lang, 'pickMember'));
      return;
    }

    setSaving(true);
    try {
      let customer;
      if (mode === 'new') {
        const body = { ...features, region, fullName: fullName.trim() };
        if (phone.trim()) body.actualPhoneNumber = phone.trim();
        customer = (await axios.post(CUSTOMERS_API, body)).data.customer;
      } else {
        // Gắn vào hồ sơ cũ: chỉ cập nhật 7 cột + dự báo; giữ nguyên họ tên, số điện thoại
        customer = (await axios.put(`${CUSTOMERS_API}/${selectedId}`, { ...features, region })).data.customer;
      }
      onSaved?.({ mode, customer });
    } catch (err) {
      if (!err.sessionExpired) setError(err.response?.data?.error || t(lang, 'serverDown'));
    } finally {
      setSaving(false);
    }
  };

  const shown = matches.slice(0, MAX_MATCHES);

  return (
    <Modal titleId="pw-save-title" onClose={saving ? undefined : onClose}>
      <div className="pw-dialog-head">
        <h2 id="pw-save-title">{t(lang, 'saveTitle')}</h2>
        <p>{t(lang, 'saveIntro', { market })}</p>
      </div>

      <div className="pw-dialog-body">
        <div className="pw-options" role="radiogroup" aria-label={t(lang, 'saveTitle')}>
          <Option checked={mode === 'new'} onClick={() => { setMode('new'); setError(''); }}
            title={t(lang, 'saveModeNew')} text={t(lang, 'saveModeNewText')} />
          <Option checked={mode === 'attach'} onClick={chooseAttach}
            title={t(lang, 'saveModeAttach')} text={t(lang, 'saveModeAttachText')} />
        </div>

        {mode === 'new' ? (
          <>
            <div className="pw-field">
              <label htmlFor="pw-save-name">{t(lang, 'fieldName')}</label>
              <input id="pw-save-name" className="pw-input" value={fullName} autoFocus
                onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="pw-field">
              <label htmlFor="pw-save-phone">{t(lang, 'fieldPhone')}</label>
              <input id="pw-save-phone" className="pw-input" value={phone} inputMode="tel"
                onChange={(e) => setPhone(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="pw-field">
            <label htmlFor="pw-save-search">{t(lang, 'searchMember')}</label>
            <div style={{ position: 'relative' }}>
              <input id="pw-save-search" className="pw-input" value={query} autoFocus style={{ paddingLeft: 38 }}
                onChange={(e) => { setQuery(e.target.value); setSelectedId(null); }} />
              <Search size={16} style={{ position: 'absolute', left: 13, top: 14, color: 'var(--muted)' }} aria-hidden />
            </div>
            <p className="pw-hint">{t(lang, 'searchHint', { market })}</p>

            {loadingMembers && (
              <div className="pw-member-empty"><LoaderCircle size={14} className="pw-spin" /> {t(lang, 'loadingMembers')}</div>
            )}
            {members && (
              <ul className="pw-member-list" role="listbox" aria-label={t(lang, 'searchMember')}>
                {shown.length === 0 && <li className="pw-member-empty">{t(lang, 'noMatch')}</li>}
                {shown.map((c) => (
                  <li key={c._id}>
                    <button type="button" role="option" aria-selected={selectedId === c._id} className="pw-member-item"
                      onClick={() => { setSelectedId(c._id); setError(''); }}>
                      <span>
                        <span className="pw-member-name">{c.fullName}</span>
                        <span className="pw-member-meta"> · {c.actualPhoneNumber || '—'}</span>
                      </span>
                      <span className="pw-member-meta">
                        {c.prediction?.risk_level && c.prediction.risk_level !== 'Chưa dự báo'
                          ? `${t(lang, 'levelBadge')[c.prediction.risk_level] || c.prediction.risk_level} · ${c.prediction.probability_percent ?? 0}%`
                          : ''}
                      </span>
                    </button>
                  </li>
                ))}
                {matches.length > MAX_MATCHES && (
                  <li className="pw-member-empty">{t(lang, 'moreMatches', { n: matches.length - MAX_MATCHES })}</li>
                )}
              </ul>
            )}
          </div>
        )}

        {error && <div className="pw-field-error" role="alert">{error}</div>}
      </div>

      <div className="pw-dialog-foot">
        <button type="button" className="pw-btn" onClick={onClose} disabled={saving}>{t(lang, 'cancel')}</button>
        <button type="button" className="pw-btn is-primary" onClick={submit} disabled={saving}>
          {saving ? <><LoaderCircle size={16} className="pw-spin" /> {t(lang, 'saving')}</> : t(lang, 'save')}
        </button>
      </div>
    </Modal>
  );
}

/* ============================== TRÙNG TÊN (LƯU NHIỀU) ============================== */
/**
 * Props:
 *   lang, market (tên thị trường hiển thị)
 *   conflict : dữ liệu lỗi 409 từ server { duplicateCount, duplicates: [tên...] }
 *   busy     : đang gửi lại
 *   onChoose : ('update' | 'skip') => void
 *   onCancel : () => void  (không lưu gì)
 */
export function DuplicateDialog({ lang, market, conflict, busy, onChoose, onCancel }) {
  const [choice, setChoice] = useState('update');
  const names = conflict?.duplicates || [];
  const shownNames = names.slice(0, 8);
  const more = (conflict?.duplicateCount || names.length) - shownNames.length;

  return (
    <Modal titleId="pw-dup-title" onClose={busy ? undefined : onCancel}>
      <div className="pw-dialog-head">
        <h2 id="pw-dup-title">{t(lang, 'dupTitle', { n: conflict?.duplicateCount || names.length })}</h2>
        <p>{t(lang, 'dupQuestion')}</p>
      </div>
      <div className="pw-dialog-body">
        <p className="pw-dup-names">
          {t(lang, 'dupText', {
            market,
            names: shownNames.join(', '),
            more: more > 0 ? t(lang, 'dupMore', { n: more }) : '',
          })}
        </p>
        <div className="pw-options" role="radiogroup" aria-label={t(lang, 'dupQuestion')}>
          <Option checked={choice === 'update'} onClick={() => setChoice('update')}
            title={t(lang, 'dupUpdate')} text={t(lang, 'dupUpdateText')} />
          <Option checked={choice === 'skip'} onClick={() => setChoice('skip')}
            title={t(lang, 'dupSkip')} text={t(lang, 'dupSkipText')} />
        </div>
      </div>
      <div className="pw-dialog-foot">
        <button type="button" className="pw-btn" onClick={onCancel} disabled={busy}>{t(lang, 'cancel')}</button>
        <button type="button" className="pw-btn is-primary" onClick={() => onChoose(choice)} disabled={busy}>
          {busy ? <><LoaderCircle size={16} className="pw-spin" /> {t(lang, 'saving')}</> : (choice === 'update' ? t(lang, 'dupUpdate') : t(lang, 'dupSkip'))}
        </button>
      </div>
    </Modal>
  );
}