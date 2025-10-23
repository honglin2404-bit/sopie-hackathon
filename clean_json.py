import json
import re

def clean_nan(file_path):
    print(f"Cleaning {file_path}...")
    
    # Read as text
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace NaN with null
    content = re.sub(r'\bNaN\b', 'null', content)
    
    # Verify it's valid JSON
    try:
        data = json.loads(content)
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"✅ Cleaned and saved {file_path}")
    except json.JSONDecodeError as e:
        print(f"❌ Still invalid JSON: {e}")

clean_nan('public/data/knowledge_base.json')
clean_nan('public/data/templates.json')