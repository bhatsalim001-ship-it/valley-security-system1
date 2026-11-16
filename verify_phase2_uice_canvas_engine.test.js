/**
 * VERIFY_PHASE2_UICE_CANVAS_ENGINE.TEST.JS
 * Comprehensive Verification Test Suite for Project Omega Phase 2:
 * Universal Intelligent Canvas Engine (UICE)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING PROJECT OMEGA PHASE 2: UICE CANVAS ENGINE');
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
// 1. STUDIO UI & HTML STRUCTURE (INDEX.HTML)
// ============================================================================
console.log('=== 1. STUDIO UI & HTML STRUCTURE (INDEX.HTML) ===');

test('index.html contains UICE Workspace and Mode Tabs', () => {
    assert(htmlContent.includes('id="tab-uice-visual"'), 'Missing tab-uice-visual button');
    assert(htmlContent.includes('id="tab-uice-classic"'), 'Missing tab-uice-classic button');
    assert(htmlContent.includes('id="uice-visual-workspace"'), 'Missing uice-visual-workspace container');
    assert(htmlContent.includes('id="uice-classic-workspace"'), 'Missing uice-classic-workspace container');
});

test('index.html contains Top Command Bar with all editing controls', () => {
    assert(htmlContent.includes('id="btn-uice-undo"'), 'Missing Undo button');
    assert(htmlContent.includes('id="btn-uice-redo"'), 'Missing Redo button');
    assert(htmlContent.includes('id="uice-orientation-sel"'), 'Missing Orientation select');
    assert(htmlContent.includes('id="btn-uice-auto-arrange"'), 'Missing Auto-Arrange button');
    assert(htmlContent.includes('id="btn-uice-reset-layout"'), 'Missing Reset button');
    assert(htmlContent.includes('id="btn-uice-grid-toggle"'), 'Missing Grid toggle');
    assert(htmlContent.includes('id="btn-uice-snap-toggle"'), 'Missing Snap toggle');
    assert(htmlContent.includes('id="btn-uice-guides-toggle"'), 'Missing Guides toggle');
    assert(htmlContent.includes('id="btn-uice-zoom-in"'), 'Missing Zoom In button');
    assert(htmlContent.includes('id="btn-uice-zoom-out"'), 'Missing Zoom Out button');
    assert(htmlContent.includes('id="btn-uice-zoom-fit"'), 'Missing Zoom Fit button');
    assert(htmlContent.includes('id="btn-uice-export-png"'), 'Missing Export PNG button');
    assert(htmlContent.includes('id="btn-uice-save-template"'), 'Missing Save Layout button');
});

test('index.html contains Left Elements Palette and Layer Tree', () => {
    assert(htmlContent.includes('id="uice-tab-elements"'), 'Missing Add Items tab');
    assert(htmlContent.includes('id="uice-tab-layers"'), 'Missing Layers tab');
    assert(htmlContent.includes('data-add-type="agency-brand"'), 'Missing Agency Header element add button');
    assert(htmlContent.includes('data-add-type="employee-photo"'), 'Missing Employee Photo element add button');
    assert(htmlContent.includes('data-add-type="employee-name"'), 'Missing Employee Name element add button');
    assert(htmlContent.includes('data-add-type="details-table"'), 'Missing Details Table element add button');
    assert(htmlContent.includes('data-add-type="qr-code"'), 'Missing QR Code element add button');
    assert(htmlContent.includes('data-add-type="barcode"'), 'Missing Barcode element add button');
    assert(htmlContent.includes('data-add-type="signature"'), 'Missing Signature element add button');
    assert(htmlContent.includes('id="uice-layers-container"'), 'Missing Layers list container');
});

test('index.html contains Interactive Center Stage with Rulers and Guides', () => {
    assert(htmlContent.includes('id="uice-ruler-top-canvas"'), 'Missing Top ruler canvas');
    assert(htmlContent.includes('id="uice-ruler-left-canvas"'), 'Missing Left ruler canvas');
    assert(htmlContent.includes('id="uice-artboard"'), 'Missing Artboard card container');
    assert(htmlContent.includes('id="uice-grid-overlay"'), 'Missing Grid overlay');
    assert(htmlContent.includes('id="uice-guides-container"'), 'Missing Smart guides container');
    assert(htmlContent.includes('id="uice-elements-container"'), 'Missing Elements container');
});

test('index.html contains Contextual Property Inspector with Sentinel', () => {
    assert(htmlContent.includes('id="prop-uice-x"'), 'Missing X position input');
    assert(htmlContent.includes('id="prop-uice-y"'), 'Missing Y position input');
    assert(htmlContent.includes('id="prop-uice-w"'), 'Missing Width input');
    assert(htmlContent.includes('id="prop-uice-h"'), 'Missing Height input');
    assert(htmlContent.includes('id="prop-uice-rot"'), 'Missing Rotation input');
    assert(htmlContent.includes('id="btn-align-center-x"'), 'Missing Horizontal Align Center button');
    assert(htmlContent.includes('id="btn-align-center-y"'), 'Missing Vertical Align Center button');
    assert(htmlContent.includes('id="uice-qr-sentinel"'), 'Missing Scannability Sentinel badge');
});

// ============================================================================
// 2. CSS STYLING ARCHITECTURE (STYLES.CSS)
// ============================================================================
console.log('\n=== 2. CSS STYLING ARCHITECTURE (STYLES.CSS) ===');

test('styles.css defines 3-column studio layout & artboard classes', () => {
    assert(cssContent.includes('.uice-studio-grid'), 'Missing .uice-studio-grid class');
    assert(cssContent.includes('.uice-artboard-card'), 'Missing .uice-artboard-card class');
    assert(cssContent.includes('.uice-node'), 'Missing .uice-node class');
    assert(cssContent.includes('.uice-node.selected'), 'Missing .uice-node.selected class');
    assert(cssContent.includes('.uice-node.locked'), 'Missing .uice-node.locked class');
});

test('styles.css defines 8-point resize handles and rotation stalk', () => {
    assert(cssContent.includes('.uice-handle'), 'Missing .uice-handle class');
    assert(cssContent.includes('.handle-nw'), 'Missing NW handle');
    assert(cssContent.includes('.handle-ne'), 'Missing NE handle');
    assert(cssContent.includes('.handle-se'), 'Missing SE handle');
    assert(cssContent.includes('.handle-sw'), 'Missing SW handle');
    assert(cssContent.includes('.uice-handle-rot-stalk'), 'Missing rotation stalk');
    assert(cssContent.includes('.handle-rot'), 'Missing rotation handle');
});

test('styles.css defines smart alignment guide lines and sentinel badges', () => {
    assert(cssContent.includes('.uice-guide-line'), 'Missing .uice-guide-line class');
    assert(cssContent.includes('.uice-sentinel-badge.valid'), 'Missing sentinel valid badge style');
    assert(cssContent.includes('.uice-sentinel-badge.warning'), 'Missing sentinel warning badge style');
});

// ============================================================================
// 3. JAVASCRIPT LOGIC & ENGINE RUNTIME (APP.JS)
// ============================================================================
console.log('\n=== 3. JAVASCRIPT LOGIC & ENGINE RUNTIME (APP.JS) ===');

test('app.js defines UICE_STATE with complete schema', () => {
    assert(appJsContent.includes('const UICE_STATE = {'), 'Missing UICE_STATE definition');
    assert(appJsContent.includes('history: []'), 'Missing history stack in UICE_STATE');
    assert(appJsContent.includes('snapToGrid: true'), 'Missing snapToGrid in UICE_STATE');
    assert(appJsContent.includes('showGuides: true'), 'Missing showGuides in UICE_STATE');
});

test('app.js defines default element generators for horizontal and vertical', () => {
    assert(appJsContent.includes('function getUiceDefaultElements(orientation, tpl = {})'), 'Missing getUiceDefaultElements');
    assert(appJsContent.includes('function convertLegacyTemplateToUice(tpl)'), 'Missing convertLegacyTemplateToUice');
});

test('app.js defines 50-step undo/redo stack managers', () => {
    assert(appJsContent.includes('function pushUiceHistory('), 'Missing pushUiceHistory');
    assert(appJsContent.includes('function undoUice()'), 'Missing undoUice');
    assert(appJsContent.includes('function redoUice()'), 'Missing redoUice');
    assert(appJsContent.includes('UICE_STATE.history.length > 50'), 'Undo stack must cap at 50 snapshots');
});

test('app.js defines independent element manipulation functions', () => {
    assert(appJsContent.includes('function addUiceElement('), 'Missing addUiceElement');
    assert(appJsContent.includes('function deleteUiceElement('), 'Missing deleteUiceElement');
    assert(appJsContent.includes('function duplicateUiceElement('), 'Missing duplicateUiceElement');
    assert(appJsContent.includes('function alignSelectedUiceElement('), 'Missing alignSelectedUiceElement');
    assert(appJsContent.includes('function computeUiceAlignmentGuides('), 'Missing computeUiceAlignmentGuides');
});

test('app.js defines live pixel rulers drawing logic', () => {
    assert(appJsContent.includes('function drawUiceRulers()'), 'Missing drawUiceRulers');
    assert(appJsContent.includes('uice-ruler-top-canvas'), 'Missing top ruler canvas access');
    assert(appJsContent.includes('uice-ruler-left-canvas'), 'Missing left ruler canvas access');
});

test('app.js defines generateUiceCardHtml and hooks into generateIdCardHtml', () => {
    assert(appJsContent.includes('function generateUiceCardHtml('), 'Missing generateUiceCardHtml');
    assert(appJsContent.includes('if (template && template.layouts && typeof generateUiceCardHtml === \'function\')'), 'Missing layout branch in generateIdCardHtml');
});

// ============================================================================
// 4. FUNCTIONAL EXECUTION & NODE MATHEMATICS
// ============================================================================
console.log('\n=== 4. FUNCTIONAL EXECUTION & NODE MATHEMATICS ===');

test('executes getUiceDefaultElements for Horizontal and checks coordinate coverage', () => {
    const fnMatch = appJsContent.match(/function getUiceDefaultElements\([\s\S]*?\n\}/);
    assert(fnMatch, 'Could not extract getUiceDefaultElements function');

    const evalFn = new Function(fnMatch[0] + '; return getUiceDefaultElements;');
    const getElements = evalFn();
    const elements = getElements('horizontal', {
        headerText: 'VALLEY SECURITY AGENCY',
        accentColor: '#009688',
        headerBgColor: '#0e3e2b'
    });

    assert(Array.isArray(elements), 'Elements must be an array');
    assert(elements.length >= 8, 'Horizontal layout must have at least 8 elements');

    const photo = elements.find(e => e.type === 'employee-photo');
    const qr = elements.find(e => e.type === 'qr-code');
    const barcode = elements.find(e => e.type === 'barcode');
    const header = elements.find(e => e.type === 'agency-brand');

    assert(photo, 'Photo element must exist');
    assert(qr, 'QR element must exist');
    assert(barcode, 'Barcode element must exist');
    assert(header, 'Header element must exist');

    assert(typeof photo.x === 'number' && typeof photo.y === 'number', 'Photo must have numeric X/Y');
    assert(typeof qr.x === 'number' && typeof qr.y === 'number', 'QR must have numeric X/Y');
    assert(typeof barcode.x === 'number' && typeof barcode.y === 'number', 'Barcode must have numeric X/Y');

    assert(photo.x < 100, 'Photo should be on left (x < 100)');
    assert(qr.x > 350, 'QR code should be on right (x > 350)');
});

test('executes getUiceDefaultElements for Vertical and checks independent geometry', () => {
    const fnMatch = appJsContent.match(/function getUiceDefaultElements\([\s\S]*?\n\}/);
    const evalFn = new Function(fnMatch[0] + '; return getUiceDefaultElements;');
    const getElements = evalFn();
    const elements = getElements('vertical', {
        headerText: 'VALLEY SECURITY AGENCY',
        accentColor: '#009688',
        headerBgColor: '#0e3e2b'
    });

    assert(Array.isArray(elements), 'Elements must be an array');
    assert(elements.length >= 8, 'Vertical layout must have at least 8 elements');

    const photo = elements.find(e => e.type === 'employee-photo');
    assert(photo, 'Vertical photo must exist');
    assert(photo.x >= 90 && photo.x <= 120, 'Vertical photo must be centered (x around 105)');
});

test('executes convertLegacyTemplateToUice and guarantees dual orientation layouts', () => {
    const fnMatch = appJsContent.match(/function convertLegacyTemplateToUice\([\s\S]*?\n\}/);
    const defFnMatch = appJsContent.match(/function getUiceDefaultElements\([\s\S]*?\n\}/);
    const evalFn = new Function(defFnMatch[0] + ';' + fnMatch[0] + '; return convertLegacyTemplateToUice;');
    const convertLegacy = evalFn();

    const mockLegacy = {
        id: 'tpl-classic-1',
        name: 'Guard Classic',
        headerText: 'VALLEY SECURITY AGENCY',
        headerBgColor: '#0e3e2b',
        accentColor: '#009688',
        layout: 'horizontal'
    };

    const upgraded = convertLegacy(mockLegacy);
    assert(upgraded.layouts, 'Upgraded template must have layouts property');
    assert(upgraded.layouts.horizontal, 'Must have horizontal layout');
    assert(upgraded.layouts.vertical, 'Must have vertical layout');
    assert.strictEqual(upgraded.layouts.horizontal.width, 500, 'Horizontal width must be 500');
    assert.strictEqual(upgraded.layouts.horizontal.height, 320, 'Horizontal height must be 320');
    assert.strictEqual(upgraded.layouts.vertical.width, 320, 'Vertical width must be 320');
    assert.strictEqual(upgraded.layouts.vertical.height, 500, 'Vertical height must be 500');
});

test('executes computeUiceAlignmentGuides and validates magnetic snapping', () => {
    const fnMatch = appJsContent.match(/function computeUiceAlignmentGuides\([\s\S]*?\n\}/);
    const evalFn = new Function(fnMatch[0] + '; return computeUiceAlignmentGuides;');
    const computeGuides = evalFn();

    const activeEl = { id: 'el-1', width: 100, height: 100 };
    const layout = {
        width: 500,
        height: 320,
        elements: [
            { id: 'el-2', x: 200, y: 150, width: 80, height: 80, visible: true }
        ]
    };

    const res = computeGuides(activeEl, 2, 50, layout);
    assert.strictEqual(res.x, 0, 'Should snap to canvas left border (0)');

    const resPeer = computeGuides(activeEl, 202, 50, layout);
    assert.strictEqual(resPeer.x, 200, 'Should snap to peer element left edge (200)');
    assert(resPeer.lines.length > 0, 'Should return active guide line definitions');
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
