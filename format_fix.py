import json
import re

def safe_format(text):
    """Format text with line breaks, handling None/NaN/numbers"""
    # Handle None, empty, or non-string
    if text is None or text == '' or text == 'N/A':
        return text
    
    # Convert numbers to string
    if isinstance(text, (int, float)):
        return str(text)
    
    if not isinstance(text, str):
        try:
            text = str(text)
        except:
            return text
    
    # Add line breaks before "Bước X:"
    text = re.sub(r'(Bước \d+:)', r'\n\1', text)
    text = re.sub(r'(Bước \d+\.\d+:)', r'\n\1', text)
    
    # Clean up
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.lstrip('\n')
    
    return text

print("📖 Reading templates.json...")
with open('public/data/templates.json', 'r', encoding='utf-8') as f:
    templates = json.load(f)

print(f"Found {len(templates)} templates")

for i, t in enumerate(templates):
    if 'template_body' in t and t['template_body']:
        t['template_body'] = safe_format(t['template_body'])
    if (i + 1) % 50 == 0:
        print(f"  Processed {i+1}/{len(templates)}")

with open('public/data/templates_formatted.json', 'w', encoding='utf-8') as f:
    json.dump(templates, f, ensure_ascii=False, indent=2)

print(f"✅ Done! Saved to templates_formatted.json")