"""
FLASK AI API — DỰ BÁO RỜI BỎ THEO THỊ TRƯỜNG (SONG NGỮ VI / EN)
---------------------------------------------------------------
Nạp 2 gói mô hình do train_model.py tạo ra:
    vn_model.pkl      (region = "vn")
    global_model.pkl  (region = "global")

Endpoints:
    GET  /health
    GET  /model-info?region=vn&lang=vi     -> khoảng giá trị, giá trị gợi ý, gói tập (dựng form)
    GET  /metrics?region=vn                -> Accuracy/Precision/Recall/F1 (giữ định dạng cũ cho Admin)
    POST /predict                          -> dự báo 1 hội viên
    POST /predict-batch                    -> dự báo nhiều hội viên (CSV)

Body của /predict:
    { "region": "vn" | "global",           (mặc định "vn" để tương thích code Node cũ)
      "model_type": "logistic" | "random_forest",
      "lang": "vi" | "en",                 (mặc định: vn -> vi, global -> en)
      ...13 biến... }
"""

import math
from pathlib import Path

import joblib
import pandas as pd
from flask import Flask, jsonify, request
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
app = Flask(__name__)
app.json.ensure_ascii = False   # trả tiếng Việt có dấu thay vì \u00ec ...
CORS(app)

MODEL_FILES = {'vn': 'vn_model.pkl', 'global': 'global_model.pkl'}
DEFAULT_REGION = 'vn'
DEFAULT_LANG = {'vn': 'vi', 'global': 'en'}
LANGS = ('vi', 'en')
MODEL_NAMES = {'logistic': 'Logistic Regression', 'random_forest': 'Random Forest'}
MAX_FREQ_PER_WEEK = 7
MAX_BATCH_ROWS = 5000
FREQ_TOTAL = 'Avg_class_frequency_total'
FREQ_CURRENT = 'Avg_class_frequency_current_month'
MIN_IMPACT = 0.15   # log-odds: yếu tố ảnh hưởng nhỏ hơn mức này coi là nhiễu, không đưa lên làm "lý do"

# ---------------------------------------------------------------------------
# CÂU CHỮ HAI NGÔN NGỮ
# ---------------------------------------------------------------------------
REGION_LABEL = {'vn': {'vi': 'Việt Nam', 'en': 'Vietnam'}, 'global': {'vi': 'Quốc tế', 'en': 'International'}}

FIELD_LABEL = {
    'gender':                       {'vi': 'Giới tính', 'en': 'Gender'},
    'Near_Location':                {'vi': 'Ở gần phòng tập', 'en': 'Lives or works nearby'},
    'Partner':                      {'vi': 'Đăng ký qua công ty đối tác', 'en': 'Corporate partner member'},
    'Promo_friends':                {'vi': 'Được bạn bè giới thiệu', 'en': 'Referred by a friend'},
    'Phone':                        {'vi': 'Có cung cấp số điện thoại', 'en': 'Phone number on file'},
    'Contract_period':              {'vi': 'Thời hạn gói tập', 'en': 'Plan length'},
    'Group_visits':                 {'vi': 'Tham gia lớp tập nhóm', 'en': 'Attends group classes'},
    'Age':                          {'vi': 'Tuổi', 'en': 'Age'},
    'Avg_additional_charges_total': {'vi': 'Chi tiêu thêm mỗi tháng', 'en': 'Extra monthly spend'},
    'Month_to_end_contract':        {'vi': 'Số tháng còn lại của hợp đồng', 'en': 'Months left on contract'},
    'Lifetime':                     {'vi': 'Thời gian đã là hội viên', 'en': 'Months as a member'},
    FREQ_TOTAL:                     {'vi': 'Số buổi tập/tuần từ khi đăng ký', 'en': 'Visits per week since joining'},
    FREQ_CURRENT:                   {'vi': 'Số buổi tập/tuần trong tháng gần nhất', 'en': 'Visits per week last month'},
}

UNIT = {
    'Age':                   {'vi': 'tuổi', 'en': 'years'},
    'Contract_period':       {'vi': 'tháng', 'en': 'months'},
    'Month_to_end_contract': {'vi': 'tháng', 'en': 'months'},
    'Lifetime':              {'vi': 'tháng', 'en': 'months'},
    FREQ_TOTAL:              {'vi': 'buổi/tuần', 'en': 'visits/week'},
    FREQ_CURRENT:            {'vi': 'buổi/tuần', 'en': 'visits/week'},
}

# Tiêu đề lý do theo TRẠNG THÁI của biến (không theo chiều tác động) -> luôn đúng nghĩa
#   biến 0/1: '0' / '1'      biến số: 'low' (< trung bình) / 'high' (>= trung bình)
TITLES = {
    'gender':          {'0': {'vi': 'Giới tính nữ', 'en': 'Female member'}, '1': {'vi': 'Giới tính nam', 'en': 'Male member'}},
    'Near_Location':   {'0': {'vi': 'Ở xa phòng tập', 'en': 'Lives far from the gym'}, '1': {'vi': 'Ở gần phòng tập', 'en': 'Lives near the gym'}},
    'Partner':         {'0': {'vi': 'Không đăng ký qua đối tác', 'en': 'Not a corporate member'}, '1': {'vi': 'Đăng ký qua đối tác', 'en': 'Corporate partner member'}},
    'Promo_friends':   {'0': {'vi': 'Không có bạn bè giới thiệu', 'en': 'Not referred by a friend'}, '1': {'vi': 'Được bạn bè giới thiệu', 'en': 'Referred by a friend'}},
    'Phone':           {'0': {'vi': 'Chưa có số điện thoại', 'en': 'No phone number on file'}, '1': {'vi': 'Đã có số điện thoại', 'en': 'Phone number on file'}},
    'Group_visits':    {'0': {'vi': 'Không tập lớp nhóm', 'en': 'No group classes'}, '1': {'vi': 'Có tập lớp nhóm', 'en': 'Attends group classes'}},
    'Age':             {'low': {'vi': 'Trẻ hơn mức trung bình', 'en': 'Younger than average'}, 'high': {'vi': 'Lớn tuổi hơn mức trung bình', 'en': 'Older than average'}},
    'Contract_period': {'low': {'vi': 'Gói tập ngắn hạn', 'en': 'Short-term plan'}, 'high': {'vi': 'Gói tập dài hạn', 'en': 'Long-term plan'}},
    'Month_to_end_contract': {'low': {'vi': 'Hợp đồng sắp hết hạn', 'en': 'Contract ending soon'}, 'high': {'vi': 'Hợp đồng còn dài', 'en': 'Plenty of time left on contract'}},
    'Lifetime':        {'low': {'vi': 'Hội viên còn mới', 'en': 'Fairly new member'}, 'high': {'vi': 'Gắn bó lâu năm', 'en': 'Long-standing member'}},
    'Avg_additional_charges_total': {'low': {'vi': 'Ít chi tiêu dịch vụ thêm', 'en': 'Low extra spending'}, 'high': {'vi': 'Chi tiêu dịch vụ thêm cao', 'en': 'High extra spending'}},
    'frequency_trend': {
        'down':        {'vi': 'Tần suất tập giảm mạnh', 'en': 'Visits are dropping'},
        'up':          {'vi': 'Tần suất tập tăng', 'en': 'Visits are increasing'},
        'stable_low':  {'vi': 'Tập ít buổi', 'en': 'Visits are infrequent'},
        'stable_high': {'vi': 'Tập đều đặn', 'en': 'Visits regularly'},
    },
}

ACTION_TIPS = {
    'frequency_trend':              {'vi': 'Gọi hỏi thăm và đặt một buổi tập cùng PT để lấy lại nhịp tập.',
                                     'en': 'Call to check in and book a session with a personal trainer.'},
    'Month_to_end_contract':        {'vi': 'Gửi ưu đãi gia hạn trước khi hợp đồng hết hạn.',
                                     'en': 'Send a renewal offer before the contract ends.'},
    'Group_visits':                 {'vi': 'Mời tham gia một lớp tập nhóm miễn phí.',
                                     'en': 'Invite them to a free group class.'},
    'Lifetime':                     {'vi': 'Chăm sóc kỹ hội viên mới trong 3 tháng đầu.',
                                     'en': 'Give extra onboarding support during the first 3 months.'},
    'Near_Location':                {'vi': 'Gợi ý khung giờ vắng hoặc chi nhánh gần hơn.',
                                     'en': 'Suggest quieter hours or a closer branch.'},
    'Contract_period':              {'vi': 'Đề xuất nâng cấp lên gói dài hạn kèm ưu đãi.',
                                     'en': 'Offer an upgrade to a longer plan with a discount.'},
    'Partner':                      {'vi': 'Giới thiệu chương trình ưu đãi doanh nghiệp.',
                                     'en': 'Introduce the corporate partner programme.'},
    'Promo_friends':                {'vi': 'Mời tham gia chương trình "rủ bạn tập cùng".',
                                     'en': 'Invite them to the bring-a-friend programme.'},
    'Avg_additional_charges_total': {'vi': 'Tặng thử một dịch vụ đi kèm (đồ uống, PT, đo InBody).',
                                     'en': 'Offer a free add-on service to try (drinks, PT, body scan).'},
    'Age':                          {'vi': 'Đề xuất chương trình tập phù hợp với độ tuổi.',
                                     'en': 'Suggest a training programme suited to their age.'},
    'gender':                       {'vi': 'Cá nhân hóa nội dung chăm sóc.',
                                     'en': 'Personalise how you reach out.'},
    'Phone':                        {'vi': 'Bổ sung số điện thoại để chăm sóc trực tiếp.',
                                     'en': 'Collect a phone number so staff can follow up.'},
}

LEVEL_WORD = {'Cao': {'vi': 'cao', 'en': 'high'}, 'Trung bình': {'vi': 'trung bình', 'en': 'medium'}, 'Thấp': {'vi': 'thấp', 'en': 'low'}}

LEVEL_ADVICE = {
    'Cao': {'vi': ('Cần can thiệp ngay', 'Nên liên hệ trực tiếp và gửi ưu đãi gia hạn trong tuần này.'),
            'en': ('Act now', 'Contact the member directly and send a renewal offer this week.')},
    'Trung bình': {'vi': ('Nên theo dõi sát', 'Một tin nhắn cá nhân hóa hoặc lời mời lớp nhóm có thể giúp giữ chân hội viên.'),
                   'en': ('Keep a close eye', 'A personal message or a group class invite can help keep this member.')},
    'Thấp': {'vi': ('Gắn kết ổn định', 'Tiếp tục chăm sóc định kỳ, chưa cần ưu đãi đặc biệt.'),
             'en': ('Stable and engaged', 'Keep up regular contact. No special offer needed yet.')},
}

MSG = {
    'missing':      {'vi': "Thiếu '{label}'.", 'en': "'{label}' is required."},
    'not_number':   {'vi': "'{label}' phải là số (nhận được: {value}).", 'en': "'{label}' must be a number (got: {value})."},
    'invalid':      {'vi': "'{label}' không hợp lệ.", 'en': "'{label}' is not valid."},
    'binary':       {'vi': "'{label}' chỉ nhận 0 hoặc 1.", 'en': "'{label}' must be 0 or 1."},
    'negative':     {'vi': "'{label}' không được âm.", 'en': "'{label}' cannot be negative."},
    'mte_gt':       {'vi': 'Số tháng còn lại không được lớn hơn thời hạn gói tập.', 'en': 'Months left cannot be longer than the plan.'},
    'freq_max':     {'vi': "'{label}' tối đa {max} buổi/tuần.", 'en': "'{label}' can be at most {max} visits a week."},
    'unseen_plan':  {'vi': 'Mô hình {region} chưa từng học gói {value} tháng (chỉ học gói {allowed} tháng). Kết quả kém tin cậy hơn.',
                     'en': 'The {region} model never saw a {value}-month plan (only {allowed}). The result is less reliable.'},
    'out_of_range': {'vi': "'{label}' = {value} nằm ngoài vùng dữ liệu huấn luyện ({lo} đến {hi}). Kết quả kém tin cậy hơn.",
                     'en': "'{label}' = {value} is outside the training data range ({lo} to {hi}). The result is less reliable."},
    'freq_gap':     {'vi': 'Tần suất tháng gần nhất lệch rất xa tần suất trung bình. Hãy kiểm tra lại số liệu.',
                     'en': 'Last month’s visits are very different from the average. Please double-check the numbers.'},
    'new_member':   {'vi': 'Hội viên mới dưới 1 tháng thường có tần suất trung bình bằng tần suất tháng gần nhất.',
                     'en': 'For members under 1 month, both visit numbers are usually the same.'},
    'avg_detail':   {'vi': '{value}. Trung bình thị trường là {mean}.', 'en': '{value}. Market average is {mean}.'},
    'trend_detail': {'vi': 'Từ {t} xuống {c} buổi/tuần. Trung bình thị trường là {m} buổi.',
                     'en': 'From {t} to {c} visits a week. Market average is {m}.'},
    'trend_up':     {'vi': 'Từ {t} lên {c} buổi/tuần. Trung bình thị trường là {m} buổi.',
                     'en': 'Up from {t} to {c} visits a week. Market average is {m}.'},
    'trend_flat':   {'vi': 'Khoảng {c} buổi/tuần. Trung bình thị trường là {m} buổi.',
                     'en': 'About {c} visits a week. Market average is {m}.'},
    'bad_region':   {'vi': "region không hợp lệ: '{value}'. Chỉ chấp nhận: vn, global.", 'en': "Invalid region '{value}'. Use vn or global."},
    'bad_model':    {'vi': "model_type không hợp lệ: '{value}'. Chỉ chấp nhận: logistic, random_forest.",
                     'en': "Invalid model_type '{value}'. Use logistic or random_forest."},
    'bad_row':      {'vi': 'Dòng không hợp lệ.', 'en': 'Invalid row.'},
}


def tr(key, lang, **kw):
    return MSG[key][lang].format(**kw)


# ---------------------------------------------------------------------------
# NẠP MÔ HÌNH
# ---------------------------------------------------------------------------
BUNDLES = {}
for region_key, filename in MODEL_FILES.items():
    try:
        BUNDLES[region_key] = joblib.load(BASE_DIR / filename)
        print(f"✅ Đã nạp {filename} ({BUNDLES[region_key]['label_vi']}, "
              f"huấn luyện lúc {BUNDLES[region_key]['trained_at_utc'][:19]})")
    except Exception as e:  # noqa: BLE001
        print(f"❌ Không nạp được {filename}: {e}\n   -> Chạy 'python train_model.py' trong thư mục flask_ai trước.")


def get_bundle(region):
    region = (region or DEFAULT_REGION).strip().lower()
    if region not in MODEL_FILES:
        raise ValueError(tr('bad_region', 'vi', value=region))
    if region not in BUNDLES:
        raise LookupError(f"Mô hình thị trường '{region}' chưa được nạp. Hãy chạy train_model.py.")
    return region, BUNDLES[region]


def get_lang(lang, region):
    lang = (lang or '').strip().lower()
    return lang if lang in LANGS else DEFAULT_LANG.get(region, 'vi')


# ---------------------------------------------------------------------------
# ĐỊNH DẠNG SỐ THEO NGÔN NGỮ (vi: 2,5 | 500.000đ   en: 2.5 | $120)
# ---------------------------------------------------------------------------
def fmt_num(value, lang, digits=2):
    s = f"{round(float(value), digits):g}"
    if lang == 'vi':
        s = s.replace('.', ',')
    return s


def fmt_money(value, region, lang):
    if region == 'vn':                       # mô hình VN tính bằng nghìn VNĐ
        dong = round(float(value) * 1000)
        return f"{dong:,.0f}".replace(',', '.') + 'đ'
    return f"${float(value):,.0f}" if lang == 'en' else f"{float(value):,.0f} USD".replace(',', '.')


def fmt_value(field, value, region, lang):
    if field == 'Avg_additional_charges_total':
        return fmt_money(value, region, lang)
    unit = UNIT.get(field, {}).get(lang, '')
    if lang == 'en' and float(value) == 1 and unit in ('months', 'years'):
        unit = unit[:-1]                      # 1 month / 1 year (số ít tiếng Anh)
    return f"{fmt_num(value, lang)} {unit}".strip()


def label_of(field, lang):
    return FIELD_LABEL[field][lang]


# ---------------------------------------------------------------------------
# KIỂM TRA DỮ LIỆU
#   errors   -> chặn, không dự báo
#   warnings -> vẫn dự báo, nhưng báo cho người dùng biết độ tin cậy giảm
# ---------------------------------------------------------------------------
def validate(raw, region, bundle, lang):
    features = bundle['features']
    binary = set(bundle['binary_features'])
    profile = bundle['profile']
    values, errors, warnings = {}, [], []

    for f in features:
        label = label_of(f, lang)
        v = raw.get(f)
        if v is None or (isinstance(v, str) and v.strip() == ''):
            errors.append({'field': f, 'message': tr('missing', lang, label=label)})
            continue
        try:
            num = float(str(v).replace(',', '.')) if isinstance(v, str) else float(v)
        except (TypeError, ValueError):
            errors.append({'field': f, 'message': tr('not_number', lang, label=label, value=repr(v))})
            continue
        if math.isnan(num) or math.isinf(num):
            errors.append({'field': f, 'message': tr('invalid', lang, label=label)})
            continue
        if f in binary and num not in (0.0, 1.0):
            errors.append({'field': f, 'message': tr('binary', lang, label=label)})
            continue
        if num < 0:
            errors.append({'field': f, 'message': tr('negative', lang, label=label)})
            continue
        values[f] = num

    if errors:
        return values, errors, warnings

    if values['Month_to_end_contract'] > values['Contract_period']:
        errors.append({'field': 'Month_to_end_contract', 'message': tr('mte_gt', lang)})
    for f in (FREQ_TOTAL, FREQ_CURRENT):
        if values[f] > MAX_FREQ_PER_WEEK:
            errors.append({'field': f, 'message': tr('freq_max', lang, label=label_of(f, lang), max=MAX_FREQ_PER_WEEK)})
    if errors:
        return values, errors, warnings

    contract = int(values['Contract_period'])
    if contract not in bundle['contract_values']:
        allowed = ', '.join(str(c) for c in bundle['contract_values'])
        warnings.append({'field': 'Contract_period', 'code': 'unseen_category',
                         'message': tr('unseen_plan', lang, region=REGION_LABEL[region][lang], value=contract, allowed=allowed)})

    for f in features:
        if f in binary or f == 'Contract_period':
            continue
        lo, hi = profile[f]['min'], profile[f]['max']
        if values[f] < lo or values[f] > hi:
            warnings.append({'field': f, 'code': 'out_of_range',
                             'message': tr('out_of_range', lang, label=label_of(f, lang),
                                           value=fmt_value(f, values[f], region, lang),
                                           lo=fmt_value(f, lo, region, lang), hi=fmt_value(f, hi, region, lang))})

    if abs(values[FREQ_CURRENT] - values[FREQ_TOTAL]) >= 2.5:
        warnings.append({'field': FREQ_CURRENT, 'code': 'inconsistent', 'message': tr('freq_gap', lang)})
    if values['Lifetime'] < 1 and abs(values[FREQ_TOTAL] - values[FREQ_CURRENT]) > 0.5:
        warnings.append({'field': 'Lifetime', 'code': 'inconsistent', 'message': tr('new_member', lang)})

    return values, errors, warnings


# ---------------------------------------------------------------------------
# DỰ BÁO + GIẢI THÍCH
# ---------------------------------------------------------------------------
def risk_label(percent, thresholds):
    if percent >= thresholds['high']:
        return 'Cao'
    if percent > thresholds['medium']:
        return 'Trung bình'
    return 'Thấp'


def _reason_item(field, state, impact, detail, lang, value, extra=None):
    title = TITLES[field][state][lang]
    item = {'field': field, 'state': state, 'title': title, 'detail': detail,
            'text': f"{title}. {detail}" if detail else title,
            'impact': round(float(impact), 4), 'value': value}
    if extra:
        item.update(extra)
    return item


def explain(values, region, bundle, lang, top_k=3):
    """
    Đóng góp của từng biến lên log-odds của Logistic Regression:
        contribution_i = coef_i * (x_i - mean_i) / std_i
    > 0 : làm TĂNG rủi ro so với một hội viên "trung bình" của thị trường
    < 0 : làm GIẢM rủi ro
    (Dùng Logistic của cùng thị trường để giải thích cho cả 2 thuật toán.)

    Hai biến tần suất tương quan rất mạnh (đa cộng tuyến) nên được GỘP thành
    một yếu tố "xu hướng tập luyện" với đóng góp = tổng 2 đóng góp.
    """
    ex, profile = bundle['explain'], bundle['profile']
    features, binary = bundle['features'], set(bundle['binary_features'])
    contrib = {f: ex['coef'][i] * (values[f] - ex['mean'][i]) / ex['scale'][i] for i, f in enumerate(features)}

    items = []
    for f in features:
        if f in (FREQ_TOTAL, FREQ_CURRENT):
            continue
        x = values[f]
        if f in binary:
            items.append(_reason_item(f, str(int(x)), contrib[f], '', lang, x))
        else:
            mean = profile[f]['mean']
            state = 'low' if x < mean else 'high'
            detail = tr('avg_detail', lang, value=fmt_value(f, x, region, lang), mean=fmt_value(f, mean, region, lang))
            items.append(_reason_item(f, state, contrib[f], detail, lang, x))

    t, c = values[FREQ_TOTAL], values[FREQ_CURRENT]
    mean_now = profile[FREQ_CURRENT]['mean']
    nums = {'t': fmt_num(t, lang), 'c': fmt_num(c, lang), 'm': fmt_num(mean_now, lang)}
    if c <= t - 0.3:
        state, detail = 'down', tr('trend_detail', lang, **nums)
    elif c >= t + 0.3:
        state, detail = 'up', tr('trend_up', lang, **nums)
    else:
        state = 'stable_low' if c < mean_now else 'stable_high'
        detail = tr('trend_flat', lang, **nums)
    items.append(_reason_item('frequency_trend', state, contrib[FREQ_TOTAL] + contrib[FREQ_CURRENT], detail, lang, c,
                              {'values': {FREQ_TOTAL: t, FREQ_CURRENT: c}}))

    increasing = sorted([it for it in items if it['impact'] >= MIN_IMPACT], key=lambda it: -it['impact'])[:top_k]
    protective = sorted([it for it in items if it['impact'] <= -MIN_IMPACT], key=lambda it: it['impact'])[:top_k]
    for it in increasing:
        it['direction'] = 'increase'
    for it in protective:
        it['direction'] = 'decrease'
    return increasing, protective


def build_advice(level, reasons, lang):
    title, text = LEVEL_ADVICE[level][lang]
    actions = []
    if level != 'Thấp':
        for r in reasons:
            tip = ACTION_TIPS.get(r['field'], {}).get(lang)
            if tip and tip not in actions:
                actions.append(tip)
    return {'level': level, 'title': title, 'text': text, 'actions': actions}


def predict_one(raw, region=None, model_type=None, lang=None):
    region, bundle = get_bundle(region)
    lang = get_lang(lang, region)
    model_type = (model_type or 'logistic').strip().lower()
    if model_type not in MODEL_NAMES:
        raise ValueError(tr('bad_model', lang, value=model_type))

    values, errors, warnings = validate(raw, region, bundle, lang)
    if errors:
        return {'ok': False, 'errors': errors}

    model = bundle['models'][model_type]
    X = pd.DataFrame([[values[f] for f in bundle['features']]], columns=bundle['features'])
    positive_index = list(model.classes_).index(1)
    prob = float(model.predict_proba(X)[0][positive_index])
    percent = round(prob * 100, 2)
    level = risk_label(percent, bundle['thresholds'])
    reasons, protective = explain(values, region, bundle, lang)

    return {
        'ok': True,
        # --- 3 trường cũ: Node/Mongo đang dùng, giữ nguyên tên & giá trị ---
        'probability_percent': percent,
        'risk_level': level,                    # luôn là 'Cao' | 'Trung bình' | 'Thấp' (khóa ổn định)
        'model_used': MODEL_NAMES[model_type],
        # --- Thông tin mới ---
        'risk_word': LEVEL_WORD[level][lang],   # chữ hiển thị theo ngôn ngữ: cao / high ...
        'lang': lang,
        'model_type': model_type,
        'region': region,
        'region_label': REGION_LABEL[region][lang],
        'currency': bundle['currency'],
        'model_version': bundle['trained_at_utc'],
        'thresholds': bundle['thresholds'],
        'reasons': reasons,
        'protective_factors': protective,
        'warnings': warnings,
        'advice': build_advice(level, reasons, lang),
    }


# ---------------------------------------------------------------------------
# ROUTES
# ---------------------------------------------------------------------------
def _region_error(e):
    return jsonify({'error': str(e)}), (400 if isinstance(e, ValueError) else 503)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok' if len(BUNDLES) == len(MODEL_FILES) else 'degraded',
        'models': {k: {'loaded': k in BUNDLES,
                       'trained_at_utc': BUNDLES[k]['trained_at_utc'] if k in BUNDLES else None}
                   for k in MODEL_FILES},
    })


@app.route('/model-info', methods=['GET'])
def model_info():
    """Frontend dùng để dựng form: khoảng hợp lệ, giá trị gợi ý, gói tập, đơn vị tiền."""
    try:
        region, bundle = get_bundle(request.args.get('region'))
    except (ValueError, LookupError) as e:
        return _region_error(e)
    lang = get_lang(request.args.get('lang'), region)

    fields = []
    for f in bundle['features']:
        p = bundle['profile'][f]
        item = {'name': f, 'label': label_of(f, lang), 'binary': f in bundle['binary_features'],
                'train_min': p['min'], 'train_max': p['max'], 'p05': p['p05'], 'p95': p['p95'],
                'median': p['median'], 'mean': p['mean']}
        if item['binary']:
            item['default'] = p['mode']       # nút Có/Không: điền sẵn giá trị phổ biến nhất
        fields.append(item)

    return jsonify({
        'region': region, 'lang': lang, 'region_label': REGION_LABEL[region][lang], 'currency': bundle['currency'],
        'contract_values': bundle['contract_values'], 'max_frequency': MAX_FREQ_PER_WEEK,
        'thresholds': bundle['thresholds'], 'data_kind': bundle['data_kind'],
        'model_version': bundle['trained_at_utc'], 'fields': fields,
    })


@app.route('/metrics', methods=['GET'])
def get_metrics():
    try:
        region, bundle = get_bundle(request.args.get('region'))
    except (ValueError, LookupError) as e:
        return _region_error(e)
    payload = dict(bundle['metrics'])
    # ModelMetricsDashboard (React) đọc response.data.models.logistic -> giữ đúng cấu trúc file JSON cũ
    payload['models'] = {'logistic': bundle['metrics']['logistic'],
                         'random_forest': bundle['metrics']['random_forest']}
    payload.update({'region': region, 'region_label': bundle['label_vi'],
                    'data_file': bundle['data_file'], 'data_kind': bundle['data_kind'],
                    'trained_at_utc': bundle['trained_at_utc']})
    return jsonify(payload)


@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({'error': 'Body phải là JSON object.'}), 400
    try:
        result = predict_one(data, data.get('region'), data.get('model_type'), data.get('lang'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except LookupError as e:
        return jsonify({'error': str(e)}), 503
    except Exception as e:  # noqa: BLE001
        return jsonify({'error': f'Lỗi khi dự báo: {e}'}), 500

    if not result['ok']:
        return jsonify({'error': result['errors'][0]['message'], 'errors': result['errors']}), 422
    result.pop('ok')
    return jsonify(result)


@app.route('/predict-batch', methods=['POST'])
def predict_batch():
    """
    Body: { "region": "vn", "model_type": "logistic", "lang": "vi", "rows": [ {13 biến, fullName?}, ... ] }
    Trả về kết quả từng dòng; dòng lỗi không làm hỏng các dòng khác.
    """
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not isinstance(data.get('rows'), list):
        return jsonify({'error': "Body phải có dạng { region, model_type, rows: [...] }."}), 400
    rows = data['rows']
    if not rows:
        return jsonify({'error': 'Danh sách rows đang trống.'}), 400
    if len(rows) > MAX_BATCH_ROWS:
        return jsonify({'error': f'Tối đa {MAX_BATCH_ROWS} dòng mỗi lần.'}), 413

    try:
        region, _ = get_bundle(data.get('region'))
        lang = get_lang(data.get('lang'), region)
        results, summary = [], {'total': len(rows), 'ok': 0, 'failed': 0, 'Cao': 0, 'Trung bình': 0, 'Thấp': 0}
        for i, row in enumerate(rows):
            if not isinstance(row, dict):
                results.append({'row': i + 1, 'ok': False, 'errors': [{'field': None, 'message': tr('bad_row', lang)}]})
                summary['failed'] += 1
                continue
            r = predict_one(row, region, data.get('model_type'), lang)
            r['row'] = i + 1
            if row.get('fullName'):
                r['fullName'] = row['fullName']
            if r['ok']:
                summary['ok'] += 1
                summary[r['risk_level']] += 1
            else:
                summary['failed'] += 1
            results.append(r)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except LookupError as e:
        return jsonify({'error': str(e)}), 503

    return jsonify({'region': region, 'lang': lang, 'summary': summary, 'results': results})


if __name__ == '__main__':
    app.run(port=5000)