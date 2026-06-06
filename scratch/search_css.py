import re

css_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\public\styles.css"

with open(css_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find @media print and print-related classes
print_blocks = re.findall(r"@media\s+print\s*\{([^}]+(?:\}[^}]*)*)\}", content, re.IGNORECASE)
print("=== PRINT BLOCKS ===")
for i, block in enumerate(print_blocks):
    print(f"Block {i+1}:\n{block}\n")

print("=== OTHER KEY PRINT CLASSES ===")
lines = content.splitlines()
for i, line in enumerate(lines):
    if "print" in line.lower() or "bulk" in line.lower() or "page-break" in line.lower():
        start = max(0, i - 2)
        end = min(len(lines), i + 3)
        print(f"Lines {start+1}-{end}:")
        for j in range(start, end):
            print(f"  {j+1}: {lines[j]}")
        print("-" * 40)
