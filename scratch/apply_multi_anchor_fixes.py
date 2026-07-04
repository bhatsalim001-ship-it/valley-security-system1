import os

file_path = 'public/app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Locate removePortraitBackground function start and replacement function
start_marker = "function removePortraitBackground("
end_marker = "function handleImageUpload("

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_function = """function removePortraitBackground(base64Str, threshold = 55) {
    return new Promise((resolve) => {
        if (!base64Str || !base64Str.startsWith('data:image/')) {
            resolve(base64Str);
            return;
        }
        const img = new Image();
        img.onload = () => {
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
            ctx.drawImage(img, 0, 0, w, h);
            
            try {
                const imgData = ctx.getImageData(0, 0, w, h);
                const data = imgData.data;
                const width = w;
                const height = h;
                
                // Helper to get pixel color
                const getPixel = (x, y) => {
                    const idx = (y * width + x) * 4;
                    return {r: data[idx], g: data[idx+1], b: data[idx+2]};
                };
                
                // Sample 9 background anchors (corners, upper borders, edges)
                const samples = [
                    getPixel(0, 0),
                    getPixel(width - 1, 0),
                    getPixel(0, Math.min(10, height - 1)),
                    getPixel(width - 1, Math.min(10, height - 1)),
                    getPixel(Math.round(width / 2), 0),
                    getPixel(Math.round(width / 4), 0),
                    getPixel(Math.round(3 * width / 4), 0),
                    getPixel(0, Math.min(40, height - 1)),
                    getPixel(width - 1, Math.min(40, height - 1))
                ];
                
                // BFS queue for flood fill
                const visited = new Uint8Array(width * height);
                const queue = [];
                
                // Initialize queue with border pixels (top, left, right borders)
                for (let x = 0; x < width; x++) {
                    queue.push({x, y: 0});
                    visited[x] = 1;
                }
                for (let y = 1; y < height; y++) {
                    queue.push({x: 0, y});
                    queue.push({x: width - 1, y});
                    visited[y * width] = 1;
                    visited[y * width + (width - 1)] = 1;
                }
                
                // Color similarity helper checking against ALL anchors
                const isColorSimilar = (r, g, b) => {
                    for (let i = 0; i < samples.length; i++) {
                        const s = samples[i];
                        const dr = r - s.r;
                        const dg = g - s.g;
                        const db = b - s.b;
                        if (Math.sqrt(dr*dr + dg*dg + db*db) < threshold) {
                            return true;
                        }
                    }
                    return false;
                };
                
                let head = 0;
                while (head < queue.length) {
                    const {x, y} = queue[head++];
                    const idx = (y * width + x) * 4;
                    const r = data[idx];
                    const g = data[idx+1];
                    const b = data[idx+2];
                    
                    if (isColorSimilar(r, g, b)) {
                        // Classify as background and turn to solid white
                        data[idx] = 255;
                        data[idx+1] = 255;
                        data[idx+2] = 255;
                        data[idx+3] = 255;
                        
                        // Add 4 neighbors
                        const neighbors = [
                            {x: x - 1, y},
                            {x: x + 1, y},
                            {x, y: y - 1},
                            {x, y: y + 1}
                        ];
                        
                        neighbors.forEach(n => {
                            if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                                const nIdx = n.y * width + n.x;
                                if (!visited[nIdx]) {
                                    visited[nIdx] = 1;
                                    queue.push(n);
                                }
                            }
                        });
                    }
                }
                
                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.95));
            } catch (e) {
                console.error("Auto-white background extraction failed:", e);
                resolve(base64Str);
            }
        };
        img.onerror = () => {
            resolve(base64Str);
        };
        img.src = base64Str;
    });
}

"""
    content = content[:start_idx] + new_function + "\n\n" + content[end_idx:]
    print("Replacement of removePortraitBackground completed successfully.")
else:
    print("Error: Could not locate markers in public/app.js!")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Modification complete.")
