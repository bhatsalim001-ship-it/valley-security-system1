const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'public', 'app.js');

if (!fs.existsSync(appJsPath)) {
  console.log('app.js not found');
  process.exit(0);
}

let content = fs.readFileSync(appJsPath, 'utf8');

const targetStr = `/* ==========================================================================\r\n   5. LUXURY ID CARD GENERATION SYSTEM\r\n   ========================================================================== */\r\nfunction generateIdCardHtml(emp, template, validityYears = 3) {`;

const targetStrUnix = `/* ==========================================================================\n   5. LUXURY ID CARD GENERATION SYSTEM\n   ========================================================================== */\nfunction generateIdCardHtml(emp, template, validityYears = 3) {`;

const insertStr = `/* ==========================================================================\r\n   5. LUXURY ID CARD GENERATION SYSTEM\r\n   ========================================================================== */\r\nfunction ensureFontLoaded(fontFamilyStr) {\r\n    if (!fontFamilyStr) return;\r\n    \r\n    // Extract font family name (e.g. 'Playfair Display' from "'Playfair Display', serif")\r\n    const match = fontFamilyStr.match(/'([^']+)'/);\r\n    if (!match) return;\r\n    const fontName = match[1];\r\n    \r\n    // Core fonts are already loaded on startup\r\n    const coreFonts = ['Plus Jakarta Sans', 'Outfit', 'Inter'];\r\n    if (coreFonts.includes(fontName)) return;\r\n    \r\n    const fontId = \`gfont-\${fontName.toLowerCase().replace(/ /g, '-')}\`;\r\n    if (document.getElementById(fontId)) return; // Already loaded\r\n    \r\n    console.log(\`Dynamically loading font: \${fontName}\`);\r\n    const link = document.createElement('link');\r\n    link.id = fontId;\r\n    link.rel = 'stylesheet';\r\n    link.href = \`https://fonts.googleapis.com/css2?family=\${fontName.replace(/ /g, '+')}:wght@400;600;700;800&display=swap\`;\r\n    document.head.appendChild(link);\r\n}\r\n\r\nfunction generateIdCardHtml(emp, template, validityYears = 3) {\r\n    if (template && template.font) {\r\n        ensureFontLoaded(template.font);\r\n    }\r\n`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, insertStr);
  console.log('Replaced successfully (Windows line endings)');
} else if (content.includes(targetStrUnix)) {
  content = content.replace(targetStrUnix, insertStr.replace(/\r\n/g, '\n'));
  console.log('Replaced successfully (Unix line endings)');
} else {
  console.log('Target string not found in app.js!');
  // Let's try matching with regex to be safe
  const regex = /\/\*\s*={10,}\s*5\.\s*LUXURY\s*ID\s*CARD\s*GENERATION\s*SYSTEM\s*={10,}\s*\*\/[\r\n\s]*function\s*generateIdCardHtml\s*\(\s*emp\s*,\s*template\s*,\s*validityYears\s*=\s*3\s*\)\s*\{/;
  if (regex.test(content)) {
    console.log('Found match using regex! Replacing...');
    const match = content.match(regex)[0];
    const isUnix = !match.includes('\r\n');
    const replacement = isUnix ? insertStr.replace(/\r\n/g, '\n') : insertStr;
    content = content.replace(regex, replacement);
    console.log('Replaced successfully using regex!');
  } else {
    console.log('Regex match also failed.');
  }
}

fs.writeFileSync(appJsPath, content, 'utf8');
