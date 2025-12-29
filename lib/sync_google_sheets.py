from flask import Blueprint, request, jsonify
from supabase import create_client
import os
import json
from openai import OpenAI
from dotenv import load_dotenv

# Load biến môi trường
load_dotenv('.env.local')

sync_bp = Blueprint('sync', __name__)

# 1. Khởi tạo Clients
url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
openai_key = os.environ.get('OPENAI_API_KEY')

supabase = create_client(url, key)
openai_client = OpenAI(api_key=openai_key)

# Hàm phụ trợ: Tạo Vector
def generate_embedding(text):
    try:
        if not text or not text.strip(): return None
        text = text.replace("\n", " ").strip()
        # Gọi OpenAI
        res = openai_client.embeddings.create(input=[text], model="text-embedding-3-small")
        return res.data[0].embedding
    except Exception as e:
        print(f"⚠️ Lỗi OpenAI: {e}")
        return None

@sync_bp.route('/api/sync-sheets', methods=['POST'])
def sync_sheets():
    """
    Nhận data từ Google Sheets -> Lưu vào 'sops' -> Tạo vector -> Lưu vào 'sop_embeddings'
    """
    try:
        data = request.json
        rows = data.get('rows', [])
        
        if not rows:
            return jsonify({'success': False, 'error': 'No data provided'}), 400
        
        synced_count = 0
        errors = []
        
        print(f"🚀 Bắt đầu đồng bộ {len(rows)} dòng...")

        for row in rows:
            try:
                # 1. Xử lý dữ liệu JSON (Check Tools, Templates)
                # Lưu ý: Google Sheet gửi lên có thể là string JSON hoặc object
                check_tools = row.get('check_tools')
                if isinstance(check_tools, str):
                    try: check_tools = json.loads(check_tools)
                    except: check_tools = {}

                templates = row.get('templates')
                if isinstance(templates, str):
                    try: templates = json.loads(templates)
                    except: templates = {}

                # Xử lý Solution (Tách L1/L2 nếu Sheet gửi gộp, hoặc lấy thẳng nếu Sheet gửi lẻ)
                # Giả sử Sheet gửi object 'solution' chứa {level1:..., level2:...}
                raw_sol = row.get('solution')
                sol_l1 = ""
                sol_l2 = ""
                
                if isinstance(raw_sol, str):
                    try: raw_sol = json.loads(raw_sol)
                    except: raw_sol = {}
                
                if isinstance(raw_sol, dict):
                    sol_l1 = raw_sol.get('level1', '')
                    sol_l2 = raw_sol.get('level2', '')
                
                # --- BƯỚC 1: UPSERT VÀO BẢNG 'sops' (Nội dung) ---
                sop_data = {
                    'id': row.get('id'),
                    'title': row.get('title'),
                    'domain': row.get('domain'),
                    'cause': row.get('cause'),
                    'check_tools': check_tools,
                    'solution_l1': sol_l1, # [FIX] Map đúng cột database mới
                    'solution_l2': sol_l2, # [FIX] Map đúng cột database mới
                    'notes': row.get('notes'),
                    'templates': templates,
                    'link': row.get('link'),
                    'last_updated': row.get('last_updated') # Nếu có
                }
                
                # Upsert bảng sops
                supabase.table('sops').upsert(sop_data).execute()
                
                # --- BƯỚC 2: TỰ ĐỘNG TẠO VECTOR (AUTO EMBEDDING) ---
                # Ghép chuỗi text để học
                content_for_embedding = f"{row.get('title', '')} {row.get('cause', '')} {sol_l1} {sol_l2}"
                
                vector = generate_embedding(content_for_embedding)
                
                if vector:
                    embed_data = {
                        'sop_id': row.get('id'), # Link với ID vừa tạo
                        'content': content_for_embedding,
                        'embedding': vector
                    }
                    # Upsert bảng vector (Nếu ID cũ đã có thì cập nhật vector mới)
                    # Lưu ý: Cần set conflict on 'sop_id'
                    supabase.table('sop_embeddings').upsert(embed_data, on_conflict='sop_id').execute()

                synced_count += 1
                print(f"   ✅ Synced: {row.get('id')}")
                
            except Exception as e:
                err_msg = f"Row {row.get('id', 'unknown')}: {str(e)}"
                print(f"   ❌ Error: {err_msg}")
                errors.append(err_msg)
        
        return jsonify({
            'success': True,
            'synced_count': synced_count,
            'errors': errors
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500