// ĐỊA CHỈ API DÙNG CHUNG CHO TOÀN BỘ FRONTEND
// -------------------------------------------
// - Chạy local: không cần làm gì, mặc định gọi http://localhost:3001
// - Triển khai (Vercel/Netlify): đặt biến môi trường VITE_API_BASE = địa chỉ Node trên mạng,
//   ví dụ https://gym-churn-api.onrender.com  (không có dấu / ở cuối, không có /api)
// Vite chỉ đọc biến bắt đầu bằng VITE_ và "dán" giá trị vào lúc build.
export const API_ROOT = (import.meta.env.VITE_API_BASE || 'http://localhost:3001').replace(/\/+$/, '');

// Ví dụ: `${API_URL}/customers` -> http://localhost:3001/api/customers
export const API_URL = `${API_ROOT}/api`;