const fs = require('fs');
const path = require('path');
const assert = require('assert');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        testsPassed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}`);
        console.error(`         ${err.message}`);
        testsFailed++;
    }
}

console.log('\n======================================================');
console.log('VERIFYING PROJECT OMEGA PHASE 5: INTELLIGENT TYPOGRAPHY & CONTENT ENGINE');
console.log('======================================================\n');

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

test('index.html contains line height, auto-fit, and multi-line wrap controls in #prop-sec-typography', () => {
    assert(htmlContent.includes('id="prop-uice-line-height"'), 'Missing prop-uice-line-height');
    assert(htmlContent.includes('id="prop-uice-text-autofit"'), 'Missing prop-uice-text-autofit');
    assert(htmlContent.includes('id="prop-uice-text-wrap"'), 'Missing prop-uice-text-wrap');
    assert(htmlContent.includes('id="uice-typo-sentinel"'), 'Missing uice-typo-sentinel');
    assert(htmlContent.includes('id="uice-typo-sentinel-details"'), 'Missing uice-typo-sentinel-details');
    assert(htmlContent.includes('id="btn-uice-typo-autofit"'), 'Missing btn-uice-typo-autofit');
});

test('index.html contains dedicated Agency Header section with branding controls and sentinel', () => {
    assert(htmlContent.includes('id="prop-sec-agency"'), 'Missing prop-sec-agency');
    assert(htmlContent.includes('id="lbl-uice-agency-status"'), 'Missing lbl-uice-agency-status');
    assert(htmlContent.includes('id="prop-uice-agency-title"'), 'Missing prop-uice-agency-title');
    assert(htmlContent.includes('id="prop-uice-agency-subtitle"'), 'Missing prop-uice-agency-subtitle');
    assert(htmlContent.includes('id="prop-uice-agency-title-size"'), 'Missing prop-uice-agency-title-size');
    assert(htmlContent.includes('id="prop-uice-agency-sub-size"'), 'Missing prop-uice-agency-sub-size');
    assert(htmlContent.includes('id="prop-uice-agency-logo-size"'), 'Missing prop-uice-agency-logo-size');
    assert(htmlContent.includes('id="prop-uice-agency-letter-spacing"'), 'Missing prop-uice-agency-letter-spacing');
    assert(htmlContent.includes('id="prop-uice-agency-line-height"'), 'Missing prop-uice-agency-line-height');
    assert(htmlContent.includes('id="prop-uice-agency-color"'), 'Missing prop-uice-agency-color');
    assert(htmlContent.includes('id="prop-uice-agency-autofit"'), 'Missing prop-uice-agency-autofit');
    assert(htmlContent.includes('id="prop-uice-agency-wrap"'), 'Missing prop-uice-agency-wrap');
    assert(htmlContent.includes('id="uice-agency-sentinel"'), 'Missing uice-agency-sentinel');
    assert(htmlContent.includes('id="uice-agency-sentinel-details"'), 'Missing uice-agency-sentinel-details');
    assert(htmlContent.includes('id="btn-uice-agency-autofit"'), 'Missing btn-uice-agency-autofit');
});

test('index.html contains Details Table font size, auto-fit, and height sentinel', () => {
    assert(htmlContent.includes('id="prop-sec-table"'), 'Missing prop-sec-table');
    assert(htmlContent.includes('id="lbl-uice-table-status"'), 'Missing lbl-uice-table-status');
    assert(htmlContent.includes('id="prop-uice-table-font-size"'), 'Missing prop-uice-table-font-size');
    assert(htmlContent.includes('id="prop-uice-table-autofit"'), 'Missing prop-uice-table-autofit');
    assert(htmlContent.includes('id="prop-uice-table-address-wrap"'), 'Missing prop-uice-table-address-wrap');
    assert(htmlContent.includes('id="uice-table-sentinel"'), 'Missing uice-table-sentinel');
    assert(htmlContent.includes('id="uice-table-sentinel-details"'), 'Missing uice-table-sentinel-details');
    assert(htmlContent.includes('id="btn-uice-table-autofit"'), 'Missing btn-uice-table-autofit');
});

// ============================================================================
// 2. CSS STYLING ARCHITECTURE (STYLES.CSS)
// ============================================================================
console.log('\n=== 2. CSS STYLING ARCHITECTURE (STYLES.CSS) ===');

test('styles.css defines typography and sentinel classes', () => {
    assert(cssContent.includes('.uice-brand-title'), 'Missing .uice-brand-title');
    assert(cssContent.includes('.uice-brand-subtitle'), 'Missing .uice-brand-subtitle');
    assert(cssContent.includes('.uice-emp-name'), 'Missing .uice-emp-name');
    assert(cssContent.includes('.uice-emp-designation'), 'Missing .uice-emp-designation');
    assert(cssContent.includes('.uice-sentinel-panel'), 'Missing .uice-sentinel-panel');
});

// ============================================================================
// 3. JAVASCRIPT ENGINE RUNTIME DECLARATIONS (APP.JS)
// ============================================================================
console.log('\n=== 3. ENGINE RUNTIME METHOD DECLARATIONS (APP.JS) ===');

test('app.js defines calculateAutoFitFontSize function', () => {
    assert(appJsContent.includes('function calculateAutoFitFontSize('), 'Missing calculateAutoFitFontSize');
});

test('app.js defines validateTypographyFit function', () => {
    assert(appJsContent.includes('function validateTypographyFit('), 'Missing validateTypographyFit');
});

test('app.js defines checkLayoutTypography function', () => {
    assert(appJsContent.includes('function checkLayoutTypography('), 'Missing checkLayoutTypography');
});

test('app.js updates Property Inspector for typography and agency branding', () => {
    assert(appJsContent.includes('const secAgency = document.getElementById(\'prop-sec-agency\');'), 'Inspector must toggle agency section');
    assert(appJsContent.includes('prop-uice-agency-title'), 'Inspector must bind agency title');
    assert(appJsContent.includes('prop-uice-line-height'), 'Inspector must bind line height');
    assert(appJsContent.includes('prop-uice-table-font-size'), 'Inspector must bind table font size');
});

test('app.js renders elements with auto-fit and multi-line wrapping in renderUiceElementHtml', () => {
    assert(appJsContent.includes('calculateAutoFitFontSize({'), 'renderUiceElementHtml must call calculateAutoFitFontSize');
    assert(appJsContent.includes('uice-brand-title'), 'renderUiceElementHtml must attach uice-brand-title class');
    assert(appJsContent.includes('uice-emp-name'), 'renderUiceElementHtml must attach uice-emp-name class');
    assert(appJsContent.includes('uice-emp-designation'), 'renderUiceElementHtml must attach uice-emp-designation class');
});

test('app.js integrates typography check into exportUiceCardPng gatekeeper', () => {
    assert(appJsContent.includes('checkLayoutTypography(layout, emp)'), 'exportUiceCardPng must call checkLayoutTypography');
    assert(appJsContent.includes('OPTICAL SCANNABILITY GATEKEEPER WARNING'), 'exportUiceCardPng gatekeeper prompt preserved');
});

// ============================================================================
// 4. FUNCTIONAL EXECUTION & MATHEMATICAL TYPOGRAPHY TESTS
// ============================================================================
console.log('\n=== 4. FUNCTIONAL EXECUTION & MATHEMATICAL LOGIC ===');

// Extract calculateAutoFitFontSize
const autoFitFn = new Function(
    appJsContent.match(/function calculateAutoFitFontSize\([\s\S]*?\n\}/)[0] + 
    '; return calculateAutoFitFontSize;'
)();

// Extract validateTypographyFit
const validateTypoFn = new Function(
    appJsContent.match(/function calculateAutoFitFontSize\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function validateTypographyFit\([\s\S]*?\n\}/)[0] + 
    '; return validateTypographyFit;'
)();

// Extract checkLayoutTypography
const checkLayoutTypoFn = new Function(
    appJsContent.match(/function calculateAutoFitFontSize\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function validateTypographyFit\([\s\S]*?\n\}/)[0] + ';\n' +
    appJsContent.match(/function checkLayoutTypography\([\s\S]*?\n\}/)[0] + 
    '; return checkLayoutTypography;'
)();

test('calculateAutoFitFontSize: Standard short text fits at preferred size without reduction', () => {
    const res = autoFitFn({
        text: 'MOHD SALIM',
        width: 180,
        height: 25,
        preferredSize: 16,
        minSize: 8,
        lineHeight: 1.15
    });

    assert.strictEqual(res.fontSize, 16, 'Font size should remain at preferred size 16');
    assert.strictEqual(res.lines, 1, 'Should occupy 1 line');
    assert.strictEqual(res.isOverflowing, false, 'Should not overflow');
});

test('calculateAutoFitFontSize: Long text auto-scales font down without clipping', () => {
    const res = autoFitFn({
        text: 'VALLEY SECURITY AND INTELLIGENCE SERVICES PRIVATE LIMITED',
        width: 140,
        height: 20,
        preferredSize: 14,
        minSize: 7.5,
        lineHeight: 1.15,
        allowWrap: false
    });

    assert(res.fontSize < 14, `Font size must be reduced below 14 (got ${res.fontSize})`);
    assert(res.fontSize >= 7.5, `Font size must not drop below minSize 7.5 (got ${res.fontSize})`);
    assert(res.requiredWidth <= 140 || res.fontSize === 7.5, 'Required width should be constrained to available width');
});

test('calculateAutoFitFontSize: Multi-line wrapping wraps words cleanly across lines', () => {
    const res = autoFitFn({
        text: 'SENIOR ARMED EXECUTIVE SECURITY SUPERVISOR',
        width: 120,
        height: 40,
        preferredSize: 11,
        minSize: 7,
        lineHeight: 1.15,
        allowWrap: true,
        maxLines: 3
    });

    assert(res.lines >= 2, `Text should wrap into at least 2 lines (got ${res.lines})`);
    assert.strictEqual(res.isOverflowing, false, 'Should fit comfortably across multiple lines');
    assert(res.wrappedText.length >= 2, 'wrappedText array must contain line chunks');
});

test('calculateAutoFitFontSize: Severe overflow at minSize flags isOverflowing', () => {
    const res = autoFitFn({
        text: 'A VERY EXTREMELY LONG TEXT STRING THAT CANNOT FIT IN A TINY BOX AT ALL EVEN UNDER ANY CIRCUMSTANCES',
        width: 30,
        height: 10,
        preferredSize: 14,
        minSize: 9,
        allowWrap: false
    });

    assert.strictEqual(res.fontSize, 9, 'Should settle at minSize');
    assert.strictEqual(res.isOverflowing, true, 'Must flag overflow when text exceeds container');
});

test('validateTypographyFit: Validates standard employee name without overflow', () => {
    const el = {
        id: 'name_1',
        type: 'employee-name',
        width: 180,
        height: 24,
        properties: { fontSize: 16 }
    };
    const emp = { name: 'MOHD SALIM' };

    const diag = validateTypoFn(el, emp);
    assert.strictEqual(diag.valid, true, 'Standard name should be valid');
    assert.strictEqual(diag.level, 'valid', 'Level should be valid');
    assert(diag.passes.length > 0, 'Should have passing checks');
});

test('validateTypographyFit: Detects long employee name and recommends scaled font size', () => {
    const el = {
        id: 'name_1',
        type: 'employee-name',
        width: 90,
        height: 20,
        properties: { fontSize: 16 }
    };
    const emp = { name: 'MOHAMMAD SHAFIQ-UL REHMAN AL-KASHMIRI' };

    const diag = validateTypoFn(el, emp);
    assert(diag.warnings.length > 0 || diag.issues.length > 0, 'Should alert about long name');
    assert(diag.recommendedFontSize < 16, `Recommended font size should be < 16 (got ${diag.recommendedFontSize})`);
});

test('validateTypographyFit: Agency brand validates available width minus logo size', () => {
    const el = {
        id: 'brand_1',
        type: 'agency-brand',
        width: 220,
        height: 38,
        properties: {
            title: 'VALLEY SECURITY AGENCY',
            subtitle: 'SHAHIDGUNJ SRINAGAR',
            logoSize: 32,
            titleFontSize: 12
        }
    };

    const diag = validateTypoFn(el);
    assert.strictEqual(diag.valid, true, 'Standard agency brand should fit cleanly');
    assert.strictEqual(diag.level, 'valid');
});

test('validateTypographyFit: Details table flags vertical overflow when height is overly constrained', () => {
    const el = {
        id: 'table_1',
        type: 'details-table',
        width: 180,
        height: 60, // 60px is too short for 7 rows at font size 9 with padding 3
        properties: {
            fontSize: 9,
            rowPadding: 3,
            addressWrap: true
        }
    };

    const diag = validateTypoFn(el);
    assert.strictEqual(diag.valid, false, 'Overly constrained table must fail validity check');
    assert.strictEqual(diag.level, 'critical', 'Level must be critical when table height is violated');
    assert(diag.issues.some(i => i.includes('Table content height')), 'Must report table height issue');
    assert(diag.recommendedFontSize <= 7.5, 'Must calculate a reduced recommendation');
});

test('checkLayoutTypography: Aggregates layout typography and flags critical overflowing elements', () => {
    const goodLayout = {
        width: 324,
        height: 204,
        elements: [
            { id: 'brand', type: 'agency-brand', width: 200, height: 35, properties: { title: 'VSA' } },
            { id: 'name', type: 'employee-name', width: 150, height: 25, properties: { fontSize: 14 } },
            { id: 'tbl', type: 'details-table', width: 180, height: 110, properties: { fontSize: 8, rowPadding: 2 } }
        ]
    };

    const reportGood = checkLayoutTypoFn(goodLayout);
    assert.strictEqual(reportGood.hasCritical, false, 'Good layout must not have critical issues');
    assert.strictEqual(reportGood.criticalCount, 0);

    const badLayout = {
        width: 324,
        height: 204,
        elements: [
            { id: 'bad_tbl', name: 'Table Details', type: 'details-table', width: 180, height: 40, properties: { fontSize: 10, rowPadding: 4 } }
        ]
    };

    const reportBad = checkLayoutTypoFn(badLayout);
    assert.strictEqual(reportBad.hasCritical, true, 'Constrained table in bad layout must flag critical');
    assert(reportBad.messages.some(m => m.includes('Table Details')), 'Must specify failing element in report messages');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n======================================================');
console.log(`TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed out of ${testsPassed + testsFailed} total tests`);
console.log('======================================================\n');

if (testsFailed > 0) {
    process.exit(1);
}
