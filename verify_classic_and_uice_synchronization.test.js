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

console.log('\n=== 5. OFFICE TEMPLATE PERSISTENCE & SYNCHRONIZATION ===');
it('index.html contains 1-click clone button for office template', () => {
    assert(indexHtml.includes('data-clone="office"'), 'index.html missing data-clone="office" button');
    assert(indexHtml.includes('Office Pass'), 'index.html missing Office Pass label');
});

it('MASTER_CLONE_PRESETS contains office preset with red wave styling', () => {
    assert(appJs.includes("'office': {"), "MASTER_CLONE_PRESETS missing 'office' preset");
    assert(appJs.includes("name: 'office'"), "'office' preset missing name: 'office'");
    assert(appJs.includes("cardTitle: 'ADMIN'"), "'office' preset missing cardTitle: 'ADMIN'");
    assert(appJs.includes("headerBgColor: '#7a0c0c'"), "'office' preset missing headerBgColor: '#7a0c0c'");
    assert(appJs.includes("accentColor: '#c8102e'"), "'office' preset missing accentColor: '#c8102e'");
    assert(appJs.includes("valueColor: '#c8102e'"), "'office' preset missing valueColor: '#c8102e'");
    assert(appJs.includes("barcodePosition: 'bottom-center'"), "'office' preset missing barcodePosition: 'bottom-center'");
});

it('server.js seeds tpl-office into PostgreSQL database', () => {
    const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');
    assert(serverJs.includes("id: 'tpl-office'"), "server.js missing seed for 'tpl-office'");
    assert(serverJs.includes("name: 'office'"), "server.js missing office template name in seed");
});

it('generateIdCardHtml organic-wave supports isQrUnderPhoto layout', () => {
    assert(appJs.includes('const isQrUnderPhoto = template.barcodePosition === \'bottom-center\''), 'generateIdCardHtml missing isQrUnderPhoto calculation');
    assert(appJs.includes("${isQrUnderPhoto ? `"), 'generateIdCardHtml missing conditional render based on isQrUnderPhoto');
});

it('getUiceDefaultElements positions QR under photo and barcode under table for office', () => {
    // Extract getUiceDefaultElements
    const startIdx = appJs.indexOf('function getUiceDefaultElements');
    assert(startIdx !== -1, 'getUiceDefaultElements missing in app.js');
    const endIdx = appJs.indexOf('\nfunction getUiceDefaultBackElements');
    assert(endIdx !== -1, 'getUiceDefaultBackElements boundary missing');
    const fnCode = appJs.substring(startIdx, endIdx);
    const getUiceDefaultElements = new Function(`${fnCode}; return getUiceDefaultElements;`)();
    
    const elements = getUiceDefaultElements('horizontal', {
        id: 'tpl-office',
        name: 'office',
        cardTheme: 'organic-wave',
        barcodePosition: 'bottom-center',
        accentColor: '#c8102e'
    });

    const qr = elements.find(e => e.type === 'qr-code');
    const barcode = elements.find(e => e.type === 'barcode');
    const sig = elements.find(e => e.type === 'signature');
    const table = elements.find(e => e.type === 'details-table');

    assert(qr, 'qr-code element missing');
    assert.strictEqual(qr.x, 44, 'qr-code x coordinate should be 44 (under photo)');
    assert.strictEqual(qr.y, 195, 'qr-code y coordinate should be 195 (under photo)');

    assert(barcode, 'barcode element missing');
    assert.strictEqual(barcode.x, 160, 'barcode x coordinate should be 160 (under details table)');
    assert.strictEqual(barcode.y, 248, 'barcode y coordinate should be 248 (under details table)');

    assert(sig, 'signature element missing');
    assert.strictEqual(sig.x, 345, 'signature x coordinate should be 345');
    assert.strictEqual(sig.y, 246, 'signature y coordinate should be 246');

    assert(table, 'details-table element missing');
    assert.strictEqual(table.properties.valueColor, '#c8102e', 'table valueColor should be #c8102e');
});

console.log('\n=== 6. DUAL-SIDED TEMPLATE CREATION & NAME PROMPTING ===');
it('public/app.js defines promptAndCreateNewTemplate with name prompting and immediate persistence', () => {
    assert(appJs.includes('async function promptAndCreateNewTemplate('), 'promptAndCreateNewTemplate function missing');
    assert(appJs.includes("prompt('What would you like to name your new template?'"), 'promptAndCreateNewTemplate missing name prompt');
    assert(appJs.includes("method: 'POST'"), 'promptAndCreateNewTemplate should POST to /api/templates');
    assert(appJs.includes('populateSelectors()'), 'promptAndCreateNewTemplate should call populateSelectors');
    assert(appJs.includes('loadTemplateInStudio(savedTpl.id)'), 'promptAndCreateNewTemplate should load saved template');
});

it('Classic and Advance buttons wire to promptAndCreateNewTemplate', () => {
    assert(appJs.includes("btnNew.addEventListener('click', () => promptAndCreateNewTemplate('classic'))"), 'btnNew not wired to promptAndCreateNewTemplate');
    assert(appJs.includes("btnNewTop.addEventListener('click', () => promptAndCreateNewTemplate('classic'))"), 'btnNewTop not wired to promptAndCreateNewTemplate');
    assert(appJs.includes("promptAndCreateNewTemplate('visual')"), 'btnNewTpl in UICE not wired to promptAndCreateNewTemplate');
});

it('populateSelectors populates uice-top-tpl-select across both sides', () => {
    assert(appJs.includes("const topTplSel = document.getElementById('uice-top-tpl-select')"), 'populateSelectors should query uice-top-tpl-select');
    assert(appJs.includes("topTplSel.innerHTML = tplHtml;"), 'populateSelectors should populate topTplSel with tplHtml');
});

it('cloneUiceTemplate prompts for name and immediately saves to database', () => {
    assert(appJs.includes("prompt('What would you like to name this cloned template?'"), 'cloneUiceTemplate should prompt for clone name');
    assert(appJs.includes("body: JSON.stringify(clone)"), 'cloneUiceTemplate should persist clone via API');
});

it('server.js preserves office template in GET /api/templates', () => {
    const serverJs = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf-8');
    assert(serverJs.includes("Auto-reseeded missing office template into templates collection"), 'server.js missing auto-reseed logic in GET /api/templates');
});

console.log('\n======================================================');
console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log('======================================================\n');

if (failed > 0) {
    process.exit(1);
} else {
    process.exit(0);
}
