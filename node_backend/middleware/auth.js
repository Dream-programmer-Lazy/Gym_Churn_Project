/**
 * XÁC THỰC & PHÂN QUYỀN (JWT)
 * ---------------------------
 * - JWT_SECRET    : đọc từ file .env (không viết cứng trong code nữa)
 * - signToken     : tạo token khi đăng nhập (dùng chung cho Admin/Staff và hội viên)
 * - verifyToken   : kiểm tra token hợp lệ -> gắn req.user = { id, role, fullName }
 * - requireRole   : chỉ cho phép một số vai trò đi tiếp
 * - requireStaff  : chỉ Admin hoặc Staff (trang quản trị)
 * - requireAdmin  : chỉ Admin
 * - requireCustomer : chỉ hội viên (cổng hội viên)
 *
 * Giữ tương thích code cũ: `const verifyToken = require('../middleware/auth')` vẫn dùng được.
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 16) {
    // Dừng server ngay để không chạy với chìa khóa yếu hoặc rỗng
    throw new Error(
        'Thiếu JWT_SECRET (hoặc quá ngắn, cần ít nhất 16 ký tự) trong node_backend/.env. '
        + 'Xem hướng dẫn trong node_backend/.env.example.'
    );
}

const STAFF_ROLES = ['Admin', 'Staff'];

/** Tạo token. payload ví dụ: { id, role, fullName }; expiresIn ví dụ: '1d', '7d' */
const signToken = (payload, expiresIn) => jwt.sign(payload, JWT_SECRET, { expiresIn });

const verifyToken = (req, res, next) => {
    // Lấy token từ header Authorization của request
    const authHeader = req.headers['authorization'];

    // Nếu không có header hoặc không bắt đầu bằng 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Truy cập bị từ chối! Vui lòng đăng nhập.' });
    }

    const token = authHeader.split(' ')[1]; // Cắt lấy phần mã token phía sau chữ Bearer

    try {
        req.user = jwt.verify(token, JWT_SECRET); // { id, role, fullName, iat, exp }
        return next();
    } catch (err) {
        return res.status(403).json({ error: 'Token không hợp lệ hoặc đã hết hạn!' });
    }
};

/** Dùng SAU verifyToken. Ví dụ: router.get('/', verifyToken, requireRole(['Admin']), ...) */
const requireRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này.' });
    }
    return next();
};

const requireStaff = requireRole(STAFF_ROLES);
const requireAdmin = requireRole(['Admin']);
const requireCustomer = requireRole(['Customer']);

module.exports = verifyToken;
module.exports.verifyToken = verifyToken;
module.exports.signToken = signToken;
module.exports.requireRole = requireRole;
module.exports.requireStaff = requireStaff;
module.exports.requireAdmin = requireAdmin;
module.exports.requireCustomer = requireCustomer;
module.exports.STAFF_ROLES = STAFF_ROLES;