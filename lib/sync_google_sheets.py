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
        # Xóa xuống dòng thừa để vector chuẩn hơn
        text = text.replace("\n", " ").strip()
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
                # --- PHẦN 1: XỬ LÝ DỮ LIỆU ĐẦU VÀO (MAPPING) ---
                
                # 1. Solution (Ưu tiên lấy cột lẻ, fallback sang JSON nếu cần)
                sol_l1 = row.get('solution_l1') or ""
                sol_l2 = row.get('solution_l2') or ""
                
                # Fallback: Nếu Sheet lỡ gửi cột gộp 'solution' dạng JSON
                if not sol_l1 and not sol_l2 and row.get('solution'):
                    try:
                        raw_sol = json.loads(row.get('solution'))
                        sol_l1 = raw_sol.get('level1', '')
                        sol_l2 = raw_sol.get('level2', '')
                    except: pass

                # 2. Check Tools
                ct_guideline = row.get('check_tool_guideline') or ""
                ct_name = row.get('check_tools_name') or ""
                ct_url = row.get('check_tools_url') or ""

                # Fallback: Nếu Sheet lỡ gửi cột gộp 'check_tools' dạng JSON
                if not ct_name and not ct_url and row.get('check_tools'):
                    try:
                        raw_ct = json.loads(row.get('check_tools'))
                        ct_guideline = raw_ct.get('guideline', ct_guideline)
                        ct_name = raw_ct.get('name', '')
                        ct_url = raw_ct.get('url', '')
                    except: pass
                
                # 3. Templates & Link
                tpl_mail = row.get('template_app_mail') or ""
                tpl_chat = row.get('template_call_chat') or ""
                # Hỗ trợ cả 2 tên cột 'link' hoặc 'link_sop'
                link_val = row.get('link_sop') or row.get('link') or ""

                # --- PHẦN 2: LƯU VÀO BẢNG 'sops' ---
                sop_data = {
                    'id': row.get('id'),
                    'title': row.get('title'),
                    'domain': row.get('domain'),
                    'product': row.get('product'),
                    'feature': row.get('feature'),
                    'cause': row.get('cause'),
                    
                    # Map vào đúng cột database
                    'solution_l1': sol_l1,
                    'solution_l2': sol_l2,
                    'check_tool_guideline': ct_guideline,
                    'check_tools_name': ct_name,
                    'check_tools_url': ct_url,
                    'template_app_mail': tpl_mail,
                    'template_call_chat': tpl_chat,
                    
                    'notes': row.get('notes'),
                    'link_sop': link_val,
                    'last_updated': row.get('last_updated'),
                    'keywords_primary': row.get('keywords_primary'),
                    'keywords_secondary': row.get('keywords_secondary')
                }
                
                # Lọc bỏ các key có giá trị None (nhưng giữ chuỗi rỗng "")
                cleaned_data = {k: v for k, v in sop_data.items() if v is not None}

                # Thực hiện Upsert
                supabase.table('sops').upsert(cleaned_data).execute()
                
                # --- PHẦN 3: TẠO & LƯU VECTOR (EMBEDDING) ---
                # Ghép tất cả thông tin quan trọng để AI học
                content_for_embedding = f"{row.get('title', '')} {row.get('feature', '')} {row.get('cause', '')} {sol_l1} {sol_l2} {ct_guideline} {row.get('keywords_primary', '')}"
                
                # Chỉ tạo vector nếu có nội dung
                if content_for_embedding.strip():
                    vector = generate_embedding(content_for_embedding)
                    
                    if vector:
                        embed_data = {
                            'sop_id': row.get('id'),
                            'content': content_for_embedding,
                            'embedding': vector
                        }
                        # Upsert vào bảng vector (Yêu cầu cột sop_id phải là Unique)
                        supabase.table('sop_embeddings').upsert(embed_data, on_conflict='sop_id').execute()

                synced_count += 1
                
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