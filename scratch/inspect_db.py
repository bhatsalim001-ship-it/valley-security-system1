import json

db_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\db.json"

with open(db_path, "r", encoding="utf-8") as f:
    db = json.load(f)

print("Number of employees:", len(db.get("employees", [])))
if db.get("employees"):
    first_emp = db["employees"][0]
    # Print employee details excluding big base64 documents
    emp_copy = {k: v for k, v in first_emp.items() if k != "documents"}
    print("First employee fields:")
    print(json.dumps(emp_copy, indent=2))
    print("\nDocuments keys:")
    print(list(first_emp.get("documents", {}).keys()))
