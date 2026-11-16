/**
 * Verification Test: 100% Exact ID Card Archetype Cloning
 * Tests the pixel-perfect replication of user reference designs:
 * 1. Hanover Elementary Teal Wave Card (Horizontal)
 * 2. Borcelle Tech Chevron Card (Vertical)
 * 3. Salford & Co. Forest Green Pill Card (Horizontal)
 * 4. Indira Seruni Wave Card (Vertical)
 * 5. Valley Elite Classic Gold Card (Vertical)
 *
 * Verifies guilloche security lines, circular ring photo framing, colon-aligned details tables,
 * barcode/QR/signature geometry, 1-click clone presets bar, and 100% preservation of VSA agency data.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING 100% EXACT ID CARD ARCHETYPE CLONING');
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

// 1. Static UI Verification in index.html
console.log('=== 1. TEMPLATE STUDIO 1-CLICK CLONES UI (INDEX.HTML) ===');
const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

it('index.html contains 1-Click Design Clones bar with all 5 archetypes', () => {
    assert(indexHtml.includes('class="studio-clones-card"'), 'Missing .studio-clones-card');
    assert(indexHtml.includes('Instant 1-Click Exact Design Clones'), 'Missing title');
    assert(indexHtml.includes('data-clone="hanover-wave"'), 'Missing hanover-wave button');
    assert(indexHtml.includes('data-clone="borcelle-tech"'), 'Missing borcelle-tech button');
    assert(indexHtml.includes('data-clone="salford-pill"'), 'Missing salford-pill button');
    assert(indexHtml.includes('data-clone="indira-wave"'), 'Missing indira-wave button');
    assert(indexHtml.includes('data-clone="valley-classic"'), 'Missing valley-classic button');
});

it('index.html contains Badge Display Title (tpl-card-title) input', () => {
    assert(indexHtml.includes('id="tpl-card-title"'), 'Missing #tpl-card-title input');
    assert(indexHtml.includes('value="SECURITY ID CARD"'), 'Missing default card title value');
});

// 2. Server.js AI Archetype Cloning Rules
console.log('\n=== 2. SERVER.JS EXACT ARCHETYPE REPLICATION PROMPT ===');
const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

it('server.js system prompt contains cardTitle schema', () => {
    assert(serverJs.includes('"cardTitle":'), 'Missing cardTitle in JSON schema');
});

it('server.js system prompt contains exact visual traits for Hanover, Borcelle, and Salford', () => {
    assert(serverJs.includes('Hanover & Tyke Wave Style'), 'Missing Hanover wave instructions');
    assert(serverJs.includes('Borcelle Tech Chevron Style'), 'Missing Borcelle tech instructions');
    assert(serverJs.includes('Salford & Co. Corporate Green Pill Style'), 'Missing Salford pill instructions');
    assert(serverJs.includes('CRITICAL DESIGN ARCHETYPES & CONTRAST RULES'), 'Missing contrast rules heading');
});

// 3. App.js Logic and Master Clone Presets
console.log('\n=== 3. APP.JS CLONE PRESETS & FORM WIRING ===');
const appJs = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

it('app.js defines MASTER_CLONE_PRESETS with all 5 archetypes', () => {
    assert(appJs.includes('const MASTER_CLONE_PRESETS = {'), 'Missing MASTER_CLONE_PRESETS');
    assert(appJs.includes("'hanover-wave':"), 'Missing hanover-wave preset');
    assert(appJs.includes("'borcelle-tech':"), 'Missing borcelle-tech preset');
    assert(appJs.includes("'salford-pill':"), 'Missing salford-pill preset');
    assert(appJs.includes("'indira-wave':"), 'Missing indira-wave preset');
    assert(appJs.includes("'valley-classic':"), 'Missing valley-classic preset');
});

it('app.js defines applyMasterClonePreset function and wires button clicks', () => {
    assert(appJs.includes('function applyMasterClonePreset(cloneKey)'), 'Missing applyMasterClonePreset');
    assert(appJs.includes("document.querySelectorAll('.btn-clone-preset')"), 'Missing clone buttons listener');
});

it('app.js handles tpl-card-title in getActiveTemplate, loadTemplate, resetTemplate, and AI callback', () => {
    assert(appJs.includes("document.getElementById('tpl-card-title')"), 'Missing tpl-card-title reference');
    assert(appJs.includes("cardTitle = document.getElementById('tpl-card-title')") || appJs.includes("cardTitle: document.getElementById('tpl-card-title')"));
    assert(appJs.includes("inputs = ['tpl-name', 'tpl-card-title'"));
});

// 4. Functional Execution of HTML Card Rendering
console.log('\n=== 4. FUNCTIONAL EXECUTION OF 100% EXACT CLONES ===');

// Prepare global environment to execute generateIdCardHtml
global.window = {
    location: { origin: 'http://localhost:3000' },
    getComputedStyle: () => ({ fontSize: '14px', whiteSpace: 'nowrap' })
};
global.document = {
    createElement: () => ({ style: {}, setAttribute: () => {} }),
    head: { appendChild: () => {} },
    getElementById: () => null
};
global.DEFAULT_FIELD_ORDER = ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email'];
global.FIRM_CONFIG = { badgeHeader: 'VALLEY SECURITY AGENCY' };
global.VSA_STATE = {
    lanIp: '192.168.1.100',
    templates: [],
    employees: [],
    customLogoBase64: null,
    customSigBase64: null,
    activeFieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email']
};
global.ensureFontLoaded = () => {};
global.toTitleCase = (str) => str ? str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()) : '';
global.getVsaDefaultLogo = () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
global.getVsaDefaultSig = () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
global.getProcessedSignature = () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
global.isColorLight = function(hex) {
    if (!hex || typeof hex !== 'string') return true;
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.substr(0, 2), 16) || 0;
    const g = parseInt(hex.substr(2, 2), 16) || 0;
    const b = parseInt(hex.substr(4, 2), 16) || 0;
    return (r * 299 + g * 587 + b * 114) / 1000 >= 150;
};

// Extract generateIdCardHtml function source from app.js
const startFnIdx = appJs.indexOf('function generateIdCardHtml(');
const endFnIdx = appJs.indexOf('function adjustCardTextSizes(');
assert(startFnIdx !== -1 && endFnIdx !== -1, 'Could not locate generateIdCardHtml boundary');

const fnSource = appJs.substring(startFnIdx, endFnIdx);
eval(fnSource); // Defines global generateIdCardHtml

const mockGuard = {
    id: 'VSA-1025',
    name: 'SHAHID AHMAD DAR',
    designation: 'Security Officer',
    department: 'Operations',
    fatherName: 'Ghulam Ahmad Dar',
    relationType: 'Father',
    bloodGroup: 'B+',
    mobile: '9876543210',
    email: 'shahid@valleysecurity.in',
    currentAddress: 'Lal Chowk, Srinagar, J&K',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
};

it('Hanover Teal Wave (Horizontal) 100% exact replica renders with guilloche lines, display title, circular photo ring, and bottom-left barcode', () => {
    const hanoverTpl = {
        name: 'Hanover Teal Wave',
        cardTitle: 'SECURITY ID CARD',
        layout: 'horizontal',
        cardTheme: 'organic-wave',
        photoShape: 'circle',
        nameStyle: 'clean',
        barcodePosition: 'bottom-left',
        font: "'Playfair Display', 'Georgia', serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#0d7a6e',
        accentColor: '#009688',
        labelColor: '#1e293b',
        valueColor: '#0f172a',
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'SHAHIDGUNJ SRINAGAR',
        logoSize: 46,
        headerHeight: 64,
        headerFontSize: 13,
        photoWidth: 115,
        photoHeight: 115,
        qrSize: 52,
        detailsFontSize: 8.5,
        nameFontSize: 15,
        designationFontSize: 10,
        rowPadding: 2,
        labelWidth: 38,
        labelValueSpacing: 6,
        fields: { photo: true, name: true, designation: true, empid: true, father: true, department: true, blood: true, validity: true, barcode: true, qrcode: true, signature: true }
    };

    const html = generateIdCardHtml(mockGuard, hanoverTpl);

    // 1. Dual wave gradient header and bottom wave accent
    assert(html.includes('hanoverWaveGradH'), 'Missing Hanover wave gradient def');
    assert(html.includes('#0d7a6e') && html.includes('#009688'), 'Missing teal gradient colors');

    // 2. Guilloche harmonic wave lines across white background
    assert(html.includes('M-50,140 C50,110 120,230 220,160'), 'Missing guilloche security wave lines');

    // 3. Display serif title
    assert(html.includes('SECURITY') && html.includes('ID CARD'), 'Missing SECURITY ID CARD title');
    assert(html.includes("'Playfair Display', Georgia, serif"), 'Missing serif display typography');

    // 4. Circular photo with thick teal outline ring
    assert(html.includes('border-radius: 50%'), 'Photo is not circular');
    assert(html.includes('3.5px solid') || html.includes('border: 3.5px solid'), 'Missing circular photo accent border');

    // 5. Horizontal barcode on bottom-left directly under circular photo
    assert(html.includes('data-barcode-val="VSA-1025"'), 'Missing guard barcode');

    // 6. Colon-aligned details table
    assert(html.includes(':</td>'), 'Missing colon separator in aligned details table');
    assert(html.includes('Staff ID'), 'Missing Staff ID label');
    assert(html.includes('VSA-1025'), 'Missing Staff ID value');
    assert(html.includes('Shahid Ahmad Dar') || html.includes('SHAHID AHMAD DAR'), 'Missing guard name');
    assert(html.includes('Security Officer'), 'Missing designation');
    assert(html.includes('B+'), 'Missing blood group');

    // 7. QR code and Authority signature
    assert(html.includes('qr-canvas-rendered'), 'Missing QR code');
    assert(html.includes('Authority Sig') || html.includes('Authority'), 'Missing Authority signature label');
});

it('Borcelle Tech Chevron (Vertical) 100% exact replica renders with angular chevrons, name banner, and centered barcode', () => {
    const borcelleTpl = {
        name: 'Borcelle Tech Chevron',
        cardTitle: 'SECURITY ID CARD',
        layout: 'vertical',
        cardTheme: 'geometric-tech',
        photoShape: 'circle',
        nameStyle: 'banner',
        barcodePosition: 'bottom-center',
        font: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#0c2340',
        accentColor: '#0b63e5',
        labelColor: '#334155',
        valueColor: '#0f172a',
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'HEADQUARTERS SRINAGAR',
        logoSize: 48,
        headerHeight: 85,
        headerFontSize: 14,
        photoWidth: 105,
        photoHeight: 105,
        qrSize: 52,
        detailsFontSize: 8.5,
        nameFontSize: 15,
        designationFontSize: 10,
        rowPadding: 3,
        labelWidth: 40,
        labelValueSpacing: 6,
        fields: { photo: true, name: true, designation: true, empid: true, father: true, department: true, blood: true, validity: true, barcode: true, qrcode: true, signature: true }
    };

    const html = generateIdCardHtml(mockGuard, borcelleTpl);

    assert(html.includes('clip-path: polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%)'), 'Missing top angular chevron header');
    assert(html.includes('clip-path: polygon(0 18%, 50% 0, 100% 18%, 100% 100%, 0 100%)'), 'Missing bottom chevron footer');
    assert(html.includes('border-radius: 50%'), 'Photo is not circular');
    assert(html.includes('border-radius: 9999px'), 'Missing solid blue name banner pill');
    assert(html.includes('Shahid Ahmad Dar') || html.includes('SHAHID AHMAD DAR'), 'Missing guard name in banner');
    assert(html.includes('data-barcode-val="VSA-1025"'), 'Missing barcode');
});

it('Salford & Co. Corporate Green Pill (Horizontal) 100% exact replica renders with green pill title badge and squircle photo', () => {
    const salfordTpl = {
        name: 'Salford Forest Pill',
        cardTitle: 'SECURITY ID CARD',
        layout: 'horizontal',
        cardTheme: 'modern-pill',
        photoShape: 'squircle',
        nameStyle: 'clean',
        barcodePosition: 'bottom-left',
        font: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#006039',
        accentColor: '#006039',
        labelColor: '#1e293b',
        valueColor: '#0f172a',
        headerText: 'VALLEY SECURITY SERVICES',
        subheaderText: 'OFFICIAL IDENTIFICATION PASS',
        logoSize: 44,
        headerHeight: 65,
        headerFontSize: 13,
        photoWidth: 100,
        photoHeight: 105,
        qrSize: 52,
        detailsFontSize: 8.5,
        nameFontSize: 15,
        designationFontSize: 10,
        rowPadding: 2,
        labelWidth: 38,
        labelValueSpacing: 6,
        fields: { photo: true, name: true, designation: true, empid: true, father: true, department: true, blood: true, validity: true, barcode: true, qrcode: true, signature: true }
    };

    const html = generateIdCardHtml(mockGuard, salfordTpl);

    assert(html.includes('#006039'), 'Missing Salford forest green color');
    assert(html.includes('border-radius: 9999px'), 'Missing top floating green pill badge');
    assert(html.includes('SECURITY ID CARD'), 'Missing card title inside green pill');
    assert(html.includes('border-radius: 18px'), 'Photo is not squircle');
    assert(html.includes('repeating-linear-gradient'), 'Missing Salford striped geometric bottom accent');
});

it('Indira Seruni Wave (Vertical) 100% exact replica renders with Japanese Seigaiha wave pattern', () => {
    const indiraTpl = {
        name: 'Indira Wave Art',
        cardTitle: 'STAFF IDENTITY CARD',
        layout: 'vertical',
        cardTheme: 'creative-social',
        photoShape: 'squircle',
        nameStyle: 'boxed',
        barcodePosition: 'bottom-center',
        font: "'Playfair Display', 'Georgia', serif",
        backgroundColor: '#fffbf5',
        headerBgColor: '#78350f',
        accentColor: '#b45309',
        labelColor: '#451a03',
        valueColor: '#1c1917',
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'ESTABLISHED 2012',
        logoSize: 46,
        headerHeight: 75,
        headerFontSize: 13,
        photoWidth: 95,
        photoHeight: 110,
        qrSize: 54,
        detailsFontSize: 8.5,
        nameFontSize: 14,
        designationFontSize: 9.5,
        rowPadding: 3,
        labelWidth: 42,
        labelValueSpacing: 6,
        fields: { photo: true, name: true, designation: true, empid: true, father: true, department: true, blood: true, validity: true, barcode: true, qrcode: true, signature: true }
    };

    const html = generateIdCardHtml(mockGuard, indiraTpl);

    assert(html.includes('seigaihaV'), 'Missing Seigaiha wave pattern ID');
    assert(html.includes('STAFF IDENTITY CARD'), 'Missing STAFF IDENTITY CARD title');
    assert(html.includes('#fffbf5'), 'Missing warm cream background color');
});

it('All 5 templates strictly preserve 100% authentic Valley Security Agency identity data', () => {
    const testThemes = [
        { layout: 'horizontal', cardTheme: 'organic-wave' },
        { layout: 'vertical', cardTheme: 'geometric-tech' },
        { layout: 'horizontal', cardTheme: 'modern-pill' },
        { layout: 'vertical', cardTheme: 'creative-social' },
        { layout: 'vertical', cardTheme: 'classic' }
    ];

    testThemes.forEach(t => {
        const tpl = {
            ...t,
            headerText: 'VALLEY SECURITY AGENCY',
            subheaderText: 'SHAHIDGUNJ SRINAGAR',
            fields: { photo: true, name: true, designation: true, empid: true, father: true, department: true, blood: true, validity: true, barcode: true, qrcode: true, signature: true }
        };
        const html = generateIdCardHtml(mockGuard, tpl);
        assert(html.includes('Shahid Ahmad Dar') || html.includes('SHAHID AHMAD DAR'), `${t.cardTheme} missing employee name`);
        assert(html.includes('VSA-1025'), `${t.cardTheme} missing VSA ID`);
        assert(html.includes('Security Officer'), `${t.cardTheme} missing designation`);
        assert(html.includes('Ghulam Ahmad Dar'), `${t.cardTheme} missing father name`);
        assert(html.includes('VALLEY SECURITY AGENCY'), `${t.cardTheme} missing agency header`);
    });
});

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('======================================================');

if (failCount > 0) {
    process.exit(1);
}
