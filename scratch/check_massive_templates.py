import json
import os

path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\templates-massive.json"
if os.path.exists(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"Total templates in templates-massive.json: {len(data)}")
    for t in data[:5]:
        print(f" - {t.get('id')}: {t.get('name')}")
    # check if 'tpl-basic-white' or similar is inside
    ids = [t.get('id') for t in data]
    print(f"tpl-basic-white in templates-massive.json? {'tpl-basic-white' in ids}")
else:
    print("templates-massive.json does not exist")
