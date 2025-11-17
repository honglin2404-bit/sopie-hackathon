"""
Generate embeddings for all SOPs in database
Run this whenever SOPs are updated
"""

import os
from openai import OpenAI
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment
load_dotenv()

# Initialize clients
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# SỬA LỖI:
# 1. Lấy đúng tên biến URL từ file .env (NEXT_PUBLIC_SUPABASE_URL)
# 2. Dùng SERVICE_ROLE_KEY (key quản trị) thay vì ANON_KEY (key công khai)
supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
supabase_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Thêm kiểm tra để đảm bảo file .env được tải đúng
if not supabase_url or not supabase_key:
    print("❌ LỖI: Vui lòng kiểm tra lại file .env. Không tìm thấy NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.")
    exit()

if not os.getenv('OPENAI_API_KEY'):
    print("❌ LỖI: Vui lòng kiểm tra lại file .env. Không tìm thấy OPENAI_API_KEY.")
    exit()

print("✅ Đã tải API keys thành công.")
supabase: Client = create_client(supabase_url, supabase_key)

def generate_embedding(text: str) -> list:
    """Generate embedding using OpenAI"""
    response = client.embeddings.create(
        model="text-embedding-3-small",
        input=text,
        encoding_format="float"
    )
    return response.data[0].embedding

def create_searchable_text(sop: dict) -> str:
    """Combine relevant fields for embedding"""
    parts = []
    
    if sop.get('title'):
        parts.append(sop['title'])
    if sop.get('cause'):
        parts.append(sop['cause'])
    if sop.get('solution_l1'):
        parts.append(sop['solution_l1'])
    if sop.get('keywords_primary'):
        parts.append(sop['keywords_primary'])
    if sop.get('keywords_secondary'):
        parts.append(sop['keywords_secondary'])
    
    return ' '.join(parts)

def generate_all_embeddings():
    """Generate embeddings for all SOPs"""
    print("🔄 Fetching SOPs from database...")
    
    # Get all SOPs
    try:
        response = supabase.table('sops').select('*').execute()
        sops = response.data
    except Exception as e:
        print(f"❌ LỖI KHI KẾT NỐI SUPABASE: {e}")
        print("---")
        print("KIỂM TRA LẠI:")
        print("1. File .env có đúng chưa?")
        print("2. Đã chạy 'pip install python-dotenv supabase openai' chưa?")
        print("3. Tường lửa có chặn kết nối không?")
        return

    print(f"📊 Found {len(sops)} SOPs")
    
    for i, sop in enumerate(sops, 1):
        try:
            print(f"⚙️  Processing {i}/{len(sops)}: {sop['title'][:50]}...")
            
            # Create searchable text
            searchable_text = create_searchable_text(sop)
            
            # Generate embedding
            embedding = generate_embedding(searchable_text)
            
            # Check if embedding exists
            existing = supabase.table('sop_embeddings').select('id').eq('sop_id', sop['id']).execute()
            
            if existing.data:
                # Update existing
                supabase.table('sop_embeddings').update({
                    'embedding': embedding,
                    'content': searchable_text
                }).eq('sop_id', sop['id']).execute()
                print(f"  ✅ Updated embedding for SOP #{sop['id']}")
            else:
                # Insert new
                supabase.table('sop_embeddings').insert({
                    'sop_id': sop['id'],
                    'embedding': embedding,
                    'content': searchable_text
                }).execute()
                print(f"  ✅ Created embedding for SOP #{sop['id']}")
                
        except Exception as e:
            print(f"  ❌ Error processing SOP #{sop['id']}: {e}")
    
    print("🎉 Done! All embeddings generated.")

if __name__ == "__main__":
    generate_all_embeddings()