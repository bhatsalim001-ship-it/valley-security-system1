import json

db_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json"

with open(db_path, "r", encoding="utf-8") as f:
    db = json.load(f)

templates = db.get("templates", [])
for t in templates:
    print(f"ID: {t.get('id')}")
    print(f"Name: {t.get('name')}")
    print(f"Layout: {t.get('layout')}")
    print(f"HeaderText: {t.get('headerText')}")
    print(f"SubheaderText: {t.get('subheaderText')}")
    print(f"HeaderBgColor: {t.get('headerBgColor')}")
    print(f"AccentColor: {t.get('accentColor')}")
    print(f"Logo Length: {len(t.get('logo', ''))}")
    print(f"Background Length: {len(t.get('background', ''))}")
    print(f"Signature Length: {len(t.get('signature', ''))}")
    print("-----------------------------------")
