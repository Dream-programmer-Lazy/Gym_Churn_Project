import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Keyboard, FileSpreadsheet, LoaderCircle, CircleAlert, MapPin, Globe } from 'lucide-react';
import { t, pick } from './i18n';
import { API_BASE, FORMS, FEATURES, initialValues, toPayload, formForMode } from './utils';
import ManualForm from './ManualForm';
import CsvDropzone from './CsvDropzone';
import ResultCard from './ResultCard';
import CsvResults from './CsvResults';
import SaveDialog from './SaveToSystem';
import '../../styles/wizard.css';
import '../../styles/predict-admin.css';

const REGION_ICON = { vn: MapPin, global: Globe };

/**
 * Trang dự báo rời bỏ. Luồng: Thị trường -> Cách nhập -> Dữ liệu -> Kết quả.  Mỗi thị trường có form riêng (forms/).
 * Chỉ còn 1 mô hình: Logistic Regression, 7 chỉ số (không còn nút chọn thuật toán).
 *
 * Hai chế độ (phương án A):
 *   - Landing Page (mặc định): dùng thử công khai, KHÔNG lưu. Props: onBack() -> quay về Landing Page
 *   - embedded (trong Admin)  : bỏ header Landing, hỏi thêm số điện thoại, có nút "Lưu vào hệ thống" (3.2)
 *                               và "Lưu tất cả" cho CSV (3.3). Cần đã đăng nhập Admin/Staff.
 */
export default function PredictWizard({ onBack, embedded = false }) {
  const [lang, setLang] = useState('vi');
  const [step, setStep] = useState('region');           // region | method | input | result
  const [region, setRegion] = useState(null);
  const [method, setMethod] = useState(null);           // manual | csv

  const [modelInfo, setModelInfo] = useState(null);
  const [loadingRegion, setLoadingRegion] = useState(null);
  const [infoError, setInfoError] = useState('');

  const [values, setValues] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [formStart, setFormStart] = useState(0);

  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [csvRun, setCsvRun] = useState(0);              // tăng mỗi lần tải file mới -> làm mới trạng thái "đã lưu"

  const [saveOpen, setSaveOpen] = useState(false);
  const [savedText, setSavedText] = useState('');

  // Trang công khai không hỏi các câu "adminOnly" (vd. số điện thoại)
  const form = region ? formForMode(FORMS[region], embedded) : null;

  /* ---------- gọi API ---------- */
  const requestPredict = (useLang) =>
    axios.post(API_BASE, { ...toPayload(form, values), region, lang: useLang });

  const requestCsv = (file, useLang, onProgress) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('region', region);
    fd.append('lang', useLang);
    return axios.post(`${API_BASE}/csv?lang=${useLang}`, fd, {
      onUploadProgress: (e) => { if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); },
    });
  };

  /* ---------- đổi ngôn ngữ: kết quả đang hiển thị cũng được dịch lại ---------- */
  const changeLang = async (next) => {
    if (next === lang) return;
    setLang(next);
    if (step !== 'result') return;
    try {
      if (method === 'manual' && result) setResult((await requestPredict(next)).data);
      if (method === 'csv' && csvFile) setCsvData((await requestCsv(csvFile, next)).data);
    } catch {
      /* giữ kết quả cũ nếu dịch lại thất bại */
    }
  };

  /* ---------- các bước ---------- */
  const chooseRegion = async (r) => {
    setInfoError('');
    const nextLang = FORMS[r].defaultLang;          // Quốc tế -> tự chuyển sang tiếng Anh
    if (r === region && modelInfo) { setLang(nextLang); setStep('method'); return; }
    setLoadingRegion(r);
    try {
      const res = await axios.get(`${API_BASE}/model-info`, { params: { region: r } });
      setRegion(r);
      setLang(nextLang);
      setModelInfo(res.data);
      setValues(initialValues(formForMode(FORMS[r], embedded)));   // form mới hoàn toàn cho thị trường mới
      setResult(null);
      setCsvData(null);
      setServerErrors({});
      setSavedText('');
      setStep('method');
    } catch (err) {
      setInfoError(err.response?.data?.error || t(lang, 'serverDown'));
    } finally {
      setLoadingRegion(null);
    }
  };

  const chooseMethod = (m) => { setMethod(m); setFormStart(0); setStep('input'); };

  const submitManual = async () => {
    setSubmitting(true);
    setServerErrors({});
    try {
      const res = await requestPredict(lang);
      setResult(res.data);
      setSavedText('');                              // kết quả mới -> chưa lưu
      setStep('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors?.length) {
        const map = {};
        data.errors.forEach((e) => { if (e.field && FEATURES.includes(e.field)) map[e.field] = e.message; });
        setServerErrors(map);
      }
      toast.error(data?.error || t(lang, 'serverDown'));
    } finally {
      setSubmitting(false);
    }
  };

  const uploadCsv = async (file, onProgress) => {
    const res = await requestCsv(file, lang, onProgress);
    setCsvFile(file);
    setCsvData(res.data);
    setCsvRun((n) => n + 1);
    setStep('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const newManual = () => {
    setValues(initialValues(form));
    setResult(null);
    setSavedText('');
    setFormStart(0);
    setStep('input');
  };

  const onSaved = ({ mode, customer }) => {
    const name = customer?.fullName || values.fullName || '';
    const text = t(lang, mode === 'new' ? 'savedNew' : 'savedAttach', { name });
    setSaveOpen(false);
    setSavedText(text);
    toast.success(text);
  };

  const langSwitch = (
    <div className="pw-lang" role="radiogroup" aria-label="Language">
      <button type="button" role="radio" aria-checked={lang === 'vi'} onClick={() => changeLang('vi')}>Tiếng Việt</button>
      <button type="button" role="radio" aria-checked={lang === 'en'} onClick={() => changeLang('en')}>English</button>
    </div>
  );

  return (
    <div className={`pw-root ${embedded ? 'is-embedded' : ''}`}>
      {embedded ? (
        <div className="pw-embed-bar">
          <span className="pw-embed-note">{t(lang, 'modelNote')}</span>
          {langSwitch}
        </div>
      ) : (
        <header className="pw-header">
          <button type="button" className="pw-brand" onClick={onBack} aria-label={t(lang, 'home')}>POWER GYM<span>.AI</span></button>
          <div className="pw-header-right">
            {langSwitch}
            <button type="button" className="pw-home" onClick={onBack}><ArrowLeft size={16} /> {t(lang, 'home')}</button>
          </div>
        </header>
      )}

      <main className={`pw-main ${step === 'input' && method === 'manual' ? 'is-wide' : ''}`}>
        {/* ---------------- BƯỚC 1: THỊ TRƯỜNG ---------------- */}
        {step === 'region' && (
          <section className="pw-pick">
            <h1 className="pw-h1 pw-pick-title">{t(lang, 'chooseMarket')}</h1>
            <div className="pw-cards">
              {Object.values(FORMS).map((f) => {
                const Icon = REGION_ICON[f.region];
                return (
                  <button key={f.region} type="button" className={`pw-choice ${region === f.region ? 'is-selected' : ''}`}
                    onClick={() => chooseRegion(f.region)} disabled={!!loadingRegion}>
                    <span className="pw-choice-icon">
                      {loadingRegion === f.region ? <LoaderCircle size={26} className="pw-spin" /> : <Icon size={26} />}
                    </span>
                    <span className="pw-choice-title">{pick(f.label, lang)}</span>
                    <span className="pw-choice-text">{pick(f.plansText, lang)}</span>
                  </button>
                );
              })}
            </div>
            {infoError && <div className="pw-alert" role="alert"><CircleAlert size={16} /> {infoError}</div>}
          </section>
        )}

        {/* ---------------- BƯỚC 2: CÁCH NHẬP ---------------- */}
        {step === 'method' && form && (
          <section className="pw-pick">
            <button type="button" className="pw-market" onClick={() => setStep('region')}><i />{pick(form.label, lang)}</button>
            <h1 className="pw-h1 pw-pick-title">{t(lang, 'chooseMethod')}</h1>
            {!embedded && <p className="pw-model-note">{t(lang, 'modelNote')}</p>}
            <div className="pw-cards">
              <button type="button" className="pw-choice" onClick={() => chooseMethod('manual')}>
                <span className="pw-choice-icon"><Keyboard size={26} /></span>
                <span className="pw-choice-body">
                  <span className="pw-choice-title">{t(lang, 'manual')}</span>
                  <span className="pw-choice-text">{t(lang, 'manualText')}</span>
                </span>
              </button>
              <button type="button" className="pw-choice" onClick={() => chooseMethod('csv')}>
                <span className="pw-choice-icon"><FileSpreadsheet size={26} /></span>
                <span className="pw-choice-body">
                  <span className="pw-choice-title">{t(lang, 'csv')}</span>
                  <span className="pw-choice-text">{t(lang, 'csvText')}</span>
                </span>
              </button>
            </div>
          </section>
        )}

        {/* ---------------- BƯỚC 3: DỮ LIỆU ---------------- */}
        {step === 'input' && method === 'manual' && form && (
          <ManualForm
            key={`${region}-${formStart}`}
            form={form}
            lang={lang}
            modelInfo={modelInfo}
            values={values}
            setValues={setValues}
            serverErrors={serverErrors}
            submitting={submitting}
            onSubmit={submitManual}
            onExit={() => setStep('method')}
            onChangeMarket={() => setStep('region')}
            initialSection={formStart}
          />
        )}
        {step === 'input' && method === 'csv' && form && (
          <>
            <button type="button" className="pw-market" onClick={() => setStep('region')}><i />{pick(form.label, lang)}</button>
            <CsvDropzone form={form} lang={lang} onUpload={uploadCsv} onBack={() => setStep('method')} />
          </>
        )}

        {/* ---------------- BƯỚC 4: KẾT QUẢ ---------------- */}
        {step === 'result' && method === 'manual' && result && (
          <ResultCard
            result={result}
            fullName={values.fullName}
            lang={lang}
            onEdit={() => { setFormStart(form.sections.length - 1); setStep('input'); }}
            onNew={newManual}
            onSave={embedded ? () => setSaveOpen(true) : undefined}
            savedText={savedText}
          />
        )}
        {step === 'result' && method === 'csv' && csvData && (
          <CsvResults
            key={csvRun}
            data={csvData}
            fileName={csvFile?.name || 'data.csv'}
            lang={lang}
            canSave={embedded}
            market={pick(form.label, lang)}
            onNew={() => { setCsvData(null); setCsvFile(null); setStep('input'); }}
          />
        )}
      </main>

      {saveOpen && embedded && form && (
        <SaveDialog form={form} values={values} lang={lang} onClose={() => setSaveOpen(false)} onSaved={onSaved} />
      )}
    </div>
  );
}