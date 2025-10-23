import pandas as pd
import json
import numpy as np

print("📖 Reading Excel...")

# Generate Templates - ĐỌC ĐẦY ĐỦ TEXT TRONG CELL
try:
    temp_df = pd.read_excel('DB_ZaloPay_CS.xlsx', sheet_name='Response_Templates')
    
    # Convert DataFrame to dict, giữ nguyên line breaks
    templates = []
    for _, row in temp_df.iterrows():
        template = {}
        for col in temp_df.columns:
            value = row[col]
            # Convert NaN to None
            if pd.isna(value):
                template[col] = None
            # Keep string as is (including line breaks)
            elif isinstance(value, str):
                template[col] = value
            # Convert numbers to string if needed
            else:
                template[col] = value
        templates.append(template)
    
    with open('public/data/templates.json', 'w', encoding='utf-8') as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Generated {len(templates)} templates")
except Exception as e:
    print(f"❌ Error: {e}")