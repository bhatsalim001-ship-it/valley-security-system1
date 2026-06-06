css_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\public\styles.css"

with open(css_path, "r", encoding="utf-8") as f:
    content = f.read()

import re
# Look for class declarations of .id-card-portrait and .id-card-horizontal outside of media queries
matches = re.finditer(r"\.(id-card-portrait|id-card-horizontal|printable-id-card-wrapper)\s*\{[^}]*\}", content)
print("=== SCREEN CARD CLASS MATCHES ===")
for m in matches:
    print(m.group(0))
    print("-" * 30)
