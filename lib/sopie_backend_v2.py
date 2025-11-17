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

# Supabase configuration
SUPABASE_URL = "https://xmoamdwyklvoffzfaoym.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtb2FtZHd5a2x2b2ZmemZhb3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzQ2NjgsImV4cCI6MjA3ODc1MDY2OH0.RYL5Hi_34sI_51T2k-gRZ6Ipzi-JklnXx8e2m1sHWv4"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhtb2FtZHd5a2x2b2ZmemZhb3ltIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzE3NDY2OCwiZXhwIjoyMDc4NzUwNjY4fQ.plTPXQdMF_sn6o_gebV9xe9dcLvv-cqxgaR4cCY9F4w"

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import Supabase client
try:
    from supabase import create_client, Client
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
    logger.info("Supabase client initialized successfully")
except ImportError:
    logger.warning("Supabase client not available, using requests")
    supabase = None
    import requests

# ============= HELPER FUNCTIONS =============

def search_sops_by_keywords(query, domain_filter=None, limit=5):
    """
    Search SOPs using keywords and optional domain filter
    Updated for new 21-column structure
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
            # Use requests directly
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
            }
            
            # Build URL with filters
            url = f"{SUPABASE_URL}/rest/v1/sops"
            params = {
                "select": "id,title,domain,product,feature,cause,solution_l1,solution_l2,keywords_primary,keywords_secondary,check_tool_guideline,check_tools_name,check_tools_url,template_app_mail,template_call_chat,link_sop,notes",
                "limit": limit
            }
            
            # Add domain filter
            if domain_filter:
                params["domain"] = f"eq.{domain_filter}"
            
            response = requests.get(url, headers=headers, params=params)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Error fetching SOPs: {response.status_code}")
                return []
                
    except Exception as e:
        logger.error(f"Error in search_sops_by_keywords: {e}")
        return []

def search_by_embedding(query_text, domain_filter=None, limit=5):
    """
    Search using embeddings (TRUE semantic search with OpenAI)
    """
    try:
        from openai import OpenAI
        
        # Get OpenAI API key from environment
        openai_key = os.getenv('OPENAI_API_KEY')
        if not openai_key:
            logger.warning("OpenAI API key not found, falling back to keyword search")
            return search_sops_by_keywords(query_text, domain_filter, limit)
        
        # Generate embedding for query
        client = OpenAI(api_key=openai_key)
        
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
            logger.info(f"RPC response status: {response}")
            
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
    Include all relevant fields from 21-column structure
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
        'relevance_score': sop.get('similarity', 0.95)
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

@app.route('/api/sops', methods=['GET'])
def get_all_sops():
    """Get all SOPs with optional domain filter"""
    try:
        domain = request.args.get('domain', None)
        
        if supabase:
            query = supabase.table('sops').select('*')
            if domain:
                query = query.eq('domain', domain)
            response = query.execute()
            sops = response.data
        else:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
            }
            url = f"{SUPABASE_URL}/rest/v1/sops"
            params = {}
            if domain:
                params['domain'] = f"eq.{domain}"
            
            response = requests.get(url, headers=headers, params=params)
            sops = response.json() if response.status_code == 200 else []
        
        formatted_sops = [format_sop_response(sop) for sop in sops]
        
        return jsonify({
            'success': True,
            'count': len(formatted_sops),
            'sops': formatted_sops
        })
        
    except Exception as e:
        logger.error(f"Error fetching all SOPs: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/sops/<sop_id>', methods=['GET'])
def get_sop_by_id(sop_id):
    """Get specific SOP by ID"""
    try:
        if supabase:
            response = supabase.table('sops').select('*').eq('id', sop_id).execute()
            sops = response.data
        else:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
            }
            url = f"{SUPABASE_URL}/rest/v1/sops"
            params = {'id': f"eq.{sop_id}"}
            
            response = requests.get(url, headers=headers, params=params)
            sops = response.json() if response.status_code == 200 else []
        
        if not sops:
            return jsonify({'error': 'SOP not found'}), 404
        
        return jsonify({
            'success': True,
            'sop': format_sop_response(sops[0])
        })
        
    except Exception as e:
        logger.error(f"Error fetching SOP {sop_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/domains', methods=['GET'])
def get_domains():
    """Get list of all unique domains"""
    try:
        if supabase:
            response = supabase.table('sops').select('domain').execute()
            domains = list(set([s['domain'] for s in response.data if s['domain']]))
        else:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
            }
            url = f"{SUPABASE_URL}/rest/v1/sops"
            params = {'select': 'domain'}
            
            response = requests.get(url, headers=headers, params=params)
            data = response.json() if response.status_code == 200 else []
            domains = list(set([s['domain'] for s in data if s['domain']]))
        
        return jsonify({
            'success': True,
            'domains': sorted(domains)
        })
        
    except Exception as e:
        logger.error(f"Error fetching domains: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get statistics about the SOPs database"""
    try:
        if supabase:
            total_response = supabase.table('sops').select('id', count='exact').execute()
            total_count = len(total_response.data)
            
            domain_response = supabase.table('sops').select('domain').execute()
            domains = [s['domain'] for s in domain_response.data]
            
            embedding_response = supabase.table('sop_embeddings').select('id', count='exact').execute()
            embedding_count = len(embedding_response.data)
        else:
            headers = {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}"
            }
            
            sops_response = requests.get(f"{SUPABASE_URL}/rest/v1/sops", headers=headers)
            sops = sops_response.json() if sops_response.status_code == 200 else []
            total_count = len(sops)
            domains = [s['domain'] for s in sops]
            
            emb_response = requests.get(f"{SUPABASE_URL}/rest/v1/sop_embeddings", headers=headers)
            embeddings = emb_response.json() if emb_response.status_code == 200 else []
            embedding_count = len(embeddings)
        
        domain_counts = {}
        for domain in domains:
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
        
        return jsonify({
            'success': True,
            'stats': {
                'total_sops': total_count,
                'total_embeddings': embedding_count,
                'domains': domain_counts,
                'database_version': '2.0',
                'last_updated': datetime.now().isoformat()
            }
        })
        
    except Exception as e:
        logger.error(f"Error fetching stats: {e}")
        return jsonify({'error': str(e)}), 500

# ============= MAIN =============

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
    logger.info(f"SOPie Backend v2.0 running on port {port}")