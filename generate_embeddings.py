import os
import json
import time
import openai
import pandas as pd
from datetime import datetime

print("=" * 80)
print("🚀 ZALOPAY CS - GENERATE EMBEDDINGS FROM EXCEL")
print("=" * 80)

# ======================== CONFIG ========================
EXCEL_FILE = r"D:\AI Project\DB_ZaloPay_CS.xlsx"
SHEET_KNOWLEDGE = "Knowledge_Extracts"
SHEET_TEMPLATES = "Response_Templates"
OUTPUT_JSON = "public/data/knowledge_base.json"
OUTPUT_TEMPLATES = "public/data/templates.json"
OUTPUT_EMBEDDINGS = "public/data/embeddings.json"
# =======================================================

# Đọc API key từ .env.local
def load_api_key():
    env_files = ['.env.local', '.env']
    
    for env_file in env_files:
        try:
            with open(env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('#') or not line:
                        continue
                    
                    if 'OPENAI_API_KEY' in line or 'REACT_APP_OPENAI_API_KEY' in line:
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            key = parts[1].strip().strip('"').strip("'")
                            print(f"✅ Đã load API key từ {env_file}")
                            return key
        except FileNotFoundError:
            continue
    
    print("❌ Không tìm thấy file .env.local hoặc .env!")
    exit(1)

api_key = load_api_key()

if not api_key or not api_key.startswith('sk-'):
    print("❌ API key không hợp lệ!")
    exit(1)

openai.api_key = api_key
print("✅ Đã khởi tạo OpenAI client")

# ======================== STEP 1: ĐỌC EXCEL ========================
print("\n" + "=" * 80)
print("📊 BƯỚC 1: ĐỌC FILE EXCEL")
print("=" * 80)

if not os.path.exists(EXCEL_FILE):
    print(f"❌ Không tìm thấy file Excel: {EXCEL_FILE}")
    exit(1)

try:
    df_knowledge = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_KNOWLEDGE)
    print(f"✅ Đã load {len(df_knowledge)} rows từ sheet '{SHEET_KNOWLEDGE}'")
    
    df_templates = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_TEMPLATES)
    print(f"✅ Đã load {len(df_templates)} rows từ sheet '{SHEET_TEMPLATES}'")
    
    print(f"📋 Knowledge columns: {', '.join(df_knowledge.columns.tolist())}")
    print(f"📋 Templates columns: {', '.join(df_templates.columns.tolist())}")
    
except Exception as e:
    print(f"❌ Lỗi khi đọc Excel: {e}")
    exit(1)

# ======================== STEP 2: CONVERT TO JSON ========================
print("\n" + "=" * 80)
print("🔄 BƯỚC 2: CONVERT EXCEL → JSON")
print("=" * 80)

COLUMN_MAPPING_KB = {
    'Error Code': 'errorCode',
    'errorCode': 'errorCode',
    'Title': 'title',
    'title': 'title',
    'Scope': 'scope',
    'scope': 'scope',
    'Product': 'product',
    'product': 'product',
    'Feature': 'feature',
    'feature': 'feature',
    'Severity': 'severity',
    'severity': 'severity',
    'Cause': 'cause',
    'cause': 'cause',
    'Solution': 'solution',
    'solution': 'solution',
    'Notes': 'notes',
    'notes': 'notes',
    'Template VI': 'template_vi',
    'template_vi': 'template_vi',
    'Source Type': 'sourceType',
    'sourceType': 'sourceType',
    'File SOP': 'fileSOP',
    'fileSOP': 'fileSOP',
    'Link SOP': 'linkSOP',
    'linkSOP': 'linkSOP'
}

COLUMN_MAPPING_TPL = {
    'template_code': 'template_code',
    'purpose': 'purpose',
    'channel': 'channel',
    'language': 'language',
    'tone': 'tone',
    'voice_style': 'voice_style',
    'emotion_mode': 'emotion_mode',
    'template_body': 'template_body'
}

df_kb_renamed = df_knowledge.copy()
for old_name, new_name in COLUMN_MAPPING_KB.items():
    if old_name in df_knowledge.columns:
        df_kb_renamed.rename(columns={old_name: new_name}, inplace=True)

df_tpl_renamed = df_templates.copy()
for old_name, new_name in COLUMN_MAPPING_TPL.items():
    if old_name in df_templates.columns:
        df_tpl_renamed.rename(columns={old_name: new_name}, inplace=True)

knowledge_base = df_kb_renamed.to_dict('records')
templates_list = df_tpl_renamed.to_dict('records')

for item in knowledge_base:
    for key, value in item.items():
        if pd.isna(value):
            item[key] = ""
        elif isinstance(value, float):
            item[key] = str(value)

for item in templates_list:
    for key, value in item.items():
        if pd.isna(value):
            item[key] = ""
        elif isinstance(value, float):
            item[key] = str(value)

json_kb_output = {
    "version": "2.0",
    "generated_date": datetime.now().strftime("%Y-%m-%d"),
    "total_cases": len(knowledge_base),
    "source_file": EXCEL_FILE,
    "knowledge_extracts": knowledge_base
}

os.makedirs(os.path.dirname(OUTPUT_JSON), exist_ok=True)

try:
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(json_kb_output, f, ensure_ascii=False, indent=2)
    
    file_size = os.path.getsize(OUTPUT_JSON) / 1024
    print(f"✅ Đã lưu Knowledge Base JSON: {OUTPUT_JSON}")
    print(f"   📊 Tổng cases: {len(knowledge_base)}")
    print(f"   💾 File size: {file_size:.2f} KB")
    
except Exception as e:
    print(f"❌ Lỗi khi lưu Knowledge Base JSON: {e}")
    exit(1)

try:
    with open(OUTPUT_TEMPLATES, 'w', encoding='utf-8') as f:
        json.dump(templates_list, f, ensure_ascii=False, indent=2)
    
    file_size = os.path.getsize(OUTPUT_TEMPLATES) / 1024
    print(f"✅ Đã lưu Templates JSON: {OUTPUT_TEMPLATES}")
    print(f"   📊 Tổng templates: {len(templates_list)}")
    print(f"   💾 File size: {file_size:.2f} KB")
    
except Exception as e:
    print(f"❌ Lỗi khi lưu Templates JSON: {e}")
    exit(1)

# ======================== STEP 3: GENERATE EMBEDDINGS ========================
print("\n" + "=" * 80)
print("🤖 BƯỚC 3: GENERATE EMBEDDINGS VỚI OPENAI")
print("=" * 80)
print(f"Model: text-embedding-ada-002")
print(f"Tổng số cases: {len(knowledge_base)}")
print(f"Ước tính thời gian: ~{len(knowledge_base) * 0.5:.0f} giây")
print(f"Ước tính chi phí: ~${len(knowledge_base) * 0.0001:.4f}")
print("=" * 80 + "\n")

if len(knowledge_base) > 20:
    confirm = input(f"⚠️  Bạn có muốn generate embeddings cho {len(knowledge_base)} cases? (y/n): ")
    if confirm.lower() != 'y':
        print("❌ Đã hủy generate embeddings!")
        print("✅ File JSON đã được tạo, bạn có thể chạy app với Keyword Search")
        exit(0)

embeddings = []
success_count = 0
error_count = 0
start_time = time.time()

for i, item in enumerate(knowledge_base):
    try:
        text_parts = [
            item.get('errorCode', ''),
            item.get('title', ''),
            item.get('scope', ''),
            item.get('product', ''),
            item.get('feature', ''),
            item.get('cause', ''),
            item.get('solution', ''),
            item.get('notes', '')
        ]
        
        text = ' '.join([str(part) for part in text_parts if part])
        
        if len(text) > 30000:
            text = text[:30000]
        
        progress = (i + 1) / len(knowledge_base) * 100
        error_code = item.get('errorCode', 'N/A')
        title = item.get('title', '')[:50]
        
        print(f"[{i+1}/{len(knowledge_base)}] ({progress:.1f}%) {error_code}: {title}...")
        
        response = openai.Embedding.create(
            model='text-embedding-ada-002',
            input=text
        )
        
        embedding = response['data'][0]['embedding']
        embeddings.append(embedding)
        success_count += 1
        
        print(f"   ✅ Success! (Vector: {len(embedding)} dimensions)")
        
        time.sleep(0.2)
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        embeddings.append(None)
        error_count += 1
        time.sleep(1)

# ======================== STEP 4: SAVE EMBEDDINGS ========================
print("\n" + "=" * 80)
print("💾 BƯỚC 4: LƯU EMBEDDINGS")
print("=" * 80)

try:
    with open(OUTPUT_EMBEDDINGS, 'w', encoding='utf-8') as f:
        json.dump(embeddings, f, indent=2)
    
    elapsed_time = time.time() - start_time
    file_size = os.path.getsize(OUTPUT_EMBEDDINGS) / 1024 / 1024
    
    print(f"✅ Đã lưu embeddings: {OUTPUT_EMBEDDINGS}")
    print(f"   💾 File size: {file_size:.2f} MB")
    
except Exception as e:
    print(f"❌ Lỗi khi lưu embeddings: {e}")
    exit(1)

# ======================== SUMMARY ========================
print("\n" + "=" * 80)
print("🎉 HOÀN THÀNH!")
print("=" * 80)
print(f"✅ Thành công: {success_count}/{len(knowledge_base)} cases")
if error_count > 0:
    print(f"❌ Lỗi: {error_count} cases")
print(f"⏱️  Tổng thời gian: {elapsed_time:.1f} giây")
print(f"📂 Output files:")
print(f"   - {OUTPUT_JSON} ({len(knowledge_base)} cases)")
print(f"   - {OUTPUT_TEMPLATES} ({len(templates_list)} templates)")
print(f"   - {OUTPUT_EMBEDDINGS}")
print("=" * 80)

print("\n🚀 BẠN CÓ THỂ CHẠY APP NGAY BÂY GIỜ:")
print("   npm run dev")
print("\n✨ Semantic search với OpenAI đã sẵn sàng!")