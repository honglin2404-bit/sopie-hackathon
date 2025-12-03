from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI

# Load environment variables
load_dotenv()
app = Flask(__name__)

# --- CORS Configuration ---
frontend_url = "https://sopie-search-tool.vercel.app"
CORS(app, resources={
    r"/api/*": {"origins": [frontend_url, "http://localhost:3001"]},
    r"/health": {"origins": "*"}
})

# --- Logging Config ---
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- Config Clients ---
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
OPENAI_KEY = os.getenv('OPENAI_API_KEY')

if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_KEY]):
    logger.critical("Missing environment variables! Check .env or Render configs.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_KEY)

# ============= 🧠 CẤU HÌNH FALLBACK RULES (DATA TỪ BẠN CUNG CẤP) =============
FALLBACK_RULES = [
    # 1. Cập nhật Số điện thoại
    {
        "keywords": ["đổi số điện thoại", "thay đổi sđt", "số điện thoại mới", "đổi sđt", "cập nhật sđt", "sđt cũ", "mất sim"],
        "context_name": "thay đổi số điện thoại",
        "link": "https://sites.google.com/view/faqcallcenter/trang-ch%E1%BB%A7/taikhoan/thay-doi-tttk/changephone-%C4%91%E1%BB%95i-s%E1%BB%91-%C4%91i%E1%BB%87n-tho%E1%BA%A1i-c%C3%B3kh%C3%B4ng-c%C3%B3-tkts",
        "link_label": "Quy trình Đổi SĐT"
    },
    # 2. Hỗ trợ Chủ Sim
    {
        "keywords": ["chủ sim", "chính chủ", "xác thực sim", "sim chính chủ"],
        "context_name": "hỗ trợ chủ sim",
        "link": "https://sites.google.com/view/faqcallcenter/trang-ch%E1%BB%A7/taikhoan/thay-doi-tttk/h%E1%BB%97-tr%E1%BB%A3-ch%E1%BB%A7-sim",
        "link_label": "Quy trình Hỗ trợ Chủ Sim"
    },
    # 3. Định danh / KYC
    {
        "keywords": ["định danh", "kyc", "xác thực tài khoản", "nâng cấp tài khoản", "chưa định danh"],
        "context_name": "định danh tài khoản (KYC)",
        "link": "https://sites.google.com/view/faqcallcenter/trang-ch%E1%BB%A7/taikhoan/dinh-danh-tai-khoan",
        "link_label": "Quy trình Định danh Tài khoản"
    },
    # 4. Sinh trắc học / NFC
    {
        "keywords": ["nfc", "sinh trắc học", "cccd gắn chip", "quét nfc", "xác thực khuôn mặt"],
        "context_name": "cập nhật sinh trắc học NFC",
        "link": "https://sites.google.com/view/faqcallcenter/trang-ch%E1%BB%A7/taikhoan/dinh-danh-tai-khoan/c%E1%BA%ADp-nh%E1%BA%ADt-sinh-tr%E1%BA%AFc-h%E1%BB%8Dc-nfc",
        "link_label": "Hướng dẫn Cập nhật NFC"
    },
    # 5. Thông tư 40 (Thuế)
    {
        "keywords": ["tt40", "thông tư 40", "thuế", "đóng thuế", "nghĩa vụ thuế"],
        "context_name": "thông tư 40",
        "link": "https://sites.google.com/view/faqcallcenter/trang-ch%E1%BB%A7/taikhoan/an-toan-va-bao-mat/th%C3%B4ng-t%C6%B0-40",
        "link_label": "Quy định Thông tư 40"
    },
    # 6. Cashback / Hoàn tiền
    {
        "keywords": ["cashback", "hoàn tiền", "không nhận được tiền", "tiền hoàn", "trả thưởng"],
        "context_name": "khiếu nại Cashback",
        "link": "https://sites.google.com/view/cs-faq-promotion-lending/quy-%C4%91%E1%BB%8Bnh-chung-khi-x%E1%BB%AD-l%C3%BD-ticket-khuy%E1%BA%BFn-m%C3%A3i/x%E1%BB%AD-l%C3%BD-khi%E1%BA%BFu-n%E1%BA%A1i-li%C3%AAn-quan-%C4%91%E1%BA%BFn-cashback",
        "link_label": "Quy trình Xử lý Cashback"
    },
    # 7. Voucher / Khuyến mãi
    {
        "keywords": ["voucher", "mã giảm giá", "ưu đãi", "coupon", "không dùng được voucher", "lỗi voucher"],
        "context_name": "khiếu nại Voucher",
        "link": "https://sites.google.com/view/faqcallcenter/trang-ch%E1%BB%A7/KM/ti%E1%BA%BFp-nh%E1%BA%ADn-y%C3%AAu-c%E1%BA%A7u-khi%E1%BA%BFu-n%E1%BA%A1i-v%E1%BB%81-ctkm/voucher",
        "link_label": "Quy trình Xử lý Voucher"
    },
    # 8. Blacklist / A30
    {
        "keywords": ["blacklist", "a30", "khóa tài khoản", "bị chặn", "gian lận", "vi phạm"],
        "context_name": "kiểm tra Blacklist/A30",
        "link": "https://sites.google.com/view/cs-faq-promotion-lending/quy-%C4%91%E1%BB%8Bnh-chung-khi-x%E1%BB%AD-l%C3%BD-ticket-khuy%E1%BA%BFn-m%C3%A3i/h%C6%B0%E1%BB%9Bng-d%E1%BA%ABn-ki%E1%BB%83m-tra-tr%E1%BA%A1ng-th%C3%A1i-blacklist",
        "link_label": "Hướng dẫn Kiểm tra Blacklist"
    }
]

# Rule mặc định
DEFAULT_FALLBACK = {
    "context_name": "vấn đề bạn đang gặp phải",
    "link": "https://sites.google.com/view/cs-faq-chung/quy-%C4%91%E1%BB%8Bnh-l%C3%A0m-vi%E1%BB%87c",
    "link_label": "Quy trình Tổng quan SOP"
}

# ============= HELPER FUNCTIONS =============

def get_fallback_suggestion(query_text):
    query_lower = query_text.lower()
    
    # Ưu tiên tìm rule khớp
    for rule in FALLBACK_RULES:
        for keyword in rule["keywords"]:
            if keyword in query_lower:
                return {
                    "found": True,
                    "context_name": rule["context_name"],
                    "link": rule["link"],
                    "link_label": rule["link_label"]
                }
    
    # Mặc định
    return {
        "found": False,
        "context_name": DEFAULT_FALLBACK["context_name"],
        "link": DEFAULT_FALLBACK["link"],
        "link_label": DEFAULT_FALLBACK["link_label"]
    }

def generate_embedding(text):
    try:
        if not text or not text.strip(): return None
        response = openai_client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
            encoding_format="float"
        )
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return None

def create_searchable_text(sop):
    parts = [
        str(sop.get('title', '')),
        str(sop.get('cause', '')),
        str(sop.get('solution_l1', '')),
        str(sop.get('keywords_primary', '')),
        str(sop.get('keywords_secondary', '')),
        str(sop.get('feature', ''))
    ]
    return " ".join(parts)

def calculate_final_score(similarity, sop, query_text=None, domain_filter=None, search_type='semantic'):
    final_score = 0.0
    query_lower = query_text.lower().strip() if query_text else ""
    query_tokens = [w for w in query_lower.split() if len(w) > 1]
    
    title_lower = str(sop.get('title', '')).lower()
    feature_lower = str(sop.get('feature', '')).lower()
    keywords = (str(sop.get('keywords_primary', '')) + " " + str(sop.get('keywords_secondary', ''))).lower()
    cause_lower = str(sop.get('cause', '')).lower()
    full_context = f"{title_lower} {feature_lower} {keywords} {cause_lower}"

    if search_type == 'keyword':
        base_score = 0.85 
        if query_lower in full_context:
            final_score = 1.0
        else:
            match_bonus = 0.0
            if query_tokens:
                matched_count = 0
                for token in query_tokens:
                    if token in full_context: matched_count += 1
                match_ratio = matched_count / len(query_tokens)
                if match_ratio >= 0.8: match_bonus = 0.05
                elif match_ratio == 1.0: match_bonus = 0.10
            final_score = base_score + match_bonus
    else:
        if similarity is None: similarity = 0.5
        min_threshold = 0.3
        rescaled = ((similarity - min_threshold) / (1.0 - min_threshold)) * 0.40 + 0.60
        final_score = max(0.60, min(1.0, rescaled))
        
        if query_tokens:
            matched_count = 0
            for token in query_tokens:
                if token in full_context: matched_count += 1
            match_ratio = matched_count / len(query_tokens)
            if match_ratio >= 0.7: final_score += 0.20
            elif match_ratio >= 0.5: final_score += 0.10

    if domain_filter and sop.get('domain') == domain_filter:
        final_score += 0.05

    return round(max(0.60, min(1.0, final_score)), 2)

def format_response(sop):
    return {
        'id': sop.get('id'),
        'title': sop.get('title'),
        'domain': sop.get('domain'),
        'cause': sop.get('cause'),
        'solution': {'level1': sop.get('solution_l1'), 'level2': sop.get('solution_l2')},
        'check_tools': {'guideline': sop.get('check_tool_guideline'), 'name': sop.get('check_tools_name'), 'url': sop.get('check_tools_url')},
        'templates': {'email': sop.get('template_app_mail'), 'chat': sop.get('template_call_chat')},
        'link': sop.get('link_sop'),
        'notes': sop.get('notes'),
        'last_updated': sop.get('last_updated')
    }

# ============= API: SYNC =============
@app.route('/api/sync-sops', methods=['POST'])
def sync_sops():
    try:
        data = request.json
        sops_list = data.get('sops', [])
        if not sops_list: return jsonify({'error': 'No data provided'}), 400
        logger.info(f"Received {len(sops_list)} SOPs to sync...")
        count = 0
        for item in sops_list:
            search_text = create_searchable_text(item)
            embedding = generate_embedding(search_text)
            sop_record = {
                'id': str(item.get('id')),
                'title': item.get('title'),
                'domain': item.get('domain'),
                'product': item.get('product'),
                'feature': item.get('feature'),
                'cause': item.get('cause'),
                'check_tool_guideline': item.get('check_tool_guideline'),
                'check_tools_name': item.get('check_tools_name'),
                'check_tools_url': item.get('check_tools_url'),
                'solution_l1': item.get('solution_l1'),
                'solution_l2': item.get('solution_l2'),
                'notes': item.get('notes'),
                'template_app_mail': item.get('template_app_mail'),
                'template_call_chat': item.get('template_call_chat'),
                'link_sop': item.get('link_sop'),
                'last_updated': item.get('last_updated'),
                'keywords_primary': item.get('keywords_primary', ''),
                'keywords_secondary': item.get('keywords_secondary', ''),
                'embedding': embedding 
            }
            supabase.table('sops').upsert(sop_record).execute()
            count += 1
        return jsonify({'success': True, 'count': count})
    except Exception as e:
        logger.error(f"Sync error: {e}")
        return jsonify({'error': str(e)}), 500

# ============= API: SEARCH =============
@app.route('/api/search', methods=['POST'])
def search():
    try:
        data = request.json
        query = data.get('query', '')
        domain = data.get('domain', None)
        search_type = data.get('type', 'keyword')
        limit = data.get('limit', 25)
        
        if not query: return jsonify({'error': 'Query required'}), 400
        
        results = []
        similarity_default = 0.5
        
        if search_type == 'semantic':
            embedding = generate_embedding(query)
            if embedding:
                rpc_params = {'query_embedding': embedding, 'match_threshold': 0.3, 'match_count': limit}
                if domain: rpc_params['domain_filter'] = domain
                rpc_res = supabase.rpc('match_sops', rpc_params).execute()
                results = rpc_res.data
        else: 
            rpc_params = {'query_text': query, 'match_count': limit}
            if domain: rpc_params['domain_filter'] = domain
            res = supabase.rpc('kw_sops', rpc_params).execute()
            results = res.data

        formatted_results = []
        for r in results:
            similarity = r.get('similarity', similarity_default)
            final_score = calculate_final_score(similarity, r, query, domain, search_type)
            formatted = format_response(r)
            formatted['relevance_score'] = final_score
            formatted_results.append(formatted)
        
        sorted_results = sorted(formatted_results, key=lambda x: x['relevance_score'], reverse=True)
        
        response_data = {'success': True, 'results': sorted_results}
        
        # Nếu không có kết quả -> Trả về Suggestion
        if not sorted_results:
            suggestion = get_fallback_suggestion(query)
            response_data['suggestion'] = suggestion

        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'SOPie Backend FINAL is running'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)