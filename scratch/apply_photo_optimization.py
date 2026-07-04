import os

file_path = 'public/app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = """        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);"""

replacement = """        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 400; // Max width or height to optimize processing & DB storage size
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);"""

if target in content:
    content = content.replace(target, replacement)
    print("Optimization applied successfully.")
else:
    target_lf = target.replace('\r\n', '\n')
    content_lf = content.replace('\r\n', '\n')
    if target_lf in content_lf:
        content = content_lf.replace(target_lf, replacement.replace('\r\n', '\n'))
        print("Optimization applied successfully (LF).")
    else:
        print("Error: Target code segment not found in public/app.js!")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
