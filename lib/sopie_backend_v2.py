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
    logger.critical("Missing environment variables!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_KEY)

# ============= HELPER: Embedding =============
def generate_embedding(text):
    """Tạo vector embedding từ text"""
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
    """Gộp thông tin để tạo embedding"""
    parts = [
        str(sop.get('title', '')),
        str(sop.get('cause', '')),
        str(sop.get('solution_l1', '')),
        str(sop.get('keywords_primary', '')),
        str(sop.get('keywords_secondary', ''))
    ]
    return " ".join(parts)

# ============= HELPER: Calculate Final Score (NÂNG CẤP) =============
def calculate_final_score(similarity, sop, query_text=None, domain_filter=None, search_type='semantic'):
    """
    Tính điểm Relevance Score.
    CẬP NHẬT: Nếu là Keyword Search -> Điểm nền là 90% (0.90)
    """
    final_score = 0.0

    # --- TRƯỜNG HỢP 1: KEYWORD SEARCH (Logic mới hiển thị 90-100%) ---
    if search_type == 'keyword':
        # Mặc định tìm ra bằng keyword là đã chính xác -> Base = 90%
        base_score = 0.90 
        
        # Cộng thêm bonus nếu khớp hoàn toàn keyword trong data
        if query_text:
            query_lower = query_text.lower().strip()
            primary_kw = str(sop.get('keywords_primary', '')).lower()
            title_lower = str(sop.get('title', '')).lower()
            
            # Nếu query xuất hiện trong primary keyword -> Lên 100%
            if primary_kw and query_lower in primary_kw:
                base_score += 0.10
            # Nếu xuất hiện trong Title -> Lên 95%
            elif query_lower in title_lower:
                base_score += 0.05
        
        final_score = base_score

    # --- TRƯỜNG HỢP 2: AI SEMANTIC SEARCH (Logic cũ giữ nguyên) ---
    else:
        # Rescale similarity [0.3 -> 1.0] thành [0.60 -> 1.0]
        min_threshold = 0.3
        # Công thức chuẩn hóa tuyến tính
        if similarity is None: similarity = 0.5
        rescaled = ((similarity - min_threshold) / (1.0 - min_threshold)) * 0.40 + 0.60
        final_score = max(0.60, min(1.0, rescaled))
        
        # Keyword Bonus nhẹ cho AI
        if query_text:
            query_lower = query_text.lower().strip()
            title_lower = str(sop.get('title', '')).lower()
            cause_lower = str(sop.get('cause', '')).lower()
            
            primary_kw = str(sop.get('keywords_primary', '')).lower()
            secondary_kw = str(sop.get('keywords_secondary', '')).lower()
            
            if primary_kw and len(primary_kw) > 2:
                primary_list = [k.strip() for k in primary_kw.split(',') if k.strip()]
                for kw in primary_list:
                    if kw in query_lower: final_score += 0.05
            
            if secondary_kw and len(secondary_kw) > 2:
                secondary_list = [k.strip() for k in secondary_kw.split(',') if k.strip()]
                for kw in secondary_list:
                    if kw in query_lower: final_score += 0.03

            important_terms = ['xuất hóa đơn', 'vat', 'telco', 'zion', 'thanh sơn', 'appid', 'nạp điện thoại', 'chuyển khoản', 'hoàn tiền', 'liên kết', 'ngân hàng', 'thẻ', 'ví']
            for term in important_terms:
                if term in query_lower and (term in title_lower or term in cause_lower):
                    final_score += 0.02

    # --- Domain Bonus Chung ---
    if domain_filter and sop.get('domain') == domain_filter:
        final_score += 0.05

    # Đảm bảo điểm không vượt quá 1.0 (100%)
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
            # Tạo embedding
            search_text = create_searchable_text(item)
            embedding = generate_embedding(search_text)
            
            # Upsert vào bảng sops
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

# ============= API: SEARCH (ĐÃ SỬA LOGIC KEY SEARCH) =============
@app.route('/api/search', methods=['POST'])
def search():
    # Log để debug trên Render
    print("========== DEBUG: BACKEND FINAL RUNNING ==========", flush=True)
    
    try:
        data = request.json
        query = data.get('query', '')
        domain = data.get('domain', None)
        search_type = data.get('type', 'keyword')
        limit = data.get('limit', 25)
        
        if not query: return jsonify({'error': 'Query required'}), 400
        
        results = []
        similarity_default = 0.5
        
        # 1. AI SEMANTIC SEARCH
        if search_type == 'semantic':
            embedding = generate_embedding(query)
            if embedding:
                rpc_params = {'query_embedding': embedding, 'match_threshold': 0.3, 'match_count': limit}
                if domain: rpc_params['domain_filter'] = domain
                rpc_res = supabase.rpc('match_sops', rpc_params).execute()
                results = rpc_res.data
                
        # 2. KEYWORD SEARCH (Sử dụng SQL Function kw_sops)
        else: 
            # Gọi hàm SQL mới (tìm cả trong Feature, Keywords...)
            rpc_params = {'query_text': query, 'match_count': limit}
            if domain: rpc_params['domain_filter'] = domain
            
            res = supabase.rpc('kw_sops', rpc_params).execute()
            results = res.data

        # 3. Tính điểm (Re-ranking)
        formatted_results = []
        for r in results:
            similarity = r.get('similarity', similarity_default)
            # Truyền search_type vào để logic mới biết đường tính điểm cao
            final_score = calculate_final_score(similarity, r, query, domain, search_type)
            
            formatted = format_response(r)
            formatted['relevance_score'] = final_score
            formatted_results.append(formatted)

        return jsonify({
            'success': True,
            'results': sorted(formatted_results, key=lambda x: x['relevance_score'], reverse=True)
        })

    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'SOPie Backend FINAL is running'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)