css_path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\public\styles.css"

with open(css_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

def print_range(start, end):
    print(f"=== LINES {start} to {end} ===")
    for i in range(start - 1, min(end, len(lines))):
        print(f"{i+1}: {lines[i]}", end="")
    print("\n" + "=" * 40 + "\n")

print_range(2140, 2260)
print_range(2680, 2760)
