/**
 * VERIFY_PHASE3_ORIENTATION_ENGINE.TEST.JS
 * Comprehensive Verification Test Suite for Project Omega Phase 3:
 * Universal Horizontal and Vertical Orientation Engine
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING PROJECT OMEGA PHASE 3: UNIVERSAL ORIENTATION ENGINE');
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  [PASS] ${description}`);
        passedTests++;
    } catch (err) {
        console.error(`  [FAIL] ${description}`);
        console.error(`         ${err.message}`);
    }
}

const htmlPath = path.join(__dirname, 'public', 'index.html');
const cssPath = path.join(__dirname, 'public', 'styles.css');
const appJsPath = path.join(__dirname, 'public', 'app.js');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

// ============================================================================
// 1. STUDIO UI & COMMAND BAR CONTROLS (INDEX.HTML)
// ============================================================================
console.log('=== 1. STUDIO UI & ORIENTATION CONTROLS (INDEX.HTML) ===');

test('index.html contains Orientation dropdown with Horizontal, Vertical, and Custom', () => {
    assert(htmlContent.includes('id="uice-orientation-sel"'), 'Missing uice-orientation-sel dropdown');
    assert(htmlContent.includes('value="horizontal"'), 'Missing horizontal option');
    assert(htmlContent.includes('value="vertical"'), 'Missing vertical option');
    assert(htmlContent.includes('value="custom"'), 'Missing custom dimensions option');
});

test('index.html contains Convert, Auto-Arrange, Revert, and Reset buttons', () => {
    assert(htmlContent.includes('id="btn-uice-convert-orient"'), 'Missing Convert button');
    assert(htmlContent.includes('id="btn-uice-auto-arrange"'), 'Missing Auto-Arrange button');
    assert(htmlContent.includes('id="btn-uice-revert-layout"'), 'Missing Revert button');
    assert(htmlContent.includes('id="btn-uice-reset-layout"'), 'Missing Reset button');
});

test('index.html contains Custom Dimensions modal with presets and reflow control', () => {
    assert(htmlContent.includes('id="uice-custom-dim-modal"'), 'Missing Custom Dimensions modal');
    assert(htmlContent.includes('id="form-uice-custom-dim"'), 'Missing Custom Dimensions form');
    assert(htmlContent.includes('id="uice-custom-width"'), 'Missing Custom width input');
    assert(htmlContent.includes('id="uice-custom-height"'), 'Missing Custom height input');
    assert(htmlContent.includes('id="uice-custom-reflow"'), 'Missing Custom reflow checkbox');
    assert(htmlContent.includes('class="uice-preset-dim-btn"'), 'Missing preset dimension buttons');
});

// ============================================================================
// 2. CSS STYLING ARCHITECTURE (STYLES.CSS)
// ============================================================================
console.log('\n=== 2. CSS STYLING ARCHITECTURE (STYLES.CSS) ===');

test('styles.css defines preset dimension button classes', () => {
    assert(cssContent.includes('.uice-preset-dim-btn'), 'Missing .uice-preset-dim-btn styling');
    assert(cssContent.includes('.uice-preset-dim-btn:hover'), 'Missing .uice-preset-dim-btn:hover');
    assert(cssContent.includes('.uice-preset-dim-btn.active'), 'Missing .uice-preset-dim-btn.active');
});

// ============================================================================
// 3. JAVASCRIPT LOGIC & ENGINE RUNTIME (APP.JS)
// ============================================================================
console.log('\n=== 3. ENGINE RUNTIME METHOD DECLARATIONS (APP.JS) ===');

test('app.js defines transformLayoutBetweenOrientations function', () => {
    assert(appJsContent.includes('function transformLayoutBetweenOrientations('), 'Missing transformLayoutBetweenOrientations');
});

test('app.js defines reflowLayoutForDimensions function', () => {
    assert(appJsContent.includes('function reflowLayoutForDimensions('), 'Missing reflowLayoutForDimensions');
});

test('app.js defines switchUiceOrientation with dual-layout preservation', () => {
    assert(appJsContent.includes('function switchUiceOrientation('), 'Missing switchUiceOrientation');
});

test('app.js defines convertUiceOrientation with confirmation and adaptation', () => {
    assert(appJsContent.includes('function convertUiceOrientation('), 'Missing convertUiceOrientation');
});

test('app.js defines revertUiceLayout with initial snapshot restoration', () => {
    assert(appJsContent.includes('function revertUiceLayout('), 'Missing revertUiceLayout');
});

test('app.js defines custom dimension modal and apply functions', () => {
    assert(appJsContent.includes('function openUiceCustomDimModal('), 'Missing openUiceCustomDimModal');
    assert(appJsContent.includes('function closeUiceCustomDimModal('), 'Missing closeUiceCustomDimModal');
    assert(appJsContent.includes('function applyUiceCustomDimensions('), 'Missing applyUiceCustomDimensions');
    assert(appJsContent.includes('function handleUiceCustomDimSubmit('), 'Missing handleUiceCustomDimSubmit');
});

// ============================================================================
// 4. FUNCTIONAL EXECUTION & MATHEMATICAL LOGIC
// ============================================================================
console.log('\n=== 4. FUNCTIONAL EXECUTION & MATHEMATICAL LOGIC ===');

// Extract getUiceDefaultElements
const getDefaultsFn = new Function(
    appJsContent.match(/function getUiceDefaultElements\([\s\S]*?\n\}/)[0] + 
    '; return getUiceDefaultElements;'
)();

// Extract convertLegacyTemplateToUice
const convertLegacyFn = new Function(
    appJsContent.match(/function getUiceDefaultElements\([\s\S]*?\n\}/)[0] + ';' +
    appJsContent.match(/function convertLegacyTemplateToUice\([\s\S]*?\n\}/)[0] + 
    '; return convertLegacyTemplateToUice;'
)();

// Extract transformLayoutBetweenOrientations & reflowLayoutForDimensions
const transformFn = new Function(
    appJsContent.match(/function getUiceDefaultElements\([\s\S]*?\n\}/)[0] + ';' +
    appJsContent.match(/function transformLayoutBetweenOrientations\([\s\S]*?\n\}/)[0] + 
    '; return transformLayoutBetweenOrientations;'
)();

const reflowFn = new Function(
    appJsContent.match(/function getUiceDefaultElements\([\s\S]*?\n\}/)[0] + ';' +
    appJsContent.match(/function transformLayoutBetweenOrientations\([\s\S]*?\n\}/)[0] + ';' +
    appJsContent.match(/function reflowLayoutForDimensions\([\s\S]*?\n\}/)[0] + 
    '; return reflowLayoutForDimensions;'
)();

test('Dual-Layout Independence: Modifying horizontal does NOT alter vertical layout', () => {
    const template = {
        id: 'tpl-test-1',
        name: 'Test Dual Isolation',
        layout: 'horizontal'
    };
    convertLegacyFn(template);

    // Initial state check
    const horizPhoto = template.layouts.horizontal.elements.find(e => e.type === 'employee-photo');
    const vertPhoto = template.layouts.vertical.elements.find(e => e.type === 'employee-photo');
    assert.strictEqual(horizPhoto.x, 18, 'Initial horizontal photo X is 18');
    assert.strictEqual(vertPhoto.x, 105, 'Initial vertical photo X is 105');

    // Mutate horizontal photo position and name color
    horizPhoto.x = 44;
    horizPhoto.y = 88;
    const horizName = template.layouts.horizontal.elements.find(e => e.type === 'employee-name');
    horizName.properties.color = '#e11d48';

    // Verify vertical layout is 100% UNTOUCHED
    const vertPhotoAfter = template.layouts.vertical.elements.find(e => e.type === 'employee-photo');
    const vertNameAfter = template.layouts.vertical.elements.find(e => e.type === 'employee-name');

    assert.strictEqual(vertPhotoAfter.x, 105, 'Vertical photo X must still be 105');
    assert.strictEqual(vertPhotoAfter.y, 98, 'Vertical photo Y must still be 98');
    assert.strictEqual(vertNameAfter.properties.color, '#0f172a', 'Vertical name color must remain #0f172a');
});

test('Dual-Layout Independence: Modifying vertical does NOT alter horizontal layout', () => {
    const template = {
        id: 'tpl-test-2',
        name: 'Test Dual Isolation 2',
        layout: 'vertical'
    };
    convertLegacyFn(template);

    const vertBarcode = template.layouts.vertical.elements.find(e => e.type === 'barcode');
    const horizBarcode = template.layouts.horizontal.elements.find(e => e.type === 'barcode');
    assert.strictEqual(vertBarcode.y, 418, 'Initial vertical barcode Y is 418');
    assert.strictEqual(horizBarcode.y, 194, 'Initial horizontal barcode Y is 194');

    // Mutate vertical barcode
    vertBarcode.y = 440;
    vertBarcode.width = 150;

    // Verify horizontal barcode is 100% UNTOUCHED
    const horizBarcodeAfter = template.layouts.horizontal.elements.find(e => e.type === 'barcode');
    assert.strictEqual(horizBarcodeAfter.y, 194, 'Horizontal barcode Y must still be 194');
    assert.strictEqual(horizBarcodeAfter.width, 122, 'Horizontal barcode width must still be 122');
});

test('Intelligent Horizontal to Vertical Transformation: Photo centered, table expanded, footer balanced', () => {
    const horizLayout = {
        width: 500,
        height: 320,
        background: { color: '#f8fafc', headerBg: '#1e3a8a', accent: '#3b82f6', borderRadius: 16 },
        elements: getDefaultsFn('horizontal', {
            headerText: 'SECURITY COMMAND VSA',
            subheaderText: 'AIRPORT DEFENCE UNIT',
            cardTitle: 'CHIEF INSPECTOR PASS'
        })
    };

    // Give photo custom styling
    const sourcePhoto = horizLayout.elements.find(e => e.type === 'employee-photo');
    sourcePhoto.properties.shape = 'rounded';
    sourcePhoto.properties.borderColor = '#3b82f6';
    sourcePhoto.properties.borderWidth = 4;

    const vertLayout = transformFn(horizLayout, 320, 500, 'vertical');

    assert.strictEqual(vertLayout.width, 320, 'Target width must be 320');
    assert.strictEqual(vertLayout.height, 500, 'Target height must be 500');
    assert.strictEqual(vertLayout.background.headerBg, '#1e3a8a', 'Header background color must be preserved');
    assert.strictEqual(vertLayout.background.accent, '#3b82f6', 'Accent color must be preserved');

    // Photo check
    const photo = vertLayout.elements.find(e => e.type === 'employee-photo');
    assert(photo, 'Photo element must exist in vertical layout');
    assert.strictEqual(photo.x, Math.round((320 - photo.width) / 2), 'Photo must be centered horizontally');
    assert.strictEqual(photo.properties.shape, 'rounded', 'Photo custom shape must be preserved');
    assert.strictEqual(photo.properties.borderColor, '#3b82f6', 'Photo border color must be preserved');

    // Name & Designation check
    const name = vertLayout.elements.find(e => e.type === 'employee-name');
    const desig = vertLayout.elements.find(e => e.type === 'designation');
    assert(name && desig, 'Name and designation must exist');
    assert.strictEqual(name.properties.textAlign, 'center', 'Vertical name should be centered');
    assert.strictEqual(desig.properties.textAlign, 'center', 'Vertical designation should be centered');
    assert(name.y > photo.y + photo.height, 'Name must sit below photo');
    assert(desig.y >= name.y + name.height, 'Designation must sit below name');

    // Table check
    const table = vertLayout.elements.find(e => e.type === 'details-table');
    assert(table, 'Details table must exist');
    assert.strictEqual(table.width, 288, 'Vertical table must span readable card width (288px)');
    assert(table.y >= desig.y + desig.height, 'Table must sit below designation');

    // Security lockup in footer
    const barcode = vertLayout.elements.find(e => e.type === 'barcode');
    const signature = vertLayout.elements.find(e => e.type === 'signature');
    const qr = vertLayout.elements.find(e => e.type === 'qr-code');

    assert(barcode && signature && qr, 'Footer must contain barcode, signature, and QR code');
    assert(barcode.x < signature.x, 'Barcode must be on the left of signature');
    assert(signature.x < qr.x, 'Signature must be on the left of QR code');
    assert(barcode.y >= 400 && qr.y >= 400, 'Security lockup must be in footer (y >= 400)');

    // Scannability check
    assert(qr.width >= 44 && qr.height >= 44, 'QR code dimensions must be scannable (>= 44px)');
    assert(barcode.width >= 100 && barcode.height >= 22, 'Barcode dimensions must be scannable (w>=100, h>=22)');
});

test('Intelligent Vertical to Horizontal Transformation: Pillar & multi-column composition', () => {
    const vertLayout = {
        width: 320,
        height: 500,
        background: { color: '#ffffff', headerBg: '#0f172a', accent: '#10b981', borderRadius: 14 },
        elements: getDefaultsFn('vertical', {
            headerText: 'VALLEY SECURITY AGENCY',
            cardTitle: 'OFFICIAL PASS'
        })
    };

    const horizLayout = transformFn(vertLayout, 500, 320, 'horizontal');

    assert.strictEqual(horizLayout.width, 500, 'Target width must be 500');
    assert.strictEqual(horizLayout.height, 320, 'Target height must be 320');

    // Left Pillar check
    const photo = horizLayout.elements.find(e => e.type === 'employee-photo');
    const barcode = horizLayout.elements.find(e => e.type === 'barcode');
    assert(photo && barcode, 'Photo and barcode must exist in horizontal layout');
    assert(photo.x < 50, 'Photo must be in left pillar (x < 50)');
    assert(barcode.x < 50, 'Barcode must be in left pillar under photo (x < 50)');
    assert(barcode.y > photo.y + photo.height, 'Barcode must be below photo in left pillar');

    // Right Column check
    const name = horizLayout.elements.find(e => e.type === 'employee-name');
    const desig = horizLayout.elements.find(e => e.type === 'designation');
    const table = horizLayout.elements.find(e => e.type === 'details-table');
    const qr = horizLayout.elements.find(e => e.type === 'qr-code');

    assert(name && desig && table && qr, 'Right column elements must exist');
    assert(name.x >= 140, 'Name must be in right column (x >= 140)');
    assert.strictEqual(name.properties.textAlign, 'left', 'Horizontal name should be left-aligned');
    assert(table.x >= 140, 'Table must be in right column (x >= 140)');
    assert(qr.x >= 400, 'QR code must be in bottom right corner (x >= 400)');

    // Scannability check
    assert(qr.width >= 44 && qr.height >= 44, 'QR code must satisfy scannability sentinel');
    assert(barcode.width >= 100 && barcode.height >= 22, 'Barcode must satisfy scannability sentinel');
});

test('Custom Dimensions Reflow: Non-standard sizes reflow smoothly without boundary violation', () => {
    const layout = {
        width: 500,
        height: 320,
        background: { color: '#ffffff' },
        elements: getDefaultsFn('horizontal')
    };

    // Reflow to Event Badge (400 x 600)
    reflowFn(layout, 400, 600);
    assert.strictEqual(layout.width, 400, 'Layout width must update to 400');
    assert.strictEqual(layout.height, 600, 'Layout height must update to 600');

    layout.elements.forEach(el => {
        assert(el.x >= 0, `Element ${el.name || el.type} X cannot be negative (${el.x})`);
        assert(el.y >= 0, `Element ${el.name || el.type} Y cannot be negative (${el.y})`);
        assert(el.x + el.width <= 400, `Element ${el.name || el.type} exceeds card width (${el.x + el.width} > 400)`);
        assert(el.y + el.height <= 600, `Element ${el.name || el.type} exceeds card height (${el.y + el.height} > 600)`);
    });

    // Reflow to Wide Badge (650 x 380)
    reflowFn(layout, 650, 380);
    assert.strictEqual(layout.width, 650, 'Layout width must update to 650');
    assert.strictEqual(layout.height, 380, 'Layout height must update to 380');

    layout.elements.forEach(el => {
        assert(el.x >= 0, `Element ${el.name || el.type} X cannot be negative (${el.x})`);
        assert(el.y >= 0, `Element ${el.name || el.type} Y cannot be negative (${el.y})`);
        assert(el.x + el.width <= 650, `Element ${el.name || el.type} exceeds card width (${el.x + el.width} > 650)`);
        assert(el.y + el.height <= 380, `Element ${el.name || el.type} exceeds card height (${el.y + el.height} > 380)`);
    });
});

test('Scannability Sentinel Guarantee: Enforces minimum size protection across all transforms', () => {
    // Malformed layout with tiny QR and squashed barcode
    const squashedLayout = {
        width: 500,
        height: 320,
        background: { color: '#ffffff' },
        elements: [
            { id: 'el-qr', type: 'qr-code', x: 200, y: 100, width: 20, height: 20, properties: {} },
            { id: 'el-bar', type: 'barcode', x: 50, y: 50, width: 40, height: 10, properties: {} }
        ]
    };

    const protectedLayout = transformFn(squashedLayout, 320, 500, 'vertical');
    const qr = protectedLayout.elements.find(e => e.type === 'qr-code');
    const barcode = protectedLayout.elements.find(e => e.type === 'barcode');

    assert(qr.width >= 44 && qr.height >= 44, `Tiny QR must be enlarged to at least 44px (got ${qr.width})`);
    assert(barcode.width >= 100 && barcode.height >= 22, `Squashed barcode must be enlarged to at least 100x22 (got ${barcode.width}x${barcode.height})`);
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n======================================================');
console.log(`TEST RESULTS: ${passedTests} passed, ${totalTests - passedTests} failed out of ${totalTests} total tests`);
console.log('======================================================\n');

if (totalTests - passedTests > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
