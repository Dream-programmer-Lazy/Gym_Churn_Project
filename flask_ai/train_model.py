import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.pipeline import Pipeline
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score
import joblib

print("--- HỆ THỐNG HUẤN LUYỆN & SO SÁNH MÔ HÌNH AI ---")

# 1. Đọc và tiền xử lý dữ liệu
print("BƯỚC 1: Đọc dataset thực tế (gym_churn_us.csv)...")
df = pd.read_csv('gym_churn_us.csv')
df = df.dropna()

X = df.drop('Churn', axis=1)
y = df['Churn']

# 2. Phân tách dữ liệu
print("BƯỚC 2: Phân tách tập Train (70%) và tập Test (30%)...")
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)

# 3. Khởi tạo 2 mô hình theo yêu cầu
print("BƯỚC 3: Đang huấn luyện Logistic Regression và Random Forest...")
pipeline_lr = Pipeline([
    ('scaler', StandardScaler()), 
    ('model', LogisticRegression(random_state=42, max_iter=1000))
])

pipeline_rf = Pipeline([
    ('scaler', StandardScaler()), 
    ('model', RandomForestClassifier(n_estimators=100, random_state=42))
])

# Huấn luyện cả 2 mô hình
pipeline_lr.fit(X_train, y_train)
pipeline_rf.fit(X_train, y_train)

# 4. Đánh giá và so sánh
y_pred_lr = pipeline_lr.predict(X_test)
y_pred_rf = pipeline_rf.predict(X_test)

def print_metrics(name, y_true, y_pred):
    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred)
    rec = recall_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred)
    print(f"[{name}] Accuracy: {acc*100:.2f}% | Precision: {prec*100:.2f}% | Recall: {rec*100:.2f}% | F1: {f1*100:.2f}%")
    return acc

print("\nBƯỚC 4: BẢNG SO SÁNH KẾT QUẢ CÁC MÔ HÌNH TRÊN TẬP TEST")
acc_lr = print_metrics("Logistic Regression", y_test, y_pred_lr)
acc_rf = print_metrics("Random Forest      ", y_test, y_pred_rf)

# 5. Chọn mô hình tốt nhất và lưu
print("\nBƯỚC 5: Lựa chọn và Đóng gói (Model Serialization)...")
if acc_lr >= acc_rf:
    best_model = pipeline_lr
    print("-> Lựa chọn: LOGISTIC REGRESSION (Vì có Accuracy cao hơn hoặc bằng)")
else:
    best_model = pipeline_rf
    print("-> Lựa chọn: RANDOM FOREST (Vì có Accuracy cao hơn)")

joblib.dump(best_model, 'gym_churn_model.joblib')
print("✅ HOÀN TẤT! File 'gym_churn_model.joblib' chứa mô hình tối ưu nhất đã sẵn sàng phục vụ Flask API.")