# SOPie Backend v2.0 
"""
SOPie Backend API v2.0
Updated for new database structure with 21 columns + Semantic Search
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import numpy as np
from datetime import datetime
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# --- SỬA LỖI DEPLOY ---
# Lấy key từ biến môi trường, không hardcode
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') # Dùng Service Key
OPENAI_KEY = os.getenv('OPENAI_API_KEY')

if not SUPABASE_URL or not SUPABASE_KEY or not OPENAI_KEY:
    logger.critical("!!! LỖI NGHIÊM TRỌNG: Thiếu một trong các biến môi trường (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY) !!!")

# Import Supabase client
try:
    from supabase import create_client, Client
    # Khởi tạo client với Service Key
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("Supabase client initialized successfully (using Service Key)")
except ImportError:
    logger.warning("Supabase client not available, using requests")
    supabase = None
    import requests
# -------------------------

# ============= HELPER FUNCTIONS =============

def search_sops_by_keywords(query, domain_filter=None, limit=5):
    """
    Search SOPs using keywords and optional domain filter
    """
    try:
        # Build the query
        if supabase:
            # Use Supabase client
            query_builder = supabase.table('sops').select(
                'id, title, domain, product, feature, cause, '
                'solution_l1, solution_l2, keywords_primary, keywords_secondary, '
                'check_tool_guideline, check_tools_name, check_tools_url, '
                'template_app_mail, template_call_chat, link_sop, notes'
            )
            
            # Apply domain filter if specified
            if domain_filter:
                query_builder = query_builder.eq('domain', domain_filter)
            
            # Apply text search on multiple fields
            search_query = f"%{query}%"
            query_builder = query_builder.or_(
                f"title.ilike.{search_query},"
                f"keywords_primary.ilike.{search_query},"
                f"keywords_secondary.ilike.{search_query},"
                f"cause.ilike.{search_query},"
                f"solution_l1.ilike.{search_query}"
            )
            
            # Limit results
            query_builder = query_builder.limit(limit)
            
            # Execute query
            response = query_builder.execute()
            return response.data
            
        else:
            # Fallback (sẽ không chạy nếu Supabase init đúng)
            logger.warning("Supabase client not available, fallback to requests")
            headers = {
                "apikey": SUPABASE_KEY, # Dùng key đã load
                "Authorization": f"Bearer {SUPABASE_KEY}"
            }
            # ... (Phần requests giữ nguyên, nhưng sẽ ít dùng)
            
    except Exception as e:
        logger.error(f"Error in search_sops_by_keywords: {e}")
        return []

def search_by_embedding(query_text, domain_filter=None, limit=5):
    """
    Search using embeddings (TRUE semantic search with OpenAI)
    """
    try:
        from openai import OpenAI
        
        if not OPENAI_KEY:
            logger.warning("OpenAI API key not found, falling back to keyword search")
            return search_sops_by_keywords(query_text, domain_filter, limit)
        
        # Generate embedding for query
        client = OpenAI(api_key=OPENAI_KEY)
        
        response = client.embeddings.create(
            model="text-embedding-3-small",
            input=query_text,
            encoding_format="float"
        )
        query_embedding = response.data[0].embedding
        
        logger.info(f"Generated embedding for query: {query_text}")
        
        # Search using pgvector via RPC
        if supabase:
            # Build RPC params FIRST
            rpc_params = {
                'query_embedding': query_embedding,
                'match_threshold': 0.3,
                'match_count': limit
            }
            
            if domain_filter:
                rpc_params['domain_filter'] = domain_filter
            
            # THEN log
            logger.info(f"Calling match_sops RPC with domain_filter={domain_filter}")
            logger.info(f"RPC params keys: {list(rpc_params.keys())}")
            
            # Call the match_sops function
            response = supabase.rpc('match_sops', rpc_params).execute()
            
            if response.data and len(response.data) > 0:
                logger.info(f"Found {len(response.data)} semantic search results")
                
                # Format results
                results = []
                for row in response.data:
                    results.append({
                        'id': row['id'],
                        'title': row['title'],
                        'domain': row['domain'],
                        'product': row.get('product'),
                        'feature': row.get('feature'),
                        'cause': row.get('cause'),
                        'solution_l1': row.get('solution_l1'),
                        'solution_l2': row.get('solution_l2'),
                        'keywords_primary': row.get('keywords_primary'),
                        'keywords_secondary': row.get('keywords_secondary'),
                        'check_tool_guideline': row.get('check_tool_guideline'),
                        'check_tools_name': row.get('check_tools_name'),
                        'check_tools_url': row.get('check_tools_url'),
                        'template_app_mail': row.get('template_app_mail'),
                        'template_call_chat': row.get('template_call_chat'),
                        'link_sop': row.get('link_sop'),
                        'notes': row.get('notes'),
                        'similarity': row.get('similarity', 0)
                    })
                
                return results
            else:
                logger.warning("No semantic search results, falling back to keyword")
                return search_sops_by_keywords(query_text, domain_filter, limit)
        else:
            logger.warning("Supabase client not available")
            return search_sops_by_keywords(query_text, domain_filter, limit)
            
    except Exception as e:
        logger.error(f"Error in search_by_embedding: {e}", exc_info=True)
        # Fallback to keyword search
        return search_sops_by_keywords(query_text, domain_filter, limit)

def format_sop_response(sop):
    """
    Format SOP data for API response
    """
    return {
        'id': sop.get('id'),
        'title': sop.get('title'),
        'domain': sop.get('domain'),
        'product': sop.get('product'),
        'feature': sop.get('feature'),
        'cause': sop.get('cause'),
        'solution': {
            'level1': sop.get('solution_l1'),
            'level2': sop.get('solution_l2')
        },
        'keywords': {
            'primary': sop.get('keywords_primary'),
            'secondary': sop.get('keywords_secondary')
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
        'relevance_score': sop.get('similarity', 0.95) # Dùng similarity nếu là semantic search
    }

# ============= API ENDPOINTS =============

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'version': '2.0',
        'database': 'connected' if supabase else 'using requests',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/search', methods=['POST'])
def search():
    """
    Main search endpoint
    Supports both keyword and semantic search
    """
    try:
        data = request.json
        query = data.get('query', '')
        domain = data.get('domain', None)
        search_type = data.get('type', 'keyword')
        limit = data.get('limit', 5)
        
        if not query:
            return jsonify({'error': 'Query is required'}), 400
        
        logger.info(f"Search request - Query: {query}, Domain: {domain}, Type: {search_type}")
        
        # Perform search based on type
        if search_type == 'semantic':
            results = search_by_embedding(query, domain, limit)
        else:
            results = search_sops_by_keywords(query, domain, limit)
        
        # Format results
        formatted_results = [format_sop_response(sop) for sop in results]
        
        return jsonify({
            'success': True,
            'query': query,
            'domain': domain,
            'type': search_type,
            'count': len(formatted_results),
            'results': formatted_results
        })
        
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}")
        return jsonify({'error': str(e)}), 500

# Các endpoints còn lại (get_all_sops, get_sop_by_id, ...) giữ nguyên
# ... (Giữ nguyên các hàm @app.route('/api/sops'), ...)
# ... (Giữ nguyên các hàm @app.route('/api/domains'), ...)
# ... (Giữ nguyên các hàm @app.route('/api/stats'), ...)

# ============= MAIN =============

if __name__ == '__main__':
    # Railway sẽ tự động gán PORT qua biến môi trường
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False) # Tắt debug mode khi deploy
    logger.info(f"SOPie Backend v2.0 running on port {port}")