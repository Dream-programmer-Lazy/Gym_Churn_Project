const express = require('express');
const router = express.Router();
const axios = require('axios');
const Customer = require('../models/Customer');
const verifyToken = require('../middleware/auth');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const fs = require('fs');

// --- API MỚI: LẤY 4 CHỈ SỐ CỦA 2 MÔ HÌNH TỪ FLASK ---
router.get('/metrics', verifyToken, async (req, res) => {
    try {
        const flaskResponse = await axios.get('http://127.0.0.1:5000/metrics');
        res.status(200).json(flaskResponse.data);
    } catch (error) {
        console.error("Lỗi lấy chỉ số mô hình:", error.message);
        res.status(500).json({ error: "Lỗi kết nối đến AI Server để lấy metrics." });
    }
});

// 1. API: THÊM KHÁCH HÀNG MỚI & DỰ ĐOÁN AI
router.post('/', verifyToken, async (req, res) => {
    try {
        const data = req.body;
        console.log(`➡️ Đang gọi AI (Flask) với mô hình: ${data.model_type || 'logistic'}`);

        const flaskResponse = await axios.post('http://127.0.0.1:5000/predict', data);
        const predictionResult = flaskResponse.data;

        const newCustomer = new Customer({
            ...data, // Copy fullName, phone và 13 thuộc tính
            prediction: {
                probability_percent: predictionResult.probability_percent,
                risk_level: predictionResult.risk_level,
                model_used: predictionResult.model_used,
                last_predicted_at: new Date()
            }
        });

        const savedCustomer = await newCustomer.save();
        res.status(201).json({ message: "Thêm khách hàng và dự báo thành công!", customer: savedCustomer });

    } catch (error) {
        console.error("❌ Lỗi:", error.message);
        res.status(500).json({ error: "Lỗi server khi xử lý khách hàng." });
    }
});

// 2. LẤY DANH SÁCH KHÁCH HÀNG
router.get('/', verifyToken, async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 });
        res.status(200).json(customers);
    } catch (error) {
        res.status(500).json({ error: "Lỗi khi lấy danh sách khách hàng." });
    }
});

// 3. XÓA KHÁCH HÀNG
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const deletedCustomer = await Customer.findByIdAndDelete(req.params.id);
        if (!deletedCustomer) return res.status(404).json({ error: "Không tìm thấy khách hàng để xóa" });
        res.status(200).json({ message: "Đã xóa khách hàng thành công!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi server khi xóa khách hàng." });
    }
});

// 4. CẬP NHẬT & DỰ BÁO LẠI
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const data = req.body;
        const flaskResponse = await axios.post('http://127.0.0.1:5000/predict', data);
        const predictionResult = flaskResponse.data;

        const updateData = {
            ...data,
            prediction: {
                probability_percent: predictionResult.probability_percent,
                risk_level: predictionResult.risk_level,
                model_used: predictionResult.model_used,
                last_predicted_at: new Date()
            }
        };

        const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updatedCustomer) return res.status(404).json({ error: "Không tìm thấy khách hàng" });

        res.status(200).json({ message: "Cập nhật và dự báo lại thành công!", customer: updatedCustomer });
    } catch (error) {
        res.status(500).json({ error: "Lỗi server khi cập nhật khách hàng." });
    }
});

// 5. DUYỆT KHÁCH HÀNG (Admin)
router.put('/:id/approve', verifyToken, async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) return res.status(404).json({ error: "Không tìm thấy khách hàng!" });
        if (customer.status === 'Đang hoạt động') return res.status(400).json({ error: "Đã được duyệt rồi!" });

        const aiData = {
            gender: customer.gender, Near_Location: customer.Near_Location, Partner: customer.Partner,
            Promo_friends: customer.Promo_friends, Phone: customer.Phone, Contract_period: customer.Contract_period,
            Group_visits: customer.Group_visits, Age: customer.Age, Avg_additional_charges_total: customer.Avg_additional_charges_total,
            Month_to_end_contract: customer.Month_to_end_contract, Lifetime: customer.Lifetime,
            Avg_class_frequency_total: customer.Avg_class_frequency_total, Avg_class_frequency_current_month: customer.Avg_class_frequency_current_month,
            model_type: req.body.model_type || 'logistic' // Truyền model_type nếu có
        };

        const flaskResponse = await axios.post('http://127.0.0.1:5000/predict', aiData);
        const predictionResult = flaskResponse.data;

        customer.status = 'Đang hoạt động';
        customer.prediction = {
            probability_percent: predictionResult.probability_percent,
            risk_level: predictionResult.risk_level,
            model_used: predictionResult.model_used,
            last_predicted_at: new Date()
        };

        await customer.save();
        res.status(200).json({ message: "Đã duyệt và đánh giá rủi ro thành công!", customer });
    } catch (error) {
        res.status(500).json({ error: "Lỗi server khi duyệt khách hàng." });
    }
});

// 6. UPLOAD FILE CSV
router.post('/upload-csv', verifyToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Vui lòng chọn một file CSV hợp lệ!" });
        
        const model_type = req.body.model_type || 'logistic'; // Lấy loại mô hình do Admin chọn
        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath, 'utf8');
        const lines = fileContent.split(/\r?\n/).filter(line => line.trim() !== '');

        if (lines.length < 2) {
            fs.unlinkSync(filePath);
            return res.status(400).json({ error: "File CSV trống hoặc sai định dạng!" });
        }

        const headers = lines[0].split(',').map(h => h.trim());
        let importedCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length !== headers.length) continue;

            let rowData = {};
            headers.forEach((h, index) => { rowData[h] = values[index]; });

            const customerPayload = {
                fullName: rowData.fullName || `Hội viên chi nhánh ${i}`,
                actualPhoneNumber: rowData.actualPhoneNumber || '0900000000',
                gender: Number(rowData.gender) || 1, Near_Location: Number(rowData.Near_Location) || 1,
                Partner: Number(rowData.Partner) || 0, Promo_friends: Number(rowData.Promo_friends) || 0,
                Phone: Number(rowData.Phone) || 1, Contract_period: Number(rowData.Contract_period) || 6,
                Group_visits: Number(rowData.Group_visits) || 0, Age: Number(rowData.Age) || 25,
                Avg_additional_charges_total: Number(rowData.Avg_additional_charges_total) || 100,
                Month_to_end_contract: Number(rowData.Month_to_end_contract) || 5, Lifetime: Number(rowData.Lifetime) || 3,
                Avg_class_frequency_total: Number(rowData.Avg_class_frequency_total) || 2.5,
                Avg_class_frequency_current_month: Number(rowData.Avg_class_frequency_current_month) || 2.0,
                status: 'Đang hoạt động',
                model_type: model_type // Ép chạy mô hình theo yêu cầu
            };

            try {
                const flaskRes = await axios.post('http://127.0.0.1:5000/predict', customerPayload);
                customerPayload.prediction = {
                    probability_percent: flaskRes.data.probability_percent,
                    risk_level: flaskRes.data.risk_level,
                    model_used: flaskRes.data.model_used,
                    last_predicted_at: new Date()
                };

                const newCustomer = new Customer(customerPayload);
                await newCustomer.save();
                importedCount++;
            } catch (aiErr) {
                console.error(`Lỗi dự đoán dòng ${i}:`, aiErr.message);
            }
        }

        fs.unlinkSync(filePath);
        res.status(200).json({ message: `Đã phân tích ${model_type} và lưu ${importedCount} hội viên.` });

    } catch (error) {
        res.status(500).json({ error: "Lỗi phân tích file CSV." });
    }
});

// 7. GỬI LỜI NHẮC
router.post('/:id/notify', verifyToken, async (req, res) => {
    try {
        const { message } = req.body;
        const customer = await Customer.findByIdAndUpdate(req.params.id, { admin_message: message }, { new: true });
        if (!customer) return res.status(404).json({ error: "Không tìm thấy khách hàng" });
        res.status(200).json({ message: "Đã gửi thông báo đến khách hàng!" });
    } catch (error) {
        res.status(500).json({ error: "Lỗi khi gửi thông báo." });
    }
});

module.exports = router;