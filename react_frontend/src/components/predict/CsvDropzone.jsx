import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, LoaderCircle, X, CircleAlert } from 'lucide-react';
import { t, pick } from './i18n';
import { FEATURES, downloadTemplate } from './utils';

const MAX_MB = 2;

/**
 * Khu vực kéo-thả CSV.
 * Props: form, lang, onUpload(file, onProgress) -> Promise (component cha gọi API), onBack()
 */
export default function CsvDropzone({ form, lang, onUpload, onBack }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(null); // null | 0..100 | 'processing'
  const [error, setError] = useState('');

  const pickFile = (f) => {
    setError('');
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) { setError(t(lang, 'onlyCsv')); return; }
    if (f.size > MAX_MB * 1024 * 1024) { setError(t(lang, 'tooBig', { n: MAX_MB })); return; }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setError('');
    setProgress(0);
    try {
      await onUpload(file, (p) => setProgress(p >= 100 ? 'processing' : p));
    } catch (err) {
      setError(err.response?.data?.error || t(lang, 'serverDown'));
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <div className="pw-box pw-csv">
      <h2 className="pw-h2">{t(lang, 'csvTitle')}</h2>
      <p className="pw-muted">{t(lang, 'csvIntro')} {t(lang, 'csvMoney', { unit: pick(form.money.csvUnit, lang) })}</p>

      <button type="button" className="pw-btn pw-template" onClick={() => downloadTemplate(form)}>
        <Download size={16} /> {t(lang, 'template')}
      </button>

      <div
        className={`pw-drop ${dragging ? 'is-drag' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
        onClick={() => !busy && !file && inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !file) { e.preventDefault(); inputRef.current?.click(); } }}
        aria-label={t(lang, 'dropTitle')}
      >
        <input ref={inputRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        {file ? (
          <div className="pw-file">
            <FileSpreadsheet size={26} />
            <div className="pw-file-meta">
              <div className="pw-file-name">{file.name}</div>
              <div className="pw-muted">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
            {!busy && (
              <button type="button" className="pw-icon-btn" aria-label={t(lang, 'removeFile')} onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                <X size={16} />
              </button>
            )}
          </div>
        ) : (
          <>
            <Upload size={26} />
            <div className="pw-drop-title">{t(lang, 'dropTitle')}</div>
            <div className="pw-muted">{t(lang, 'dropSub')}</div>
          </>
        )}
      </div>

      {busy && (
        <div className="pw-progress" aria-live="polite">
          <div className="pw-progress-bar"><span className={progress === 'processing' ? 'is-busy' : undefined} style={{ width: progress === 'processing' ? '100%' : `${progress}%` }} /></div>
          <div className="pw-muted">{progress === 'processing' ? t(lang, 'processing') : t(lang, 'uploading', { p: progress })}</div>
        </div>
      )}

      {error && <div className="pw-alert" role="alert"><CircleAlert size={16} /> {error}</div>}

      <details className="pw-columns">
        <summary>{t(lang, 'columns')}</summary>
        <code>{FEATURES.join(', ')}</code>
      </details>

      <div className="pw-form-foot">
        <button type="button" className="pw-btn" onClick={onBack} disabled={busy}>{t(lang, 'back')}</button>
        <span />
        <button type="button" className="pw-btn is-primary" onClick={upload} disabled={!file || busy}>
          {busy ? <><LoaderCircle size={16} className="pw-spin" /> {t(lang, 'predicting')}</> : t(lang, 'predictFile')}
        </button>
      </div>
    </div>
  );
}