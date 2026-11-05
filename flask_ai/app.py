from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import json

app = Flask(__name__)
CORS(app)

# 1. Load 2 mô hình và file metrics khi khởi động Server
try:
    lr_model = joblib.load('logistic.joblib')
    rf_model = joblib.load('random_forest.joblib')
    
    with open('model_metrics.json', 'r', encoding='utf-8') as f:
        metrics_data = json.load(f)
        
    print("✅ Đã load thành công 2 mô hình AI (Logistic & Random Forest) và file metrics!")
except Exception as e:
    print(f"❌ Lỗi load file AI: {e}\nĐảm bảo 3 file .joblib và .json đang nằm cùng thư mục với app.py")

# 2. API DỰ BÁO (Hỗ trợ chọn mô hình)
@app.route('/predict', methods=['POST'])
def predict():
    try:
        data = request.json
        
        # Lấy loại mô hình từ request do Frontend/Nodejs gửi lên, mặc định là logistic
        model_type = data.get('model_type', 'logistic')
        
        if model_type == 'random_forest':
            model = rf_model
            model_name = "Random Forest"
        else:
            model = lr_model
            model_name = "Logistic Regression"

        # 13 thuộc tính theo đúng thứ tự file HD bàn giao
        features = [
            'gender', 'Near_Location', 'Partner', 'Promo_friends', 'Phone', 
            'Contract_period', 'Group_visits', 'Age', 
            'Avg_additional_charges_total', 'Month_to_end_contract', 
            'Lifetime', 'Avg_class_frequency_total', 'Avg_class_frequency_current_month'
        ]

        # Đọc dữ liệu gửi lên
        input_data = {col: float(data.get(col, 0)) for col in features}
        
        # Sắp xếp đúng các cột đã dùng khi train
        df_input = pd.DataFrame([input_data], columns=features)

        # Lấy index của class 1 (Rời bỏ) một cách linh hoạt theo HD bàn giao
        positive_index = list(model.classes_).index(1)
        
        # Dự đoán xác suất rời bỏ
        churn_prob = float(model.predict_proba(df_input)[0][positive_index])

        # Đánh giá nguy cơ 
        # Theo HD bàn giao, ngưỡng > 0.5 là dự báo lớp 1 (Có nguy cơ)
        if churn_prob >= 0.7:
            risk = "Cao"
        elif churn_prob > 0.5:
            risk = "Trung bình"
        else:
            risk = "Thấp"

        return jsonify({
            "probability_percent": round(churn_prob * 100, 2),
            "risk_level": risk,
            "model_used": model_name
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# 3. API TRẢ VỀ CHỈ SỐ ĐÁNH GIÁ (Accuracy, Precision, Recall, F1)
@app.route('/metrics', methods=['GET'])
def get_metrics():
    try:
        return jsonify(metrics_data)
    except Exception as e:
        return jsonify({"error": "Không thể tải dữ liệu đánh giá mô hình."}), 500

if __name__ == '__main__':
    app.run(port=5000)