const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');

if (!fs.existsSync(appJsPath)) {
  console.log('app.js not found at:', appJsPath);
  process.exit(0);
}

const content = fs.readFileSync(appJsPath, 'utf8');
const lines = content.split('\n');

const logoIdx = lines.findIndex(l => l.includes('const VSA_FALLBACK_LOGO ='));
const sigIdx = lines.findIndex(l => l.includes('const VSA_FALLBACK_SIG ='));

if (logoIdx === -1 || sigIdx === -1) {
  console.log('Could not find VSA_FALLBACK_LOGO or VSA_FALLBACK_SIG in app.js');
  process.exit(0);
}

console.log(`Found logo at line ${logoIdx + 1}, sig at line ${sigIdx + 1}`);

const logoLine = lines[logoIdx];
const sigLine = lines[sigIdx];

const logoMatch = logoLine.match(/"(data:image\/[a-zA-Z+-]+;base64,[a-zA-Z0-9+/=]+)"/);
const sigMatch = sigLine.match(/"(data:image\/[a-zA-Z+-]+;base64,[a-zA-Z0-9+/=]+)"/);

if (!logoMatch || !sigMatch) {
  console.log('Could not parse logo or sig base64 strings from matching lines');
  process.exit(0);
}

const logoBase64 = logoMatch[1];
const sigBase64 = sigMatch[1];

console.log('Original Logo Base64 size:', logoBase64.length);
console.log('Original Sig Base64 size:', sigBase64.length);

async function compressImage(base64Str, width, isPng) {
  const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
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

async function run() {
  try {
    const compressedLogo = await compressImage(logoBase64, 250, true);
    console.log('Compressed Logo Base64 size:', compressedLogo.length);
    
    const isPngSig = sigBase64.includes('image/png');
    const compressedSig = await compressImage(sigBase64, 250, isPngSig);
    console.log('Compressed Sig Base64 size:', compressedSig.length);
    
    lines[logoIdx] = `const VSA_FALLBACK_LOGO = "${compressedLogo}";`;
    lines[sigIdx] = `const VSA_FALLBACK_SIG = "${compressedSig}";`;
    
    fs.writeFileSync(appJsPath, lines.join('\n'), 'utf8');
    console.log('Successfully updated app.js with compressed assets!');
  } catch (err) {
    console.error('Error compressing images:', err);
  }
}

run();
