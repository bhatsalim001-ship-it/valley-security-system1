const sharp = require('sharp');
const fs = require('fs');

const imgDir = "C:/Users/salim/.gemini/antigravity/brain/7dbd627f-6ee4-40d8-8e11-80bf7ab183a3";
const inputPath = `${imgDir}/media__1782372962202.jpg`;
const outputPath = `${imgDir}/media__1782372962202_processed_v3.png`;

sharp(inputPath)
  .resize(400, 400, { fit: 'inside' })
  .raw()
  .toBuffer({ resolveWithObject: true })
  .then(({ data, info }) => {
     const { width, height, channels } = info;
     const outputData = Buffer.alloc(width * height * 4); // RGBA output
     
     const getPixel = (x, y) => {
         const idx = (y * width + x) * channels;
         return { r: data[idx], g: data[idx+1], b: data[idx+2] };
     };
     
     // Step 1: Collect border pixels (top, left, right borders)
     const borderPixels = [];
     const sampleStep = 4; // Sample every 4th pixel to get a dense but fast representation
     
     // Top border
     for (let x = 0; x < width; x += sampleStep) {
         borderPixels.push(getPixel(x, 0));
     }
     // Left and Right borders
     for (let y = 1; y < height; y += sampleStep) {
         borderPixels.push(getPixel(0, y));
         borderPixels.push(getPixel(width - 1, y));
     }
     
     console.log(`Collected ${borderPixels.length} border pixels for analysis.`);
     
     // Helper for color distance
     const colorDist = (c1, c2) => {
         const dr = c1.r - c2.r;
         const dg = c1.g - c2.g;
         const db = c1.b - c2.b;
         return Math.sqrt(dr*dr + dg*dg + db*db);
     };
     
     // Step 2: Cluster and find dominant colors
     // For each border pixel, count how many other border pixels are within distance 25
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
             console.log(`Selected background anchor: RGB(${candidate.r}, ${candidate.g}, ${candidate.b}) representing ${count} border pixels.`);
             if (anchors.length >= maxAnchors) break;
         }
     }
     
     if (anchors.length === 0) {
         // Fallback if no cluster dominates (should not happen)
         anchors.push(getPixel(0, 0));
         console.log("Fallback: Selected top-left pixel as single anchor.");
     }
     
     // Step 3: Run BFS flood fill
     const visited = new Uint8Array(width * height);
     const queue = [];
     
     // Initialize BFS queue with border pixels
     for (let x = 0; x < width; x++) {
         queue.push({ x, y: 0 });
         visited[0 * width + x] = 1;
     }
     for (let y = 1; y < height; y++) {
         queue.push({ x: 0, y });
         queue.push({ x: width - 1, y });
         visited[y * width] = 1;
         visited[y * width + (width - 1)] = 1;
     }
     
     // Safe threshold for matching anchors
     const threshold = 40;
     
     const isColorSimilarToAnchors = (r, g, b) => {
         const p = { r, g, b };
         for (let i = 0; i < anchors.length; i++) {
             if (colorDist(p, anchors[i]) < threshold) {
                 return true;
             }
         }
         return false;
     };
     
     // Copy original pixels to output buffer (RGBA)
     for (let y = 0; y < height; y++) {
         for (let x = 0; x < width; x++) {
             const idx = (y * width + x) * channels;
             const outIdx = (y * width + x) * 4;
             outputData[outIdx] = data[idx];
             outputData[outIdx+1] = data[idx+1];
             outputData[outIdx+2] = data[idx+2];
             outputData[outIdx+3] = 255;
         }
     }
     
     let head = 0;
     let cleanedCount = 0;
     while (head < queue.length) {
         const { x, y } = queue[head++];
         const idx = (y * width + x) * channels;
         const outIdx = (y * width + x) * 4;
         const r = data[idx];
         const g = data[idx+1];
         const b = data[idx+2];
         
         if (isColorSimilarToAnchors(r, g, b)) {
             // Turn to solid white
             outputData[outIdx] = 255;
             outputData[outIdx+1] = 255;
             outputData[outIdx+2] = 255;
             outputData[outIdx+3] = 255;
             cleanedCount++;
             
             // 4-way neighbors
             const neighbors = [
                 { x: x - 1, y },
                 { x: x + 1, y },
                 { x, y: y - 1 },
                 { x, y: y + 1 }
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
     
     console.log(`Flood fill completed. Cleaned pixels: ${cleanedCount} / ${width * height}`);
     
     sharp(outputData, { raw: { width, height, channels: 4 } })
       .png()
       .toFile(outputPath)
       .then(() => {
           console.log("Processed image saved successfully to:", outputPath);
       })
       .catch(err => {
           console.error("Error saving output image:", err);
       });
  })
  .catch(err => {
      console.error("Error processing image:", err);
  });
