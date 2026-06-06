import json
import os

db_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json"

if os.path.exists(db_path):
    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)
    
    original_templates = []
    for t in db.get("templates", []):
        if t.get("id") in ["tpl-default", "tpl-vip-landscape"]:
            original_templates.append(t)
            
    db["templates"] = original_templates
    
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)
        
    print(f"Successfully cleaned db.json. Kept {len(original_templates)} templates.")
else:
    print("db.json not found")
