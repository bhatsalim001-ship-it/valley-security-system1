import os

path = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\public\NEW_MASTER_STYLES.css"

override = """

/* Global Animation & Transition Reset (CLEAN, VERY VERY FAST) */
*, *::before, *::after {
    transition: none !important;
    animation: none !important;
}
"""

if os.path.exists(path):
    with open(path, "a", encoding="utf-8") as f:
        f.write(override)
    print("Successfully appended override to NEW_MASTER_STYLES.css")
else:
    print("NEW_MASTER_STYLES.css not found")
