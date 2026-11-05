import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Activity, Target, Cpu, TrendingUp } from 'lucide-react';

export default function ModelMetricsDashboard() {
  const [modelMetrics, setModelMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/customers/metrics');
        const data = response.data.models;
        
        if (data && data.logistic && data.random_forest) {
          const formatPercent = (val) => Number((val * 100).toFixed(2));
          setModelMetrics([
            { name: 'Accuracy', 'Logistic Regression': formatPercent(data.logistic.accuracy), 'Random Forest': formatPercent(data.random_forest.accuracy) },
            { name: 'Precision', 'Logistic Regression': formatPercent(data.logistic.precision), 'Random Forest': formatPercent(data.random_forest.precision) },
            { name: 'Recall', 'Logistic Regression': formatPercent(data.logistic.recall), 'Random Forest': formatPercent(data.random_forest.recall) },
            { name: 'F1 Score', 'Logistic Regression': formatPercent(data.logistic.f1), 'Random Forest': formatPercent(data.random_forest.f1) }
          ]);
        }
      } catch (error) {
        console.error("Lỗi khi tải chỉ số AI:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMetrics();
  }, []);

  const getMetricValue = (model, metricIndex) => {
    if (modelMetrics.length === 0) return 0;
    return modelMetrics[metricIndex][model];
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Đang nạp dữ liệu từ AI Server...</div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ width: '48px', height: '48px', backgroundColor: '#eff6ff', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Activity size={24} color="#3b82f6" />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>Hiệu Suất Mô Hình Machine Learning</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>Đánh giá dựa trên tập dữ liệu thử nghiệm (1200 mẫu giả lập)[cite: 17, 18]</p>
        </div>
      </div>

      {/* THẺ TÓM TẮT */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
            <Cpu size={20} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Thuật toán khuyên dùng</h3>
          </div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>Logistic Regression</h2>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b', lineHeight: '1.5' }}>Được chọn làm thuật toán mặc định vì tốc độ phản hồi nhanh và khả năng lý giải (Explainability) tốt hơn trong bài toán Y tế/Sức khỏe.</p>
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
            <Target size={20} color="#10b981" />
            <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Độ Chính Xác (Accuracy)</h3>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{getMetricValue('Logistic Regression', 0)}%</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Logistic</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{getMetricValue('Random Forest', 0)}%</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Random Forest</div>
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px' }}>
            <TrendingUp size={20} color="#f59e0b" />
            <h3 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold' }}>Điểm F1 (F1 Score)</h3>
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{getMetricValue('Logistic Regression', 3)}%</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Logistic</div>
            </div>
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{getMetricValue('Random Forest', 3)}%</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Random Forest</div>
            </div>
          </div>
        </div>
      </div>

      {/* BIỂU ĐỒ SO SÁNH 4 CHỈ SỐ */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 'bold', color: '#0f172a' }}>Biểu đồ so sánh chi tiết 4 chỉ số</h3>
        <div style={{ height: '350px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={modelMetrics} margin={{ top: 20, right: 30, left: 0, bottom: 5 }} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 14, fontWeight: '500', fill: '#334155'}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fontSize: 13, fill: '#64748b'}} domain={[0, 100]} />
              <Tooltip formatter={(value) => `${value}%`} cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'}} />
              <Legend wrapperStyle={{fontSize: '14px', paddingTop: '20px'}} />
              <Bar dataKey="Logistic Regression" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={40} />
              <Bar dataKey="Random Forest" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}