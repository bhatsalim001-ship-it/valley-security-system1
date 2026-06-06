import json

db_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json"

with open(db_path, "r", encoding="utf-8") as f:
    db = json.load(f)

templates = db.get("templates", [])
for t in templates:
    print(f"=== ID: {t.get('id')} ===")
    print(json.dumps(t, indent=2))
