import { useState, useEffect } from 'react';
import axios from 'axios';
import { UploadCloud, Edit2, Trash2, Bell, CheckCircle, Cpu } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CustomerList({ setEditingCustomer, refreshFlag, onSuccess, externalFilter, onFilterChange, dateFilter }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Quản lý mô hình AI đang được chọn để dự báo
  const [modelType, setModelType] = useState('logistic');

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await axios.get('http://localhost:3001/api/customers');
        setCustomers(response.data);
      } catch (error) {
        console.error("Lỗi:", error);
        toast.error("Không thể tải danh sách khách hàng!"); 
      } finally {
        setLoading(false);
      }
    };
    fetchCustomers();
  }, [refreshFlag]);

  const handleDelete = async (id, name) => {
    if (window.confirm(`Xác nhận xóa khách hàng "${name}"?`)) {
      try {
        await axios.delete(`http://localhost:3001/api/customers/${id}`);
        onSuccess(); 
        toast.success(`Đã xóa khách hàng ${name} thành công!`);
      } catch (error) {
        console.error("Lỗi khi xóa:", error);
        toast.error('Lỗi khi xóa khách hàng!');
      }
    }
  };

  const handleNotify = async (id, name) => {
    const msg = window.prompt(`Nhập lời nhắc nhở cho "${name}":`, "Bạn đã lâu không đến phòng tập. Đừng bỏ cuộc nhé, hãy quay lại luyện tập để đạt kết quả tốt nhất!");
    if (msg) {
      try {
        await axios.post(`http://localhost:3001/api/customers/${id}/notify`, { message: msg });
        toast.success(`Đã gửi thông báo đến ${name} thành công!`);
        onSuccess();
      } catch (error) {
        console.error("Lỗi khi gửi thông báo:", error);
        toast.error("Lỗi khi gửi thông báo.");
      }
    }
  };

  const handleApprove = async (id, name) => {
    const modelName = modelType === 'logistic' ? 'Logistic Regression' : 'Random Forest';
    if (window.confirm(`Xác nhận duyệt hợp đồng cho "${name}" và chạy phân tích AI bằng thuật toán [${modelName}]?`)) {
      const loadingToast = toast.loading(`Đang phân tích rủi ro bằng ${modelName}...`); 
      try {
        await axios.put(`http://localhost:3001/api/customers/${id}/approve`, { model_type: modelType });
        onSuccess(); 
        toast.success(`Đã duyệt và đánh giá rủi ro thành công!`, { id: loadingToast });
      } catch (error) {
        console.error("Lỗi khi duyệt:", error);
        toast.error(error.response?.data?.error || 'Lỗi khi duyệt khách hàng!', { id: loadingToast });
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_type', modelType);

    const modelName = modelType === 'logistic' ? 'Logistic Regression' : 'Random Forest';
    const confirmUpload = window.confirm(`Bạn có chắc chắn muốn tải lên file "${file.name}" để hệ thống AI tự động phân tích rủi ro bằng [${modelName}] không?`);
    if (!confirmUpload) {
        e.target.value = null; 
        return;
    }

    const loadingToast = toast.loading(`Đang xử lý file CSV và chạy AI ${modelName}...`); 

    try {
      setLoading(true);
      await axios.post('http://localhost:3001/api/customers/upload-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Đã xử lý file CSV và phân tích bằng ${modelName} thành công!`, { id: loadingToast });
      onSuccess();
    } catch (error) {
      console.error("Lỗi tải lên CSV:", error);
      toast.error(error.response?.data?.error || 'Lỗi khi tải lên file CSV!', { id: loadingToast }); 
    } finally {
      setLoading(false);
      e.target.value = null;
    }
  };

  const filteredCustomers = customers.filter(cus => {
    const matchSearch = cus.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        (cus.actualPhoneNumber && cus.actualPhoneNumber.includes(searchTerm));
    const matchRisk = externalFilter === 'All' || (cus.prediction?.risk_level === externalFilter);
    
    let matchDate = true;
    if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      matchDate = new Date(cus.createdAt) >= thirtyDaysAgo;
    }

    return matchSearch && matchRisk && matchDate;
  });

  if (loading) return <p style={{textAlign: 'center', padding: '20px'}}>Đang tải dữ liệu...</p>;

  return (
    <div id="customer-list-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: '15px' }}>
        
        <div style={{ display: 'flex', gap: '15px' }}>
          <input type="text" placeholder="🔍 Tìm tên hoặc SĐT..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', minWidth: '250px', backgroundColor: '#f8fafc', outline: 'none' }} />
          <select value={externalFilter} onChange={(e) => onFilterChange(e.target.value)} style={{ padding: '10px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', outline: 'none', fontWeight: '500', color: '#334155' }}>
            <option value="All">Tất cả rủi ro</option>
            <option value="Cao">Nguy cơ CAO</option>
            <option value="Trung bình">Nguy cơ Trung bình</option>
            <option value="Thấp">An toàn</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <Cpu size={18} color="#3b82f6" />
            <select value={modelType} onChange={(e) => setModelType(e.target.value)} style={{ backgroundColor: 'transparent', border: 'none', outline: 'none', fontWeight: 'bold', color: '#1e40af', cursor: 'pointer', fontSize: '13px' }}>
              <option value="logistic">AI: Logistic Regression</option>
              <option value="random_forest">AI: Random Forest</option>
            </select>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'white', color: '#334155', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '14px', transition: '0.2s' }}>
            <UploadCloud size={16} /> Upload CSV
            <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ color: '#64748b', textTransform: 'uppercase', fontSize: '11px', fontWeight: 'bold', borderBottom: '1px solid #f1f5f9' }}>
              <th style={{ padding: '16px 20px' }}>Hội viên</th>
              <th style={{ padding: '16px 20px' }}>Gói tập</th>
              <th style={{ padding: '16px 20px' }}>Tần suất tháng</th>
              <th style={{ padding: '16px 20px' }}>Xác suất rời bỏ</th>
              <th style={{ padding: '16px 20px' }}>Mức độ rủi ro</th>
              <th style={{ padding: '16px 20px', textAlign: 'center' }}>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr><td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>Không tìm thấy khách hàng.</td></tr>
            ) : (
              filteredCustomers.map((cus) => {
                const riskPrc = cus.prediction?.probability_percent || 0;
                let barColor = '#22c55e'; 
                let badgeColor = '#dcfce7', badgeText = '#166534';
                if (riskPrc >= 70) { barColor = '#ef4444'; badgeColor = '#fef2f2'; badgeText = '#991b1b'; } 
                else if (riskPrc > 50) { barColor = '#f59e0b'; badgeColor = '#fef3c7'; badgeText = '#b45309'; } 

                if (cus.status === 'Chờ duyệt') {
                  barColor = '#cbd5e1'; badgeColor = '#f1f5f9'; badgeText = '#64748b';
                }

                const initials = cus.fullName.split(' ').map(n=>n[0]).join('').substring(0,3).toUpperCase();
                const usedModel = cus.prediction?.model_used === 'Random Forest' ? 'RF' : (cus.prediction?.model_used === 'Logistic Regression' ? 'LR' : '');

                return (
                  <tr key={cus._id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <div style={{ width: '35px', height: '35px', borderRadius: '50%', backgroundColor: badgeColor, color: badgeText, display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '12px' }}>{initials}</div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '14px' }}>{cus.fullName}</div>
                        <div style={{ color: '#64748b', fontSize: '12px' }}>{cus.actualPhoneNumber || 'Chưa cập nhật'}</div>
                      </div>
                    </td>
                    <td style={{ padding: '16px 20px', fontWeight: '500', color: '#334155' }}>
                      Gói {cus.Contract_period} Tháng
                      {cus.status === 'Chờ duyệt' && <div style={{ fontSize: '11px', color: '#f59e0b', marginTop: '4px' }}>⏳ Đang chờ duyệt</div>}
                    </td>
                    {/* KHẮC PHỤC LỖI HIỂN THỊ DÀI: LÀM TRÒN SỐ */}
                    <td style={{ padding: '16px 20px', fontWeight: '500', color: '#334155' }}>
                      {Number(cus.Avg_class_frequency_current_month || 0).toFixed(2)} b/tuần
                    </td>
                    
                    <td style={{ padding: '16px 20px' }}>
                      {cus.status === 'Chờ duyệt' ? (
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Chờ đánh giá</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '80px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${riskPrc}%`, height: '100%', backgroundColor: barColor }}></div>
                          </div>
                          <span style={{ fontWeight: 'bold', color: '#334155' }}>
                            {riskPrc}% 
                            {usedModel && <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px' }}>[{usedModel}]</span>}
                          </span>
                        </div>
                      )}
                    </td>
                    
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ backgroundColor: badgeColor, color: badgeText, padding: '4px 10px', borderRadius: '20px', fontWeight: 'bold', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap' }}>
                        <div style={{width:'6px', height:'6px', borderRadius:'50%', backgroundColor: barColor}}></div> 
                        {cus.status === 'Chờ duyệt' ? 'Chưa dự báo' : (cus.prediction?.risk_level || 'Chưa đánh giá')}
                      </span>
                    </td>
                    
                    <td style={{ padding: '16px 20px', textAlign: 'center', display: 'flex', justifyContent: 'center', gap: '15px', color: '#94a3b8' }}>
                      
                      {cus.status === 'Chờ duyệt' ? (
                        <button onClick={() => handleApprove(cus._id, cus.fullName)} style={{ padding: '6px 12px', backgroundColor: '#4caf50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                          Duyệt
                        </button>
                      ) : (
                        cus.prediction?.risk_level === 'Cao' || cus.prediction?.risk_level === 'Trung bình' ? (
                          <div onClick={() => handleNotify(cus._id, cus.fullName)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#ef4444', backgroundColor: '#fef2f2', padding: '4px 8px', borderRadius: '6px' }} title="Gửi nhắc nhở">
                            <Bell size={16} style={{ marginRight: '4px' }} /> Nhắc nhở
                          </div>
                        ) : (
                          <CheckCircle size={18} color="#22c55e" title="Ổn định" />
                        )
                      )}
                      
                      <Edit2 size={18} style={{ cursor: 'pointer', color: '#3b82f6', marginTop: '2px' }} onClick={() => setEditingCustomer(cus)} title="Sửa" />
                      <Trash2 size={18} style={{ cursor: 'pointer', color: '#94a3b8', marginTop: '2px' }} onClick={() => handleDelete(cus._id, cus.fullName)} title="Xóa" />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}