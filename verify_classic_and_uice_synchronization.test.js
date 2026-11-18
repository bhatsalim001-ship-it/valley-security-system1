/**
 * Verification Suite: Classic ID Card Settings Overhaul & Advance UICE WYSIWYG Synchronization
 * Tests:
 * 1. Classic Horizontal Organic-Wave dynamic photo offset & dimensions
 * 2. Classic Horizontal QR code and barcode dynamic sizing
 * 3. UICE element renderer for svg-wave-top, svg-wave-bottom, and guilloche-waves
 * 4. UICE badge-pill styling (transparent background, serif font, text shadow)
 * 5. convertLegacyTemplateToUice organic-wave element generation
 * 6. Form control bindings for tpl-photo-top-offset
 * 7. Tab switching synchronization between Classic Form and UICE Canvas
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('======================================================');
console.log('VERIFYING CLASSIC CARD SETTINGS & UICE SYNCHRONIZATION');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function it(desc, fn) {
    try {
        fn();
        console.log(`  [PASS] ${desc}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${desc}\n  Error: ${err.message}`);
        failed++;
    }
}

const appJsPath = path.join(__dirname, 'public', 'app.js');
const indexHtmlPath = path.join(__dirname, 'public', 'index.html');
const appJs = fs.readFileSync(appJsPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// =========================================================================
// SECTION 1: HTML CONTROLS VERIFICATION
// =========================================================================
console.log('=== 1. HTML CONTROLS (INDEX.HTML) ===');

it('index.html contains tpl-photo-top-offset slider and label', () => {
    assert(indexHtml.includes('id="tpl-photo-top-offset"'), 'Missing tpl-photo-top-offset slider');
    assert(indexHtml.includes('id="lbl-photo-top-offset"'), 'Missing lbl-photo-top-offset label');
    assert(indexHtml.includes('Photo Down Offset'), 'Missing Photo Down Offset label text');
});

it('index.html tpl-photo-width and tpl-qr-size have expanded dynamic ranges', () => {
    assert(indexHtml.includes('id="tpl-photo-width"') && indexHtml.includes('max="145"'), 'tpl-photo-width should have max 145');
    assert(indexHtml.includes('id="tpl-qr-size"') && indexHtml.includes('max="150"'), 'tpl-qr-size should have max 150');
});

// =========================================================================
// SECTION 2: CLASSIC ID CARD HORIZONTAL ORGANIC-WAVE ENGINE
// =========================================================================
console.log('\n=== 2. CLASSIC FORM DYNAMIC CARD RENDERING ===');

it('generateIdCardHtml horizontal organic-wave uses pTopOffset and pDim', () => {
    assert(appJs.includes('const pTopOffset = template.photoTopOffset !== undefined ? template.photoTopOffset : 10;'), 'Missing pTopOffset in horizontal organic-wave');
    assert(appJs.includes('margin-top: ${pTopOffset}px;'), 'margin-top should use pTopOffset');
    assert(appJs.includes('width: ${pDim}px; height: ${pDim}px;'), 'Photo container should use dynamic pDim');
});

it('generateIdCardHtml horizontal organic-wave dynamically sizes QR container and canvas', () => {
    assert(appJs.includes('const qrBoxDim = qrSize || 48;'), 'Missing qrBoxDim');
    assert(appJs.includes('const qrCanvasDim = Math.max(24, qrBoxDim - 8);'), 'Missing qrCanvasDim calculation');
    assert(appJs.includes('width: ${qrBoxDim}px; height: ${qrBoxDim}px;'), 'QR container should use qrBoxDim');
    assert(appJs.includes('data-qr-size="${qrCanvasDim}"'), 'QR canvas should use qrCanvasDim');
});

// =========================================================================
// SECTION 3: UICE CANVAS ENGINE THEME NODES & RENDERER
// =========================================================================
console.log('\n=== 3. ADVANCE ID CARD (UICE) WYSIWYG ENGINE ===');

it('getUiceDefaultElements generates svg-wave-top, guilloche-waves, and svg-wave-bottom for organic-wave', () => {
    assert(appJs.includes("type: 'svg-wave-top'"), "getUiceDefaultElements missing type: 'svg-wave-top'");
    assert(appJs.includes("type: 'guilloche-waves'"), "getUiceDefaultElements missing type: 'guilloche-waves'");
    assert(appJs.includes("type: 'svg-wave-bottom'"), "getUiceDefaultElements missing type: 'svg-wave-bottom'");
});

it('renderUiceElementHtml has renderer cases for svg-wave-top, svg-wave-bottom, and guilloche-waves', () => {
    assert(appJs.includes("case 'svg-wave-top':"), "renderUiceElementHtml missing case 'svg-wave-top'");
    assert(appJs.includes("case 'svg-wave-bottom':"), "renderUiceElementHtml missing case 'svg-wave-bottom'");
    assert(appJs.includes("case 'guilloche-waves':"), "renderUiceElementHtml missing case 'guilloche-waves'");
    assert(appJs.includes('hanoverWaveGradH') || appJs.includes('uiceWaveGrad_'), 'svg-wave-top should generate linear gradient');
});

it('renderUiceElementHtml badge-pill supports transparent background, serif typography, and text shadow', () => {
    assert(appJs.includes("const isTransparent = p.background === 'transparent' || !p.background;"), 'badge-pill should handle transparent background');
    assert(appJs.includes("text-shadow: 0 2px 5px rgba(0,0,0,0.45);"), 'badge-pill should render text shadow when transparent');
    assert(appJs.includes("font-family: ${fontFamily};"), 'badge-pill should apply fontFamily');
});

it('UICE_STATE initializes with showGrid: false to prevent distracting graph paper overlay', () => {
    assert(appJs.includes('showGrid: false'), 'UICE_STATE should default showGrid to false');
});

// =========================================================================
// SECTION 4: FORM & TAB SYNCHRONIZATION
// =========================================================================
console.log('\n=== 4. FORM & TAB SYNCHRONIZATION ===');

it('getActiveTemplateFromForm extracts and returns photoTopOffset', () => {
    assert(appJs.includes("const photoTopOffset = document.getElementById('tpl-photo-top-offset') ? parseInt(document.getElementById('tpl-photo-top-offset').value) : 10;"), 'getActiveTemplateFromForm missing photoTopOffset extraction');
    assert(appJs.includes('photoTopOffset,') && appJs.includes('isVisualTemplate: true'), 'getActiveTemplateFromForm should return photoTopOffset');
});

it('loadTemplateInStudio populates tpl-photo-top-offset and lbl-photo-top-offset', () => {
    assert(appJs.includes("document.getElementById('tpl-photo-top-offset').value = photoTopOffsetVal;"), 'loadTemplateInStudio should set slider value');
    assert(appJs.includes("document.getElementById('lbl-photo-top-offset').textContent = photoTopOffsetVal;"), 'loadTemplateInStudio should set label text');
});

it('resetTemplateForm resets tpl-photo-top-offset to 10', () => {
    assert(appJs.includes("document.getElementById('tpl-photo-top-offset').value = 10;"), 'resetTemplateForm should reset slider value to 10');
    assert(appJs.includes("document.getElementById('lbl-photo-top-offset').textContent = 10;"), 'resetTemplateForm should reset label text to 10');
});

it('rangeSliders array includes tpl-photo-top-offset for live updates', () => {
    assert(appJs.includes("'tpl-photo-top-offset'"), "rangeSliders should include 'tpl-photo-top-offset'");
    assert(appJs.includes("if (id === 'tpl-photo-top-offset')"), 'setupTemplatesManager should update lbl-photo-top-offset on slider input');
});

it('Tab switching from Classic to Visual initializes UICE with current form template', () => {
    assert(appJs.includes("tabVisual.addEventListener('click'"), 'tabVisual listener missing');
    assert(appJs.includes('initUiceWithTemplate(currentFormTpl)'), 'tabVisual listener should call initUiceWithTemplate(currentFormTpl)');
});

it('convertLegacyTemplateToUice regenerates organic-wave elements if missing and syncs colors', () => {
    assert(appJs.includes("(tpl.cardTheme === 'organic-wave' && !tpl.layouts.horizontal.elements.some(e => e.type === 'svg-wave-top'))"), 'convertLegacyTemplateToUice should detect missing theme elements');
    assert(appJs.includes("e.type === 'svg-wave-top' || e.type === 'svg-wave-bottom'"), 'convertLegacyTemplateToUice should sync colors to theme elements');
});

it('applyMasterClonePreset sets photoTopOffset and synchronizes UICE', () => {
    assert(appJs.includes("setSlider('tpl-photo-top-offset'"), 'applyMasterClonePreset should set tpl-photo-top-offset');
    assert(appJs.includes("MASTER_CLONE_PRESETS = {"), 'MASTER_CLONE_PRESETS defined');
});

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log('======================================================\n');

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
