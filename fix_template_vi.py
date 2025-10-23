import json
import re

def fix_template_vi(input_file, output_file):
    """
    Tự động fix field template_vi trong knowledge_base.json:
    - Nếu template_vi = "tên temp" → generate từ errorCode
    - Nếu template_vi có nhiều codes → chỉ lấy base code
    """
    print(f"📖 Reading {input_file}...")
    
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    if 'knowledge_extracts' not in data:
        print("❌ Error: 'knowledge_extracts' not found in JSON")
        return
    
    items = data['knowledge_extracts']
    print(f"📊 Found {len(items)} items")
    
    fixed_count = 0
    
    for i, item in enumerate(items):
        error_code = item.get('errorCode', '')
        template_vi = item.get('template_vi', '')
        
        # Case 1: template_vi = "tên temp" → Generate từ errorCode
        if template_vi == "tên temp" or template_vi == "":
            if error_code:
                # E_BL_001 → TPL_E_BL_001
                new_template = f"TPL_{error_code}"
                item['template_vi'] = new_template
                fixed_count += 1
                print(f"  ✓ Fixed {error_code}: 'tên temp' → '{new_template}'")
            else:
                # Không có errorCode thì set null
                item['template_vi'] = None
                print(f"  ⚠ Warning: Item {i} has no errorCode, set template_vi to null")
        
        # Case 2: template_vi có nhiều codes (cách nhau bằng dấu phẩy)
        # "TPL_E_BL_001_INAPP_NEUTRAL, TPL_E_BL_001_CHAT_NEUTRAL, ..."
        elif ',' in str(template_vi):
            # Lấy code đầu tiên
            first_code = template_vi.split(',')[0].strip()
            
            # Extract base code: TPL_E_BL_001_INAPP_NEUTRAL → TPL_E_BL_001
            # Pattern: TPL_E_XX_999_CHANNEL_MODE → TPL_E_XX_999
            match = re.match(r'(TPL_[A-Z]+_[A-Z]+_\d+)', first_code)
            if match:
                base_code = match.group(1)
                item['template_vi'] = base_code
                fixed_count += 1
                print(f"  ✓ Fixed {error_code}: Multi-codes → '{base_code}'")
            else:
                # Fallback: Lấy code đầu tiên
                item['template_vi'] = first_code
                print(f"  ⚠ Warning: Could not extract base code, using first code: '{first_code}'")
        
        # Case 3: template_vi đã đúng format (TPL_E_XX_999) → giữ nguyên
        else:
            # Check nếu có suffix _INAPP, _CHAT, _CALL, _NEUTRAL, _CALMING
            if re.search(r'_(INAPP|CHAT|CALL)_(NEUTRAL|CALMING|ANGRY)$', str(template_vi)):
                # Remove suffix
                base_code = re.sub(r'_(INAPP|CHAT|CALL)_(NEUTRAL|CALMING|ANGRY)$', '', template_vi)
                item['template_vi'] = base_code
                fixed_count += 1
                print(f"  ✓ Fixed {error_code}: Removed suffix → '{base_code}'")
    
    print(f"\n✅ Fixed {fixed_count} items out of {len(items)}")
    
    # Save to output file
    print(f"💾 Saving to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print("✅ Done!")

if __name__ == '__main__':
    input_file = 'public/data/knowledge_base.json'
    output_file = 'public/data/knowledge_base_fixed.json'
    
    fix_template_vi(input_file, output_file)
    
    print("\n" + "="*60)
    print("🎉 All done! Please review knowledge_base_fixed.json")
    print("="*60)