css_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\public\styles.css"

with open(css_path, "r", encoding="utf-8") as f:
    content = f.read()

import re
matches = re.findall(r"\.hidden\s*\{[^}]*\}", content)
print("=== .hidden MATCHES ===")
for m in matches:
    print(m)
