/**
 * Verification Test: Classic Card Settings Defects Overhaul
 * Validates fixes for:
 * 1. Header brand title vs type badge collision and truncation
 * 2. Details table full-width symmetry and elimination of right-side empty voids
 * 3. Bottom barcode safe white-plate container, margin discipline, and zero wave collisions
 * 4. Proper portrait photo diameter scaling for optical balance
 * 5. Universal multi-theme vertical rendering harmony
 */

const fs = require('fs');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING CLASSIC CARD SETTINGS DEFECTS OVERHAUL');
console.log('======================================================\n');

let passCount = 0;
let failCount = 0;

function it(name, fn) {
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passCount++;
    } catch (err) {
        console.error(`  [FAIL] ${name}`);
        console.error(`         ${err.message}`);
        failCount++;
    }
}

// Read app.js
const appJs = fs.readFileSync('public/app.js', 'utf8');

// Setup mock browser environment
global.window = {
    location: { hostname: 'localhost', host: 'localhost:3000', protocol: 'http:' },
    getComputedStyle: (el) => ({
        fontSize: '13px',
        whiteSpace: 'nowrap',
        clientWidth: 180
    }),
    requestAnimationFrame: (cb) => cb()
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
global.cleanTextVal = (val, toTitle = true) => val || '-';
global.formatDateDDMMYYYYLocal = (d) => '17-11-2026';

// Extract generateIdCardHtml
const startFnIdx = appJs.indexOf('function generateIdCardHtml(');
const endFnIdx = appJs.indexOf('function adjustCardTextSizes(');
assert(startFnIdx !== -1 && endFnIdx !== -1, 'Could not locate generateIdCardHtml boundary');

const fnSource = appJs.substring(startFnIdx, endFnIdx);
eval(fnSource);

const mockEmp = {
    id: 'VSA-1015',
    name: 'Shugufta Iqbal',
    designation: 'General Manager',
    department: 'Valley Security Service Agency',
    fatherName: 'Mohd Iqbal',
    relationType: 'Father',
    bloodGroup: 'O+',
    mobile: '6006018918',
    email: 'shugufta@valleysecurity.in',
    currentAddress: 'Srinagar, Kashmir',
    photo: ''
};

const verticalHanoverTpl = {
    name: 'Hanover Teal Wave (100% Replica)',
    cardTitle: 'SECURITY ID CARD',
    layout: 'vertical',
    cardTheme: 'organic-wave',
    photoShape: 'circle',
    nameStyle: 'clean',
    barcodePosition: 'bottom-left',
    font: "'Plus Jakarta Sans', sans-serif",
    backgroundColor: '#ffffff',
    headerBgColor: '#0d7a6e',
    accentColor: '#009688',
    labelColor: '#475569',
    valueColor: '#0f172a',
    headerText: 'VALLEY SECURITY AGENCY',
    subheaderText: 'SHAHIDGUNJ SRINAGAR',
    logoSize: 44,
    headerHeight: 68,
    headerFontSize: 13,
    photoWidth: 125,
    photoHeight: 125,
    qrSize: 50,
    detailsFontSize: 9,
    nameFontSize: 18,
    designationFontSize: 10.5,
    rowPadding: 2.5,
    labelWidth: 92,
    labelValueSpacing: 6,
    fields: { photo: true, name: true, designation: true, empid: true, father: true, department: true, blood: true, validity: true, barcode: true, qrcode: true, signature: true }
};

console.log('=== 1. VERTICAL HEADER COLLISION ELIMINATION ===');

it('Vertical organic-wave renders brand title and card type badge in distinct non-colliding flex containers', () => {
    const html = generateIdCardHtml(mockEmp, verticalHanoverTpl);
    assert(html.includes('id-portrait-brand'), 'Missing id-portrait-brand container');
    assert(html.includes('id-portrait-type-wrapper'), 'Missing id-portrait-type-wrapper container');
    assert(html.includes('id-portrait-type-badge'), 'Missing id-portrait-type-badge pill element');
    assert(html.includes('SECURITY ID CARD'), 'Missing full badge text SECURITY ID CARD');
    // Ensure no broken truncated line wrap
    assert(!html.includes('SECURIT<br>ID CA'), 'Detected clipped text collision');
});

it('Brand header enforces flex: 1 and min-width: 0 with font clamping', () => {
    const html = generateIdCardHtml(mockEmp, verticalHanoverTpl);
    assert(html.includes('flex: 1; min-width: 0'), 'Missing flex: 1 min-width: 0 on brand container');
    assert(html.includes('VALLEY SECURITY AGENCY'), 'Missing agency title');
    assert(html.includes('SHAHIDGUNJ SRINAGAR'), 'Missing agency subtitle');
});

console.log('\n=== 2. DETAILS TABLE BALANCED SYMMETRY & VOID ELIMINATION ===');

it('Details table is wrapped in a structured data card container', () => {
    const html = generateIdCardHtml(mockEmp, verticalHanoverTpl);
    assert(html.includes('border-radius: 8px'), 'Missing rounded details card container');
    assert(html.includes('table-layout: fixed'), 'Missing fixed table layout');
});

it('Table rows use balanced percentage widths and dashed dividers spanning full width', () => {
    const html = generateIdCardHtml(mockEmp, verticalHanoverTpl);
    assert(html.includes('width: 33%') || html.includes('width: 32%'), 'Missing balanced label percentage width');
    assert(html.includes('border-bottom: 1px dashed') || html.includes('1px dashed rgba'), 'Missing hairline row dividers');
    assert(html.includes('Staff ID'), 'Missing Staff ID');
    assert(html.includes('VSA-1015'), 'Missing VSA-1015');
    assert(html.includes('Mohd Iqbal'), 'Missing Father name');
    assert(html.includes('Valley Security Service Agency'), 'Missing Department');
    assert(html.includes('O+'), 'Missing Blood Group');
    assert(html.includes('6006018918'), 'Missing Contact');
});

console.log('\n=== 3. BOTTOM BARCODE WHITE-PLATE PROTECTION & EDGE MARGINS ===');

it('Barcode is enclosed in a white protective plate to prevent background wave collisions', () => {
    const html = generateIdCardHtml(mockEmp, verticalHanoverTpl);
    assert(html.includes('background: #ffffff; padding: 2px 8px; border-radius: 4px'), 'Missing white protective plate on barcode');
    assert(html.includes('data-barcode-val="VSA-1015"'), 'Missing barcode data attribute');
});

it('Barcode has safe margins and does not touch bottom card edge', () => {
    const html = generateIdCardHtml(mockEmp, verticalHanoverTpl);
    assert(html.includes('margin: 3px 0 4px 0') || html.includes('margin-top: 3px'), 'Missing barcode safe margins');
});

it('QR code and signature are balanced with compact dimensions', () => {
    const html = generateIdCardHtml(mockEmp, verticalHanoverTpl);
    assert(html.includes('data-qr-size="42"'), 'QR code should be compact 42px canvas');
    assert(html.includes('Authority Sig'), 'Missing signature label');
    assert(html.includes('VSA property'), 'Missing property notice');
});

console.log('\n=== 4. OPTICAL BALANCE & PHOTO PROPORTION ===');

it('Circular photo diameter in vertical mode is constrained to avoid pushing content off card', () => {
    const html = generateIdCardHtml(mockEmp, verticalHanoverTpl);
    assert(html.includes('width: 98px; height: 98px'), 'Circular photo should be constrained to 98px in vertical mode');
    assert(html.includes('border-radius: 50%'), 'Photo must be circular');
});

console.log('\n=== 5. UNIVERSAL MULTI-THEME HARMONY ===');

const themes = ['geometric-tech', 'modern-pill', 'creative-social', 'classic'];
themes.forEach(th => {
    it(`Theme ${th} (Vertical) renders with structured details and safe barcode`, () => {
        const tpl = {
            ...verticalHanoverTpl,
            cardTheme: th,
            barcodePosition: 'bottom-center'
        };
        const html = generateIdCardHtml(mockEmp, tpl);
        assert(html.includes('id-card-portrait'), `${th} missing portrait class`);
        assert(html.includes('cleanDetailsRowsHtml') === false, `${th} failed to evaluate table rows`);
        assert(html.includes('VSA-1015'), `${th} missing employee ID`);
        assert(html.includes('Shugufta Iqbal') || html.includes('SHUGUFTA IQBAL'), `${th} missing employee name`);
        assert(html.includes('data-barcode-val="VSA-1015"'), `${th} missing barcode`);
    });
});

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('======================================================');

if (failCount > 0) {
    process.exit(1);
}
