# lib/sync_google_sheets.py
from flask import Blueprint, request, jsonify
from supabase import create_client
import os
import json
from openai import OpenAI

sync_bp = Blueprint('sync', __name__)

# Khởi tạo clients
supabase = create_client(
    os.environ.get('NEXT_PUBLIC_SUPABASE_URL'),
    os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
)

openai_client = OpenAI(api_key=os.environ.get('OPENAI_API_KEY'))

@sync_bp.route('/api/sync-sheets', methods=['POST'])
def sync_sheets():
    """
    API endpoint để nhận data từ Google Sheets và sync vào Supabase
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
                # Parse JSON fields
                check_tools = json.loads(row.get('check_tools', '{}')) if row.get('check_tools') else None
                solution = json.loads(row.get('solution', '{}')) if row.get('solution') else None
                templates = json.loads(row.get('templates', '{}')) if row.get('templates') else None
                
                # Tạo content để generate embedding
                content_for_embedding = f"{row.get('title', '')} {row.get('cause', '')} {solution.get('level1', '') if solution else ''}"
                
                # Generate embedding
                response = openai_client.embeddings.create(
                    model="text-embedding-3-small",
                    input=content_for_embedding
                )
                embedding = response.data[0].embedding
                
                # Prepare data
                sop_data = {
                    'id': row.get('id'),
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
                
                # Upsert vào Supabase
                result = supabase.table('sop_items').upsert(sop_data).execute()
                synced_count += 1
                
            except Exception as e:
                errors.append(f"Row {row.get('id', 'unknown')}: {str(e)}")
        
        return jsonify({
            'success': True,
            'synced_count': synced_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500