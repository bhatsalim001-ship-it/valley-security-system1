const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const imgPath = path.join(__dirname, '..', 'public', 'developer.jpg');

if (!fs.existsSync(imgPath)) {
  console.log('developer.jpg not found');
  process.exit(0);
}

console.log('Original developer.jpg size:', fs.statSync(imgPath).size);

async function run() {
  try {
    const buffer = fs.readFileSync(imgPath);
    // Resize to max 300px width (typical for portraits) and compress
    const compressed = await sharp(buffer)
      .resize(300)
      .jpeg({ quality: 80, progressive: true })
      .toBuffer();
      
    fs.writeFileSync(imgPath, compressed);
    console.log('Compressed developer.jpg size:', fs.statSync(imgPath).size);
  } catch (err) {
    console.error('Error compressing developer.jpg:', err);
  }
}

run();
