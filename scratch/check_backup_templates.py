import json
import os

path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json.backup"
if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    templates = data.get("templates", [])
    print(f"Total templates in db.json.backup: {len(templates)}")
    for t in templates[:5]:
        print(f" - {t.get('id')}: {t.get('name')}")
else:
    print("db.json.backup does not exist")
