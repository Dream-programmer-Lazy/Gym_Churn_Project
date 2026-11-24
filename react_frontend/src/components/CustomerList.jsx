import { useState, useRef } from 'react';
import axios from 'axios';
import { CloudUpload, PenLine, Trash2, BellRing, CircleCheck, Search, Clock, Inbox, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_URL } from '../config';
import { isDuplicateConflict } from './predict/utils';
import { DuplicateDialog } from './predict/SaveToSystem';

const RISK_TABS = [
  { value: 'All', label: 'Tất cả', tone: 'tone-all' },
  { value: 'Cao', label: 'Nguy cơ cao', tone: 'tone-high' },
  { value: 'Trung bình', label: 'Trung bình', tone: 'tone-mid' },
  { value: 'Thấp', label: 'An toàn', tone: 'tone-low' },
];
const MARKET_NAME = { vn: 'Việt Nam', global: 'Quốc tế' };
const PAGE = 200; // hiện tối đa 200 dòng một lần cho nhẹ, bấm "Xem thêm" để hiện tiếp

const LEVEL_TONE = { 'Cao': 'tone-high', 'Trung bình': 'tone-mid', 'Thấp': 'tone-low' };
const isPendingOf = (cus) => cus.status === 'Chờ duyệt' || !LEVEL_TONE[cus.prediction?.risk_level];
// Màu theo đúng mức rủi ro đã lưu (Cao >= 70%, Trung bình 50–70%, Thấp < 50%); chờ duyệt = trung tính
const toneOf = (cus) => (isPendingOf(cus) ? 'tone-pend' : LEVEL_TONE[cus.prediction.risk_level]);

/**
 * Danh sách hội viên của MỘT thị trường.
 * Props: region ('vn' | 'global', mặc định 'vn' — lấy từ menu)
 *        customers  : danh sách hội viên của thị trường — App tải sẵn 1 lần, dùng chung với Dashboard
 *        ready      : false = đang tải lần đầu (hiện khung xám)
 *        refreshing : true  = đang tải lại (vẫn hiện bảng cũ, chỉ báo "Đang cập nhật…")
 *        setEditingCustomer, onSuccess (thêm/sửa/xóa xong -> App tải lại), externalFilter, onFilterChange, dateFilter
 * - Nút "Tải lên CSV": lưu thẳng vào thị trường của trang. Có tên trùng -> hỏi Cập nhật / Bỏ qua (luật trùng).
 * - Chỉ còn 1 mô hình -> bỏ ô chọn thuật toán.
 * - Đang lọc theo mức rủi ro (Cao / Trung bình / An toàn) -> sắp theo % rủi ro giảm dần (người nguy hiểm nhất lên đầu).
 *   Xem "Tất cả" -> giữ thứ tự cũ (mới tạo lên đầu).
 */
export default function CustomerList({ region = 'vn', customers = [], ready = true, refreshing = false, setEditingCustomer, onSuccess, externalFilter, onFilterChange, dateFilter }) {
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [conflict, setConflict] = useState(null);    // dữ liệu 409 (tên trùng) đang chờ chọn
  const pendingFile = useRef(null);                   // file CSV đang chờ chọn Cập nhật / Bỏ qua
  const market = MARKET_NAME[region];

  const handleDelete = async (id, name) => {
    if (window.confirm(`Xác nhận xóa khách hàng "${name}"?`)) {
      try {
        await axios.delete(`${API_URL}/customers/${id}`);
        onSuccess();
        toast.success(`Đã xóa khách hàng ${name} thành công!`);
      } catch (error) {
        console.error("Lỗi khi xóa:", error);
        if (!error.sessionExpired) toast.error(error.response?.data?.error || 'Lỗi khi xóa khách hàng!');
      }
    }
  };

  const handleNotify = async (id, name) => {
    const msg = window.prompt(`Nhập lời nhắc nhở cho "${name}":`, "Bạn đã lâu không đến phòng tập. Đừng bỏ cuộc nhé, hãy quay lại luyện tập để đạt kết quả tốt nhất!");
    if (msg) {
      try {
        await axios.post(`${API_URL}/customers/${id}/notify`, { message: msg });
        toast.success(`Đã gửi thông báo đến ${name} thành công!`);
        // Lời nhắc không làm đổi số liệu trên bảng -> không cần tải lại cả danh sách
      } catch (error) {
        console.error("Lỗi khi gửi thông báo:", error);
        if (!error.sessionExpired) toast.error("Lỗi khi gửi thông báo.");
      }
    }
  };

  const handleApprove = async (id, name) => {
    if (window.confirm(`Xác nhận duyệt hợp đồng cho "${name}" và chạy phân tích rủi ro bằng AI?`)) {
      const loadingToast = toast.loading('Đang phân tích rủi ro...');
      try {
        await axios.put(`${API_URL}/customers/${id}/approve`, {});
        onSuccess();
        toast.success('Đã duyệt và đánh giá rủi ro thành công!', { id: loadingToast });
      } catch (error) {
        console.error("Lỗi khi duyệt:", error);
        if (error.sessionExpired) toast.dismiss(loadingToast);
        else toast.error(error.response?.data?.error || 'Lỗi khi duyệt khách hàng!', { id: loadingToast });
      }
    }
  };

  /** Gửi file CSV. onDuplicate: undefined (lần đầu) | 'update' | 'skip' (sau khi người dùng chọn) */
  const sendCsv = async (file, onDuplicate) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('region', region);
    if (onDuplicate) formData.append('onDuplicate', onDuplicate);

    const loadingToast = toast.loading(`Đang xử lý file CSV và chấm điểm rủi ro (thị trường ${market})...`);
    setUploading(true);
    try {
      const res = await axios.post(`${API_URL}/customers/upload-csv`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setConflict(null);
      pendingFile.current = null;
      toast.success(res.data.message || 'Đã xử lý file CSV thành công!', { id: loadingToast, duration: 6000 });
      if (res.data.rowErrors?.length) console.table(res.data.rowErrors); // chi tiết dòng lỗi (F12 > Console)
      onSuccess();
    } catch (error) {
      console.error("Lỗi tải lên CSV:", error);
      if (isDuplicateConflict(error)) {
        toast.dismiss(loadingToast);
        pendingFile.current = file;
        setConflict(error.response.data);   // mở hộp thoại Cập nhật / Bỏ qua — CHƯA lưu gì
      } else if (error.sessionExpired) {
        toast.dismiss(loadingToast);
      } else {
        toast.error(error.response?.data?.error || 'Lỗi khi tải lên file CSV!', { id: loadingToast, duration: 6000 });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    e.target.value = null; // cho phép chọn lại cùng 1 file
    if (!file) return;
    const ok = window.confirm(`Tải lên file "${file.name}" và LƯU NGAY vào danh sách hội viên ${market}?\n\nFile cần có cột fullName và 7 cột chỉ số. Muốn xem kết quả trước khi lưu, hãy dùng mục "Dự báo".`);
    if (ok) sendCsv(file);
  };

  // Sửa → đẩy dữ liệu lên form và cuộn tới form (hữu ích khi màn hình hẹp, form nằm trên bảng)
  const handleEdit = (cus) => {
    setEditingCustomer(cus);
    document.getElementById('customer-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const term = searchTerm.trim().toLowerCase();
  const filteredCustomers = customers.filter(cus => {
    const matchSearch = !term || (cus.fullName || '').toLowerCase().includes(term) ||
                        (cus.actualPhoneNumber && cus.actualPhoneNumber.includes(searchTerm.trim()));
    const matchRisk = externalFilter === 'All' || (!isPendingOf(cus) && cus.prediction?.risk_level === externalFilter);

    let matchDate = true;
    if (dateFilter === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      matchDate = new Date(cus.createdAt) >= thirtyDaysAgo;
    }

    return matchSearch && matchRisk && matchDate;
  });

  if (externalFilter !== 'All') {
    filteredCustomers.sort((a, b) => (b.prediction?.probability_percent ?? 0) - (a.prediction?.probability_percent ?? 0));
  }

  const pendingCount = customers.filter(c => c.status === 'Chờ duyệt').length;
  const shown = filteredCustomers.slice(0, limit);

  if (!ready) {
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
      {conflict && (
        <DuplicateDialog lang="vi" market={market} conflict={conflict} busy={uploading}
          onChoose={(mode) => { if (pendingFile.current) sendCsv(pendingFile.current, mode); }}
          onCancel={() => { setConflict(null); pendingFile.current = null; toast('Đã hủy, không có hội viên nào được lưu.'); }} />
      )}

      {/* ---------- Toolbar ---------- */}
      <div className="ad-toolbar">
        <div className="ad-toolbar-row">
          <div>
            <h3 className="ad-h3">
              Danh sách hội viên {market} <span className="ad-count ad-num">{filteredCustomers.length}/{customers.length}</span>
              {refreshing && <span className="ad-count" role="status" style={{ marginLeft: 6 }}>Đang cập nhật…</span>}
            </h3>
            <p className="ad-h3-sub">
              {pendingCount > 0 ? `${pendingCount} hội viên đang chờ duyệt và chấm điểm rủi ro` : 'Tất cả hội viên đã được chấm điểm rủi ro'}
            </p>
          </div>

          <div className="ad-actions">
            <label className={`ad-btn ${uploading ? 'is-disabled' : ''}`} style={{ cursor: uploading ? 'wait' : 'pointer', opacity: uploading ? 0.6 : 1 }}
              title={`Lưu thẳng vào danh sách ${market}. Cần cột fullName + 7 cột chỉ số.`}>
              <CloudUpload size={15} /> {uploading ? 'Đang xử lý...' : 'Tải lên CSV'}
              <input type="file" accept=".csv" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>
        </div>

        <div className="ad-toolbar-row">
          <div className="ad-search">
            <Search size={15} />
            <input className="ad-input" type="text" placeholder="Tìm theo tên hoặc số điện thoại" value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setLimit(PAGE); }} aria-label="Tìm hội viên" />
          </div>

          <div className="ad-tabs" role="group" aria-label="Lọc theo mức rủi ro">
            {RISK_TABS.map(t => (
              <button key={t.value} className={`ad-tab ${t.tone}`} aria-pressed={externalFilter === t.value} onClick={() => { onFilterChange(t.value); setLimit(PAGE); }}>
                {t.value !== 'All' && <span className="ad-tab-dot" />}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ---------- Bảng (cuộn dọc, header dính) ---------- */}
      <div className="ad-table-scroll" aria-busy={refreshing} style={{ opacity: refreshing ? 0.6 : 1, transition: 'opacity .2s' }}>
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
              shown.map((cus) => {
                const riskPrc = cus.prediction?.probability_percent || 0;
                const isPending = cus.status === 'Chờ duyệt';
                const notScored = isPendingOf(cus);
                const tone = toneOf(cus);
                const initials = (cus.fullName || '?').split(' ').map(n => n[0]).join('').substring(0, 3).toUpperCase();
                const needsCare = !notScored && (cus.prediction.risk_level === 'Cao' || cus.prediction.risk_level === 'Trung bình');

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
                            {notScored ? 'Chưa dự báo' : cus.prediction.risk_level}
                          </span>
                          {notScored
                            ? <span className="ad-wait">Chờ đánh giá</span>
                            : <span className="ad-meter-val ad-num">{riskPrc}%</span>}
                        </div>
                        <div className="ad-meter-track"><div className="ad-meter-fill" style={{ width: `${notScored ? 0 : Math.min(riskPrc, 100)}%` }} /></div>
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
        {filteredCustomers.length > limit && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <button className="ad-btn" onClick={() => setLimit(limit + PAGE)}>
              Xem thêm {Math.min(PAGE, filteredCustomers.length - limit)} hội viên (đang hiện {limit}/{filteredCustomers.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}