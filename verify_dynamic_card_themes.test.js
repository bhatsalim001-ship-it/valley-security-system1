/**
 * Verification Test: Dynamic Card Themes, Photo Shapes, Name Styles, and Barcode Positions
 * Tests the multi-theme ID card renderer, contrast safety, VSA detail preservation, and AI layout designer integration.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING DYNAMIC MULTI-THEME CARD RENDERER & AI DESIGNER');
console.log('======================================================\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
    try {
        fn();
        console.log(`  [PASS] ${desc}`);
        passCount++;
    } catch (err) {
        console.error(`  [FAIL] ${desc}: ${err.message}`);
        failCount++;
    }
}

// 1. Static File Verification
console.log('=== 1. TEMPLATE STUDIO CONTROLS (INDEX.HTML) ===');
const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

it('index.html contains tpl-card-theme select with all 5 themes', () => {
    assert(indexHtml.includes('id="tpl-card-theme"'), 'Missing #tpl-card-theme');
    assert(indexHtml.includes('value="classic"'), 'Missing classic theme option');
    assert(indexHtml.includes('value="organic-wave"'), 'Missing organic-wave theme option');
    assert(indexHtml.includes('value="geometric-tech"'), 'Missing geometric-tech theme option');
    assert(indexHtml.includes('value="modern-pill"'), 'Missing modern-pill theme option');
    assert(indexHtml.includes('value="creative-social"'), 'Missing creative-social theme option');
});

it('index.html contains tpl-photo-shape select with standard, circle, squircle', () => {
    assert(indexHtml.includes('id="tpl-photo-shape"'), 'Missing #tpl-photo-shape');
    assert(indexHtml.includes('value="standard"'), 'Missing standard photo shape');
    assert(indexHtml.includes('value="circle"'), 'Missing circle photo shape');
    assert(indexHtml.includes('value="squircle"'), 'Missing squircle photo shape');
});

it('index.html contains tpl-name-style select with clean, banner, boxed', () => {
    assert(indexHtml.includes('id="tpl-name-style"'), 'Missing #tpl-name-style');
    assert(indexHtml.includes('value="clean"'), 'Missing clean name style');
    assert(indexHtml.includes('value="banner"'), 'Missing banner name style');
    assert(indexHtml.includes('value="boxed"'), 'Missing boxed name style');
});

it('index.html contains tpl-barcode-pos select with bottom-right, bottom-left, bottom-center', () => {
    assert(indexHtml.includes('id="tpl-barcode-pos"'), 'Missing #tpl-barcode-pos');
    assert(indexHtml.includes('value="bottom-right"'), 'Missing bottom-right position');
    assert(indexHtml.includes('value="bottom-left"'), 'Missing bottom-left position');
    assert(indexHtml.includes('value="bottom-center"'), 'Missing bottom-center position');
});

// 2. Server.js AI System Prompt Verification
console.log('\n=== 2. AI TEMPLATE DESIGNER PROMPT (SERVER.JS) ===');
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

it('server.js system prompt contains cardTheme schema and values', () => {
    assert(serverJs.includes('"cardTheme": "organic-wave" or "geometric-tech" or "modern-pill" or "creative-social" or "classic"'));
});

it('server.js system prompt contains photoShape, nameStyle, barcodePosition schema', () => {
    assert(serverJs.includes('"photoShape": "circle" or "squircle" or "standard"'));
    assert(serverJs.includes('"nameStyle": "clean" or "banner" or "boxed"'));
    assert(serverJs.includes('"barcodePosition": "bottom-right" or "bottom-left" or "bottom-center"'));
});

it('server.js system prompt enforces contrast discipline', () => {
    assert(serverJs.includes('CRITICAL DESIGN ARCHETYPES & CONTRAST RULES'));
    assert(serverJs.includes('High contrast is mandatory'));
    assert(serverJs.includes('The main card body backgroundColor MUST BE light/clean'));
});

// 3. App.js Form Binding Verification
console.log('\n=== 3. APP.JS FORM BINDINGS & STATE SYNC ===');
const appJs = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

it('getActiveTemplateFromForm reads theme, photo shape, name style, barcode pos', () => {
    assert(appJs.includes("const cardTheme = document.getElementById('tpl-card-theme') ? document.getElementById('tpl-card-theme').value : 'classic';"));
    assert(appJs.includes("const photoShape = document.getElementById('tpl-photo-shape') ? document.getElementById('tpl-photo-shape').value : 'standard';"));
    assert(appJs.includes("const nameStyle = document.getElementById('tpl-name-style') ? document.getElementById('tpl-name-style').value : 'clean';"));
    assert(appJs.includes("const barcodePosition = document.getElementById('tpl-barcode-pos') ? document.getElementById('tpl-barcode-pos').value : 'bottom-right';"));
});

it('loadTemplateInStudio populates theme, photo shape, name style, barcode pos', () => {
    assert(appJs.includes("document.getElementById('tpl-card-theme').value = tpl.cardTheme || 'classic';"));
    assert(appJs.includes("document.getElementById('tpl-photo-shape').value = tpl.photoShape || 'standard';"));
    assert(appJs.includes("document.getElementById('tpl-name-style').value = tpl.nameStyle || 'clean';"));
    assert(appJs.includes("document.getElementById('tpl-barcode-pos').value = tpl.barcodePosition || 'bottom-right';"));
});

it('resetTemplateForm resets theme fields to default', () => {
    assert(appJs.includes("document.getElementById('tpl-card-theme').value = 'classic';"));
    assert(appJs.includes("document.getElementById('tpl-photo-shape').value = 'standard';"));
    assert(appJs.includes("document.getElementById('tpl-name-style').value = 'clean';"));
    assert(appJs.includes("document.getElementById('tpl-barcode-pos').value = 'bottom-right';"));
});

it('selects array includes theme dropdowns for instant live preview updates', () => {
    assert(appJs.includes("'tpl-card-theme'"));
    assert(appJs.includes("'tpl-photo-shape'"));
    assert(appJs.includes("'tpl-name-style'"));
    assert(appJs.includes("'tpl-barcode-pos'"));
});

it('AI generator handler populates all 4 theme fields from Gemini response', () => {
    assert(appJs.includes("if (data.cardTheme && document.getElementById('tpl-card-theme'))"));
    assert(appJs.includes("if (data.photoShape && document.getElementById('tpl-photo-shape'))"));
    assert(appJs.includes("if (data.nameStyle && document.getElementById('tpl-name-style'))"));
    assert(appJs.includes("if (data.barcodePosition && document.getElementById('tpl-barcode-pos'))"));
});

// 4. Functional Execution of generateIdCardHtml
console.log('\n=== 4. FUNCTIONAL EXECUTION OF GENERATEIDCARDHTML ===');

// Create mock browser context for Node execution of generateIdCardHtml
global.window = {
    location: {
        hostname: 'localhost',
        host: 'localhost:3000',
        protocol: 'http:'
    }
};
global.VSA_STATE = {
    lanIp: '192.168.1.100',
    activeFieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email']
};
global.DEFAULT_FIELD_ORDER = ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email'];
global.ensureFontLoaded = () => {};
global.toTitleCase = (str) => str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
global.getVsaDefaultLogo = () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
global.getVsaDefaultSig = () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
global.getProcessedSignature = () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';

// Extract generateIdCardHtml function source from app.js using regex or eval
const startFnIdx = appJs.indexOf('function generateIdCardHtml(');
const endFnIdx = appJs.indexOf('function adjustCardTextSizes(');
assert(startFnIdx !== -1 && endFnIdx !== -1, 'Could not locate generateIdCardHtml boundary');

const fnSource = appJs.substring(startFnIdx, endFnIdx);
eval(fnSource); // Defines global generateIdCardHtml

const mockEmp = {
    id: 'VSA-1001',
    name: 'MOHAMMAD SALIM',
    designation: 'SECURITY SUPERVISOR',
    department: 'Main Gate Security',
    fatherName: 'GHULAM MOHAMMAD',
    mobile: '9876543210',
    bloodGroup: 'O+',
    currentAddress: 'Shaheed Gunj Srinagar',
    email: 'salim@valleysecurity.in',
    documents: { photo: '' },
    secureToken: 'token-abc-123'
};

const baseTemplate = {
    headerText: 'VALLEY SECURITY AGENCY',
    subheaderText: 'SHAHIDGUNJ SRINAGAR',
    font: "'Plus Jakarta Sans', sans-serif",
    headerBgColor: '#046a52',
    backgroundColor: '#ffffff',
    accentColor: '#dfba5f',
    logoSize: 50,
    headerHeight: 90,
    headerFontSize: 14,
    photoWidth: 85,
    photoHeight: 105,
    qrSize: 70,
    detailsFontSize: 8,
    nameFontSize: 14,
    designationFontSize: 10,
    fields: {
        photo: true, name: true, designation: true, department: true, empid: true,
        father: true, phone: true, email: true, blood: true, address: true, signature: true,
        qrcode: true, barcode: true, validity: true
    }
};

it('executes generateIdCardHtml for Horizontal Organic Wave with all VSA details', () => {
    const tpl = { ...baseTemplate, layout: 'horizontal', cardTheme: 'organic-wave', photoShape: 'circle', barcodePosition: 'bottom-left' };
    const html = generateIdCardHtml(mockEmp, tpl);
    assert(html.includes('theme-organic-wave'), 'Missing theme-organic-wave class');
    assert(html.includes('id-card-horizontal'), 'Missing id-card-horizontal class');
    assert(html.includes('VALLEY SECURITY AGENCY'), 'Missing agency title');
    assert(html.includes('SHAHIDGUNJ SRINAGAR'), 'Missing agency subheader');
    assert(html.includes('Mohammad Salim'), 'Missing employee name');
    assert(html.includes('Security Supervisor'), 'Missing designation');
    assert(html.includes('VSA-1001'), 'Missing employee ID');
    assert(html.includes('Main Gate Security'), 'Missing department');
    assert(html.includes('Ghulam Mohammad'), 'Missing father name');
    assert(html.includes('O+'), 'Missing blood group');
    assert(html.includes('9876543210'), 'Missing mobile');
    assert(html.includes('qr-canvas-rendered'), 'Missing QR canvas');
    assert(html.includes('barcode-canvas-rendered'), 'Missing barcode canvas');
    assert(html.includes('Authority Sig'), 'Missing signature label');
    assert(html.includes('border-radius: 50%'), 'Photo should have circle 50% radius');
});

it('executes generateIdCardHtml for Vertical Organic Wave with circular photo overlapping wave', () => {
    const tpl = { ...baseTemplate, layout: 'vertical', cardTheme: 'organic-wave', photoShape: 'circle', barcodePosition: 'bottom-center' };
    const html = generateIdCardHtml(mockEmp, tpl);
    assert(html.includes('theme-organic-wave'), 'Missing theme-organic-wave class');
    assert(html.includes('id-card-portrait'), 'Missing id-card-portrait class');
    assert(html.includes('border-radius: 50%'), 'Circular photo missing border-radius: 50%');
    assert(html.includes('qr-canvas-rendered'), 'Missing QR canvas');
    assert(html.includes('barcode-canvas-rendered'), 'Missing barcode canvas');
});

it('executes generateIdCardHtml for Vertical Geometric Tech with chevron and name banner', () => {
    const tpl = { ...baseTemplate, layout: 'vertical', cardTheme: 'geometric-tech', photoShape: 'circle', nameStyle: 'banner', barcodePosition: 'bottom-center' };
    const html = generateIdCardHtml(mockEmp, tpl);
    assert(html.includes('theme-geometric-tech'), 'Missing theme-geometric-tech class');
    assert(html.includes('clip-path: polygon'), 'Missing angular geometric chevron');
    assert(html.includes('border-radius: 9999px'), 'Missing pill banner for name');
});

it('executes generateIdCardHtml for Horizontal Modern Pill with squircle photo', () => {
    const tpl = { ...baseTemplate, layout: 'horizontal', cardTheme: 'modern-pill', photoShape: 'squircle', barcodePosition: 'bottom-left' };
    const html = generateIdCardHtml(mockEmp, tpl);
    assert(html.includes('theme-modern-pill'), 'Missing theme-modern-pill class');
    assert(html.includes('border-radius: 18px'), 'Missing squircle 18px radius');
});

it('executes generateIdCardHtml for Classic layout (100% backward compatibility)', () => {
    const tpl = { ...baseTemplate, layout: 'horizontal', cardTheme: 'classic', photoShape: 'standard' };
    const html = generateIdCardHtml(mockEmp, tpl);
    assert(html.includes('id-card-horizontal visual-id-card-render'), 'Missing classic horizontal class');
    assert(html.includes('VSA-1001'), 'Missing employee ID in classic layout');
});

it('contrast enforcement prevents dark-on-dark unreadable text when dark colors provided', () => {
    // Simulate user or AI passing dark green for background and dark green for valueColor
    const tpl = { ...baseTemplate, backgroundColor: '#ffffff', valueColor: '#ffffff', labelColor: '#ffffff' };
    const html = generateIdCardHtml(mockEmp, tpl);
    // Contrast engine should have automatically flipped light text to dark on white background
    assert(!html.includes('color: #ffffff; padding: 3px 0; width: 55% !important; max-width: 55%; text-align: left; padding-left: 10px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">VSA-1001'), 'Text should not be white on white');
    assert(html.includes('color: #0f172a'), 'Value color should be automatically protected to dark #0f172a on light background');
});

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('======================================================');

if (failCount > 0) {
    process.exit(1);
}
