import json

with open(r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json", "r", encoding="utf-8") as f:
    db = json.load(f)

templates = db.get("templates", [])
print(f"Total templates in db.json: {len(templates)}")
for t in templates[:10]:
    print(f"ID: {t.get('id')}, Name: {t.get('name')}")
if len(templates) > 10:
    print("...")
