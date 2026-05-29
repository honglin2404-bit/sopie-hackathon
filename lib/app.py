from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys # <--- [MỚI] Thêm thư viện này
import json
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI

# ==============================================================================
# [FIX QUAN TRỌNG] CẤU HÌNH ĐƯỜNG DẪN IMPORT (SỬA LỖI RENDER)
# ==============================================================================
# Đoạn code này ép Python phải nhìn thấy các file trong cùng thư mục 'lib'
# Bất chấp Render chạy từ thư mục gốc hay thư mục con.
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Import Blueprint từ file sync (Bây giờ nó sẽ luôn tìm thấy)
from sync_google_sheets import sync_bp

# ==============================================================================
# CẤU HÌNH FLASK & CLIENTS
# ==============================================================================

# Load environment variables
load_dotenv()
app = Flask(__name__)

# [QUAN TRỌNG] Đăng ký Blueprint để kích hoạt API Sync
app.register_blueprint(sync_bp)

# --- CORS Configuration ---
frontend_url = "https://sopie-search-tool.vercel.app"
CORS(app, resources={
    r"/api/*": {"origins": [frontend_url, "http://localhost:3000", "http://localhost:3001"]},
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

# ============= 🧠 CẤU HÌNH FALLBACK RULES (GIỮ NGUYÊN) =============
FALLBACK_RULES = [
    # --- NHÓM ỨNG DỤNG & TÍNH NĂNG CHUNG ---
    {"keywords": ["lỗi ứng dụng", "văng app", "không vào được", "không mở được", "app lỗi", "treo app", "chậm", "lag"], "context_name": "lỗi ứng dụng Zalopay", "link": "https://sites.google.com/view/cs-faq-chung/%E1%BB%A9ng-d%E1%BB%A5ng/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-ticket-l%E1%BB%97i-%E1%BB%A9ng-d%E1%BB%A5ng", "link_label": "Quy trình Lỗi ứng dụng"},
    {"keywords": ["điểm tin cậy", "nâng điểm", "hạng tài khoản", "tin cậy thấp", "điểm thấp"], "context_name": "tính năng Điểm tin cậy", "link": "https://sites.google.com/view/cs-faq-chung/%E1%BB%A9ng-d%E1%BB%A5ng/%C4%91i%E1%BB%83m-tin-c%E1%BA%ADy", "link_label": "FAQ Điểm tin cậy"},
    {"keywords": ["autodebit", "thanh toán tự động", "gia hạn tự động", "hủy tự động", "trừ tiền tự động"], "context_name": "dịch vụ Autodebit", "link": "https://sites.google.com/view/cs-faq-chung/%E1%BB%A9ng-d%E1%BB%A5ng/t%C3%ADnh-n%C4%83ng-autodebit", "link_label": "Tính năng Autodebit"},
    # --- NHÓM NGÂN HÀNG & TÀI KHOẢN ---
    {"keywords": ["liên kết ngân hàng", "thêm thẻ", "lỗi liên kết", "không liên kết được", "liên kết bank"], "context_name": "lỗi liên kết ngân hàng", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/li%C3%AAn-k%E1%BA%BFt-ng%C3%A2n-h%C3%A0ng/li%C3%AAn-k%E1%BA%BFtl%E1%BB%97i-li%C3%AAn-k%E1%BA%BFt", "link_label": "Xử lý Lỗi liên kết"},
    {"keywords": ["hủy liên kết", "gỡ thẻ", "xóa ngân hàng", "không gỡ được thẻ", "unbound"], "context_name": "hủy liên kết ngân hàng", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/li%C3%AAn-k%E1%BA%BFt-ng%C3%A2n-h%C3%A0ng/quy-tr%C3%ACnh-h%E1%BB%97-tr%E1%BB%A3-h%E1%BB%A7y-li%C3%AAn-k%E1%BA%BFt", "link_label": "Quy trình Hủy liên kết"},
    {"keywords": ["đăng ký", "đăng nhập", "tạo tài khoản", "không nhận otp", "quên tài khoản"], "context_name": "tài khoản Zalopay", "link": "https://sites.google.com/view/cs-faq-chung/t%C3%A0i-kho%E1%BA%A3n-chung/%C4%91%C4%83ng-nh%E1%BA%ADpt%E1%BA%A1o-t%C3%A0i-kho%E1%BA%A3n-zalopay", "link_label": "FAQ Đăng ký/Đăng nhập"},
    {"keywords": ["mật khẩu", "đổi mật khẩu", "quên mật khẩu", "pin", "thiết lập mật khẩu"], "context_name": "mật khẩu thanh toán", "link": "https://sites.google.com/view/cs-faq-chung/t%C3%A0i-kho%E1%BA%A3n-chung/m%E1%BA%ADt-kh%E1%BA%A9u-thanh-to%C3%A1n", "link_label": "FAQ Mật khẩu"},
    # --- NHÓM GIAO DỊCH VÀ ĐỐI TÁC ---
    {"keywords": ["rút tiền", "chuyển tiền", "ibft", "trả nợ thẻ", "rút về bank"], "context_name": "Rút tiền/Chuyển tiền/Trả nợ thẻ", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/ibft-r%C3%BAt-ti%E1%BB%81n-tr%E1%BA%A3-n%E1%BB%A3-th%E1%BA%BB", "link_label": "Quy trình Rút/Chuyển tiền/Trả nợ thẻ"},
    {"keywords": ["nạp tiền", "topup vào ví", "nạp ví", "nạp tiền lỗi"], "context_name": "xử lý giao dịch Nạp tiền", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/n%E1%BA%A1p-ti%E1%BB%81n", "link_label": "Quy trình Nạp tiền"},
    {"keywords": ["telco", "nạp điện thoại", "thẻ đt", "trả sau", "esim", "gohub", "apple gift card", "google gift card"], "context_name": "dịch vụ Telco/Thẻ ĐT/Hóa đơn trả sau", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/telco", "link_label": "Quy trình Telco"},
    {"keywords": ["billing", "hóa đơn", "điện", "nước", "vay", "học phí", "chung cư", "internet", "truyền hình"], "context_name": "thanh toán Hóa đơn (Billing)", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-chung/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/billing", "link_label": "Quy trình Billing"},
    {"keywords": ["google", "ch play", "youtube premium", "drive", "google cloud"], "context_name": "đối tác Google", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/%C4%91%E1%BB%91i-t%C3%A1c-kh%C3%A1c/579-google", "link_label": "Đối tác Google"},
    {"keywords": ["apple", "itunes", "icloud", "appstore", "apple music"], "context_name": "đối tác Apple", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/%C4%91%E1%BB%91i-t%C3%A1c-kh%C3%A1c/9999-apple-service", "link_label": "Đối tác Apple"},
    {"keywords": ["tiktok", "nạp xu", "livestream", "tiktok ads"], "context_name": "đối tác Tiktok", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/%C4%91%E1%BB%91i-t%C3%A1c-kh%C3%A1c/tiktok", "link_label": "Đối tác Tiktok"},
    {"keywords": ["vng", "game", "nạp card", "zing", "pubg", "vltk", "valorant"], "context_name": "đối tác Game VNG", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/%C4%91%E1%BB%91i-t%C3%A1c-kh%C3%A1c/game-vng", "link_label": "Dịch vụ Game VNG"},
    # --- NHÓM TÀI CHÍNH & KHUYẾN MÃI ---
    {"keywords": ["số dư sinh lời", "sdsl", "mmf", "lợi nhuận", "túi thần tài"], "context_name": "Số dư sinh lời (SDSL)", "link": "https://sites.google.com/view/cs-faq-chung/khuy%E1%BA%BFn-m%C3%A3ilending-chung/lending/s%E1%BB%91-d%C6%B0-sinh-l%E1%BB%9Di-mmf", "link_label": "FAQ Số dư sinh lời"},
    {"keywords": ["vay tiền", "cashloan", "vay nhanh", "trả nợ vay"], "context_name": "Vay tiền nhanh (Cashloan)", "link": "https://sites.google.com/view/cs-faq-chung/khuy%E1%BA%BFn-m%C3%A3ilending-chung/lending/vay-ti%E1%BB%81n-nhanh-cashloan", "link_label": "FAQ Cashloan"},
    {"keywords": ["chứng khoán", "stock", "dnse", "mua cổ phiếu"], "context_name": "Chứng khoán (Stock Trading)", "link": "https://sites.google.com/view/cs-faq-chung/khuy%E1%BA%BFn-m%C3%A3ilending-chung/lending/ch%E1%BB%A9ng-kho%C3%A1n-stocktrading", "link_label": "FAQ Chứng khoán"},
    {"keywords": ["khuyến mãi", "voucher", "ưu đãi", "giảm giá", "mã code", "hoàn tiền", "cashback", "referrals"], "context_name": "Khuyến mãi & Ưu đãi", "link": "https://sites.google.com/view/cs-faq-chung/khuy%E1%BA%BFn-m%C3%A3ilending-chung/khuy%E1%BA%BFn-m%C3%A3i", "link_label": "Quy trình Khuyến mãi"},
    # --- NHÓM KHÁC ---
    {"keywords": ["sao kê", "lịch sử giao dịch", "lsgd", "xác nhận giao dịch"], "context_name": "Sao kê/Lịch sử giao dịch", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/g%E1%BB%ADi-sao-k%C3%AAlsgd", "link_label": "HD Gửi sao kê"},
    {"keywords": ["hạn mức", "phí dịch vụ", "biểu phí", "tối đa", "tối thiểu"], "context_name": "Hạn mức & Phí dịch vụ", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/h%E1%BA%A1n-m%E1%BB%A9c-thanh-to%C3%A1n-v%C3%A0-ph%C3%AD-d%E1%BB%8Bch-v%E1%BB%A5", "link_label": "Biểu phí & Hạn mức"},
    # --- NHÓM DỊCH VỤ ĐỐI TÁC & MUA SẮM ---
    {"keywords": ["mua vé", "đặt vé", "vé xem phim", "vé máy bay", "vé sự kiện", "cgv", "galaxy cinema", "booking", "thao tác mua vé"], "context_name": "dịch vụ Mua vé & Giải trí", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/%C4%91%E1%BB%91i-t%C3%A1c-kh%C3%A1c", "link_label": "Quy trình Đối tác Mua vé"},
    {"keywords": ["grab", "shopee", "lazada", "tiki", "sendo", "mua sắm", "đặt hàng", "thanh toán đơn hàng"], "context_name": "thanh toán Sàn TMĐT & Đối tác", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all/%C4%91%E1%BB%91i-t%C3%A1c-kh%C3%A1c", "link_label": "Quy trình Đối tác TMĐT"},
    {"keywords": ["hoàn tiền giao dịch", "refund", "lỗi thanh toán", "giao dịch thất bại", "không nhận được tiền"], "context_name": "xử lý Hoàn tiền & Giao dịch lỗi", "link": "https://sites.google.com/view/cs-faq-chung/thanh-to%C3%A1n-payment/quy-tr%C3%ACnh-x%E1%BB%AD-l%C3%BD-gd-all", "link_label": "Quy trình Xử lý Giao dịch lỗi"}
]

DEFAULT_FALLBACK = {
    "context_name": "vấn đề tra cứu tổng quát",
    "link": "https://sites.google.com/view/cs-faq-chung/quy-%C4%91%E1%BB%8Bnh-chung",
    "link_label": "Trang chủ FAQ Tổng hợp"
}

# ============= HELPER FUNCTIONS =============

def get_fallback_suggestion(query_text):
    query_lower = query_text.lower()
    for rule in FALLBACK_RULES:
        for keyword in rule["keywords"]:
            if keyword in query_lower:
                return {"found": True, "context_name": rule["context_name"], "link": rule["link"], "link_label": rule["link_label"]}
    return {"found": False, "context_name": DEFAULT_FALLBACK["context_name"], "link": DEFAULT_FALLBACK["link"], "link_label": DEFAULT_FALLBACK["link_label"]}

# [QUAN TRỌNG] Hàm này VẪN GIỮ để phục vụ chức năng SEARCH
def generate_embedding(text):
    try:
        if not text or not text.strip(): return None
        response = openai_client.embeddings.create(model="text-embedding-3-small", input=text, encoding_format="float")
        return response.data[0].embedding
    except Exception as e:
        logger.error(f"Embedding error: {e}")
        return None

# ============= SCORE CALCULATION =============
def calculate_final_score(similarity, sop, query_text=None, domain_filter=None, search_type='semantic'):
    final_score = 0.0
    query_lower = query_text.lower().strip() if query_text else ""
    query_tokens = [w for w in query_lower.split() if len(w) > 1]
    
    title_lower = str(sop.get('title', '')).lower()
    feature_lower = str(sop.get('feature', '')).lower()
    keywords = (str(sop.get('keywords_primary', '')) + " " + str(sop.get('keywords_secondary', ''))).lower()
    cause_lower = str(sop.get('cause', '')).lower()
    full_context = f"{title_lower} {feature_lower} {keywords} {cause_lower}"

    kw_primary_lower = str(sop.get('keywords_primary', '')).lower()

    if search_type == 'keyword':
        base_score = 0.85
        if query_lower in full_context: final_score = 1.0
        else:
            match_bonus = 0.0
            if query_tokens:
                matched_count = sum(1 for token in query_tokens if token in full_context)
                match_ratio = matched_count / len(query_tokens)
                if match_ratio == 1.0: match_bonus = 0.10
                elif match_ratio >= 0.75: match_bonus = 0.05
            final_score = base_score + match_bonus
    else:
        if similarity is None: similarity = 0.5
        min_threshold = 0.20
        if similarity < min_threshold: rescaled = 0.0
        else: rescaled = ((similarity - min_threshold) / (1.0 - min_threshold)) * 0.40 + 0.60
        final_score = max(0.0, min(1.0, rescaled))
        if final_score > 0 and query_tokens:
            # Bonus từ keywords_primary (weight cao — đây là signal chính xác nhất)
            primary_matched = sum(1 for token in query_tokens if token in kw_primary_lower)
            primary_ratio = primary_matched / len(query_tokens)

            # Bonus từ full_context (weight thấp hơn)
            full_matched = sum(1 for token in query_tokens if token in full_context)
            full_ratio = full_matched / len(query_tokens)

            if primary_ratio >= 0.30:   final_score += 0.25   # nhiều keyword_primary khớp → boost mạnh
            elif full_ratio >= 0.70:    final_score += 0.12   # khớp nhiều trong context chung
            elif full_ratio >= 0.50:    final_score += 0.06

    if final_score > 0 and domain_filter and sop.get('domain') == domain_filter: final_score += 0.05
    return round(max(0.0, min(1.0, final_score)), 2)

def format_response(sop):
    return {
        'id': sop.get('id'), 'title': sop.get('title'), 'domain': sop.get('domain'), 'cause': sop.get('cause'),
        'solution': {'level1': sop.get('solution_l1'), 'level2': sop.get('solution_l2')},
        'check_tools': {'guideline': sop.get('check_tool_guideline'), 'name': sop.get('check_tools_name'), 'url': sop.get('check_tools_url')},
        'templates': {'email': sop.get('template_app_mail'), 'chat': sop.get('template_call_chat')},
        'link': sop.get('link_sop'), 'notes': sop.get('notes'), 'last_updated': sop.get('last_updated')
    }

# ============= API: NOTIFICATION =============

@app.route('/api/trigger-noti', methods=['POST'])
def trigger_noti():
    try:
        data = request.json
        msg = data.get('message')
        noti_type = data.get('type', 'realtime') 
        
        if not msg: return jsonify({"error": "No message"}), 400
        
        supabase.table('notifications').insert({
            "message": msg,
            "type": noti_type
        }).execute()
        
        return jsonify({"success": True})
    except Exception as e:
        logger.error(f"Trigger Noti Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-latest-noti', methods=['GET'])
def get_latest_noti():
    try:
        response = supabase.table('notifications').select("*").order('id', desc=True).limit(20).execute()
        if response.data: 
            return jsonify({"success": True, "notis": response.data})
        return jsonify({"success": False, "notis": []})
    except Exception as e:
        logger.error(f"Get Latest Noti Error: {e}")
        return jsonify({"error": str(e)}), 500

# ============= API: SEARCH =============
@app.route('/api/search', methods=['POST'])
def search():
    try:
        data = request.json
        query = data.get('query', '')
        # [BUG FIX] raw_query: query gốc của user trước khi frontend enrich.
        # Dùng cho token-matching bonus trong calculate_final_score.
        # Nếu không có (gọi trực tiếp hoặc query ngắn không enrich), fallback về query.
        raw_query = data.get('raw_query') or query
        domain = data.get('domain', None)
        search_type = data.get('type', 'keyword')
        limit = data.get('limit', 25)
        if not query: return jsonify({'error': 'Query required'}), 400

        results = []
        if search_type == 'semantic':
            # Dùng query (enriched) để tạo embedding — vector phong phú hơn
            embedding = generate_embedding(query)
            if embedding:
                rpc_params = {'query_embedding': embedding, 'match_threshold': 0.20, 'match_count': limit}
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
            similarity = r.get('similarity', 0.5)
            # [BUG FIX] Dùng raw_query cho token-matching, không dùng enriched query.
            # Trước đây: query enriched có 20+ token → match_ratio thấp → mất bonus.
            # Sau fix: raw_query "thao tác mua vé" có 4 token → match_ratio cao → bonus OK.
            scoring_query = raw_query if search_type == 'semantic' else query
            final_score = calculate_final_score(similarity, r, scoring_query, domain, search_type)
            if final_score > 0:
                formatted = format_response(r)
                formatted['relevance_score'] = final_score
                formatted_results.append(formatted)

        sorted_results = sorted(formatted_results, key=lambda x: x['relevance_score'], reverse=True)
        response_data = {'success': True, 'results': sorted_results}

        # Fallback suggestion dùng raw_query để match đúng rule (ví dụ: "mua vé")
        top_score = sorted_results[0]['relevance_score'] if sorted_results else 0
        if not sorted_results or top_score < 0.8:
            response_data['suggestion'] = get_fallback_suggestion(raw_query)
        return jsonify(response_data)
    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'SOPie Backend FULLY OPERATIONAL'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)