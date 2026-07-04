const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const faviconPath = path.join(__dirname, '..', 'public', 'favicon.png');

if (!fs.existsSync(faviconPath)) {
  console.log('favicon.png not found');
  process.exit(0);
}

console.log('Original favicon.png size:', fs.statSync(faviconPath).size);

async function run() {
  try {
    const buffer = fs.readFileSync(faviconPath);
    const compressed = await sharp(buffer)
      .resize(64, 64) // Resizing to 64x64 is standard for high-res favicon
      .png({ compressionLevel: 9, quality: 80 })
      .toBuffer();
      
    fs.writeFileSync(faviconPath, compressed);
    console.log('Compressed favicon.png size:', fs.statSync(faviconPath).size);
  } catch (err) {
    console.error('Error compressing favicon:', err);
  }
}

run();
