css_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\public\app.js"

with open(css_path, "r", encoding="utf-8") as f:
    content = f.read()

import re
matches = re.finditer(r"generateIdCardHtml\s*\([^)]*\)", content)
print("=== generateIdCardHtml CALL MATCHES ===")
lines = content.splitlines()
for m in matches:
    # find line number
    char_index = m.start()
    line_num = content.count('\n', 0, char_index) + 1
    print(f"Line {line_num}: {m.group(0)}")
    # print surrounding lines
    for i in range(max(0, line_num-2), min(len(lines), line_num+1)):
        print(f"  {i+1}: {lines[i]}")
    print("-" * 40)
