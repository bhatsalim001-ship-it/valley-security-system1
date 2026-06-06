import os
import re

workspace = r"C:\Users\salim\.gemini\antigravity\scratch\valley-security-system\public"

keywords = ["animation", "transition", "keyframes", "transform", "translate", "scale", "rotate", "animate"]

for root, dirs, files in os.walk(workspace):
    for file in files:
        if file.endswith((".css", ".js", ".html")):
            path = os.path.join(root, file)
            print(f"=== {file} ===")
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                lines = f.readlines()
            for idx, line in enumerate(lines):
                # check if any keyword matches as word or pattern
                for kw in keywords:
                    if kw in line.lower():
                        print(f"Line {idx+1}: {line.strip()}")
                        break
