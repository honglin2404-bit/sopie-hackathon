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
# Cấu hình cho phép Frontend gọi API
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

# Kiểm tra biến môi trường quan trọng
if not all([SUPABASE_URL, SUPABASE_KEY, OPENAI_KEY]):
    logger.critical("Missing environment variables! Check .env or Render configs.")

# Khởi tạo Supabase và OpenAI Client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
openai_client = OpenAI(api_key=OPENAI_KEY)

# ============= HELPER: Embedding =============
def generate_embedding(text):
    """
    Tạo vector embedding từ text sử dụng OpenAI
    """
    try:
        if not text or not text.strip():
            return None
            
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
    """
    Gộp các trường thông tin quan trọng thành 1 chuỗi để AI đọc
    """
    parts = [
        str(sop.get('title', '')),
        str(sop.get('cause', '')),
        str(sop.get('solution_l1', '')),
        str(sop.get('keywords_primary', '')),
        str(sop.get('keywords_secondary', ''))
    ]
    return " ".join(parts)

# ============= HELPER: Calculate Final Score =============
def calculate_final_score(similarity, sop, query_text=None, domain_filter=None):
    """
    Tính điểm Relevance Score (Semantic Score + Keyword Bonus + Domain Bonus)
    """
    # 1. Rescale similarity từ [0.3, 1.0] -> [0.60, 1.0]
    min_threshold = 0.3
    max_similarity = 1.0
    
    rescaled = ((similarity - min_threshold) / (max_similarity - min_threshold)) * 0.40 + 0.60
    rescaled = max(0.60, min(1.0, rescaled))
    
    # 2. Keyword Bonus
    keyword_bonus = 0.0
    if query_text:
        query_lower = query_text.lower().strip()
        title_lower = str(sop.get('title', '')).lower()
        cause_lower = str(sop.get('cause', '')).lower()
        
        primary_kw = str(sop.get('keywords_primary', '')).lower()
        secondary_kw = str(sop.get('keywords_secondary', '')).lower()
        
        # Check primary keywords
        if primary_kw and len(primary_kw) > 2:
            primary_list = [k.strip() for k in primary_kw.split(',') if k.strip()]
            for kw in primary_list:
                if kw in query_lower:
                    keyword_bonus += 0.05
        
        # Check secondary keywords
        if secondary_kw and len(secondary_kw) > 2:
            secondary_list = [k.strip() for k in secondary_kw.split(',') if k.strip()]
            for kw in secondary_list:
                if kw in query_lower:
                    keyword_bonus += 0.03
        
        # Check important terms hardcoded
        important_terms = [
            'xuất hóa đơn', 'vat', 'telco', 'zion', 'thanh sơn',
            'appid', 'nạp điện thoại', 'chuyển khoản', 'hoàn tiền',
            'liên kết', 'ngân hàng', 'thẻ', 'ví'
        ]
        
        for term in important_terms:
            if term in query_lower and (term in title_lower or term in cause_lower):
                keyword_bonus += 0.02
    
    keyword_bonus = min(0.15, keyword_bonus)
    
    # 3. Domain Bonus
    domain_bonus = 0.0
    if domain_filter and sop.get('domain') == domain_filter:
        domain_bonus = 0.05
    
    final_score = rescaled + keyword_bonus + domain_bonus
    return round(max(0.60, min(1.0, final_score)), 2)

def format_response(sop):
    return {
        'id': sop.get('id'),
        'title': sop.get('title'),
        'domain': sop.get('domain'),
        'cause': sop.get('cause'),
        'solution': {
            'level1': sop.get('solution_l1'),
            'level2': sop.get('solution_l2')
        },
        'check_tools': {
            'guideline': sop.get('check_tool_guideline'),
            'name': sop.get('check_tools_name'),
            'url': sop.get('check_tools_url')
        },
        'templates': {
            'email': sop.get('template_app_mail'),
            'chat': sop.get('template_call_chat')
        },
        'link': sop.get('link_sop'),
        'notes': sop.get('notes'),
        'last_updated': sop.get('last_updated')
    }

# ============= API: SYNC =============
@app.route('/api/sync-sops', methods=['POST'])
def sync_sops():
    """
    Nhận data từ Google Sheet -> Tạo Embedding -> Lưu tất cả vào bảng 'sops'
    """
    try:
        data = request.json
        sops_list = data.get('sops', [])
        
        if not sops_list:
            return jsonify({'error': 'No data provided'}), 400
            
        logger.info(f"Received {len(sops_list)} SOPs to sync...")
        
        count = 0
        for item in sops_list:
            # 1. Tạo searchable text và embedding ngay lập tức
            search_text = create_searchable_text(item)
            embedding = generate_embedding(search_text)
            
            if not embedding:
                logger.warning(f"Warning: Could not generate embedding for ID {item.get('id')}")
            
            # 2. Tạo record đầy đủ (bao gồm cả embedding)
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
                # QUAN TRỌNG: Lưu embedding trực tiếp vào bảng sops
                'embedding': embedding 
            }
            
            # 3. Upsert vào bảng 'sops'
            supabase.table('sops').upsert(sop_record).execute()
            count += 1
            
        logger.info(f"Successfully synced {count} SOPs.")
        return jsonify({'success': True, 'count': count})
        
    except Exception as e:
        logger.error(f"Sync error: {e}")
        return jsonify({'error': str(e)}), 500

# ============= API: SEARCH (ĐÃ CẬP NHẬT KEY SEARCH) =============
@app.route('/api/search', methods=['POST'])
def search():
    try:
        data = request.json
        query = data.get('query', '')
        domain = data.get('domain', None)
        search_type = data.get('type', 'keyword')
        limit = data.get('limit', 25)
        
        if not query: 
            return jsonify({'error': 'Query required'}), 400
        
        results = []
        similarity_default = 0.5
        
        # 1. SEMANTIC SEARCH (AI)
        if search_type == 'semantic':
            embedding = generate_embedding(query)
            if embedding:
                rpc_params = {
                    'query_embedding': embedding,
                    'match_threshold': 0.3,
                    'match_count': limit
                }
                if domain: 
                    rpc_params['domain_filter'] = domain
                
                # Gọi hàm RPC 'match_sops' trong Supabase
                rpc_res = supabase.rpc('match_sops', rpc_params).execute()
                results = rpc_res.data
                
        # 2. KEYWORD SEARCH (Đã nâng cấp dùng SQL Function)
        else: 
            # Gọi hàm RPC 'kw_sops' (SQL) thay vì query bằng Python
            rpc_params = {
                'query_text': query,
                'match_count': limit
            }
            if domain: 
                rpc_params['domain_filter'] = domain
            
            # Thực thi hàm tìm kiếm từ khóa dưới database
            res = supabase.rpc('kw_sops', rpc_params).execute()
            results = res.data

        # 3. Tính toán điểm số cuối cùng (Re-ranking)
        formatted_results = []
        for r in results:
            similarity = r.get('similarity', similarity_default)
            final_score = calculate_final_score(similarity, r, query, domain)
            
            formatted = format_response(r)
            formatted['relevance_score'] = final_score
            formatted_results.append(formatted)

        # Trả về kết quả đã sort theo điểm số giảm dần
        return jsonify({
            'success': True,
            'results': sorted(formatted_results, key=lambda x: x['relevance_score'], reverse=True)
        })

    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy', 'message': 'SOPie Backend V2 is running'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)