import subprocess
import json

try:
    output = subprocess.check_output(["git", "show", "HEAD:db.json"], cwd=r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system")
    git_db = json.loads(output.decode('utf-8'))
    git_templates = git_db.get("templates", [])
    print(f"Total templates in git HEAD db.json: {len(git_templates)}")
    for t in git_templates:
         print(f"ID: {t.get('id')}, Name: {t.get('name')}")
except Exception as e:
    print(f"Error checking git version of db.json: {e}")
