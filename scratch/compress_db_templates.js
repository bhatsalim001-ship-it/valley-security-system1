const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const dbPath = path.join(__dirname, '..', 'db.json');
const backupPath = path.join(__dirname, '..', 'db.json.backup');

async function compressImage(base64Str, width, isPng) {
  if (!base64Str || !base64Str.startsWith('data:image/')) return base64Str;
  
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches) return base64Str;
  
  const buffer = Buffer.from(matches[2], 'base64');
  
  let sharpInstance = sharp(buffer).resize(width);
  
  let outputBuffer;
  if (isPng) {
    outputBuffer = await sharpInstance.png({ quality: 80, compressionLevel: 9 }).toBuffer();
  } else {
    outputBuffer = await sharpInstance.jpeg({ quality: 75 }).toBuffer();
  }
  
  const mimeType = isPng ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${outputBuffer.toString('base64')}`;
}

async function processDbFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log('File not found:', filePath);
    return;
  }
  
  console.log('Processing file:', filePath);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  let updated = false;
  
  if (data.templates && Array.isArray(data.templates)) {
    for (const t of data.templates) {
      if (t.logo && t.logo.length > 50000) {
        console.log(`Compressing logo in template "${t.name}" (original length: ${t.logo.length})`);
        t.logo = await compressImage(t.logo, 250, true);
        console.log(`New logo length: ${t.logo.length}`);
        updated = true;
      }
      if (t.signature && t.signature.length > 50000) {
        console.log(`Compressing signature in template "${t.name}" (original length: ${t.signature.length})`);
        const isPngSig = t.signature.includes('image/png');
        t.signature = await compressImage(t.signature, 250, isPngSig);
        console.log(`New signature length: ${t.signature.length}`);
        updated = true;
      }
    }
  }
  
  if (updated) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Successfully saved compressed templates in:', filePath);
  } else {
    console.log('No templates needed compression in:', filePath);
  }
}

async function run() {
  await processDbFile(dbPath);
  await processDbFile(backupPath);
}

run().catch(console.error);
