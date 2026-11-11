import { useEffect } from 'react';
import { TriangleAlert, PenLine, RotateCcw, Download } from 'lucide-react';
import { t } from './i18n';
import { fmtNum, shortName } from './utils';
import Rich from './Rich';

const TONE = { 'Cao': 'high', 'Trung bình': 'mid', 'Thấp': 'low' };

/**
 * Kết quả dự báo 1 hội viên.
 * Props: result (JSON từ /api/predict, đã đúng ngôn ngữ), fullName, lang, onEdit, onNew
 */
export default function ResultCard({ result, fullName, lang, onEdit, onNew }) {
  const tone = TONE[result.risk_level] || 'low';
  const pct = Math.max(0, Math.min(100, result.probability_percent));
  const { high, medium } = result.thresholds || { high: 70, medium: 50 };
  const name = shortName(fullName, result.region);
  const levelWord = t(lang, 'levels')[result.risk_level];
  const date = new Date().toLocaleDateString(lang === 'vi' ? 'vi-VN' : 'en-GB');
  const hasReasons = result.reasons?.length > 0;
  const actions = result.advice?.actions || [];

  // Tên file PDF gợi ý = tiêu đề trang lúc in
  useEffect(() => {
    const original = document.title;
    const before = () => { document.title = `${lang === 'vi' ? 'Ket_qua_du_bao' : 'Churn_result'}${fullName ? '_' + fullName.trim().replace(/\s+/g, '_') : ''}`; };
    const after = () => { document.title = original; };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); };
  }, [fullName, lang]);

  return (
    <div className={`pw-result tone-${tone}`}>
      <div className="pw-print-only pw-print-head">
        <div className="pw-brand-print">POWER GYM<span>.AI</span></div>
        <div>{t(lang, 'title')}, {date}</div>
      </div>

      <section className="pw-hero">
        {fullName?.trim() && <div className="pw-hero-who">{t(lang, 'resultFor', { name: fullName.trim() })}</div>}
        <h2 className="pw-hero-title">
          <Rich text={t(lang, 'headline', { name: name || t(lang, 'thisMember'), level: levelWord })} />
        </h2>
        <div className="pw-score">
          <div className="pw-pct pw-num">{fmtNum(pct, lang)}<small>%</small></div>
          <div className="pw-gauge" aria-hidden>
            <div className="pw-gauge-track" style={{ '--m': `${medium}%`, '--h': `${high}%` }}>
              <span className="pw-gauge-marker" style={{ left: `${pct}%` }} />
            </div>
            <div className="pw-gauge-labels">
              <span style={{ left: 0 }}>{t(lang, 'safe')}</span>
              <span style={{ left: `${medium}%` }} className="is-mid">{medium}%</span>
              <span style={{ left: `${high}%` }} className="is-mid">{high}%</span>
              <span style={{ right: 0 }}>{t(lang, 'highRisk')}</span>
            </div>
          </div>
        </div>
      </section>

      {result.warnings?.length > 0 && (
        <section className="pw-box pw-warnbox" role="note">
          <h3 className="pw-h3"><TriangleAlert size={16} /> {t(lang, 'reliability')}</h3>
          <ul>{result.warnings.map((w) => <li key={w.message}>{w.message}</li>)}</ul>
        </section>
      )}

      <div className="pw-cols">
        <section className="pw-box">
          {hasReasons ? (
            <>
              <h3 className="pw-h3">{name ? t(lang, 'whyRisk', { name }) : t(lang, 'whyRiskGeneric')}</h3>
              <ol className="pw-why">
                {result.reasons.map((r, i) => (
                  <li key={r.field}>
                    <span className="pw-why-num">{i + 1}</span>
                    <div><div className="pw-why-title">{r.title}</div>{r.detail && <div className="pw-why-detail">{r.detail}</div>}</div>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <h3 className="pw-h3">{t(lang, 'keeping')}</h3>
              {result.protective_factors?.length ? (
                <ol className="pw-why is-good">
                  {result.protective_factors.map((r, i) => (
                    <li key={r.field}>
                      <span className="pw-why-num">{i + 1}</span>
                      <div><div className="pw-why-title">{r.title}</div>{r.detail && <div className="pw-why-detail">{r.detail}</div>}</div>
                    </li>
                  ))}
                </ol>
              ) : <p className="pw-muted">{t(lang, 'noRiskFactor')}</p>}
            </>
          )}
        </section>

        <section className="pw-box">
          <h3 className="pw-h3">{actions.length ? t(lang, 'todo') : result.advice?.title}</h3>
          {actions.length ? (
            <ul className="pw-todo">
              {actions.map((a) => (
                <li key={a}><label><input type="checkbox" /> <span>{a}</span></label></li>
              ))}
            </ul>
          ) : <p className="pw-muted">{result.advice?.text}</p>}
        </section>
      </div>

      <p className="pw-print-only pw-print-note">
        {t(lang, 'printNote', { model: result.model_used, region: result.region_label, date })}
      </p>

      <div className="pw-result-actions">
        <button type="button" className="pw-btn" onClick={onEdit}><PenLine size={16} /> {t(lang, 'editAnswers')}</button>
        <button type="button" className="pw-btn" onClick={onNew}><RotateCcw size={16} /> {t(lang, 'newMember')}</button>
        <button type="button" className="pw-btn is-primary" onClick={() => window.print()}><Download size={16} /> {t(lang, 'printPdf')}</button>
      </div>
    </div>
  );
}