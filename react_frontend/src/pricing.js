/**
 * BẢNG GIÁ GÓI TẬP (thị trường Việt Nam) — DÙNG CHUNG cho Landing Page (Bảng giá) và trang Đăng ký.
 * Giá tham khảo phân khúc tầm trung, đơn vị: đồng.
 * PHẢI trùng với PLAN_PRICES.vn trong node_backend/routes/offers.js (giá dùng để tính ưu đãi gia hạn).
 * Hội viên tự đăng ký chỉ ở thị trường Việt Nam (máy chủ chỉ nhận gói 1/3/6/12 tháng).
 */
export const PLAN_PRICES_VND = { 1: 500000, 3: 1350000, 6: 2500000, 12: 4500000 };

export const PLANS_VN = [
  { months: 1, name: 'Gói Cơ bản', note: 'Phù hợp cho người muốn trải nghiệm ngắn hạn toàn bộ dịch vụ.' },
  { months: 3, name: 'Gói Khởi động', note: 'Đủ thời gian hình thành thói quen tập luyện đều đặn.' },
  { months: 6, name: 'Gói Tiết kiệm', note: 'Lộ trình chuẩn hóa giúp bạn thấy rõ sự thay đổi của cơ thể.', popular: true },
  { months: 12, name: 'Gói VIP Đặc quyền', note: 'Tối ưu chi phí kèm theo đặc quyền phân tích chỉ số AI trọn gói.' },
];

export const DEFAULT_PLAN = 6;
export const isValidPlan = (months) => Object.prototype.hasOwnProperty.call(PLAN_PRICES_VND, months);

/** 2500000 -> "2.500.000đ" */
export const formatVnd = (amount) => `${Math.round(amount).toLocaleString('vi-VN')}đ`;

/** Giá trung bình mỗi tháng của gói, làm tròn tới nghìn đồng (6 tháng -> 417.000) */
export const pricePerMonth = (months) => Math.round(PLAN_PRICES_VND[months] / months / 1000) * 1000;

/** Tiết kiệm bao nhiêu % so với mua lẻ từng tháng (gói 1 tháng -> 0) */
export const savingPercent = (months) =>
  Math.round((1 - PLAN_PRICES_VND[months] / (PLAN_PRICES_VND[1] * months)) * 100);