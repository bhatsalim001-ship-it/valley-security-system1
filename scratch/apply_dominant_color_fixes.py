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
    new_function = """function removePortraitBackground(base64Str, threshold = 40) {
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
                
                // Step 1: Collect border pixels
                const borderPixels = [];
                const sampleStep = 4; // Sample every 4th pixel for dense analysis
                
                // Top border
                for (let x = 0; x < width; x += sampleStep) {
                    borderPixels.push(getPixel(x, 0));
                }
                // Left and Right borders
                for (let y = 1; y < height; y += sampleStep) {
                    borderPixels.push(getPixel(0, y));
                    borderPixels.push(getPixel(width - 1, y));
                }
                
                // Helper for color distance
                const colorDist = (c1, c2) => {
                    const dr = c1.r - c2.r;
                    const dg = c1.g - c2.g;
                    const db = c1.b - c2.b;
                    return Math.sqrt(dr*dr + dg*dg + db*db);
                };
                
                // Step 2: Cluster and find dominant colors
                const density = borderPixels.map(p => {
                    let count = 0;
                    borderPixels.forEach(other => {
                        if (colorDist(p, other) < 25) {
                            count++;
                        }
                    });
                    return { pixel: p, count };
                });
                
                // Sort by density (highest neighbor count first)
                density.sort((a, b) => b.count - a.count);
                
                // Select dominant anchors (ensure they are distinct from each other)
                const anchors = [];
                const maxAnchors = 4;
                const minAcceptableCount = borderPixels.length * 0.15; // Must represent at least 15% of borders
                
                for (let i = 0; i < density.length; i++) {
                    const candidate = density[i].pixel;
                    const count = density[i].count;
                    
                    if (count < minAcceptableCount) break; // Not dominant enough
                    
                    // Check if this candidate is too close to an already selected anchor
                    let tooClose = false;
                    for (let j = 0; j < anchors.length; j++) {
                        if (colorDist(candidate, anchors[j]) < 30) {
                            tooClose = true;
                            break;
                        }
                    }
                    
                    if (!tooClose) {
                        anchors.push(candidate);
                        if (anchors.length >= maxAnchors) break;
                    }
                }
                
                if (anchors.length === 0) {
                    // Fallback
                    anchors.push(getPixel(0, 0));
                }
                
                // Step 3: Run BFS flood fill
                const visited = new Uint8Array(width * height);
                const queue = [];
                
                // Initialize BFS queue with border pixels
                for (let x = 0; x < width; x++) {
                    queue.push({ x, y: 0 });
                    visited[x] = 1;
                }
                for (let y = 1; y < height; y++) {
                    queue.push({ x: 0, y });
                    queue.push({ x: width - 1, y });
                    visited[y * width] = 1;
                    visited[y * width + (width - 1)] = 1;
                }
                
                const isColorSimilarToAnchors = (r, g, b) => {
                    const p = { r, g, b };
                    for (let i = 0; i < anchors.length; i++) {
                        if (colorDist(p, anchors[i]) < threshold) {
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
                    
                    if (isColorSimilarToAnchors(r, g, b)) {
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
