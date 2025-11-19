from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import logging
from dotenv import load_dotenv
from supabase import create_client, Client
from openai import OpenAI

# Load environment
load_dotenv()
app = Flask(__name__)

# --- CORS Configuration ---
# Cho phép cả Vercel và localhost:3001 gọi API
frontend_url = "https://sopie-search-tool.vercel.app"
CORS(app, resources={
    # Chỉ giữ lại cổng 3001 cho Localhost
    r"/api/*": {"origins": [frontend_url, "http://localhost:3001"]},
    r"/health": {"origins": "*"}
})

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
    try:
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
    # Kết hợp các trường quan trọng để AI hiểu
    parts = [
        str(sop.get('title', '')),
        str(sop.get('cause', '')),
        str(sop.get('solution_l1', '')),
        str(sop.get('keywords_primary', '')), # Nếu có
        str(sop.get('keywords_secondary', '')) # Nếu có
    ]
    return " ".join(parts)

# ============= API: SYNC (Nhận từ GG Sheet) =============
@app.route('/api/sync-sops', methods=['POST'])
def sync_sops():
    """
    Endpoint nhận data từ Google Sheet và update vào Supabase
    """
    try:
        data = request.json
        sops_list = data.get('sops', [])
        
        if not sops_list:
            return jsonify({'error': 'No data provided'}), 400
            
        logger.info(f"Received {len(sops_list)} SOPs to sync...")
        
        count = 0
        for item in sops_list:
            # 1. Upsert SOP vào bảng 'sops'
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
                'keywords_secondary': item.get('keywords_secondary', '')
            }
            
            # Upsert vào database
            supabase.table('sops').upsert(sop_record).execute()
            
            # 2. Tạo và Upsert Embedding (Tự động tạo AI Vector)
            search_text = create_searchable_text(item)
            embedding = generate_embedding(search_text)
            
            if embedding:
                existing = supabase.table('sop_embeddings').select('id').eq('sop_id', sop_record['id']).execute()
                embedding_record = {
                    'sop_id': sop_record['id'],
                    'content': search_text,
                    'embedding': embedding
                }
                if existing.data:
                    supabase.table('sop_embeddings').update(embedding_record).eq('sop_id', sop_record['id']).execute()
                else:
                    supabase.table('sop_embeddings').insert(embedding_record).execute()
            
            count += 1
            
        return jsonify({'success': True, 'count': count})
        
    except Exception as e:
        logger.error(f"Sync error: {e}")
        return jsonify({'error': str(e)}), 500

# ============= API: SEARCH =============
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
        'last_updated': sop.get('last_updated'), 
        # Đã điều chỉnh: Dùng giá trị mặc định 0.5 cho Key Search (nếu similarity không tồn tại)
        'relevance_score': sop.get('similarity', 0.5) 
    }

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
        if search_type == 'semantic':
            embedding = generate_embedding(query)
            if embedding:
                rpc_params = {
                    'query_embedding': embedding,
                    'match_threshold': 0.3,
                    'match_count': limit
                }
                if domain: rpc_params['domain_filter'] = domain
                rpc_res = supabase.rpc('match_sops', rpc_params).execute()
                results = rpc_res.data
        else: 
            builder = supabase.table('sops').select('*')
            if domain: builder = builder.eq('domain', domain)
            search_str = f"%{query}%"
            builder = builder.or_(f"title.ilike.{search_str},cause.ilike.{search_str}")
            builder = builder.limit(limit)
            res = builder.execute()
            results = res.data

        return jsonify({
            'success': True,
            'results': [format_response(r) for r in results]
        })

    except Exception as e:
        logger.error(f"Search error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)