def format_text_with_breaks(text):
    """
    Tự động format text với xuống dòng tại các patterns:
    - Bước X:
    - * (bullet points)
    - Numbered lists
    """
    # Handle None, NaN, empty, or non-string values
    if text is None or text == 'N/A' or text == '':
        return text
    
    # Convert to string if it's a number
    if not isinstance(text, str):
        text = str(text)
    
    # Skip if empty after conversion
    if not text.strip():
        return text
    
    # Danh sách patterns cần xuống dòng
    patterns = [
        # Bước 1:, Bước 2:, etc.
        (r'(Bước \d+:)', r'\n\1'),
        # Bước 1.1:, Bước 2.2:, etc.
        (r'(Bước \d+\.\d+:)', r'\n\1'),
        # Step patterns in English
        (r'(Step \d+:)', r'\n\1'),
        # Bullet points với *
        (r'(\* )', r'\n\1'),
        # Bullet points với -
        (r'^(-\s)', r'\n\1', re.MULTILINE),
        # Risk Level:, Net Profit:, etc (specific keywords)
        (r'(Risk Level:)', r'\n  \1'),
        (r'(Điểm Net Profit:)', r'\n  \1'),
        # Numbered lists: 1., 2., 3., etc
        (r'(\d+\.\s)', r'\n\1'),
    ]
    
    result = text
    for pattern in patterns:
        if len(pattern) == 2:
            result = re.sub(pattern[0], pattern[1], result)
        else:
            result = re.sub(pattern[0], pattern[1], result, flags=pattern[2])
    
    # Cleanup: remove multiple consecutive newlines (keep max 2)
    result = re.sub(r'\n{3,}', '\n\n', result)
    
    # Cleanup: remove newline at the beginning
    result = result.lstrip('\n')
    
    return result