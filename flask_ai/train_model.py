"""
HUẤN LUYỆN MÔ HÌNH DỰ BÁO RỜI BỎ — 1 MÔ HÌNH, 7 CỘT, 2 THỊ TRƯỜNG
------------------------------------------------------------------
Quyết định đã chốt (lộ trình, cập nhật 24/11):
    - Chỉ dùng Logistic Regression với class_weight='balanced' (kèm StandardScaler).
    - Dùng 7 cột chung cho cả 2 thị trường (xem FEATURES).
    - Giữ nguyên file dữ liệu gốc (13 cột); việc chọn 7 cột nằm trong code này.

Tạo ra:
    vn_model.pkl       <- huấn luyện từ gym_churn_vn_synthetic.csv (tiền: nghìn VNĐ)
    global_model.pkl   <- huấn luyện từ gym_churn_us.csv           (tiền: USD)
    model_metrics_vn.json / model_metrics_global.json  (bản dễ đọc, dùng cho tab Metrics và báo cáo)

Mỗi file .pkl là một "gói" (dict) chứa:
    - model:      Pipeline(StandardScaler + LogisticRegression cân bằng)
    - metrics:    Accuracy / Precision / Recall / F1 / AUC / Confusion matrix trên tập test (30%)
    - comparison: bảng so sánh 13 cột / 7 cột, Logistic / Logistic cân bằng / Random Forest
                  (CHỈ để đưa vào báo cáo; Random Forest KHÔNG được lưu vào hệ thống)
    - profile:    min, max, p05, p95, trung vị, trung bình của từng cột (cảnh báo ngoài vùng huấn luyện)
    - explain:    hệ số Logistic để giải thích "3 lý do chính"
    - thresholds: ngưỡng rủi ro (Cao >= 70%, Trung bình 50–70%, Thấp < 50%)

Cách chạy (đứng trong thư mục flask_ai):
    python train_model.py
"""

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score, precision_score,
                             recall_score, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BASE_DIR = Path(__file__).resolve().parent

# 7 cột dùng cho mô hình — ĐÚNG THỨ TỰ này được dùng ở cả train và predict
FEATURES = [
    'Lifetime',
    'Avg_class_frequency_current_month',
    'Avg_class_frequency_total',
    'Age',
    'Avg_additional_charges_total',
    'Month_to_end_contract',
    'Contract_period',
]
# 13 cột gốc của bộ dữ liệu — CHỈ dùng cho bảng so sánh trong báo cáo
ALL_13_FEATURES = [
    'gender', 'Near_Location', 'Partner', 'Promo_friends', 'Phone',
    'Contract_period', 'Group_visits', 'Age',
    'Avg_additional_charges_total', 'Month_to_end_contract',
    'Lifetime', 'Avg_class_frequency_total', 'Avg_class_frequency_current_month',
]
TARGET = 'Churn'

REGIONS = {
    'vn': {
        'label_vi': 'Việt Nam',
        'data_file': 'gym_churn_vn_synthetic.csv',
        'currency': 'nghìn VNĐ',
        'output': 'vn_model.pkl',
    },
    'global': {
        'label_vi': 'Quốc tế',
        'data_file': 'gym_churn_us.csv',
        'currency': 'USD',
        'output': 'global_model.pkl',
    },
}

THRESHOLDS = {'high': 70.0, 'medium': 50.0}   # % : >= 70 Cao, >= 50 Trung bình, còn lại Thấp
TEST_SIZE = 0.3
SEED = 42
MODEL_NAME = 'Logistic Regression (cân bằng)'


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def make_logistic(balanced: bool) -> Pipeline:
    return Pipeline([
        ('scaler', StandardScaler()),
        ('model', LogisticRegression(max_iter=1000, random_state=SEED,
                                     class_weight='balanced' if balanced else None)),
    ])


def evaluate(model, X_test, y_test) -> dict:
    """Chỉ số trên tập test. Quy tắc quyết định: xác suất rời bỏ >= 50% -> dự đoán 'rời bỏ'."""
    positive_index = list(model.classes_).index(1)
    prob = model.predict_proba(X_test)[:, positive_index]
    y_pred = (prob >= 0.5).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_test, y_pred, labels=[0, 1]).ravel()
    return {
        'accuracy': float(accuracy_score(y_test, y_pred)),
        'precision': float(precision_score(y_test, y_pred, zero_division=0)),
        'recall': float(recall_score(y_test, y_pred, zero_division=0)),
        'f1': float(f1_score(y_test, y_pred, zero_division=0)),
        'auc': float(roc_auc_score(y_test, prob)),
        'confusion_matrix': {'TN': int(tn), 'FP': int(fp), 'FN': int(fn), 'TP': int(tp)},
    }


def build_profile(X_train: pd.DataFrame) -> dict:
    """Thống kê từng cột trên TẬP TRAIN (không dùng tập test để tránh rò rỉ dữ liệu)."""
    profile = {}
    for col in FEATURES:
        s = X_train[col]
        profile[col] = {
            'min': float(s.min()), 'max': float(s.max()),
            'p05': float(s.quantile(0.05)), 'p95': float(s.quantile(0.95)),
            'median': float(s.median()), 'mean': float(s.mean()), 'std': float(s.std()),
        }
    return profile


def build_comparison(df_all: pd.DataFrame, y: pd.Series) -> list:
    """
    Bảng so sánh cho báo cáo: cùng một cách chia train/test (cùng SEED) cho mọi mô hình.
    Không lưu mô hình nào ở đây vào hệ thống.
    """
    has_13 = all(c in df_all.columns for c in ALL_13_FEATURES)
    candidates = []
    if has_13:
        candidates += [
            ('Logistic Regression', 13, ALL_13_FEATURES, lambda: make_logistic(False)),
            ('Logistic Regression cân bằng', 13, ALL_13_FEATURES, lambda: make_logistic(True)),
            ('Random Forest', 13, ALL_13_FEATURES,
             lambda: RandomForestClassifier(n_estimators=100, random_state=SEED, n_jobs=-1)),
        ]
    candidates += [
        ('Logistic Regression', 7, FEATURES, lambda: make_logistic(False)),
        ('Logistic Regression cân bằng', 7, FEATURES, lambda: make_logistic(True)),
    ]

    rows = []
    for name, n_cols, cols, factory in candidates:
        X_tr, X_te, y_tr, y_te = train_test_split(
            df_all[cols], y, test_size=TEST_SIZE, random_state=SEED, stratify=y)
        model = factory().fit(X_tr, y_tr)
        m = evaluate(model, X_te, y_te)
        rows.append({'model': name, 'n_features': n_cols,
                     'selected': name == 'Logistic Regression cân bằng' and n_cols == 7,
                     **{k: m[k] for k in ('accuracy', 'precision', 'recall', 'f1', 'auc')}})
    return rows


def train_region(key: str, cfg: dict) -> dict:
    data_path = BASE_DIR / cfg['data_file']
    if not data_path.exists():
        sys.exit(f"❌ Không tìm thấy {data_path.name} trong thư mục flask_ai/")

    print(f"\n=== [{cfg['label_vi']}] Đọc {data_path.name} ===")
    df_raw = pd.read_csv(data_path, encoding='utf-8-sig')      # utf-8-sig: bỏ ký tự BOM ở đầu file VN
    missing = [c for c in FEATURES + [TARGET] if c not in df_raw.columns]
    if missing:
        sys.exit(f"❌ File {data_path.name} thiếu cột: {missing}")

    # Bỏ dòng thiếu dữ liệu ở 7 cột + nhãn (cột thừa không ảnh hưởng)
    df = df_raw.dropna(subset=FEATURES + [TARGET]).reset_index(drop=True)
    y = df[TARGET].astype(int)
    X = df[FEATURES]
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=SEED, stratify=y)
    print(f"Train: {len(X_train)} dòng | Test: {len(X_test)} dòng | Tỷ lệ rời bỏ: {y.mean():.1%}")

    model = make_logistic(balanced=True)
    model.fit(X_train, y_train)

    m = evaluate(model, X_test, y_test)
    metrics = {
        'logistic': m,
        'majority_baseline_accuracy': float(max(y_test.mean(), 1 - y_test.mean())),
        'train_rows': int(len(X_train)),
        'test_rows': int(len(X_test)),
        'churn_rate': float(y.mean()),
        'decision_rule': 'p(rời bỏ) >= 0.5',
    }
    print(f"  {MODEL_NAME}: Acc {m['accuracy']:.3f} | Prec {m['precision']:.3f} | "
          f"Recall {m['recall']:.3f} | F1 {m['f1']:.3f} | AUC {m['auc']:.3f}")
    print(f"  (Mốc so sánh: đoán 'không ai rời bỏ' đạt {metrics['majority_baseline_accuracy']:.3f})")

    comparison = build_comparison(df, y)
    print('  Bảng so sánh cho báo cáo:')
    for r in comparison:
        mark = '  <- đã chọn' if r['selected'] else ''
        print(f"    {r['model']:30s} {r['n_features']:>2} cột | Acc {r['accuracy']:.3f} | "
              f"Recall {r['recall']:.3f} | AUC {r['auc']:.3f}{mark}")

    scaler = model.named_steps['scaler']
    lr = model.named_steps['model']
    explain = {
        'method': 'logistic_contribution',   # đóng góp = hệ số * (x - mean) / std
        'mean': [float(v) for v in scaler.mean_],
        'scale': [float(v) for v in scaler.scale_],
        'coef': [float(v) for v in lr.coef_[0]],
        'intercept': float(lr.intercept_[0]),
    }

    bundle = {
        'schema_version': 'gym-region-model-v2',
        'region': key,
        'label_vi': cfg['label_vi'],
        'currency': cfg['currency'],
        'data_file': cfg['data_file'],
        'data_sha256': sha256_of(data_path),
        'data_kind': 'synthetic' if 'synthetic' in cfg['data_file'] else 'public_dataset',
        'trained_at_utc': datetime.now(timezone.utc).isoformat(),
        'versions': {
            'python': sys.version.split()[0], 'scikit_learn': sklearn.__version__,
            'pandas': pd.__version__, 'numpy': np.__version__, 'joblib': joblib.__version__,
        },
        'model_name': MODEL_NAME,
        'model_type': 'logistic',
        'features': FEATURES,
        'binary_features': [],                 # 7 cột đều là số (giữ khóa để code cũ không lỗi)
        'contract_values': sorted(int(v) for v in X_train['Contract_period'].unique()),
        'thresholds': THRESHOLDS,
        'profile': build_profile(X_train),
        'explain': explain,
        'metrics': metrics,
        'comparison': comparison,
        'model': model,
    }

    out = BASE_DIR / cfg['output']
    joblib.dump(bundle, out)
    readable = {k: v for k, v in bundle.items() if k != 'model'}
    (BASE_DIR / f"model_metrics_{key}.json").write_text(
        json.dumps(readable, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"✅ Đã lưu {out.name} và model_metrics_{key}.json")
    return bundle


if __name__ == '__main__':
    print('--- HUẤN LUYỆN MÔ HÌNH DỰ BÁO RỜI BỎ (Logistic cân bằng, 7 cột) ---')
    for region_key, region_cfg in REGIONS.items():
        train_region(region_key, region_cfg)
    print('\nHoàn tất. Khởi động lại app.py để nạp mô hình mới.')