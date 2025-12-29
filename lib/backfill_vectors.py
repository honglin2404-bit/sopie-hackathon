import os
import time
import json
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
        # Xử lý text rỗng hoặc None
        if not text or not text.strip():
            return None
            
        text = text.replace("\n", " ").strip()
        res = openai_client.embeddings.create(input=[text], model="text-embedding-3-small")
        return res.data[0].embedding
    except Exception as e:
        print(f"⚠️ Lỗi OpenAI: {e}")
        return None

def main():
    print("🔄 Đang đối chiếu dữ liệu giữa 2 bảng (Fix cột solution)...")

    # BƯỚC 1: Lấy danh sách ID từ bảng gốc (sops)
    # [FIX] Đổi 'solution' thành 'solution_l1' và 'solution_l2' theo đúng cấu trúc bảng của bạn
    try:
        sops_res = supabase.table('sops').select("id, title, cause, solution_l1, solution_l2").execute()
        all_sops = sops_res.data
    except Exception as e:
        print(f"❌ Lỗi đọc bảng 'sops': {e}")
        return

    # BƯỚC 2: Lấy danh sách ID đã có vector (sop_embeddings)
    try:
        embed_res = supabase.table('sop_embeddings').select("sop_id").execute()
        existing_ids = [item['sop_id'] for item in embed_res.data]
    except Exception as e:
        print(f"❌ Lỗi đọc bảng 'sop_embeddings': {e}")
        return

    # BƯỚC 3: Tìm những SOP chưa có Vector
    missing_sops = [sop for sop in all_sops if sop['id'] not in existing_ids]

    if not missing_sops:
        print("✅ Dữ liệu đã đồng bộ 100%! Không có SOP nào thiếu vector.")
        return

    print(f"👉 Tìm thấy {len(missing_sops)} SOP đang thiếu vector. Bắt đầu xử lý...")

    # BƯỚC 4: Tạo vector
    for i, row in enumerate(missing_sops):
        print(f"[{i+1}/{len(missing_sops)}] Creating for ID: {row['id']} - {row.get('title', '')[:30]}...")
        
        # [FIX] Lấy dữ liệu trực tiếp từ cột solution_l1, solution_l2 (không cần parse JSON nữa)
        sol_l1 = row.get('solution_l1') or ''
        sol_l2 = row.get('solution_l2') or ''
        
        # Tạo chuỗi text để embed (Title + Cause + Solution L1 + Solution L2)
        content_text = f"{row.get('title', '')} {row.get('cause', '')} {sol_l1} {sol_l2}"
        
        # Gọi OpenAI
        vector = generate_embedding(content_text)
        
        if vector:
            new_record = {
                'sop_id': row['id'],      
                'content': content_text,  
                'embedding': vector       
            }
            
            try:
                supabase.table('sop_embeddings').insert(new_record).execute()
                print("   -> ✅ Insert thành công.")
            except Exception as e:
                print(f"   -> ❌ Lỗi Insert Supabase: {e}")
        else:
            print("   -> ⚠️ Bỏ qua vì nội dung rỗng hoặc lỗi OpenAI.")
        
        time.sleep(0.5)

    print("\n🎉 Hoàn tất quá trình Backfill!")

if __name__ == "__main__":
    main()