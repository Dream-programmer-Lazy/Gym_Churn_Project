// INTERNATIONAL FORM — global_model.pkl (public gym dataset, money in USD)
// Khác form VN: tiếng Anh mặc định, USD, chỉ có gói 1/6/12 tháng, mức chi tiêu gợi ý theo USD.
const yesNo = [
  { value: 1, label: { vi: 'Có', en: 'Yes' } },
  { value: 0, label: { vi: 'Không', en: 'No' } },
];

const formGlobal = {
  region: 'global',
  defaultLang: 'en',
  label: { vi: 'Quốc tế', en: 'International' },
  plansText: { vi: 'Tiền USD, gói 1, 6, 12 tháng', en: 'USD, 1, 6 and 12-month plans' },
  money: { currency: 'usd', modelScale: 1, csvUnit: { vi: 'USD', en: 'USD' } },

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
        { name: 'Age', type: 'stepper', min: 14, max: 90, start: 29,
          label: { vi: 'Hội viên bao nhiêu tuổi?', en: 'How old is the member?' }, unit: { vi: 'tuổi', en: 'years' } },
        { name: 'Phone', type: 'choice', options: yesNo,
          label: { vi: 'Hội viên có để lại số điện thoại không?', en: 'Is their phone number on file?' } },
      ],
    },
    {
      id: 'source',
      title: { vi: 'Nguồn đăng ký', en: 'How they joined' },
      questions: [
        { name: 'Near_Location', type: 'choice', options: yesNo,
          label: { vi: 'Hội viên sống hoặc làm việc gần phòng tập?', en: 'Do they live or work near the gym?' } },
        { name: 'Partner', type: 'choice', options: yesNo,
          label: { vi: 'Đăng ký qua công ty đối tác?', en: 'Are they a corporate partner member?' } },
        { name: 'Promo_friends', type: 'choice', options: yesNo,
          label: { vi: 'Được bạn bè giới thiệu?', en: 'Did they join through a friend referral?' } },
      ],
    },
    {
      id: 'contract',
      title: { vi: 'Hợp đồng', en: 'Membership' },
      questions: [
        { name: 'Contract_period', type: 'plans', plans: [1, 6, 12],
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
        { name: 'Avg_additional_charges_total', type: 'money', presets: [0, 50, 120, 250],
          label: { vi: 'Mỗi tháng hội viên chi thêm khoảng bao nhiêu?', en: 'How much extra do they spend per month?' },
          hint: { vi: 'Không tính tiền gói tập.', en: 'Not including the membership fee.' } },
      ],
    },
  ],

  templateRows: [
    ['John Carter', 1, 1, 0, 1, 1, 1, 0, 24, 120, 1, 2, 1.5, 0.4],
    ['Emma Wilson', 0, 1, 1, 1, 1, 12, 1, 31, 210, 10, 8, 2.8, 3.0],
  ],
};

export default formGlobal;