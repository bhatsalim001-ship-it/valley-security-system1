const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');
const lines = fs.readFileSync(appJsPath, 'utf8').split('\n');

lines.forEach((line, i) => {
  if (line.includes('const VSA_FALLBACK_LOGO') || line.includes('const VSA_FALLBACK_SIG')) {
    console.log(`Line ${i+1}: ${line.substring(0, 100)}`);
  }
});
