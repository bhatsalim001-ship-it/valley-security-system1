/**
 * VERIFY_PHASE4_SCANNABILITY_ENGINE.TEST.JS
 * Comprehensive Verification Test Suite for Project Omega Phase 4:
 * Intelligent QR Code and Barcode Engine & Scannability Sentinel
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING PROJECT OMEGA PHASE 4: INTELLIGENT SCANNABILITY ENGINE');
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
// 1. STUDIO UI & DOM ARCHITECTURE (INDEX.HTML)
// ============================================================================
console.log('=== 1. STUDIO UI & DOM ARCHITECTURE (INDEX.HTML) ===');

test('index.html loads jsQR optical decoding library', () => {
    assert(htmlContent.includes('jsqr@1.4.0/dist/jsQR.min.js'), 'Missing jsQR library CDN script tag');
});

test('index.html contains Live QR preview canvas, decoded payload, and metrics', () => {
    assert(htmlContent.includes('id="uice-qr-preview-canvas"'), 'Missing uice-qr-preview-canvas');
    assert(htmlContent.includes('id="uice-qr-preview-url"'), 'Missing uice-qr-preview-url');
    assert(htmlContent.includes('id="uice-qr-preview-metrics"'), 'Missing uice-qr-preview-metrics');
    assert(htmlContent.includes('id="lbl-uice-qr-status"'), 'Missing lbl-uice-qr-status');
    assert(htmlContent.includes('id="uice-qr-sentinel-details"'), 'Missing uice-qr-sentinel-details');
});

test('index.html contains QR quick-fix action buttons', () => {
    assert(htmlContent.includes('id="btn-uice-qr-fix-ratio"'), 'Missing btn-uice-qr-fix-ratio');
    assert(htmlContent.includes('id="btn-uice-qr-fix-contrast"'), 'Missing btn-uice-qr-fix-contrast');
    assert(htmlContent.includes('id="btn-uice-qr-fix-size"'), 'Missing btn-uice-qr-fix-size');
});

test('index.html contains Live Barcode preview canvas and metrics', () => {
    assert(htmlContent.includes('id="uice-barcode-preview-canvas"'), 'Missing uice-barcode-preview-canvas');
    assert(htmlContent.includes('id="uice-barcode-preview-val"'), 'Missing uice-barcode-preview-val');
    assert(htmlContent.includes('id="uice-barcode-preview-metrics"'), 'Missing uice-barcode-preview-metrics');
    assert(htmlContent.includes('id="lbl-uice-barcode-status"'), 'Missing lbl-uice-barcode-status');
    assert(htmlContent.includes('id="uice-barcode-sentinel-details"'), 'Missing uice-barcode-sentinel-details');
});

test('index.html contains Barcode background input and quick-fix buttons', () => {
    assert(htmlContent.includes('id="prop-uice-barcode-bg"'), 'Missing prop-uice-barcode-bg');
    assert(htmlContent.includes('id="prop-uice-barcode-font-size"'), 'Missing prop-uice-barcode-font-size');
    assert(htmlContent.includes('id="btn-uice-barcode-fix-size"'), 'Missing btn-uice-barcode-fix-size');
    assert(htmlContent.includes('id="btn-uice-barcode-fix-contrast"'), 'Missing btn-uice-barcode-fix-contrast');
});

// ============================================================================
// 2. CSS STYLING ARCHITECTURE (STYLES.CSS)
// ============================================================================
console.log('\n=== 2. CSS STYLING ARCHITECTURE (STYLES.CSS) ===');

test('styles.css defines sentinel badge states (valid, warning, error)', () => {
    assert(cssContent.includes('.uice-sentinel-badge.valid'), 'Missing .uice-sentinel-badge.valid');
    assert(cssContent.includes('.uice-sentinel-badge.warning'), 'Missing .uice-sentinel-badge.warning');
    assert(cssContent.includes('.uice-sentinel-badge.error'), 'Missing .uice-sentinel-badge.error');
    assert(cssContent.includes('.uice-sentinel-preview-card'), 'Missing .uice-sentinel-preview-card');
});

// ============================================================================
// 3. JAVASCRIPT ENGINE RUNTIME DECLARATIONS (APP.JS)
// ============================================================================
console.log('\n=== 3. ENGINE RUNTIME METHOD DECLARATIONS (APP.JS) ===');

test('app.js defines calculateColorContrast function', () => {
    assert(appJsContent.includes('function calculateColorContrast('), 'Missing calculateColorContrast');
});

test('app.js defines getUiceVerificationUrl function', () => {
    assert(appJsContent.includes('function getUiceVerificationUrl('), 'Missing getUiceVerificationUrl');
});

test('app.js defines validateQrScannability function', () => {
    assert(appJsContent.includes('function validateQrScannability('), 'Missing validateQrScannability');
});

test('app.js defines validateBarcodeScannability function', () => {
    assert(appJsContent.includes('function validateBarcodeScannability('), 'Missing validateBarcodeScannability');
});

test('app.js defines checkLayoutScannability function', () => {
    assert(appJsContent.includes('function checkLayoutScannability('), 'Missing checkLayoutScannability');
});

test('app.js defines exportUiceCardPng with optical gatekeeper check', () => {
    assert(appJsContent.includes('checkLayoutScannability('), 'exportUiceCardPng must call checkLayoutScannability');
    assert(appJsContent.includes('OPTICAL SCANNABILITY GATEKEEPER WARNING'), 'exportUiceCardPng must display gatekeeper warning prompt');
});

test('app.js renders QRs with high-DPI 2x resolution and dynamic ECC level', () => {
    assert(appJsContent.includes('canvas.getAttribute(\'data-qr-level\')'), 'renderQrsInContainer must support data-qr-level');
    assert(appJsContent.includes('canvas.width = size * scale'), 'renderQrsInContainer must use high-DPI scaling');
});

// ============================================================================
// 4. FUNCTIONAL EXECUTION & MATHEMATICAL OPTICAL TESTS
// ============================================================================
console.log('\n=== 4. FUNCTIONAL EXECUTION & MATHEMATICAL LOGIC ===');

// Extract calculateColorContrast
const contrastFn = new Function(
    appJsContent.match(/function calculateColorContrast\([\s\S]*?\n\}/)[0] + 
    '; return calculateColorContrast;'
)();

// Extract getUiceVerificationUrl
const verificationUrlFn = new Function(
    'const VSA_STATE = { lanIp: "192.168.1.10" };\n' +
    appJsContent.match(/function getUiceVerificationUrl\([\s\S]*?\n\}/)[0] + 
    '; return getUiceVerificationUrl;'
)();

// Extract validateQrScannability
const validateQrFn = new Function(
    'const VSA_STATE = { lanIp: "192.168.1.10" };\n' +
    appJsContent.match(/function calculateColorContrast\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function getUiceVerificationUrl\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function validateQrScannability\([\s\S]*?\n\}/)[0] + 
    '; return validateQrScannability;'
)();

// Extract validateBarcodeScannability
const validateBarcodeFn = new Function(
    appJsContent.match(/function calculateColorContrast\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function validateBarcodeScannability\([\s\S]*?\n\}/)[0] + 
    '; return validateBarcodeScannability;'
)();

// Extract checkLayoutScannability
const checkLayoutFn = new Function(
    'const VSA_STATE = { lanIp: "192.168.1.10" };\n' +
    appJsContent.match(/function calculateColorContrast\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function getUiceVerificationUrl\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function validateQrScannability\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function validateBarcodeScannability\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function checkLayoutScannability\([\s\S]*?\n\}/)[0] + 
    '; return checkLayoutScannability;'
)();

test('WCAG 2.1 Contrast Calculation: B/W gives 21:1, Low contrast gives < 4.5:1', () => {
    const bwRatio = contrastFn('#000000', '#ffffff');
    assert.strictEqual(bwRatio, 21, 'Black on white must yield 21:1');

    const lowContrastRatio = contrastFn('#facc15', '#ffffff'); // bright yellow on white
    assert(lowContrastRatio < 4.5, `Bright yellow on white (${lowContrastRatio}:1) must be below 4.5:1`);

    const navyOnWhite = contrastFn('#0f172a', '#ffffff');
    assert(navyOnWhite >= 14, `Navy on white (${navyOnWhite}:1) must be high contrast`);
});

test('Verification URL generation conforms to official format', () => {
    const emp = { id: 'VSA-0099', secureToken: 'token_abc123' };
    const url = verificationUrlFn(emp);
    assert(url.includes('/verification.html?id=VSA-0099&token=token_abc123'), `URL must follow canonical pattern, got ${url}`);
});

test('QR Scannability Sentinel: Validates standard 54x54 scannable QR', () => {
    const el = {
        type: 'qr-code',
        width: 54,
        height: 54,
        properties: {
            foreground: '#000000',
            background: '#ffffff',
            errorCorrection: 'H',
            quietZone: 2
        }
    };
    const emp = { id: 'VSA-0042' };
    const res = validateQrFn(el, emp);

    assert.strictEqual(res.valid, true, 'Standard QR must be valid');
    assert.strictEqual(res.level, 'valid', 'Level should be valid');
    assert(res.contrast >= 7.0, 'Contrast should be >= 7.0');
    assert.strictEqual(res.issues.length, 0, 'Standard QR should have zero critical issues');
});

test('QR Scannability Sentinel: Detects aspect ratio distortion (> 5%)', () => {
    const distortedEl = {
        type: 'qr-code',
        width: 60,
        height: 40, // 33% distortion
        properties: {
            foreground: '#000000',
            background: '#ffffff'
        }
    };
    const res = validateQrFn(distortedEl, { id: 'VSA-0042' });

    assert.strictEqual(res.valid, false, 'Distorted QR must not be marked valid');
    assert.strictEqual(res.level, 'critical', 'Distorted QR must be critical level');
    assert(res.issues.some(i => i.includes('Distortion detected')), 'Must report distortion issue');
});

test('QR Scannability Sentinel: Enforces minimum size threshold (< 40px critical, < 48px warning)', () => {
    const tinyEl = {
        type: 'qr-code',
        width: 32,
        height: 32,
        properties: { foreground: '#000000', background: '#ffffff' }
    };
    const tinyRes = validateQrFn(tinyEl, { id: 'VSA-0042' });
    assert.strictEqual(tinyRes.level, 'critical', 'Sub-40px QR must be critical level');
    assert(tinyRes.issues.some(i => i.includes('40px critical scanning limit')));

    const compactEl = {
        type: 'qr-code',
        width: 44,
        height: 44,
        properties: { foreground: '#000000', background: '#ffffff' }
    };
    const compactRes = validateQrFn(compactEl, { id: 'VSA-0042' });
    assert.strictEqual(compactRes.level, 'warning', '44px QR must be warning level');
    assert(compactRes.warnings.some(w => w.includes('Recommended size is >= 48px')));
});

test('QR Scannability Sentinel: Flags low contrast (< 4.5:1 critical)', () => {
    const unreadableEl = {
        type: 'qr-code',
        width: 54,
        height: 54,
        properties: {
            foreground: '#e2e8f0', // light grey on white
            background: '#ffffff'
        }
    };
    const res = validateQrFn(unreadableEl, { id: 'VSA-0042' });
    assert.strictEqual(res.level, 'critical', 'Low contrast QR must be critical');
    assert(res.issues.some(i => i.includes('Critical contrast failure')));
});

test('Barcode Scannability Sentinel: Validates standard 120x26 CODE128 barcode', () => {
    const el = {
        type: 'barcode',
        width: 120,
        height: 26,
        properties: {
            format: 'CODE128',
            lineColor: '#000000',
            background: '#ffffff'
        }
    };
    const res = validateBarcodeFn(el, { id: 'VSA-0042' });
    assert.strictEqual(res.valid, true, 'Standard barcode must be valid');
    assert.strictEqual(res.level, 'valid');
    assert.strictEqual(res.issues.length, 0);
});

test('Barcode Scannability Sentinel: Detects incompatible format (EAN13 with alphanumeric ID)', () => {
    const el = {
        type: 'barcode',
        width: 120,
        height: 26,
        properties: {
            format: 'EAN13',
            lineColor: '#000000',
            background: '#ffffff'
        }
    };
    const res = validateBarcodeFn(el, { id: 'VSA-0042' }); // VSA-0042 contains letters and hyphens!
    assert.strictEqual(res.valid, false, 'EAN13 with alphanumeric ID must fail');
    assert.strictEqual(res.level, 'critical');
    assert(res.issues.some(i => i.includes('EAN-13 strictly requires 12 or 13 digits')));
});

test('Barcode Scannability Sentinel: Flags undersized barcodes (< 90x16px critical)', () => {
    const el = {
        type: 'barcode',
        width: 80,
        height: 12,
        properties: {
            format: 'CODE128',
            lineColor: '#000000',
            background: '#ffffff'
        }
    };
    const res = validateBarcodeFn(el, { id: 'VSA-0042' });
    assert.strictEqual(res.level, 'critical');
    assert(res.issues.some(i => i.includes('too small for standard 1D laser/CCD')));
});

test('Layout Gatekeeper: Accurately checks complete layout and flags unreadable cards', () => {
    // 1. Clean Layout
    const goodLayout = {
        width: 500,
        height: 320,
        elements: [
            { type: 'qr-code', width: 54, height: 54, properties: { foreground: '#000000', background: '#ffffff' } },
            { type: 'barcode', width: 120, height: 26, properties: { format: 'CODE128', lineColor: '#000000', background: '#ffffff' } }
        ]
    };
    const goodReport = checkLayoutFn(goodLayout, { id: 'VSA-0042' });
    assert.strictEqual(goodReport.hasCritical, false, 'Good layout must not have critical issues');

    // 2. Defective Layout
    const badLayout = {
        width: 500,
        height: 320,
        elements: [
            { id: 'qr-defective', name: 'Defective QR', type: 'qr-code', width: 60, height: 30, properties: { foreground: '#ffff00', background: '#ffffff' } },
            { id: 'barcode-defective', name: 'Defective Barcode', type: 'barcode', width: 120, height: 26, properties: { format: 'EAN13', lineColor: '#000000', background: '#ffffff' } }
        ]
    };
    const badReport = checkLayoutFn(badLayout, { id: 'VSA-0042' });
    assert.strictEqual(badReport.hasCritical, true, 'Defective layout must trigger critical gatekeeper');
    assert(badReport.criticalCount >= 2, `Should have at least 2 critical issues, found ${badReport.criticalCount}`);
    assert(badReport.messages.some(m => m.includes('Distortion detected')));
    assert(badReport.messages.some(m => m.includes('EAN-13 strictly requires')));
});

// ============================================================================
// FINAL SUMMARY
// ============================================================================
console.log('\n======================================================');
console.log(`TEST RESULTS: ${passedTests} passed, ${totalTests - passedTests} failed out of ${totalTests} total tests`);
console.log('======================================================');

if (passedTests === totalTests) {
    process.exit(0);
} else {
    process.exit(1);
}
