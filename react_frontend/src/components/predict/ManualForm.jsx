import { useState } from 'react';
import { Check, TriangleAlert, LoaderCircle, Minus, Plus } from 'lucide-react';
import { t, pick } from './i18n';
import { validateSection, softWarning, parseNum, fmtNum, fmtMoney } from './utils';
import Rich from './Rich';

/* ============================ CÁC Ô NHẬP ============================ */

function ChoiceInput({ q, value, onChange, lang }) {
  return (
    <div className="pw-opts" role="radiogroup" aria-label={pick(q.label, lang)}>
      {q.options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value !== '' && Number(value) === o.value}
          className="pw-opt" onClick={() => onChange(o.value)}>
          <span className="pw-radio" />{pick(o.label, lang)}
        </button>
      ))}
    </div>
  );
}

function StepperInput({ q, value, onChange, lang, max, invalid, id }) {
  const n = parseNum(value);
  const clamp = (x) => Math.max(q.min ?? 0, Math.min(max ?? Infinity, x));
  const step = (d) => onChange(clamp(Number.isNaN(n) ? q.start : n + d));
  return (
    <div className={`pw-stepper ${invalid ? 'has-error' : ''}`}>
      <button type="button" aria-label="-" onClick={() => step(-1)} disabled={!Number.isNaN(n) && n <= (q.min ?? 0)}><Minus size={18} /></button>
      <input id={id} inputMode="numeric" value={value} placeholder="–" aria-invalid={invalid}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))} />
      <span className="pw-stepper-unit">{lang === 'en' && n === 1 ? pick(q.unit, lang).replace(/s$/, '') : pick(q.unit, lang)}</span>
      <button type="button" aria-label="+" onClick={() => step(1)} disabled={!Number.isNaN(n) && max !== undefined && n >= max}><Plus size={18} /></button>
    </div>
  );
}

function SliderInput({ q, value, onChange, lang, invalid, id }) {
  const n = parseNum(value);
  const unset = Number.isNaN(n);
  const pct = unset ? 0 : (Math.min(n, q.max) / q.max) * 100;
  const shown = typeof value === 'number' ? fmtNum(value, lang) : value;
  return (
    <div className={`pw-slider ${unset ? 'is-unset' : ''}`}>
      <div className="pw-slider-row">
        <div className="pw-range-wrap">
          <input type="range" min={q.min} max={q.max} step={q.step} value={unset ? 0 : Math.min(n, q.max)}
            style={{ '--pct': `${pct}%` }} aria-label={pick(q.label, lang)}
            onChange={(e) => onChange(Number(e.target.value))}
            onPointerUp={(e) => { if (unset) onChange(Number(e.currentTarget.value)); }} />
          <div className="pw-ticks" aria-hidden>
            {Array.from({ length: q.max - q.min + 1 }, (_, i) => <span key={i}>{q.min + i}</span>)}
          </div>
        </div>
        <label className={`pw-slider-value ${invalid ? 'has-error' : ''}`}>
          <input id={id} inputMode="decimal" value={shown} placeholder="–" aria-invalid={invalid}
            onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} />
          <span>{pick(q.unit, lang)}</span>
        </label>
      </div>
    </div>
  );
}

function PlansInput({ q, value, onChange, lang }) {
  return (
    <div className="pw-plans" style={{ gridTemplateColumns: `repeat(${q.plans.length}, 1fr)` }} role="radiogroup" aria-label={pick(q.label, lang)}>
      {q.plans.map((m) => (
        <button key={m} type="button" role="radio" aria-checked={Number(value) === m} className="pw-plan" onClick={() => onChange(m)}>
          <b>{m}</b><small>{lang === 'en' && m === 1 ? 'month' : pick(q.unit, lang)}</small>
        </button>
      ))}
    </div>
  );
}

function MoneyInput({ q, value, onChange, lang, currency, invalid, id }) {
  const n = parseNum(value);
  const isPreset = !Number.isNaN(n) && q.presets.includes(n);
  const [custom, setCustom] = useState(!Number.isNaN(n) && !isPreset);
  return (
    <div className="pw-money">
      <div className="pw-chips">
        {q.presets.map((p) => (
          <button key={p} type="button" className="pw-chip" aria-pressed={!custom && n === p}
            onClick={() => { setCustom(false); onChange(p); }}>
            {fmtMoney(p, currency)}
          </button>
        ))}
        <button type="button" className="pw-chip is-other" aria-pressed={custom}
          onClick={() => { setCustom(true); if (isPreset) onChange(''); }}>
          {t(lang, 'otherAmount')}
        </button>
      </div>
      {custom && (
        <div className={`pw-money-custom ${invalid ? 'has-error' : ''}`}>
          <input id={id} inputMode="numeric" autoFocus value={value} aria-invalid={invalid}
            placeholder={currency === 'vnd' ? '350000' : '80'}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))} />
          <span>{!Number.isNaN(n) ? fmtMoney(n, currency) : currency === 'vnd' ? 'đ' : '$'}</span>
        </div>
      )}
    </div>
  );
}

/* ============================ FORM ============================ */

/**
 * Form nhập thủ công theo cấu hình thị trường (forms/form.vn.js hoặc forms/form.global.js).
 * Props: form, lang, modelInfo, values, setValues, serverErrors, submitting,
 *        onSubmit(), onExit() (quay về bước chọn cách nhập), onChangeMarket(), initialSection
 */
export default function ManualForm({ form, lang, modelInfo, values, setValues, serverErrors = {}, submitting, onSubmit, onExit, onChangeMarket, initialSection = 0 }) {
  const [section, setSection] = useState(initialSection);
  const [doneUpTo, setDoneUpTo] = useState(initialSection - 1);
  const [errors, setErrors] = useState({});
  const sections = form.sections;
  const current = sections[section];
  const isLast = section === sections.length - 1;

  // Server báo lỗi ở câu nào -> nhảy tới phần chứa câu đó
  const [prevServerErrors, setPrevServerErrors] = useState(serverErrors);
  if (serverErrors !== prevServerErrors) {
    setPrevServerErrors(serverErrors);
    const first = Object.keys(serverErrors)[0];
    if (first) {
      const idx = sections.findIndex((s) => s.questions.some((q) => q.name === first));
      if (idx >= 0) setSection(idx);
      setErrors(serverErrors);
    }
  }

  const setField = (name, value) => {
    setValues((v) => {
      const next = { ...v, [name]: value };
      // Đổi gói ngắn hơn số tháng còn lại -> xóa số tháng còn lại để nhập lại
      sections.flatMap((s) => s.questions).forEach((q) => {
        if (q.maxFrom === name && next[q.name] !== '' && parseNum(next[q.name]) > parseNum(value)) next[q.name] = '';
      });
      return next;
    });
    if (errors[name]) setErrors((e) => { const n = { ...e }; delete n[name]; return n; });
  };

  const goNext = () => {
    const errs = validateSection(form, section, values, lang);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`pw-q-${Object.keys(errs)[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setDoneUpTo((d) => Math.max(d, section));
    if (isLast) { onSubmit(); return; }
    setSection(section + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setErrors({});
    if (section === 0) onExit();
    else setSection(section - 1);
  };

  const renderInput = (q) => {
    const common = { q, value: values[q.name], onChange: (v) => setField(q.name, v), lang, invalid: !!errors[q.name], id: `pw-in-${q.name}` };
    switch (q.type) {
      case 'text':
        return <input id={common.id} className="pw-input" value={values[q.name]} placeholder={pick(q.placeholder, lang)}
          onChange={(e) => setField(q.name, e.target.value)} />;
      case 'choice': return <ChoiceInput {...common} />;
      case 'plans': return <PlansInput {...common} />;
      case 'slider': return <SliderInput {...common} />;
      case 'money': return <MoneyInput {...common} currency={form.money.currency} />;
      case 'stepper': {
        const cap = q.maxFrom ? parseNum(values[q.maxFrom]) : q.max;
        return <StepperInput {...common} max={Number.isNaN(cap) ? q.max : cap} />;
      }
      default: return null;
    }
  };

  const insightFor = (q) => {
    if (!q.insightFrom) return null;
    const avg = parseNum(values[q.insightFrom]);
    const now = parseNum(values[q.name]);
    if (Number.isNaN(avg) || Number.isNaN(now) || now > avg - 0.3) return null;
    return t(lang, 'dropInsight', { n: fmtNum(avg - now, lang) });
  };

  return (
    <div className="pw-form-layout">
      <aside className="pw-rail">
        <button type="button" className="pw-market" onClick={onChangeMarket}><i />{pick(form.label, lang)}</button>
        <h1 className="pw-rail-title">{t(lang, 'title')}</h1>
        <ol className="pw-sections">
          {sections.map((s, i) => {
            const state = i === section ? 'is-current' : i <= doneUpTo ? 'is-done' : '';
            return (
              <li key={s.id} className={state}>
                <button type="button" disabled={i > doneUpTo + 1 || i === section} onClick={() => { setErrors({}); setSection(i); }}>
                  <span className="pw-sec-num">{state === 'is-done' ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
                  {pick(s.title, lang)}
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <section className="pw-form-main">
        <h2 className="pw-h2">{pick(current.title, lang)}</h2>

        {current.questions.map((q) => {
          const warn = softWarning(q, values, form, modelInfo, lang);
          const insight = insightFor(q);
          return (
            <div key={q.name} id={`pw-q-${q.name}`} className={`pw-q ${errors[q.name] ? 'has-error' : ''}`}>
              <label className="pw-q-label" htmlFor={`pw-in-${q.name}`}>{pick(q.label, lang)}</label>
              {q.hint && <div className="pw-q-hint">{pick(q.hint, lang)}</div>}
              <div className="pw-q-control">{renderInput(q)}</div>
              {errors[q.name] && <div className="pw-q-error">{errors[q.name]}</div>}
              {!errors[q.name] && warn && <div className="pw-q-warn"><TriangleAlert size={14} /> {warn}</div>}
              {insight && <div className="pw-insight"><TriangleAlert size={16} /><div><Rich text={insight} /></div></div>}
            </div>
          );
        })}

        <div className="pw-form-foot">
          <button type="button" className="pw-btn" onClick={goBack} disabled={submitting}>{t(lang, 'back')}</button>
          <span className="pw-muted">{t(lang, 'sectionOf', { i: section + 1, n: sections.length })}</span>
          <button type="button" className="pw-btn is-primary" onClick={goNext} disabled={submitting}>
            {submitting ? <><LoaderCircle size={16} className="pw-spin" /> {t(lang, 'predicting')}</> : isLast ? t(lang, 'predict') : t(lang, 'next')}
          </button>
        </div>
      </section>
    </div>
  );
}