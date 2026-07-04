const sharp = require('sharp');
const fs = require('fs');

const imgDir = "C:/Users/salim/.gemini/antigravity/brain/7dbd627f-6ee4-40d8-8e11-80bf7ab183a3";
const inputPath = `${imgDir}/media__1782372962202.jpg`;
const outputPath = `${imgDir}/media__1782372962202_processed.png`;

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
     
     // Sample 8 background anchor points (corners and upper borders)
     const samples = [
         getPixel(0, 0), // Top-Left
         getPixel(width - 1, 0), // Top-Right
         getPixel(0, Math.min(10, height - 1)), // Upper Left
         getPixel(width - 1, Math.min(10, height - 1)), // Upper Right
         getPixel(Math.round(width / 2), 0), // Top Middle
         getPixel(Math.round(width / 4), 0), // Top Left-Middle
         getPixel(Math.round(3 * width / 4), 0), // Top Right-Middle
         getPixel(0, Math.min(40, height - 1)), // Mid Left
         getPixel(width - 1, Math.min(40, height - 1)) // Mid Right
     ];
     
     console.log("Background anchors sampled:", samples.length);
     
     const visited = new Uint8Array(width * height);
     const queue = [];
     
     // Initialize BFS queue with border pixels (top, left, right borders)
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
     
     // Threshold: distance limit to match any background anchor
     const threshold = 55;
     
     const isColorSimilar = (r, g, b) => {
         // Check distance against ALL background anchors
         for (let i = 0; i < samples.length; i++) {
             const s = samples[i];
             const dr = r - s.r;
             const dg = g - s.g;
             const db = b - s.b;
             const dist = Math.sqrt(dr*dr + dg*dg + db*db);
             if (dist < threshold) {
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
         
         if (isColorSimilar(r, g, b)) {
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
