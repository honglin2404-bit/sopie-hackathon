from dotenv import load_dotenv
load_dotenv()
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client
import os
import json
from openai import OpenAI

app = Flask(__name__)
CORS(app)

# Khởi tạo Supabase client
supabase = create_client(
    os.environ.get('NEXT_PUBLIC_SUPABASE_URL'),
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
)

# Khởi tạo OpenAI client
openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

# ==========================================
# HEALTH CHECK ENDPOINT
# ==========================================
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'ok',
        'message': 'SOPie Backend is running'
    })

# ==========================================
# SEARCH ENDPOINT (EXISTING)
# ==========================================
@app.route('/api/search', methods=['POST'])
def search_sops():
    """
    Search SOPs using semantic or keyword search
    """
    try:
        data = request.json
        query = data.get('query', '')
        domain = data.get('domain')
        search_type = data.get('type', 'semantic')
        limit = data.get('limit', 10)
        
        if not query:
            return jsonify({'success': False, 'error': 'Query is required'}), 400
        
        results = []
        
        if search_type == 'semantic':
            # Generate embedding for query
            response = openai_client.embeddings.create(
                model="text-embedding-3-small",
                input=query
            )
            query_embedding = response.data[0].embedding
            
            # Search using vector similarity
            rpc_params = {
                'query_embedding': query_embedding,
                'match_threshold': 0.3,
                'match_count': limit
            }
            
            if domain:
                rpc_params['filter_domain'] = domain
            
            result = supabase.rpc('search_sops', rpc_params).execute()
            results = result.data if result.data else []
            
        else:  # keyword search
            # Build query
            query_builder = supabase.table('sop_items').select('*')
            
            # Search in title, cause, solution fields
            search_filter = f"title.ilike.%{query}%,cause.ilike.%{query}%"
            query_builder = query_builder.or_(search_filter)
            
            if domain:
                query_builder = query_builder.eq('domain', domain)
            
            query_builder = query_builder.limit(limit)
            
            result = query_builder.execute()
            
            # Add relevance score for keyword search
            if result.data:
                for item in result.data:
                    item['relevance_score'] = 0.8  # Default score for keyword match
                results = result.data
        
        return jsonify({
            'success': True,
            'results': results,
            'count': len(results)
        })
        
    except Exception as e:
        print(f"Error in search: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# GOOGLE SHEETS SYNC ENDPOINT (NEW)
# ==========================================
@app.route('/api/sync-sheets', methods=['POST'])
def sync_sheets():
    """
    API endpoint để nhận data từ Google Sheets và sync vào Supabase
    
    Expected JSON format:
    {
        "rows": [
            {
                "id": 1,
                "title": "...",
                "domain": "...",
                "cause": "...",
                "check_tools": "{...}",  // JSON string
                "solution": "{...}",      // JSON string
                "templates": "{...}",     // JSON string
                "notes": "...",
                "link": "..."
            },
            ...
        ]
    }
    """
    try:
        data = request.json
        rows = data.get('rows', [])
        
        if not rows:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        synced_count = 0
        errors = []
        
        for row in rows:
            try:
                # Skip empty rows
                if not row.get('id') or not row.get('title'):
                    continue
                
                # Parse JSON fields (if they're strings)
                check_tools = row.get('check_tools')
                if isinstance(check_tools, str) and check_tools.strip():
                    try:
                        check_tools = json.loads(check_tools)
                    except:
                        check_tools = None
                elif not check_tools:
                    check_tools = None
                
                solution = row.get('solution')
                if isinstance(solution, str) and solution.strip():
                    try:
                        solution = json.loads(solution)
                    except:
                        solution = None
                elif not solution:
                    solution = None
                
                templates = row.get('templates')
                if isinstance(templates, str) and templates.strip():
                    try:
                        templates = json.loads(templates)
                    except:
                        templates = None
                elif not templates:
                    templates = None
                
                # Tạo content để generate embedding
                content_parts = [
                    row.get('title', ''),
                    row.get('cause', ''),
                ]
                
                if solution and isinstance(solution, dict):
                    if solution.get('level1'):
                        content_parts.append(solution['level1'])
                    if solution.get('level2'):
                        content_parts.append(solution['level2'])
                
                content_for_embedding = ' '.join(filter(None, content_parts))
                
                # Generate embedding
                embedding_response = openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=content_for_embedding
                )
                embedding = embedding_response.data[0].embedding
                
                # Prepare data for Supabase
                sop_data = {
                    'id': int(row.get('id')),
                    'title': row.get('title'),
                    'domain': row.get('domain'),
                    'cause': row.get('cause'),
                    'check_tools': check_tools,
                    'solution': solution,
                    'notes': row.get('notes'),
                    'templates': templates,
                    'link': row.get('link'),
                    'embedding': embedding
                }
                
                # Remove None values
                sop_data = {k: v for k, v in sop_data.items() if v is not None}
                
                # Upsert vào Supabase
                result = supabase.table('sop_items').upsert(sop_data).execute()
                synced_count += 1
                
            except Exception as e:
                error_msg = f"Row ID {row.get('id', 'unknown')}: {str(e)}"
                errors.append(error_msg)
                print(f"Error syncing row: {error_msg}")
        
        return jsonify({
            'success': True,
            'synced_count': synced_count,
            'total_rows': len(rows),
            'errors': errors if errors else None
        })
        
    except Exception as e:
        print(f"Error in sync_sheets: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# STATS ENDPOINT (OPTIONAL)
# ==========================================
@app.route('/api/stats', methods=['GET'])
def get_stats():
    """
    Get statistics about SOPs
    """
    try:
        # Count total SOPs
        total_result = supabase.table('sop_items').select('id', count='exact').execute()
        total_count = total_result.count if hasattr(total_result, 'count') else 0
        
        # Count by domain
        domain_result = supabase.table('sop_items').select('domain').execute()
        domains = {}
        if domain_result.data:
            for item in domain_result.data:
                domain = item.get('domain', 'Unknown')
                domains[domain] = domains.get(domain, 0) + 1
        
        return jsonify({
            'success': True,
            'total_sops': total_count,
            'by_domain': domains
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# ==========================================
# MAIN
# ==========================================
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)