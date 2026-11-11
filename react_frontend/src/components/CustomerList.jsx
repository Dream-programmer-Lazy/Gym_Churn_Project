import { useState, useEffect } from 'react';
import axios from 'axios';
import { CloudUpload, PenLine, Trash2, BellRing, CircleCheck, Cpu, Search, Clock, Inbox, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

const RISK_TABS = [
  { value: 'All', label: 'Tất cả', tone: 'tone-all' },
  { value: 'Cao', label: 'Nguy cơ cao', tone: 'tone-high' },
  { value: 'Trung bình', label: 'Trung bình', tone: 'tone-mid' },
  { value: 'Thấp', label: 'An toàn', tone: 'tone-low' },
];

// Cùng ngưỡng với bản cũ: >=70 cao, >50 trung bình, còn lại thấp; chờ duyệt = trung tính
const toneOf = (cus) => {
  if (cus.status === 'Chờ duyệt') return 'tone-pend';
  const p = cus.prediction?.probability_percent || 0;
  if (p >= 70) return 'tone-high';
  if (p > 50) return 'tone-mid';
  return 'tone-low';
};

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
        // Hết phiên -> App đã báo và chuyển về đăng nhập, không báo lỗi trùng
        if (!error.sessionExpired) {
          const msg = error.response
            ? (error.response.data?.error || `Máy chủ trả lỗi ${error.response.status}.`)
            : 'Không kết nối được máy chủ Node (cổng 3001). Hãy kiểm tra server đã chạy chưa.';
          toast.error(`Không thể tải danh sách hội viên: ${msg}`, { id: 'load-customers' });
        }
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

  // Sửa → đẩy dữ liệu lên form và cuộn tới form (hữu ích khi màn hình hẹp, form nằm trên bảng)
  const handleEdit = (cus) => {
    setEditingCustomer(cus);
    document.getElementById('customer-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const pendingCount = customers.filter(c => c.status === 'Chờ duyệt').length;

  if (loading) {
    return (
      <div id="customer-list-section" aria-busy="true">
        <div className="ad-toolbar"><div className="ad-skel" style={{ width: 180, height: 14 }} /></div>
        {[0, 1, 2, 3, 4].map(i => (
          <div className="ad-skel-row" key={i}>
            <div className="ad-skel" style={{ width: 36, height: 36, borderRadius: '50%' }} />
            <div className="ad-skel" style={{ width: '22%' }} />
            <div className="ad-skel" style={{ width: '12%' }} />
            <div className="ad-skel" style={{ width: '18%', marginLeft: 'auto' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div id="customer-list-section">
      {/* ---------- Toolbar ---------- */}
      <div className="ad-toolbar">
        <div className="ad-toolbar-row">
          <div>
            <h3 className="ad-h3">Danh sách hội viên <span className="ad-count ad-num">{filteredCustomers.length}/{customers.length}</span></h3>
            <p className="ad-h3-sub">
              {pendingCount > 0 ? `${pendingCount} hội viên đang chờ duyệt và chấm điểm rủi ro` : 'Tất cả hội viên đã được chấm điểm rủi ro'}
            </p>
          </div>

          <div className="ad-actions">
            <label className="ad-model-pick" title="Mô hình dùng khi duyệt và khi tải CSV">
              <Cpu size={15} />
              <select className="ad-select" value={modelType} onChange={(e) => setModelType(e.target.value)} aria-label="Mô hình AI">
                <option value="logistic">Logistic Regression</option>
                <option value="random_forest">Random Forest</option>
              </select>
            </label>

            <label className="ad-btn" style={{ cursor: 'pointer' }}>
              <CloudUpload size={15} /> Tải lên CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </label>
          </div>
        </div>

        <div className="ad-toolbar-row">
          <div className="ad-search">
            <Search size={15} />
            <input className="ad-input" type="text" placeholder="Tìm theo tên hoặc số điện thoại" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} aria-label="Tìm hội viên" />
          </div>

          <div className="ad-tabs" role="group" aria-label="Lọc theo mức rủi ro">
            {RISK_TABS.map(t => (
              <button key={t.value} className={`ad-tab ${t.tone}`} aria-pressed={externalFilter === t.value} onClick={() => onFilterChange(t.value)}>
                {t.value !== 'All' && <span className="ad-tab-dot" />}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Bảng (cuộn dọc, header dính) ---------- */}
      <div className="ad-table-scroll">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Hội viên</th>
              <th>Gói tập & tần suất</th>
              <th>Rủi ro rời bỏ</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: 0 }}>
                  <div className="ad-empty">
                    <div className="ad-empty-icon"><Inbox size={20} /></div>
                    <div className="ad-empty-title">Không có hội viên phù hợp</div>
                    <div>Thử đổi từ khóa tìm kiếm hoặc chọn “Tất cả” để bỏ lọc.</div>
                  </div>
                </td>
              </tr>
            ) : (
              filteredCustomers.map((cus) => {
                const riskPrc = cus.prediction?.probability_percent || 0;
                const isPending = cus.status === 'Chờ duyệt';
                const tone = toneOf(cus);
                const initials = cus.fullName.split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase();
                const usedModel = cus.prediction?.model_used === 'Random Forest' ? 'RF' : (cus.prediction?.model_used === 'Logistic Regression' ? 'LR' : '');
                const needsCare = cus.prediction?.risk_level === 'Cao' || cus.prediction?.risk_level === 'Trung bình';

                return (
                  <tr key={cus._id} className={isPending ? 'is-pending' : undefined}>
                    <td>
                      <div className="ad-member">
                        <div className={`ad-member-av ${tone}`}>{initials}</div>
                        <div>
                          <div className="ad-member-name">{cus.fullName}</div>
                          <div className="ad-member-phone ad-num">{cus.actualPhoneNumber || 'Chưa cập nhật SĐT'}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="ad-cell-strong">Gói {cus.Contract_period} tháng</div>
                      {isPending
                        ? <div className="ad-pending-tag"><Clock size={12} /> Đang chờ duyệt</div>
                        : <div className="ad-cell-sub ad-num">{Number(cus.Avg_class_frequency_current_month || 0).toFixed(2)} buổi/tuần</div>}
                    </td>

                    <td>
                      <div className={`ad-risk ${tone}`}>
                        <div className="ad-risk-top">
                          <span className="ad-badge">
                            <span className="ad-badge-dot" />
                            {isPending ? 'Chưa dự báo' : (cus.prediction?.risk_level || 'Chưa đánh giá')}
                          </span>
                          {isPending
                            ? <span className="ad-wait">Chờ đánh giá</span>
                            : <span className="ad-meter-val ad-num">{riskPrc}%</span>}
                          {!isPending && usedModel && <span className="ad-model-tag" title={cus.prediction?.model_used}>{usedModel}</span>}
                        </div>
                        <div className="ad-meter-track"><div className="ad-meter-fill" style={{ width: `${isPending ? 0 : Math.min(riskPrc, 100)}%` }} /></div>
                      </div>
                    </td>

                    <td>
                      <div className="ad-row-actions">
                        {isPending ? (
                          <button className="ad-btn is-sm is-approve" onClick={() => handleApprove(cus._id, cus.fullName)}>
                            <ShieldCheck size={14} /> Duyệt
                          </button>
                        ) : needsCare ? (
                          <button className="ad-btn is-sm is-notify" onClick={() => handleNotify(cus._id, cus.fullName)} title="Gửi nhắc nhở">
                            <BellRing size={14} /> Nhắc nhở
                          </button>
                        ) : (
                          <span className="ad-ok-icon" title="Ổn định" aria-label="Ổn định"><CircleCheck size={17} /></span>
                        )}
                        <button className="ad-row-btn" onClick={() => handleEdit(cus)} title="Sửa" aria-label={`Sửa ${cus.fullName}`}><PenLine size={16} /></button>
                        <button className="ad-row-btn is-danger" onClick={() => handleDelete(cus._id, cus.fullName)} title="Xóa" aria-label={`Xóa ${cus.fullName}`}><Trash2 size={16} /></button>
                      </div>
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