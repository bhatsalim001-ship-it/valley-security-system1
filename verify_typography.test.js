const fs = require('fs');
const path = require('path');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

console.log('\n======================================================');
console.log('TYPOGRAPHY & FONT SYSTEM VERIFICATION');
console.log('======================================================\n');

const htmlFiles = [
  'index.html',
  'login.html',
  'register.html',
  'upload-photo.html',
  'verification.html'
];

console.log('=== 1. GOOGLE FONTS LINK UNIFICATION ===');
htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, 'public', file);
  assert(fs.existsSync(filePath), `${file} exists`);
  const content = fs.readFileSync(filePath, 'utf8');
  assert(content.includes('family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap'), `${file} imports Plus Jakarta Sans & JetBrains Mono`);
  assert(content.includes('rel="preconnect" href="https://fonts.googleapis.com"'), `${file} has preconnect to fonts.googleapis.com`);
  assert(content.includes('rel="preconnect" href="https://fonts.gstatic.com"'), `${file} has preconnect to fonts.gstatic.com`);
});

console.log('\n=== 2. ELIMINATION OF CASUAL / OUTDATED FONTS ===');
htmlFiles.forEach(file => {
  const filePath = path.join(__dirname, 'public', file);
  const content = fs.readFileSync(filePath, 'utf8');
  assert(!content.includes("'Outfit'"), `${file} contains zero Outfit font declarations`);
  assert(!content.includes("'Space Mono'"), `${file} contains zero Space Mono font declarations`);
});

const stylesPath = path.join(__dirname, 'public', 'styles.css');
const stylesContent = fs.readFileSync(stylesPath, 'utf8');
assert(!stylesContent.includes("'Outfit'"), 'styles.css contains zero Outfit font declarations');
assert(!stylesContent.includes("'Space Mono'"), 'styles.css contains zero Space Mono font declarations');

console.log('\n=== 3. CSS TOKEN & TABULAR NUMERAL ENGINE ===');
assert(stylesContent.includes("--vs-font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;"), '--vs-font-sans points to Plus Jakarta Sans');
assert(stylesContent.includes("--vs-font-mono: 'JetBrains Mono', 'SF Mono', Consolas, monospace;"), '--vs-font-mono points to JetBrains Mono');
assert(stylesContent.includes('body {\n    font-family: var(--vs-font-sans);'), 'body uses var(--vs-font-sans)');
assert(stylesContent.includes('font-variant-numeric: tabular-nums;'), 'tabular numerals enabled in styles.css');
assert(stylesContent.includes('font-feature-settings: "cv02", "cv03", "cv04", "cv11", "tnum";'), 'OpenType features configured for numeric tabular figures');

console.log('\n=== 4. APP.JS TEMPLATE DEFAULT UNIFICATION ===');
const appJsPath = path.join(__dirname, 'public', 'app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');
assert(!appJsContent.includes("'Outfit'"), 'app.js contains zero Outfit font declarations');
assert(appJsContent.includes("['Plus Jakarta Sans', 'JetBrains Mono', 'Inter']"), 'app.js coreFonts updated to Plus Jakarta Sans & JetBrains Mono');
assert(appJsContent.includes("font: \"'Plus Jakarta Sans', sans-serif\""), 'app.js default template uses Plus Jakarta Sans');

console.log('\n======================================================');
console.log(`TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
console.log('======================================================\n');

if (testsFailed > 0) {
  process.exit(1);
}
