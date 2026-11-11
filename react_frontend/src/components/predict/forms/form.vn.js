// FORM THỊ TRƯỜNG VIỆT NAM — mô hình vn_model.pkl (dữ liệu mô phỏng, tiền tính bằng nghìn VNĐ)
// Người dùng nhập tiền VNĐ đầy đủ (500.000đ); utils.toPayload tự chia 1.000 trước khi gửi cho mô hình.
const yesNo = [
  { value: 1, label: { vi: 'Có', en: 'Yes' } },
  { value: 0, label: { vi: 'Không', en: 'No' } },
];

const formVN = {
  region: 'vn',
  defaultLang: 'vi',
  label: { vi: 'Việt Nam', en: 'Vietnam' },
  plansText: { vi: 'Tiền VNĐ, gói 1, 3, 6, 12 tháng', en: 'VND, 1, 3, 6 and 12-month plans' },
  money: { currency: 'vnd', modelScale: 1000, csvUnit: { vi: 'nghìn VNĐ (500 = 500.000đ)', en: 'thousand VND (500 = 500,000 VND)' } },

  sections: [
    {
      id: 'personal',
      title: { vi: 'Thông tin cá nhân', en: 'About the member' },
      questions: [
        { name: 'fullName', type: 'text', optional: true,
          label: { vi: 'Họ và tên hội viên', en: 'Member name' }, placeholder: { vi: 'Không bắt buộc', en: 'Optional' } },
        { name: 'gender', type: 'choice',
          label: { vi: 'Giới tính', en: 'Gender' },
          options: [{ value: 0, label: { vi: 'Nữ', en: 'Female' } }, { value: 1, label: { vi: 'Nam', en: 'Male' } }] },
        { name: 'Age', type: 'stepper', min: 14, max: 90, start: 25,
          label: { vi: 'Hội viên bao nhiêu tuổi?', en: 'How old is the member?' }, unit: { vi: 'tuổi', en: 'years' } },
        { name: 'Phone', type: 'choice', options: yesNo,
          label: { vi: 'Hội viên có để lại số điện thoại không?', en: 'Did they leave a phone number?' } },
      ],
    },
    {
      id: 'source',
      title: { vi: 'Nguồn đăng ký', en: 'How they joined' },
      questions: [
        { name: 'Near_Location', type: 'choice', options: yesNo,
          label: { vi: 'Hội viên sống hoặc làm việc gần phòng tập?', en: 'Do they live or work near the gym?' } },
        { name: 'Partner', type: 'choice', options: yesNo,
          label: { vi: 'Đăng ký qua công ty đối tác?', en: 'Did they join through a partner company?' } },
        { name: 'Promo_friends', type: 'choice', options: yesNo,
          label: { vi: 'Được bạn bè giới thiệu?', en: 'Were they referred by a friend?' } },
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
        { name: 'Group_visits', type: 'choice', options: yesNo,
          label: { vi: 'Hội viên có tham gia lớp tập nhóm không?', en: 'Do they attend group classes?' } },
        { name: 'Avg_additional_charges_total', type: 'money', presets: [0, 200000, 500000, 1000000],
          label: { vi: 'Mỗi tháng hội viên chi thêm khoảng bao nhiêu?', en: 'How much extra do they spend per month?' },
          hint: { vi: 'Không tính tiền gói tập.', en: 'Not including the membership fee.' } },
      ],
    },
  ],

  // 2 dòng ví dụ cho file CSV mẫu (tiền theo đơn vị của mô hình: nghìn VNĐ)
  templateRows: [
    ['Nguyễn Văn An', 1, 1, 0, 1, 1, 1, 0, 24, 350, 1, 3, 2.1, 0.6],
    ['Trần Thị Bích', 0, 1, 1, 0, 1, 12, 1, 35, 820, 9, 20, 3.0, 3.2],
  ],
};

export default formVN;