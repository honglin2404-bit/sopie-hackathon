import os
import time
from supabase import create_client
from openai import OpenAI
from dotenv import load_dotenv

# 1. Load môi trường
load_dotenv('.env.local')

url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
openai_key = os.environ.get('OPENAI_API_KEY')

if not url or not key or not openai_key:
    print("❌ Lỗi: Thiếu Key trong .env.local")
    exit()

# 2. Khởi tạo Client
supabase = create_client(url, key)
openai_client = OpenAI(api_key=openai_key)

def generate_embedding(text):
    try:
        if not text or not text.strip(): return None
        text = text.replace("\n", " ").strip()
        res = openai_client.embeddings.create(input=[text], model="text-embedding-3-small")
        return res.data[0].embedding
    except Exception as e:
        print(f"⚠️ Lỗi OpenAI: {e}")
        return None

def main():
    print("🔄 Đang chạy Force Update toàn bộ Vector...")

    # BƯỚC 1: Lấy TOÀN BỘ dữ liệu từ bảng gốc
    try:
        # Lấy hết, không cần so sánh với bảng cũ nữa vì ta muốn update hết
        sops_res = supabase.table('sops').select("id, title, cause, solution_l1, solution_l2, keywords_primary").execute()
        all_sops = sops_res.data
    except Exception as e:
        print(f"❌ Lỗi đọc bảng 'sops': {e}")
        return

    print(f"👉 Tìm thấy {len(all_sops)} SOP. Bắt đầu sinh lại Vector cho tất cả...")

    # BƯỚC 2: Duyệt qua từng dòng và Upsert
    count_success = 0
    
    for i, row in enumerate(all_sops):
        print(f"[{i+1}/{len(all_sops)}] Processing ID: {row['id']}...")
        
        # [OPT] Chuỗi embedding ưu tiên title + keywords_primary (lặp 2 lần để tăng weight).
        # Chỉ lấy 200 ký tự đầu của solution để tránh vector bị loãng bởi nội dung dài.
        # Nhất quán với cách tạo embedding trong sync_google_sheets.py.
        sol_l1 = row.get('solution_l1') or ''
        kw = row.get('keywords_primary') or ''
        title_val = row.get('title', '')
        cause_val = row.get('cause', '')

        content_text = f"{title_val} {title_val} {kw} {kw} {cause_val} {sol_l1[:200]}"
        
        vector = generate_embedding(content_text)
        
        if vector:
            embed_data = {
                'sop_id': row['id'],      
                'content': content_text,  
                'embedding': vector       
            }
            
            try:
                # [QUAN TRỌNG] Dùng Upsert thay vì Insert
                # Yêu cầu Bước 1 (SQL UNIQUE) đã được chạy
                supabase.table('sop_embeddings').upsert(embed_data, on_conflict='sop_id').execute()
                print("   -> ✅ Updated.")
                count_success += 1
            except Exception as e:
                print(f"   -> ❌ Lỗi DB: {e}")
        else:
            print("   -> ⚠️ Skipped (No content/OpenAI Error).")
        
        # Sleep nhẹ để tránh Rate Limit của OpenAI
        time.sleep(0.2)

    print(f"\n🎉 Hoàn tất! Đã cập nhật {count_success}/{len(all_sops)} vectors.")

if __name__ == "__main__":
    main()