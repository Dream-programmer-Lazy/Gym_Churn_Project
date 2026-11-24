/**
 * XÓA TOÀN BỘ HỘI VIÊN TRONG MONGODB (collection customers)
 * ---------------------------------------------------------
 * Chạy trong thư mục node_backend:
 *   node scripts/xoa_het.js                     -> CHỈ XEM TRƯỚC, không xóa gì
 *   node scripts/xoa_het.js --xoa               -> XÓA THẬT, GIỮ LẠI hội viên có tài khoản đăng nhập
 *   node scripts/xoa_het.js --xoa --ca-tai-khoan -> XÓA THẬT TẤT CẢ, kể cả hội viên có tài khoản
 * Trước khi xóa luôn lưu bản sao ra file backup_xoa_het_*.json.
 *
 * KHÔNG ảnh hưởng mô hình AI (mô hình học từ file CSV trong flask_ai, không đọc MongoDB)
 * và KHÔNG xóa tài khoản Admin/Staff (nằm ở collection users).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');

const XOA_THAT = process.argv.includes('--xoa');
const CA_TAI_KHOAN = process.argv.includes('--ca-tai-khoan');

(async () => {
    if (!process.env.MONGODB_URI) {
        console.error('❌ Thiếu MONGODB_URI trong node_backend/.env');
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Đã kết nối MongoDB Atlas');

    const total = await Customer.countDocuments();
    const withAccount = await Customer.countDocuments({ username: { $exists: true, $ne: null } });
    const vn = await Customer.countDocuments({ $or: [{ region: 'vn' }, { region: { $exists: false } }] });
    const global = await Customer.countDocuments({ region: 'global' });

    // Điều kiện xóa: mặc định bỏ qua người có tài khoản đăng nhập
    const filter = CA_TAI_KHOAN ? {} : { $or: [{ username: { $exists: false } }, { username: null }] };
    const willDelete = await Customer.countDocuments(filter);

    console.log(`\nTổng hội viên hiện có: ${total} (Việt Nam: ${vn}, Quốc tế: ${global})`);
    console.log(`Trong đó có tài khoản đăng nhập: ${withAccount}`);
    console.log(CA_TAI_KHOAN
        ? `Chế độ: XÓA TẤT CẢ (kể cả ${withAccount} người có tài khoản)`
        : `Chế độ: GIỮ LẠI ${withAccount} người có tài khoản đăng nhập`);
    console.log(`Sẽ xóa: ${willDelete} hồ sơ | Còn lại sau khi xóa: ${total - willDelete}`);

    if (!willDelete) {
        console.log('\nKhông có gì để xóa.');
        await mongoose.disconnect();
        return;
    }

    if (!XOA_THAT) {
        console.log('\n👀 Đây chỉ là XEM TRƯỚC, chưa xóa gì.');
        console.log('   Xóa thật (giữ tài khoản):   node scripts/xoa_het.js --xoa');
        console.log('   Xóa thật tất cả:            node scripts/xoa_het.js --xoa --ca-tai-khoan');
        await mongoose.disconnect();
        return;
    }

    const docs = await Customer.find(filter).lean();
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(__dirname, '..', `backup_xoa_het_${stamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`\n💾 Đã lưu bản sao ${docs.length} hồ sơ vào: ${backupFile}`);

    const result = await Customer.deleteMany(filter);
    console.log(`🗑️  Đã xóa ${result.deletedCount} hồ sơ.`);
    console.log(`Còn lại: ${await Customer.countDocuments()} hội viên.`);

    await mongoose.disconnect();
})().catch(async (err) => {
    console.error('❌ Lỗi:', err.message);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});