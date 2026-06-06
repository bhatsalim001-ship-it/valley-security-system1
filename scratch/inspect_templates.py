import json

db_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json"

with open(db_path, "r", encoding="utf-8") as f:
    db = json.load(f)

print("Available templates:")
for t in db.get("templates", []):
    print(f"ID: {t['id']} | Name: {t['name']} | Layout: {t['layout']}")
