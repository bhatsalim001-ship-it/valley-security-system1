/**
 * Automated Verification Test Suite: Phase 9
 * Security Overlays, Dynamic Token Binding & System-Wide Integration
 * Project Omega: Complete ID Card Design Engine Overhaul
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- STARTING PHASE 9: SECURITY OVERLAYS & DYNAMIC TOKEN BINDING SUITE ---');

// 1. Read source files
const appJsPath = path.join(__dirname, 'public', 'app.js');
const indexHtmlPath = path.join(__dirname, 'public', 'index.html');
const stylesCssPath = path.join(__dirname, 'public', 'styles.css');

assert(fs.existsSync(appJsPath), 'public/app.js must exist');
assert(fs.existsSync(indexHtmlPath), 'public/index.html must exist');
assert(fs.existsSync(stylesCssPath), 'public/styles.css must exist');

const appJs = fs.readFileSync(appJsPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const stylesCss = fs.readFileSync(stylesCssPath, 'utf8');

// 2. Setup isolated sandbox environment
const sandbox = {
    console,
    Math,
    Date,
    String,
    parseInt,
    parseFloat,
    isNaN,
    Array,
    Object,
    RegExp,
    JSON,
    setTimeout: () => {},
    clearTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {},
    escapeHtml: (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    toTitleCase: (str) => String(str || '').replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()),
    getVsaDefaultLogo: () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    getVsaDefaultSig: () => 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
    window: {
        location: { hostname: 'localhost', host: 'localhost:3000', protocol: 'http:' },
        addEventListener: () => {},
        removeEventListener: () => {}
    },
    document: {
        getElementById: () => null,
        querySelectorAll: () => [],
        createElement: () => ({ style: {}, appendChild: () => {} }),
        head: { appendChild: () => {} },
        body: { appendChild: () => {}, removeChild: () => {} },
        addEventListener: () => {},
        removeEventListener: () => {}
    },
    VSA_STATE: {
        employees: [
            {
                id: 'VSA-1001',
                name: 'Tariq Ahmad Sheikh',
                fullName: 'Tariq Ahmad Sheikh',
                designation: 'Senior Armed Escort Commander',
                role: 'Senior Armed Escort Commander',
                department: 'Special Security Group',
                fatherName: 'Mohammad Sheikh',
                bloodGroup: 'B+',
                mobile: '+91 9419123456',
                phone: '+91 9419123456',
                currentAddress: 'Lal Chowk, Srinagar, J&K - 190001',
                policeStation: 'Kothi Bagh',
                aadhaar: '123456789012',
                aadhaarLast4: '9012',
                joiningDate: '2023-04-15',
                cardIssueDate: '2024-01-10',
                cardValidity: 3,
                deployedSite: 'Kashmir Valley Corporate HQ',
                rank: 'Commander',
                zone: 'Central Valley'
            }
        ],
        templates: [],
        singleCardPreviewSurface: 'front'
    },
    UICE_STATE: {
        selectedId: null,
        orientation: 'horizontal',
        previewEmp: null,
        template: {
            id: 'tpl-omega-test',
            name: 'Omega Test',
            layout: 'horizontal',
            layouts: {
                horizontal: {
                    width: 500,
                    height: 320,
                    elements: [],
                    backElements: []
                }
            }
        }
    }
};

// Create sandbox runner
const vm = require('vm');
const context = vm.createContext(sandbox);

// Execute app.js in sandbox
try {
    vm.runInContext(appJs, context);
    console.log('✓ app.js successfully evaluated in test sandbox');
} catch (e) {
    console.error('Error evaluating app.js in test sandbox:', e);
    throw e;
}

// =========================================================================
// TEST 1: DYNAMIC TOKEN RESOLUTION ENGINE (resolveUiceTokens)
// =========================================================================
console.log('\n--- TEST 1: Testing Dynamic Token Resolution Engine ---');

const resolveUiceTokens = sandbox.resolveUiceTokens;
assert(typeof resolveUiceTokens === 'function', 'resolveUiceTokens must be defined');

const emp = sandbox.VSA_STATE.employees[0];

// Test basic tokens
assert.strictEqual(resolveUiceTokens('{{name}}', emp), 'Tariq Ahmad Sheikh');
assert.strictEqual(resolveUiceTokens('{{empId}}', emp), 'VSA-1001');
assert.strictEqual(resolveUiceTokens('{{id}}', emp), 'VSA-1001');
assert.strictEqual(resolveUiceTokens('{{designation}}', emp), 'Senior Armed Escort Commander');
assert.strictEqual(resolveUiceTokens('{{department}}', emp), 'Special Security Group');
assert.strictEqual(resolveUiceTokens('{{fatherName}}', emp), 'Mohammad Sheikh');
assert.strictEqual(resolveUiceTokens('{{bloodGroup}}', emp), 'B+');
assert.strictEqual(resolveUiceTokens('{{phone}}', emp), '+91 9419123456');
assert.strictEqual(resolveUiceTokens('{{policeStation}}', emp), 'Kothi Bagh');
assert.strictEqual(resolveUiceTokens('{{aadhaarLast4}}', emp), 'XXXX-XXXX-9012');
assert.strictEqual(resolveUiceTokens('{{site}}', emp), 'Kashmir Valley Corporate HQ');
assert.strictEqual(resolveUiceTokens('{{rank}}', emp), 'Commander');
assert.strictEqual(resolveUiceTokens('{{zone}}', emp), 'Central Valley');

console.log('✓ All standard employee profile tokens verified');

// Test Case-insensitivity
assert.strictEqual(resolveUiceTokens('{{NAME}} - {{EMPID}}', emp), 'Tariq Ahmad Sheikh - VSA-1001');
assert.strictEqual(resolveUiceTokens('{{Designation}}', emp), 'Senior Armed Escort Commander');
console.log('✓ Case-insensitive token replacement verified');

// Test date calculations
const testIssue = '2025-06-01';
const resIssue = resolveUiceTokens('{{issueDate}}', emp, 3, testIssue);
const resValid = resolveUiceTokens('{{validUntil}}', emp, 3, testIssue);
assert.strictEqual(resIssue, '01-06-2025');
assert.strictEqual(resValid, '01-06-2028');

// Test custom 5-year validity
const resValid5Yr = resolveUiceTokens('{{validUntil}}', emp, 5, testIssue);
assert.strictEqual(resValid5Yr, '01-06-2030');
console.log('✓ Issue date and validity offset calculations verified (3-yr and 5-yr offsets)');

// Test multiple tokens in continuous prose
const multiTokenStr = 'SECURITY CREDENTIAL FOR {{name}} (ID: {{empId}}), DEPLOYED AT {{site}}, VALID UNTIL {{validUntil}}';
const multiResolved = resolveUiceTokens(multiTokenStr, emp, 3, testIssue);
assert(multiResolved.includes('Tariq Ahmad Sheikh'), 'Must contain resolved name');
assert(multiResolved.includes('VSA-1001'), 'Must contain resolved empId');
assert(multiResolved.includes('Kashmir Valley Corporate HQ'), 'Must contain resolved site');
assert(multiResolved.includes('01-06-2028'), 'Must contain resolved validUntil');
console.log('✓ Multi-token sentence interpolation verified');

// Test empty / fallback cases
const emptyResolved = resolveUiceTokens('{{name}} - {{empId}}', {});
assert(emptyResolved.includes('Rajesh Kumar'), 'Fallback name must be provided');
assert(emptyResolved.includes('VSA-0042'), 'Fallback ID must be provided');
console.log('✓ Graceful token fallbacks verified');


// =========================================================================
// TEST 2: ENTERPRISE ANTI-COUNTERFEIT SECURITY OVERLAYS
// =========================================================================
console.log('\n--- TEST 2: Testing Enterprise Anti-Counterfeit Security Overlays ---');

// 2A: Guilloche Security Wave Pattern
const generateGuillocheSvg = sandbox.generateGuillocheSvg;
assert(typeof generateGuillocheSvg === 'function', 'generateGuillocheSvg must be defined');

const guillocheSvg = generateGuillocheSvg(480, 80, {
    strokeColor: '#009688',
    strokeWidth: 0.8,
    frequency: 5,
    waveCount: 10,
    amplitude: 15,
    opacity: 0.3,
    style: 'harmonic'
});

assert(guillocheSvg.includes('<svg'), 'Guilloche must return SVG');
assert(guillocheSvg.includes('viewBox="0 0 480 80"'), 'SVG must use correct dimensions');
assert(guillocheSvg.includes('stroke="#009688"'), 'SVG must use configured stroke color');
assert(guillocheSvg.includes('stroke-width="0.8"'), 'SVG must use configured stroke width');
assert(guillocheSvg.includes('opacity: 0.3'), 'SVG must use configured opacity');
assert(guillocheSvg.includes('<path d="M'), 'SVG must contain wave path curves');

// Test spirograph and sinusoidal styles
const spiroSvg = generateGuillocheSvg(300, 60, { style: 'spirograph' });
assert(spiroSvg.includes('<path d="M'), 'Spirograph style must generate paths');
const sinSvg = generateGuillocheSvg(300, 60, { style: 'sinusoidal' });
assert(sinSvg.includes('<path d="M'), 'Sinusoidal style must generate paths');
console.log('✓ Guilloche Vector Spirograph Engine verified (harmonic, spirograph, sinusoidal)');

// 2B: Holographic Security Foil Badge
const generateHologramFoilHtml = sandbox.generateHologramFoilHtml;
assert(typeof generateHologramFoilHtml === 'function', 'generateHologramFoilHtml must be defined');

const holoHtml = generateHologramFoilHtml({ width: 50, height: 50 }, {
    foilStyle: 'prismatic',
    badgeShape: 'circle',
    crest: 'vsa-crest',
    label: 'AUTHENTIC'
});

assert(holoHtml.includes('uice-hologram-badge'), 'Hologram must include badge class');
assert(holoHtml.includes('uice-hologram-prismatic'), 'Hologram must include prismatic foil class');
assert(holoHtml.includes('uice-hologram-circle'), 'Hologram must include circle shape class');
assert(holoHtml.includes('uice-hologram-shimmer'), 'Hologram must include animated shimmer element');
assert(holoHtml.includes('AUTHENTIC'), 'Hologram must include custom security label');

// Test gold, silver, emerald foil styles
['silver', 'gold', 'emerald'].forEach(f => {
    const fHtml = generateHologramFoilHtml({}, { foilStyle: f });
    assert(fHtml.includes(`uice-hologram-${f}`), `Must support foilStyle: ${f}`);
});
console.log('✓ Holographic Diffraction Foil Badge verified across all 4 luster presets');

// 2C: Microtext Anti-Copy Line
const generateMicrotextLineHtml = sandbox.generateMicrotextLineHtml;
assert(typeof generateMicrotextLineHtml === 'function', 'generateMicrotextLineHtml must be defined');

const microHtml = generateMicrotextLineHtml(
    { width: 400, height: 8 },
    {
        text: 'VALLEY SECURITY AGENCY • CREDENTIAL {{empId}} • {{name}} • ',
        fontSize: 4.5,
        letterSpacing: 1.5,
        color: '#1e293b',
        repeatCount: 5,
        opacity: 0.9
    },
    emp,
    3,
    testIssue
);

assert(microHtml.includes('uice-microtext-rule'), 'Microtext must include rule class');
assert(microHtml.includes('font-size: 4.5px'), 'Microtext must enforce sub-millimeter font size');
assert(microHtml.includes('letter-spacing: 1.5px'), 'Microtext must configure letter spacing');
assert(microHtml.includes('Tariq Ahmad Sheikh'), 'Microtext must resolve employee name token');
assert(microHtml.includes('VSA-1001'), 'Microtext must resolve employee ID token');
console.log('✓ Sub-millimeter Microtext Anti-Replication Engine verified with token injection');

// 2D: Security Watermark Crest
const generateSecurityWatermarkHtml = sandbox.generateSecurityWatermarkHtml;
assert(typeof generateSecurityWatermarkHtml === 'function', 'generateSecurityWatermarkHtml must be defined');

const watermarkHtml = generateSecurityWatermarkHtml({ width: 150, height: 150 }, {
    preset: 'vsa-crest',
    opacity: 0.12,
    rotation: 15,
    grayscale: true
});

assert(watermarkHtml.includes('uice-watermark-overlay'), 'Watermark must include overlay class');
assert(watermarkHtml.includes('opacity: 0.12'), 'Watermark must apply configured opacity');
assert(watermarkHtml.includes('rotate(15deg)'), 'Watermark must apply rotation angle');
assert(watermarkHtml.includes('grayscale(100%)'), 'Watermark must apply grayscale filter');
assert(watermarkHtml.includes('<svg'), 'Watermark must contain vector crest SVG');

// Test other crest presets
['emblem-eagle', 'shield-verified'].forEach(preset => {
    const wHtml = generateSecurityWatermarkHtml({}, { preset });
    assert(wHtml.includes('<svg'), `Must render watermark for preset: ${preset}`);
});
console.log('✓ Security Watermark Crest Engine verified across all sovereign presets');


// =========================================================================
// TEST 3: UICE ELEMENT HTML INTEGRATION (renderUiceElementHtml)
// =========================================================================
console.log('\n--- TEST 3: Testing renderUiceElementHtml Integration ---');

const renderUiceElementHtml = sandbox.renderUiceElementHtml;
assert(typeof renderUiceElementHtml === 'function', 'renderUiceElementHtml must be defined');

// 3A: Custom text with dynamic tokens
const customTextEl = {
    id: 'el-custom-1',
    type: 'custom-text',
    width: 200,
    height: 30,
    properties: {
        text: 'Guard: {{name}} [{{empId}}]',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
        fontSize: 12
    }
};
const customTextOut = renderUiceElementHtml(customTextEl, emp, 3, testIssue);
assert(customTextOut.includes('Guard: Tariq Ahmad Sheikh [VSA-1001]'), 'Custom text must resolve embedded tokens');
console.log('✓ custom-text token resolution inside canvas node verified');

// 3B: Title badge pill with dynamic tokens
const badgeEl = {
    id: 'el-badge-1',
    type: 'badge-pill',
    width: 150,
    height: 25,
    properties: {
        text: 'OFFICIAL ID: {{id}}'
    }
};
const badgeOut = renderUiceElementHtml(badgeEl, emp);
assert(badgeOut.includes('OFFICIAL ID: VSA-1001'), 'Badge pill must resolve embedded tokens');
console.log('✓ badge-pill token resolution inside canvas node verified');

// 3C: Agency brand with dynamic tokens
const agencyEl = {
    id: 'el-agency-1',
    type: 'agency-brand',
    width: 300,
    height: 45,
    properties: {
        title: 'VALLEY SECURITY - {{zone}}',
        subtitle: 'STATION: {{policeStation}}'
    }
};
const agencyOut = renderUiceElementHtml(agencyEl, emp);
assert(agencyOut.includes('VALLEY SECURITY - Central Valley'), 'Agency title must resolve zone token');
assert(agencyOut.includes('STATION: Kothi Bagh'), 'Agency subtitle must resolve policeStation token');
console.log('✓ agency-brand token resolution inside canvas node verified');

// 3D: Details table with dynamic date calculations
const tableEl = {
    id: 'el-table-1',
    type: 'details-table',
    width: 350,
    height: 120,
    properties: {
        fontSize: 8,
        labelWidth: 38
    }
};
const tableOut = renderUiceElementHtml(tableEl, emp, 3, testIssue);
assert(tableOut.includes('01-06-2028'), 'Details table must contain calculated validity date');
assert(tableOut.includes('VSA-1001'), 'Details table must contain employee ID');
assert(tableOut.includes('Mohammad Sheikh'), 'Details table must contain father name');
console.log('✓ details-table dynamic calculation & token verification passed');

// 3E: Security overlays rendered through renderUiceElementHtml
const gOut = renderUiceElementHtml({ type: 'guilloche-pattern', width: 400, height: 60, properties: {} }, emp);
assert(gOut.includes('uice-guilloche-container'), 'renderUiceElementHtml must handle guilloche-pattern');

const hOut = renderUiceElementHtml({ type: 'hologram-overlay', width: 48, height: 48, properties: {} }, emp);
assert(hOut.includes('uice-hologram-badge'), 'renderUiceElementHtml must handle hologram-overlay');

const mOut = renderUiceElementHtml({ type: 'microtext-line', width: 300, height: 8, properties: { text: 'SECURE {{name}}' } }, emp);
assert(mOut.includes('uice-microtext-rule'), 'renderUiceElementHtml must handle microtext-line');
assert(mOut.includes('Tariq Ahmad Sheikh'), 'microtext-line must resolve name in renderUiceElementHtml');

const wOut = renderUiceElementHtml({ type: 'security-watermark', width: 100, height: 100, properties: {} }, emp);
assert(wOut.includes('uice-watermark-overlay'), 'renderUiceElementHtml must handle security-watermark');
console.log('✓ All 4 security overlays successfully rendered via renderUiceElementHtml');


// =========================================================================
// TEST 4: DUAL-SURFACE (DUPLEX) CARD HTML & SINGLE CARD GENERATOR
// =========================================================================
console.log('\n--- TEST 4: Testing Dual-Surface (Duplex) Card Generator ---');

const generateUiceCardHtml = sandbox.generateUiceCardHtml;
assert(typeof generateUiceCardHtml === 'function', 'generateUiceCardHtml must be defined');

const layoutMock = {
    width: 500,
    height: 320,
    elements: [
        { id: 'el-1', type: 'custom-text', x: 20, y: 20, width: 200, height: 30, properties: { text: 'FRONT: {{name}}' } }
    ],
    backElements: [
        { id: 'back-1', type: 'custom-text', x: 20, y: 20, width: 200, height: 30, properties: { text: 'BACK: {{empId}}' } }
    ]
};

// 4A: Front card
const frontCard = generateUiceCardHtml(emp, layoutMock, {}, 3, testIssue, 'front');
assert(frontCard.includes('FRONT: Tariq Ahmad Sheikh'), 'Front face must render front elements with resolved tokens');

// 4B: Back card
const backCard = generateUiceCardHtml(emp, layoutMock, {}, 3, testIssue, 'back');
assert(backCard.includes('BACK: VSA-1001'), 'Back face must render back elements with resolved tokens');

// 4C: Duplex card
const duplexCard = generateUiceCardHtml(emp, layoutMock, {}, 3, testIssue, 'duplex');
assert(duplexCard.includes('uice-duplex-wrapper'), 'Duplex card must wrap both faces in uice-duplex-wrapper');
assert(duplexCard.includes('Front Face'), 'Duplex card must render Front Face label');
assert(duplexCard.includes('Reverse Face'), 'Duplex card must render Reverse Face label');
assert(duplexCard.includes('FRONT: Tariq Ahmad Sheikh'), 'Duplex card must contain front face content');
assert(duplexCard.includes('BACK: VSA-1001'), 'Duplex card must contain reverse face content');
console.log('✓ Dual-surface (Front, Back, Duplex) card HTML generation verified');

// 4D: Test generateIdCardHtml with duplex parameter
const generateIdCardHtml = sandbox.generateIdCardHtml;
assert(typeof generateIdCardHtml === 'function', 'generateIdCardHtml must be defined');

const tplMock = {
    id: 'tpl-omega-full',
    layout: 'horizontal',
    layouts: {
        horizontal: layoutMock
    }
};

const idCardDuplexOut = generateIdCardHtml(emp, tplMock, 3, testIssue, 'duplex');
assert(idCardDuplexOut.includes('uice-duplex-wrapper'), 'generateIdCardHtml must forward duplex mode to UICE engine');
console.log('✓ generateIdCardHtml universal integration verified');


// =========================================================================
// TEST 5: DOM & PALETTE INTEGRATION (public/index.html)
// =========================================================================
console.log('\n--- TEST 5: Testing DOM Elements in public/index.html ---');

// Elements palette add buttons
assert(indexHtml.includes('id="btn-add-guilloche"'), 'btn-add-guilloche must exist in index.html');
assert(indexHtml.includes('id="btn-add-hologram"'), 'btn-add-hologram must exist in index.html');
assert(indexHtml.includes('id="btn-add-microtext"'), 'btn-add-microtext must exist in index.html');
assert(indexHtml.includes('id="btn-add-watermark"'), 'btn-add-watermark must exist in index.html');
assert(indexHtml.includes('data-add-type="guilloche-pattern"'), 'guilloche-pattern data-add-type must exist');
assert(indexHtml.includes('data-add-type="hologram-overlay"'), 'hologram-overlay data-add-type must exist');
assert(indexHtml.includes('data-add-type="microtext-line"'), 'microtext-line data-add-type must exist');
assert(indexHtml.includes('data-add-type="security-watermark"'), 'security-watermark data-add-type must exist');
console.log('✓ All 4 security elements verified in Canvas Palette');

// Property Inspector Sections
assert(indexHtml.includes('id="prop-sec-guilloche"'), 'prop-sec-guilloche section must exist');
assert(indexHtml.includes('id="prop-sec-hologram"'), 'prop-sec-hologram section must exist');
assert(indexHtml.includes('id="prop-sec-microtext"'), 'prop-sec-microtext section must exist');
assert(indexHtml.includes('id="prop-sec-watermark"'), 'prop-sec-watermark section must exist');
assert(indexHtml.includes('id="prop-uice-text-content"'), 'prop-uice-text-content must exist in typography');
console.log('✓ All Property Inspector sections & text content input verified');

// Single Card Preview Stage Surface Toggle
assert(indexHtml.includes('id="single-card-surface-toggle"'), 'single-card-surface-toggle container must exist');
assert(indexHtml.includes('id="btn-single-preview-front"'), 'btn-single-preview-front must exist');
assert(indexHtml.includes('id="btn-single-preview-back"'), 'btn-single-preview-back must exist');
assert(indexHtml.includes('id="btn-single-preview-duplex"'), 'btn-single-preview-duplex must exist');
console.log('✓ Single Card Generator surface toggle buttons verified');


// =========================================================================
// TEST 6: CSS STYLING & ANIMATION RULES (public/styles.css)
// =========================================================================
console.log('\n--- TEST 6: Testing CSS Rules in public/styles.css ---');

assert(stylesCss.includes('.uice-guilloche-container'), '.uice-guilloche-container CSS class must exist');
assert(stylesCss.includes('.uice-hologram-badge'), '.uice-hologram-badge CSS class must exist');
assert(stylesCss.includes('.uice-hologram-silver'), '.uice-hologram-silver CSS class must exist');
assert(stylesCss.includes('.uice-hologram-gold'), '.uice-hologram-gold CSS class must exist');
assert(stylesCss.includes('.uice-hologram-prismatic'), '.uice-hologram-prismatic CSS class must exist');
assert(stylesCss.includes('.uice-hologram-emerald'), '.uice-hologram-emerald CSS class must exist');
assert(stylesCss.includes('.uice-hologram-shimmer'), '.uice-hologram-shimmer CSS class must exist');
assert(stylesCss.includes('@keyframes uiceHoloShimmer'), '@keyframes uiceHoloShimmer must exist');
assert(stylesCss.includes('.uice-microtext-rule'), '.uice-microtext-rule CSS class must exist');
assert(stylesCss.includes('.uice-watermark-overlay'), '.uice-watermark-overlay CSS class must exist');
assert(stylesCss.includes('.single-card-surface-toggle'), '.single-card-surface-toggle CSS class must exist');
console.log('✓ All Phase 9 CSS classes and holographic shimmer animation verified');

console.log('\n=============================================================');
console.log('ALL PHASE 9 ASSERTIONS PASSED PERFECTLY (100% SUCCESS)');
console.log('=============================================================');
