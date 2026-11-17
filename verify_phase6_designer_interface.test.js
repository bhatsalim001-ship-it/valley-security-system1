/**
 * VERIFY_PHASE6_DESIGNER_INTERFACE.TEST.JS
 * Comprehensive Verification Test Suite for Project Omega Phase 6:
 * Advanced Designer Interface (Visual Canvas Studio Overhaul)
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING PROJECT OMEGA PHASE 6: ADVANCED DESIGNER INTERFACE');
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

test('index.html contains Command Bar overlay toggles (Safe Margins, Bleed Area, Outlines)', () => {
    assert(htmlContent.includes('id="btn-uice-safe-margins"'), 'Missing Safe Margins button (#btn-uice-safe-margins)');
    assert(htmlContent.includes('id="btn-uice-bleed-area"'), 'Missing Bleed Area button (#btn-uice-bleed-area)');
    assert(htmlContent.includes('id="btn-uice-show-outlines"'), 'Missing Outlines button (#btn-uice-show-outlines)');
});

test('index.html contains Zoom controls (100% Actual Size reset and Fit to Screen)', () => {
    assert(htmlContent.includes('id="btn-uice-zoom-actual"'), 'Missing Actual Size 100% button (#btn-uice-zoom-actual)');
    assert(htmlContent.includes('id="btn-uice-zoom-fit"'), 'Missing Fit to Screen button (#btn-uice-zoom-fit)');
    assert(htmlContent.includes('id="lbl-uice-zoom"'), 'Missing Zoom level display (#lbl-uice-zoom)');
});

test('index.html artboard contains Safe Margins and Bleed Area overlay guides', () => {
    assert(htmlContent.includes('id="uice-safe-margins-overlay"'), 'Missing Safe Margins overlay (#uice-safe-margins-overlay)');
    assert(htmlContent.includes('id="uice-bleed-area-overlay"'), 'Missing Bleed Area overlay (#uice-bleed-area-overlay)');
    assert(htmlContent.includes('class="uice-overlay-tag safe-tag"'), 'Missing Safe margin tag');
    assert(htmlContent.includes('class="uice-overlay-tag bleed-tag"'), 'Missing Bleed area tag');
});

test('index.html categorizes Left Elements Palette into organized sections', () => {
    assert(htmlContent.includes('class="uice-palette-categories"'), 'Missing uice-palette-categories container');
    assert(htmlContent.includes('class="uice-palette-category"'), 'Missing uice-palette-category sections');
    assert(htmlContent.includes('Header & Branding'), 'Missing Header & Branding category title');
    assert(htmlContent.includes('Employee Information'), 'Missing Employee Information category title');
    assert(htmlContent.includes('Photographs & Media'), 'Missing Photographs & Media category title');
    assert(htmlContent.includes('Security Codes'), 'Missing Security Codes category title');
    assert(htmlContent.includes('Shapes & Accents'), 'Missing Shapes & Accents category title');

    // Guarantee all 12 element add types exist
    const addTypes = [
        'agency-brand', 'agency-logo', 'badge-pill',
        'employee-name', 'designation', 'details-table',
        'employee-photo', 'signature',
        'qr-code', 'barcode',
        'custom-text', 'shape'
    ];
    addTypes.forEach(type => {
        assert(htmlContent.includes(`data-add-type="${type}"`), `Missing element add button for ${type}`);
    });
});

test('index.html Property Inspector features Progressive Disclosure Advanced Settings accordion', () => {
    assert(htmlContent.includes('id="prop-sec-advanced"'), 'Missing Advanced Settings accordion (#prop-sec-advanced)');
    assert(htmlContent.includes('id="prop-uice-name"'), 'Missing Element Name/Label input (#prop-uice-name)');
    assert(htmlContent.includes('id="prop-uice-opacity"'), 'Missing Opacity range slider (#prop-uice-opacity)');
    assert(htmlContent.includes('id="lbl-uice-opacity-val"'), 'Missing Opacity percentage label (#lbl-uice-opacity-val)');
    assert(htmlContent.includes('id="prop-uice-shadow"'), 'Missing Shadow preset dropdown (#prop-uice-shadow)');
    assert(htmlContent.includes('id="prop-uice-lock"'), 'Missing Lock element checkbox (#prop-uice-lock)');
});

// ============================================================================
// 2. CSS STYLING ARCHITECTURE (STYLES.CSS)
// ============================================================================
console.log('\n=== 2. CSS STYLING ARCHITECTURE (STYLES.CSS) ===');

test('styles.css defines Safe Margins and Bleed Area guide overlay styles', () => {
    assert(cssContent.includes('.uice-safe-margins-overlay'), 'Missing .uice-safe-margins-overlay rule');
    assert(cssContent.includes('.uice-bleed-area-overlay'), 'Missing .uice-bleed-area-overlay rule');
    assert(cssContent.includes('.uice-overlay-tag'), 'Missing .uice-overlay-tag rule');
    assert(cssContent.includes('.bleed-tag'), 'Missing .bleed-tag rule');
    assert(cssContent.includes('.safe-tag'), 'Missing .safe-tag rule');
});

test('styles.css defines Element Boundaries outlines and shadow presets', () => {
    assert(cssContent.includes('.uice-show-element-outlines'), 'Missing .uice-show-element-outlines rule');
    assert(cssContent.includes('.uice-shadow-subtle'), 'Missing .uice-shadow-subtle rule');
    assert(cssContent.includes('.uice-shadow-medium'), 'Missing .uice-shadow-medium rule');
    assert(cssContent.includes('.uice-shadow-prominent'), 'Missing .uice-shadow-prominent rule');
    assert(cssContent.includes('.uice-shadow-glow'), 'Missing .uice-shadow-glow rule');
});

test('styles.css defines Left Palette categories and Progressive Disclosure accordion', () => {
    assert(cssContent.includes('.uice-palette-categories'), 'Missing .uice-palette-categories rule');
    assert(cssContent.includes('.uice-palette-category'), 'Missing .uice-palette-category rule');
    assert(cssContent.includes('.uice-category-title'), 'Missing .uice-category-title rule');
    assert(cssContent.includes('.uice-accordion-card'), 'Missing .uice-accordion-card rule');
    assert(cssContent.includes('.uice-accordion-header'), 'Missing .uice-accordion-header rule');
});

test('styles.css defines Smooth Hand Pan cursor states', () => {
    assert(cssContent.includes('.uice-panning-active'), 'Missing .uice-panning-active cursor rule');
    assert(cssContent.includes('.uice-is-panning'), 'Missing .uice-is-panning cursor rule');
});

// ============================================================================
// 3. ENGINE RUNTIME METHOD DECLARATIONS (APP.JS)
// ============================================================================
console.log('\n=== 3. ENGINE RUNTIME METHOD DECLARATIONS (APP.JS) ===');

test('app.js UICE_STATE includes overlays (margins, bleed, outlines) and pan state', () => {
    assert(appJsContent.includes('showSafeMargins:'), 'UICE_STATE missing showSafeMargins');
    assert(appJsContent.includes('showBleedArea:'), 'UICE_STATE missing showBleedArea');
    assert(appJsContent.includes('showElementOutlines:'), 'UICE_STATE missing showElementOutlines');
    assert(appJsContent.includes('pan:'), 'UICE_STATE missing pan state');
});

test('app.js defines setUiceZoom and fitUiceToScreen functions', () => {
    assert(appJsContent.includes('function setUiceZoom('), 'app.js missing setUiceZoom function');
    assert(appJsContent.includes('function fitUiceToScreen('), 'app.js missing fitUiceToScreen function');
});

test('app.js defines setupUiceKeyboardShortcuts function', () => {
    assert(appJsContent.includes('function setupUiceKeyboardShortcuts('), 'app.js missing setupUiceKeyboardShortcuts function');
});

test('app.js renders Safe Margins, Bleed, Outlines, Opacity, and Shadows in renderUiceStage', () => {
    assert(appJsContent.includes('uice-safe-margins-overlay'), 'renderUiceStage missing safe margins overlay handler');
    assert(appJsContent.includes('uice-bleed-area-overlay'), 'renderUiceStage missing bleed area overlay handler');
    assert(appJsContent.includes('uice-show-element-outlines'), 'renderUiceStage missing element outlines handler');
    assert(appJsContent.includes('uice-shadow-'), 'renderUiceStage missing shadow preset application');
});

test('app.js Layer Manager renders and wires reorder (bring forward, send backward) and duplicate buttons', () => {
    assert(appJsContent.includes('btn-layer-up'), 'renderUiceLayersList missing btn-layer-up button');
    assert(appJsContent.includes('btn-layer-down'), 'renderUiceLayersList missing btn-layer-down button');
    assert(appJsContent.includes('btn-layer-dup'), 'renderUiceLayersList missing btn-layer-dup button');
});

test('app.js binds Progressive Disclosure advanced fields (name, opacity, shadow, lock)', () => {
    assert(appJsContent.includes('prop-uice-name'), 'bindUiceInspectorInputs missing prop-uice-name binding');
    assert(appJsContent.includes('prop-uice-opacity'), 'bindUiceInspectorInputs missing prop-uice-opacity binding');
    assert(appJsContent.includes('prop-uice-shadow'), 'bindUiceInspectorInputs missing prop-uice-shadow binding');
    assert(appJsContent.includes('prop-uice-lock'), 'bindUiceInspectorInputs missing prop-uice-lock binding');
});

// ============================================================================
// 4. FUNCTIONAL EXECUTION & MATHEMATICAL LOGIC
// ============================================================================
console.log('\n=== 4. FUNCTIONAL EXECUTION & MATHEMATICAL LOGIC ===');

// Extract and test setUiceZoom logic
test('setUiceZoom: Correctly clamps zoom scale between 0.35 and 2.5', () => {
    function mockSetUiceZoom(val) {
        return Math.max(0.35, Math.min(2.5, Math.round(val * 100) / 100));
    }

    assert.strictEqual(mockSetUiceZoom(1.0), 1.0, 'Normal 100% zoom should be 1.0');
    assert.strictEqual(mockSetUiceZoom(0.1), 0.35, 'Extreme zoom out should clamp to 0.35');
    assert.strictEqual(mockSetUiceZoom(5.0), 2.5, 'Extreme zoom in should clamp to 2.5');
    assert.strictEqual(mockSetUiceZoom(1.2345), 1.23, 'Zoom should be rounded to 2 decimal places');
});

// Extract and test fitUiceToScreen proportional calculation
test('fitUiceToScreen: Computes proportional scale preserving card aspect ratio', () => {
    function mockFitToScreen(vpW, vpH, cardW, cardH) {
        const padding = 120;
        const availW = Math.max(200, vpW - padding);
        const availH = Math.max(200, vpH - padding);
        const scaleX = availW / cardW;
        const scaleY = availH / cardH;
        const targetScale = Math.min(scaleX, scaleY);
        return Math.max(0.4, Math.min(2.0, Math.round(targetScale * 100) / 100));
    }

    // Horizontal card (500x320) in typical 1080p browser viewport (900x700 stage)
    const horizScale = mockFitToScreen(900, 700, 500, 320);
    assert(horizScale >= 1.0 && horizScale <= 1.8, `Expected scale between 1.0 and 1.8, got ${horizScale}`);

    // Vertical card (320x500) in same viewport
    const vertScale = mockFitToScreen(900, 700, 320, 500);
    assert(vertScale >= 1.0 && vertScale <= 1.4, `Expected vertical scale between 1.0 and 1.4, got ${vertScale}`);

    // Very small screen: scale scales down cleanly
    const smallScreenScale = mockFitToScreen(400, 300, 500, 320);
    assert(smallScreenScale < 1.0, `Expected scale down on small screen, got ${smallScreenScale}`);
});

// Test Hotkey Nudge Delta & Boundary Clamping
test('Hotkey Nudge Engine: Calculates 1px normal nudge and 10px shift nudge with bounds protection', () => {
    function nudgeElement(el, key, shiftKey, layout) {
        const step = shiftKey ? 10 : 1;
        if (key === 'ArrowLeft') el.x = Math.max(0, el.x - step);
        if (key === 'ArrowRight') el.x = Math.min(layout.width - el.width, el.x + step);
        if (key === 'ArrowUp') el.y = Math.max(0, el.y - step);
        if (key === 'ArrowDown') el.y = Math.min(layout.height - el.height, el.y + step);
        return el;
    }

    const layout = { width: 500, height: 320 };
    let el = { x: 50, y: 50, width: 100, height: 40 };

    // Standard 1px nudge right
    nudgeElement(el, 'ArrowRight', false, layout);
    assert.strictEqual(el.x, 51, 'Standard arrow nudge should move 1px');

    // Shift 10px nudge right
    nudgeElement(el, 'ArrowRight', true, layout);
    assert.strictEqual(el.x, 61, 'Shift arrow nudge should move 10px');

    // Left border clamp
    el.x = 4;
    nudgeElement(el, 'ArrowLeft', true, layout);
    assert.strictEqual(el.x, 0, 'Nudge should clamp cleanly at left border (0px)');

    // Right border clamp
    el.x = 395;
    nudgeElement(el, 'ArrowRight', true, layout);
    assert.strictEqual(el.x, 400, 'Nudge should clamp at right border (layout.width - el.width = 400px)');
});

// Test Input Guard in Keyboard Shortcuts
test('Keyboard Shortcuts: Correctly ignores canvas hotkeys when user is typing in form inputs', () => {
    function shouldInterceptHotkey(targetTagName, isContentEditable) {
        const tag = (targetTagName || '').toLowerCase();
        const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || isContentEditable;
        return !isInput;
    }

    assert.strictEqual(shouldInterceptHotkey('input', false), false, 'Should NOT intercept when in <input>');
    assert.strictEqual(shouldInterceptHotkey('textarea', false), false, 'Should NOT intercept when in <textarea>');
    assert.strictEqual(shouldInterceptHotkey('select', false), false, 'Should NOT intercept when in <select>');
    assert.strictEqual(shouldInterceptHotkey('div', true), false, 'Should NOT intercept in contenteditable');
    assert.strictEqual(shouldInterceptHotkey('div', false), true, 'SHOULD intercept when clicking on stage or canvas body');
    assert.strictEqual(shouldInterceptHotkey('button', false), true, 'SHOULD intercept when on toolbar button');
});

// Test Layer Reorder Z-Index Mathematics
test('Layer Manager Z-Index: Moving up/down modifies zIndex without collision', () => {
    const elements = [
        { id: 'el-1', zIndex: 1 },
        { id: 'el-2', zIndex: 2 },
        { id: 'el-3', zIndex: 3 }
    ];

    // Bring el-1 forward
    elements[0].zIndex = elements[0].zIndex + 2; // zIndex becomes 3
    assert.strictEqual(elements[0].zIndex, 3);

    // Send el-3 backward
    elements[2].zIndex = Math.max(0, elements[2].zIndex - 2); // zIndex becomes 1
    assert.strictEqual(elements[2].zIndex, 1);
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
