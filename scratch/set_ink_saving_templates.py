import json
import os

db_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json"

if os.path.exists(db_path):
    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)
    
    templates = db.get("templates", [])
    for t in templates:
        if t.get("id") == "tpl-default":
            t["headerBgColor"] = "#ffffff"
            t["background"] = ""
            t["layout"] = "vertical"
            t["name"] = "Standard Luxury Security Badge"
        elif t.get("id") == "tpl-vip-landscape":
            t["headerBgColor"] = "#ffffff"
            t["background"] = ""
            t["layout"] = "horizontal"
            t["name"] = "VIP Executive Landscape Badge"
            
    db["templates"] = templates
    
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)
        
    print("Successfully set db.json templates to ink-saving white background with border accents.")
else:
    print("db.json not found")
