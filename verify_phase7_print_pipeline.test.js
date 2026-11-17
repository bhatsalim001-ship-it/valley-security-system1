/**
 * ============================================================================
 * PROJECT OMEGA: COMPLETE ID CARD DESIGN ENGINE OVERHAUL
 * PHASE 7 VERIFICATION TEST SUITE: HIGH-DPI EXPORT, PRINT PIPELINE & BATCH ENGINE
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING PROJECT OMEGA PHASE 7: PRINT PIPELINE & BATCH ENGINE');
console.log('======================================================\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
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

const ROOT = __dirname;
const indexHtml = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(ROOT, 'public', 'styles.css'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'public', 'app.js'), 'utf8');

// ============================================================================
// 1. STUDIO UI & DOM ARCHITECTURE (INDEX.HTML)
// ============================================================================
console.log('=== 1. STUDIO UI & DOM ARCHITECTURE (INDEX.HTML) ===');

test('index.html contains Command Bar Phase 7 action buttons', () => {
    assert(indexHtml.includes('id="btn-uice-print-proof"'), 'Missing #btn-uice-print-proof');
    assert(indexHtml.includes('id="btn-uice-export-png"'), 'Missing #btn-uice-export-png');
    assert(indexHtml.includes('id="btn-uice-print-sheet"'), 'Missing #btn-uice-print-sheet');
    assert(indexHtml.includes('id="btn-uice-batch-export"'), 'Missing #btn-uice-batch-export');
});

test('index.html defines Single Card High-DPI Export Modal (#uice-export-modal)', () => {
    assert(indexHtml.includes('id="uice-export-modal"'), 'Missing #uice-export-modal');
    assert(indexHtml.includes('id="uice-export-dpi"'), 'Missing #uice-export-dpi dropdown');
    assert(indexHtml.includes('id="uice-export-bleed"'), 'Missing #uice-export-bleed checkbox');
    assert(indexHtml.includes('id="uice-export-cmyk-proof"'), 'Missing #uice-export-cmyk-proof checkbox');
    assert(indexHtml.includes('id="uice-export-gatekeeper"'), 'Missing #uice-export-gatekeeper checkbox');
    assert(indexHtml.includes('id="uice-export-dimensions-info"'), 'Missing #uice-export-dimensions-info preview tag');
});

test('index.html defines A4 Multi-Up Print Sheet Modal (#uice-sheet-modal)', () => {
    assert(indexHtml.includes('id="uice-sheet-modal"'), 'Missing #uice-sheet-modal');
    assert(indexHtml.includes('id="uice-sheet-layout"'), 'Missing #uice-sheet-layout');
    assert(indexHtml.includes('id="uice-sheet-duplex"'), 'Missing #uice-sheet-duplex');
    assert(indexHtml.includes('id="uice-sheet-crop-marks"'), 'Missing #uice-sheet-crop-marks');
    assert(indexHtml.includes('id="uice-sheet-crosshairs"'), 'Missing #uice-sheet-crosshairs');
    assert(indexHtml.includes('id="uice-sheet-hole-punch"'), 'Missing #uice-sheet-hole-punch');
});

test('index.html defines Industrial Batch Generation Modal (#uice-batch-modal)', () => {
    assert(indexHtml.includes('id="uice-batch-modal"'), 'Missing #uice-batch-modal');
    assert(indexHtml.includes('id="uice-batch-preflight-summary"'), 'Missing #uice-batch-preflight-summary');
    assert(indexHtml.includes('id="uice-batch-issues-list"'), 'Missing #uice-batch-issues-list');
    assert(indexHtml.includes('id="uice-batch-progress-bar"'), 'Missing #uice-batch-progress-bar');
    assert(indexHtml.includes('id="uice-batch-target"'), 'Missing #uice-batch-target');
});

test('index.html defines dedicated printable container (#printable-uice-sheet)', () => {
    assert(indexHtml.includes('id="printable-uice-sheet"'), 'Missing #printable-uice-sheet container');
});

// ============================================================================
// 2. CSS STYLING ARCHITECTURE (STYLES.CSS)
// ============================================================================
console.log('\n=== 2. CSS STYLING ARCHITECTURE (STYLES.CSS) ===');

test('styles.css defines Dye-Sublimation / CMYK Print Proofing simulation styles', () => {
    assert(stylesCss.includes('.uice-artboard-card.uice-soft-proofing'), 'Missing .uice-soft-proofing class');
    assert(stylesCss.includes('filter: saturate(0.88) contrast(1.04) brightness(0.98) sepia(0.04)'), 'Missing proofing filter');
    assert(stylesCss.includes("content: 'PROOFING: CMYK SIMULATION'"), 'Missing proofing badge label');
});

test('styles.css defines Batch Pre-Flight audit badges', () => {
    assert(stylesCss.includes('.uice-preflight-stat-box'), 'Missing .uice-preflight-stat-box');
    assert(stylesCss.includes('.uice-preflight-stat-box.stat-passed'), 'Missing .stat-passed');
    assert(stylesCss.includes('.uice-preflight-stat-box.stat-warn'), 'Missing .stat-warn');
    assert(stylesCss.includes('.uice-preflight-stat-box.stat-crit'), 'Missing .stat-crit');
});

test('styles.css defines High-Fidelity Print Media queries for A4 Multi-Up sheets', () => {
    assert(stylesCss.includes('body.uice-sheet-print-active'), 'Missing body.uice-sheet-print-active class');
    assert(stylesCss.includes('.uice-print-sheet-page'), 'Missing .uice-print-sheet-page');
    assert(stylesCss.includes('width: 210mm !important'), 'Missing 210mm A4 width rule');
    assert(stylesCss.includes('height: 297mm !important'), 'Missing 297mm A4 height rule');
    assert(stylesCss.includes('page-break-after: always !important'), 'Missing page break rule');
});

test('styles.css defines 8-Up, 10-Up, and 9-Up Multi-Up sheet grid systems', () => {
    assert(stylesCss.includes('.uice-sheet-grid-8up'), 'Missing .uice-sheet-grid-8up');
    assert(stylesCss.includes('.uice-sheet-grid-10up'), 'Missing .uice-sheet-grid-10up');
    assert(stylesCss.includes('.uice-sheet-grid-9up'), 'Missing .uice-sheet-grid-9up');
    assert(stylesCss.includes('repeat(2, 85.6mm)'), 'Missing 85.6mm CR80 column template');
    assert(stylesCss.includes('repeat(4, 54mm)'), 'Missing 54mm CR80 row template');
});

test('styles.css defines physical cutting crop marks and registration crosshairs', () => {
    assert(stylesCss.includes('.uice-crop-mark'), 'Missing .uice-crop-mark');
    assert(stylesCss.includes('.uice-crop-tl'), 'Missing .uice-crop-tl');
    assert(stylesCss.includes('.uice-crop-tr'), 'Missing .uice-crop-tr');
    assert(stylesCss.includes('.uice-crop-bl'), 'Missing .uice-crop-bl');
    assert(stylesCss.includes('.uice-crop-br'), 'Missing .uice-crop-br');
    assert(stylesCss.includes('.uice-reg-mark'), 'Missing .uice-reg-mark');
    assert(stylesCss.includes('.uice-hole-punch-guide'), 'Missing .uice-hole-punch-guide');
});

// ============================================================================
// 3. ENGINE RUNTIME METHOD DECLARATIONS (APP.JS)
// ============================================================================
console.log('\n=== 3. ENGINE RUNTIME METHOD DECLARATIONS (APP.JS) ===');

test('app.js UICE_STATE includes showPrintProofing state', () => {
    assert(appJs.includes('showPrintProofing: false'), 'Missing showPrintProofing in UICE_STATE');
});

test('app.js defines toggleUicePrintProofing function', () => {
    assert(appJs.includes('function toggleUicePrintProofing('), 'Missing toggleUicePrintProofing function');
    assert(appJs.includes("artboard.classList.toggle('uice-soft-proofing'"), 'Missing artboard proofing class toggle');
});

test('app.js defines High-DPI export methods', () => {
    assert(appJs.includes('function openUiceExportModal()'), 'Missing openUiceExportModal');
    assert(appJs.includes('function closeUiceExportModal()'), 'Missing closeUiceExportModal');
    assert(appJs.includes('function updateUiceExportPreviewInfo()'), 'Missing updateUiceExportPreviewInfo');
    assert(appJs.includes('async function exportUiceCardWithResolution('), 'Missing exportUiceCardWithResolution');
    assert(appJs.includes('async function exportUiceCardPng()'), 'Missing backward-compatible exportUiceCardPng');
});

test('app.js defines Multi-Up A4 Print Sheet methods', () => {
    assert(appJs.includes('function openUiceSheetModal()'), 'Missing openUiceSheetModal');
    assert(appJs.includes('function closeUiceSheetModal()'), 'Missing closeUiceSheetModal');
    assert(appJs.includes('function calculateDuplexGridPositions('), 'Missing calculateDuplexGridPositions');
    assert(appJs.includes('function printUiceSheet('), 'Missing printUiceSheet');
});

test('app.js defines Industrial Batch Export and Gatekeeper methods', () => {
    assert(appJs.includes('function openUiceBatchModal()'), 'Missing openUiceBatchModal');
    assert(appJs.includes('function closeUiceBatchModal()'), 'Missing closeUiceBatchModal');
    assert(appJs.includes('function runUicePreFlightValidation('), 'Missing runUicePreFlightValidation');
    assert(appJs.includes('function refreshUiceBatchPreflight()'), 'Missing refreshUiceBatchPreflight');
    assert(appJs.includes('async function startUiceBatchExport('), 'Missing startUiceBatchExport');
});

test('app.js wires event listeners for Phase 7 buttons', () => {
    assert(appJs.includes("document.getElementById('btn-uice-print-proof')"), 'Missing btn-uice-print-proof listener');
    assert(appJs.includes("document.getElementById('btn-uice-print-sheet')"), 'Missing btn-uice-print-sheet listener');
    assert(appJs.includes("document.getElementById('btn-uice-batch-export')"), 'Missing btn-uice-batch-export listener');
});

// ============================================================================
// 4. FUNCTIONAL EXECUTION & MATHEMATICAL LOGIC
// ============================================================================
console.log('\n=== 4. FUNCTIONAL EXECUTION & MATHEMATICAL LOGIC ===');

// Extract and test calculateDuplexGridPositions directly in Node.js
const duplexFuncMatch = appJs.match(/function calculateDuplexGridPositions\([\s\S]*?\n\}/);
assert(duplexFuncMatch, 'Could not extract calculateDuplexGridPositions function from app.js');
const calculateDuplexGridPositions = new Function(`return ${duplexFuncMatch[0]}`)();

test('Duplex Mirroring: 2-column grid correctly mirrors column 0 and column 1 on back page', () => {
    const cards = [
        { id: 'G-1' }, { id: 'G-2' },
        { id: 'G-3' }, { id: 'G-4' }
    ];

    // Front page: Col 0 -> Col 0, Col 1 -> Col 1
    const frontPages = calculateDuplexGridPositions(cards, 2, 2, false);
    assert.strictEqual(frontPages.length, 1);
    assert.strictEqual(frontPages[0][0].id, 'G-1');
    assert.strictEqual(frontPages[0][1].id, 'G-2');
    assert.strictEqual(frontPages[0][2].id, 'G-3');
    assert.strictEqual(frontPages[0][3].id, 'G-4');

    // Back page (Long-Edge Mirrored): Col 0 -> Col 1, Col 1 -> Col 0!
    const backPages = calculateDuplexGridPositions(cards, 2, 2, true);
    assert.strictEqual(backPages.length, 1);
    // Row 0: G-1 moves to Col 1, G-2 moves to Col 0!
    assert.strictEqual(backPages[0][0].id, 'G-2', 'Back row 0 col 0 must be G-2');
    assert.strictEqual(backPages[0][1].id, 'G-1', 'Back row 0 col 1 must be G-1 (aligns with front G-1)');
    // Row 1: G-3 moves to Col 1, G-4 moves to Col 0!
    assert.strictEqual(backPages[0][2].id, 'G-4', 'Back row 1 col 0 must be G-4');
    assert.strictEqual(backPages[0][3].id, 'G-3', 'Back row 1 col 1 must be G-3 (aligns with front G-3)');
});

test('Duplex Mirroring: 3-column grid correctly mirrors 3 columns (0 <-> 2, 1 <-> 1)', () => {
    const cards = [
        { id: 'A' }, { id: 'B' }, { id: 'C' },
        { id: 'D' }, { id: 'E' }, { id: 'F' }
    ];

    const backPages = calculateDuplexGridPositions(cards, 3, 2, true);
    // Row 0: [A, B, C] -> [C, B, A]
    assert.strictEqual(backPages[0][0].id, 'C');
    assert.strictEqual(backPages[0][1].id, 'B');
    assert.strictEqual(backPages[0][2].id, 'A');
    // Row 1: [D, E, F] -> [F, E, D]
    assert.strictEqual(backPages[0][3].id, 'F');
    assert.strictEqual(backPages[0][4].id, 'E');
    assert.strictEqual(backPages[0][5].id, 'D');
});

test('High-DPI Math: CR80 300 DPI calculations match physical standards exactly', () => {
    // ISO/IEC 7810 CR80 Card Dimensions: 85.60 mm x 53.98 mm = 3.3700787 in x 2.1251968 in
    const physicalWidthInches = 85.60 / 25.4;
    const physicalHeightInches = 53.98 / 25.4;

    const dpi300W = Math.round(physicalWidthInches * 300);
    const dpi300H = Math.round(physicalHeightInches * 300);

    assert.strictEqual(dpi300W, 1011, 'CR80 300 DPI width must be 1011px');
    assert.strictEqual(dpi300H, 638, 'CR80 300 DPI height must be 638px');

    // Scale multiplier from screen base 500x320
    const scaleRatio = 1011 / 500;
    assert(Math.abs(scaleRatio - 2.022) < 0.001, 'Scale multiplier from 500px base must be 2.022');

    // 3mm bleed margin in pixels at 300 DPI: 3 / 25.4 * 300 = 35.43px
    const bleedPx300 = Math.round((3 / 25.4) * 300);
    assert.strictEqual(bleedPx300, 35, '3mm bleed at 300 DPI must be 35px');
});

test('Multi-Up A4 Sheet Capacity: Math correctly partitions card counts across pages', () => {
    const guards19 = Array.from({ length: 19 }, (_, i) => ({ id: `G-${i + 1}` }));

    // 8-up layout: 19 cards should take 3 pages (8 + 8 + 3)
    const pages8up = calculateDuplexGridPositions(guards19, 2, 4, false);
    assert.strictEqual(pages8up.length, 3);
    assert.strictEqual(pages8up[0].filter(Boolean).length, 8);
    assert.strictEqual(pages8up[1].filter(Boolean).length, 8);
    assert.strictEqual(pages8up[2].filter(Boolean).length, 3);

    // 10-up layout: 19 cards should take 2 pages (10 + 9)
    const pages10up = calculateDuplexGridPositions(guards19, 2, 5, false);
    assert.strictEqual(pages10up.length, 2);
    assert.strictEqual(pages10up[0].filter(Boolean).length, 10);
    assert.strictEqual(pages10up[1].filter(Boolean).length, 9);
});

// Extract and test runUicePreFlightValidation
const preflightFuncMatch = appJs.match(/function runUicePreFlightValidation\([\s\S]*?\n\}/);
assert(preflightFuncMatch, 'Could not extract runUicePreFlightValidation from app.js');

test('Batch Pre-Flight Validation Engine: Aggregates validation reports with summary counts', () => {
    // Mock checkLayoutScannability and checkLayoutTypography for headless test
    global.checkLayoutScannability = (layout, emp) => {
        if (emp.badQr) {
            return { hasCritical: true, messages: ['QR contrast below 4.5:1'] };
        }
        return { hasCritical: false, messages: [] };
    };

    global.checkLayoutTypography = (layout, emp) => {
        if (emp.badText) {
            return { hasCritical: false, messages: ['Text truncated'] };
        }
        return { hasCritical: false, messages: [] };
    };

    const runUicePreFlightValidation = new Function(`return ${preflightFuncMatch[0]}`)();

    const mockLayout = { width: 500, height: 320, elements: [] };
    const mockEmployees = [
        { id: 'E-1', name: 'Valid Guard' },
        { id: 'E-2', name: 'Bad Text Guard', badText: true },
        { id: 'E-3', name: 'Bad QR Guard', badQr: true }
    ];

    const report = runUicePreFlightValidation(mockLayout, mockEmployees);

    assert.strictEqual(report.total, 3, 'Total employees count mismatch');
    assert.strictEqual(report.summary.passCount, 1, 'Pass count must be 1');
    assert.strictEqual(report.summary.warnCount, 1, 'Warn count must be 1');
    assert.strictEqual(report.summary.critCount, 1, 'Critical count must be 1');
    assert.strictEqual(report.critical[0].emp.id, 'E-3', 'Critical employee must be E-3');
    assert.strictEqual(report.warnings[0].emp.id, 'E-2', 'Warning employee must be E-2');
    assert.strictEqual(report.passed[0].id, 'E-1', 'Passed employee must be E-1');
});

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passCount} passed, ${failCount} failed out of ${passCount + failCount} total tests`);
console.log('======================================================\n');

if (failCount > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
