import os

file_path = 'public/app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Define background removal function
remove_bg_function = """/**
 * Automatically detects the background color of a portrait photo (by sampling corners)
 * and uses a BFS flood-fill algorithm from the edges to replace the colored background
 * (like red, blue, green, etc.) with a solid white background.
 */
function removePortraitBackground(base64Str, threshold = 55) {
    return new Promise((resolve) => {
        if (!base64Str || !base64Str.startsWith('data:image/')) {
            resolve(base64Str);
            return;
        }
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                const width = canvas.width;
                const height = canvas.height;
                
                // Helper to get pixel color
                const getPixel = (x, y) => {
                    const idx = (y * width + x) * 4;
                    return {r: data[idx], g: data[idx+1], b: data[idx+2]};
                };
                
                // Sample corners and top-middle to determine background color
                const samples = [
                    getPixel(0, 0),
                    getPixel(width - 1, 0),
                    getPixel(0, Math.min(10, height - 1)),
                    getPixel(width - 1, Math.min(10, height - 1)),
                    getPixel(Math.round(width / 2), 0)
                ];
                
                let bgR = 0, bgG = 0, bgB = 0;
                samples.forEach(s => {
                    bgR += s.r; bgG += s.g; bgB += s.b;
                });
                bgR = Math.round(bgR / samples.length);
                bgG = Math.round(bgG / samples.length);
                bgB = Math.round(bgB / samples.length);
                
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
                
                // Color distance helper
                const isColorSimilar = (r, g, b) => {
                    const dr = r - bgR;
                    const dg = g - bgG;
                    const db = b - bgB;
                    return Math.sqrt(dr*dr + dg*dg + db*db) < threshold;
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

# 2. Define the replacement for handleImageUpload
target_handle = """function handleImageUpload(e, previewBoxId) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.style.maxHeight = '100px';
        
        const previewBox = document.getElementById(previewBoxId);
        previewBox.innerHTML = '';
        previewBox.appendChild(img);
        
        // Store the base64 in a data attribute for form submission
        const input = e.target;
        input.dataset.imageData = event.target.result;
    };
    reader.readAsDataURL(file);
}"""

replacement_handle = remove_bg_function + """function handleImageUpload(e, previewBoxId) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const rawBase64 = event.target.result;
        const input = e.target;
        
        if (previewBoxId === 'reg-photo-preview') {
            // Automatically clean color background to white for employee photo
            const previewBox = document.getElementById(previewBoxId);
            previewBox.innerHTML = '<span class="preview-placeholder" style="color: var(--theme-accent); font-weight: 500;">✨ Auto-cleaning background to white...</span>';
            
            removePortraitBackground(rawBase64, 55).then(processedBase64 => {
                const img = document.createElement('img');
                img.src = processedBase64;
                img.style.maxHeight = '100px';
                
                previewBox.innerHTML = '';
                previewBox.appendChild(img);
                input.dataset.imageData = processedBase64;
            }).catch(err => {
                console.error("Failed auto-cleaning photo background:", err);
                const img = document.createElement('img');
                img.src = rawBase64;
                img.style.maxHeight = '100px';
                previewBox.innerHTML = '';
                previewBox.appendChild(img);
                input.dataset.imageData = rawBase64;
            });
        } else {
            const img = document.createElement('img');
            if (previewBoxId.includes('signature') || previewBoxId.includes('sig')) {
                img.src = getProcessedSignature(rawBase64);
            } else {
                img.src = rawBase64;
            }
            img.style.maxHeight = '100px';
            
            const previewBox = document.getElementById(previewBoxId);
            previewBox.innerHTML = '';
            previewBox.appendChild(img);
            input.dataset.imageData = rawBase64;
        }
    };
    reader.readAsDataURL(file);
}"""

if target_handle in content:
    content = content.replace(target_handle, replacement_handle)
    print("Match found: handleImageUpload replaced with automatic background removal integration.")
else:
    # Try with line ending differences
    target_handle_lf = target_handle.replace('\\r\\n', '\\n')
    content_lf = content.replace('\\r\\n', '\\n')
    if target_handle_lf in content_lf:
        content = content_lf.replace(target_handle_lf, replacement_handle.replace('\\r\\n', '\\n'))
        print("Match found (LF): handleImageUpload replaced with automatic background removal integration.")
    else:
        # Fallback to looser replacement via python replace helper
        print("Error: Target handleImageUpload definition not found in public/app.js! Trying simple replacement.")
        # Simple subreplace
        start_idx = content.find("function handleImageUpload")
        if start_idx != -1:
            end_idx = content.find("function updateNavActive", start_idx)
            if end_idx != -1:
                content = content[:start_idx] + replacement_handle + "\\n\\n" + content[end_idx:]
                print("Fallback replace succeeded!")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Modification complete.")
