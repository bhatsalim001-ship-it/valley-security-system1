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
        
        const runFallback = (img, res) => {
            try {
                const canvas = document.createElement('canvas');
                const maxDim = 400;
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
                
                const imgData = ctx.getImageData(0, 0, w, h);
                const data = imgData.data;
                const width = w;
                const height = h;
                
                const getPixel = (x, y) => {
                    const idx = (y * width + x) * 4;
                    return {r: data[idx], g: data[idx+1], b: data[idx+2]};
                };
                
                const borderPixels = [];
                const sampleStep = 4;
                for (let x = 0; x < width; x += sampleStep) {
                    borderPixels.push(getPixel(x, 0));
                }
                for (let y = 1; y < height; y += sampleStep) {
                    borderPixels.push(getPixel(0, y));
                    borderPixels.push(getPixel(width - 1, y));
                }
                
                const colorDist = (c1, c2) => {
                    return Math.sqrt((c1.r - c2.r)**2 + (c1.g - c2.g)**2 + (c1.b - c2.b)**2);
                };
                
                const density = borderPixels.map(p => {
                    let count = 0;
                    borderPixels.forEach(other => {
                        if (colorDist(p, other) < 25) count++;
                    });
                    return { pixel: p, count };
                });
                
                density.sort((a, b) => b.count - a.count);
                
                const anchors = [];
                const maxAnchors = 4;
                const minAcceptableCount = borderPixels.length * 0.15;
                
                for (let i = 0; i < density.length; i++) {
                    const candidate = density[i].pixel;
                    const count = density[i].count;
                    if (count < minAcceptableCount) break;
                    
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
                    anchors.push(getPixel(0, 0));
                }
                
                const visited = new Uint8Array(width * height);
                const queue = [];
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
                        if (colorDist(p, anchors[i]) < threshold) return true;
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
                        data[idx] = 255;
                        data[idx+1] = 255;
                        data[idx+2] = 255;
                        data[idx+3] = 255;
                        
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
                res(canvas.toDataURL('image/jpeg', 0.95));
            } catch (err) {
                console.error("Fallback background removal failed:", err);
                res(base64Str);
            }
        };

        const img = new Image();
        img.onload = async () => {
            if (typeof window !== 'undefined' && window.SelfieSegmentation) {
                try {
                    const canvas = document.createElement('canvas');
                    const maxDim = 400;
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
                    
                    // Initialize MediaPipe Selfie Segmentation
                    const selfieSegmentation = new window.SelfieSegmentation({
                        locateFile: (file) => {
                            return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`;
                        }
                    });
                    
                    selfieSegmentation.setOptions({
                        modelSelection: 1, // landscape model for speed
                    });
                    
                    // Set a timeout of 3.5 seconds to prevent hanging if WebGL context creation fails
                    let resolved = false;
                    const timeoutId = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            console.warn("MediaPipe Selfie Segmentation timed out, using flood fill fallback...");
                            try { selfieSegmentation.close(); } catch(e){}
                            runFallback(img, resolve);
                        }
                    }, 3500);

                    selfieSegmentation.onResults((results) => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timeoutId);

                        try {
                            // Clear canvas to white background
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, w, h);
                            
                            // Draw original image first
                            ctx.drawImage(img, 0, 0, w, h);
                            
                            // Draw mask onto temporary canvas to read pixels
                            const maskCanvas = document.createElement('canvas');
                            maskCanvas.width = w;
                            maskCanvas.height = h;
                            const maskCtx = maskCanvas.getContext('2d');
                            maskCtx.drawImage(results.segmentationMask, 0, 0, w, h);
                            
                            const imgData = ctx.getImageData(0, 0, w, h);
                            const maskData = maskCtx.getImageData(0, 0, w, h);
                            const data = imgData.data;
                            const mData = maskData.data;
                            
                            // MediaPipe mask outputs white (255) for person, black (0) for background.
                            // We replace any pixel with low mask probability (< 110) with solid white background.
                            for (let i = 0; i < data.length; i += 4) {
                                const maskVal = mData[i]; // Grayscale/Red channel
                                if (maskVal < 110) {
                                    data[i] = 255;
                                    data[i+1] = 255;
                                    data[i+2] = 255;
                                    data[i+3] = 255;
                                }
                            }
                            
                            ctx.putImageData(imgData, 0, 0);
                            selfieSegmentation.close();
                            resolve(canvas.toDataURL('image/jpeg', 0.95));
                        } catch(e) {
                            console.error("Error applying MediaPipe mask, falling back:", e);
                            runFallback(img, resolve);
                        }
                    });
                    
                    await selfieSegmentation.send({ image: img });
                } catch (err) {
                    console.error("MediaPipe processing failed, falling back:", err);
                    runFallback(img, resolve);
                }
            } else {
                runFallback(img, resolve);
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
