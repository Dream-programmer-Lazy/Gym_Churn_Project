import { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { ArrowLeft, Keyboard, FileSpreadsheet, LoaderCircle, CircleAlert, MapPin, Globe } from 'lucide-react';
import { t, pick } from './i18n';
import { API_BASE, FORMS, FEATURES, initialValues, toPayload } from './utils';
import ManualForm from './ManualForm';
import CsvDropzone from './CsvDropzone';
import ResultCard from './ResultCard';
import CsvResults from './CsvResults';
import '../../styles/wizard.css';

const REGION_ICON = { vn: MapPin, global: Globe };

/**
 * Trang dự báo dùng thử (không lưu dữ liệu).
 * Luồng: Thị trường -> Cách nhập -> Dữ liệu -> Kết quả.  Mỗi thị trường có form riêng (forms/).
 * Props: onBack() -> quay về Landing Page
 */
export default function PredictWizard({ onBack }) {
  const [lang, setLang] = useState('vi');
  const [step, setStep] = useState('region');           // region | method | input | result
  const [region, setRegion] = useState(null);
  const [method, setMethod] = useState(null);           // manual | csv
  const [modelType, setModelType] = useState('logistic');

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

  const form = region ? FORMS[region] : null;

  /* ---------- gọi API ---------- */
  const requestPredict = (useLang) =>
    axios.post(API_BASE, { ...toPayload(form, values), region, model_type: modelType, lang: useLang });

  const requestCsv = (file, useLang, onProgress) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('region', region);
    fd.append('model_type', modelType);
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
      setValues(initialValues(FORMS[r], res.data));   // form mới hoàn toàn cho thị trường mới
      setResult(null);
      setCsvData(null);
      setServerErrors({});
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
    setStep('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const newManual = () => {
    setValues(initialValues(form, modelInfo));
    setResult(null);
    setFormStart(0);
    setStep('input');
  };

  return (
    <div className="pw-root">
      <header className="pw-header">
        <button type="button" className="pw-brand" onClick={onBack} aria-label={t(lang, 'home')}>POWER GYM<span>.AI</span></button>
        <div className="pw-header-right">
          <div className="pw-lang" role="radiogroup" aria-label="Language">
            <button type="button" role="radio" aria-checked={lang === 'vi'} onClick={() => changeLang('vi')}>Tiếng Việt</button>
            <button type="button" role="radio" aria-checked={lang === 'en'} onClick={() => changeLang('en')}>English</button>
          </div>
          <button type="button" className="pw-home" onClick={onBack}><ArrowLeft size={16} /> {t(lang, 'home')}</button>
        </div>
      </header>

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
            <div className="pw-algo">
              <span className="pw-algo-label">{t(lang, 'algorithm')}</span>
              <div className="pw-seg" role="radiogroup" aria-label={t(lang, 'algorithm')}>
                <button type="button" role="radio" aria-checked={modelType === 'logistic'} onClick={() => setModelType('logistic')}>
                  Logistic Regression<small>{t(lang, 'algoLogistic')}</small>
                </button>
                <button type="button" role="radio" aria-checked={modelType === 'random_forest'} onClick={() => setModelType('random_forest')}>
                  Random Forest<small>{t(lang, 'algoForest')}</small>
                </button>
              </div>
            </div>
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
          />
        )}
        {step === 'result' && method === 'csv' && csvData && (
          <CsvResults data={csvData} fileName={csvFile?.name || 'data.csv'} lang={lang}
            onNew={() => { setCsvData(null); setCsvFile(null); setStep('input'); }} />
        )}
      </main>
    </div>
  );
}