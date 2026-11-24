// FORM THỊ TRƯỜNG VIỆT NAM — mô hình vn_model.pkl (dữ liệu mô phỏng, tiền tính bằng nghìn VNĐ)
// 7 cột của mô hình + họ tên / số điện thoại (không gửi cho mô hình).
// Người dùng nhập tiền VNĐ đầy đủ (500.000đ); utils.toPayload tự chia 1.000 trước khi gửi cho mô hình.
// Câu có adminOnly: true chỉ hiện trong Admin (trang dùng thử công khai không hỏi).

const formVN = {
  region: 'vn',
  defaultLang: 'vi',
  label: { vi: 'Việt Nam', en: 'Vietnam' },
  plansText: { vi: 'Tiền VNĐ, gói 1, 3, 6, 12 tháng', en: 'VND, 1, 3, 6 and 12-month plans' },
  plans: [1, 3, 6, 12],
  money: { currency: 'vnd', modelScale: 1000, csvUnit: { vi: 'nghìn VNĐ (500 = 500.000đ)', en: 'thousand VND (500 = 500,000 VND)' } },

  sections: [
    {
      id: 'personal',
      title: { vi: 'Thông tin hội viên', en: 'About the member' },
      questions: [
        { name: 'fullName', type: 'text', optional: true,
          label: { vi: 'Họ và tên hội viên', en: 'Member name' }, placeholder: { vi: 'Không bắt buộc', en: 'Optional' } },
        { name: 'actualPhoneNumber', type: 'text', optional: true, adminOnly: true,
          label: { vi: 'Số điện thoại', en: 'Phone number' }, placeholder: { vi: '09xx xxx xxx (không bắt buộc)', en: 'Optional' } },
        { name: 'Age', type: 'stepper', min: 14, max: 90, start: 25,
          label: { vi: 'Hội viên bao nhiêu tuổi?', en: 'How old is the member?' }, unit: { vi: 'tuổi', en: 'years' } },
      ],
    },
    {
      id: 'contract',
      title: { vi: 'Hợp đồng', en: 'Membership' },
      questions: [
        { name: 'Contract_period', type: 'plans', plans: [1, 3, 6, 12],
          label: { vi: 'Hội viên đang dùng gói mấy tháng?', en: 'Which plan are they on?' }, unit: { vi: 'tháng', en: 'months' } },
        { name: 'Month_to_end_contract', type: 'stepper', min: 0, maxFrom: 'Contract_period', start: 1,
          label: { vi: 'Hợp đồng còn mấy tháng nữa thì hết?', en: 'How many months are left on the contract?' }, unit: { vi: 'tháng', en: 'months' } },
        { name: 'Lifetime', type: 'stepper', min: 0, max: 120, start: 1,
          label: { vi: 'Hội viên đã tập ở đây được bao lâu?', en: 'How long have they been a member?' }, unit: { vi: 'tháng', en: 'months' } },
      ],
    },
    {
      id: 'habits',
      title: { vi: 'Thói quen tập luyện', en: 'Visit habits' },
      questions: [
        { name: 'Avg_class_frequency_total', type: 'slider', min: 0, max: 7, step: 0.1,
          label: { vi: 'Từ khi đăng ký, trung bình mỗi tuần hội viên tập mấy buổi?', en: 'Since joining, how many times a week do they visit on average?' },
          unit: { vi: 'buổi', en: '/ week' } },
        { name: 'Avg_class_frequency_current_month', type: 'slider', min: 0, max: 7, step: 0.1, insightFrom: 'Avg_class_frequency_total',
          label: { vi: 'Còn trong tháng gần nhất thì sao?', en: 'And over the last month?' },
          unit: { vi: 'buổi', en: '/ week' } },
        { name: 'Avg_additional_charges_total', type: 'money', presets: [0, 200000, 500000, 1000000],
          label: { vi: 'Mỗi tháng hội viên chi thêm khoảng bao nhiêu?', en: 'How much extra do they spend per month?' },
          hint: { vi: 'Không tính tiền gói tập (đồ uống, PT, dịch vụ...).', en: 'Not including the membership fee (drinks, PT, services...).' } },
      ],
    },
  ],

  // 2 dòng ví dụ cho file CSV mẫu. Thứ tự cột = utils.TEMPLATE_HEADER:
  // fullName, actualPhoneNumber, Lifetime, Avg_class_frequency_current_month, Avg_class_frequency_total,
  // Age, Avg_additional_charges_total (NGHÌN VNĐ), Month_to_end_contract, Contract_period
  templateRows: [
    ['Nguyễn Văn An', '0901234567', 3, 0.6, 2.1, 24, 350, 1, 1],
    ['Trần Thị Bích', '0912345678', 20, 3.2, 3.0, 35, 820, 9, 12],
  ],
};

export default formVN;