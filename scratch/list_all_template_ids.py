import json

with open(r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json", "r", encoding="utf-8") as f:
    db = json.load(f)

templates = db.get("templates", [])
print(f"Total: {len(templates)}")
for t in templates:
    print(f" - {t.get('id')}: {t.get('name')}")
