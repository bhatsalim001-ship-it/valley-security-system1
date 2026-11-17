/**
 * ============================================================================
 * PROJECT OMEGA: COMPLETE ID CARD DESIGN ENGINE OVERHAUL
 * PHASE 8 VERIFICATION TEST SUITE: DUPLEX ENGINE, ARCHETYPES & ASSET SYSTEM
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('VERIFYING PROJECT OMEGA PHASE 8: DUPLEX ENGINE, ARCHETYPES & ASSETS');
console.log('================================================================\n');

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

test('index.html contains Surface Switcher Segmented Control & 3D Flip Button', () => {
    assert(indexHtml.includes('id="btn-uice-surface-front"'), 'Missing #btn-uice-surface-front');
    assert(indexHtml.includes('id="btn-uice-surface-back"'), 'Missing #btn-uice-surface-back');
    assert(indexHtml.includes('id="btn-uice-flip-card"'), 'Missing #btn-uice-flip-card');
});

test('index.html contains Archetype Preset Library and Asset Management buttons', () => {
    assert(indexHtml.includes('id="btn-uice-archetype-library"'), 'Missing #btn-uice-archetype-library');
    assert(indexHtml.includes('id="btn-uice-export-tpl-json"'), 'Missing #btn-uice-export-tpl-json');
    assert(indexHtml.includes('id="btn-uice-import-tpl-json"'), 'Missing #btn-uice-import-tpl-json');
    assert(indexHtml.includes('id="btn-uice-clone-tpl"'), 'Missing #btn-uice-clone-tpl');
    assert(indexHtml.includes('id="uice-tpl-file-input"'), 'Missing #uice-tpl-file-input');
});

test('index.html defines Master Archetype Preset Library Modal (#uice-archetypes-modal)', () => {
    assert(indexHtml.includes('id="uice-archetypes-modal"'), 'Missing #uice-archetypes-modal');
    assert(indexHtml.includes('id="uice-archetypes-title"'), 'Missing #uice-archetypes-title');
    assert(indexHtml.includes('id="uice-archetypes-list"'), 'Missing #uice-archetypes-list');
});

// ============================================================================
// 2. CSS STYLING & 3D ANIMATION ARCHITECTURE (STYLES.CSS)
// ============================================================================
console.log('\n=== 2. CSS STYLING & 3D ANIMATION ARCHITECTURE (STYLES.CSS) ===');

test('styles.css defines Surface Switcher Segmented Control styles', () => {
    assert(stylesCss.includes('.uice-surface-segmented'), 'Missing .uice-surface-segmented class');
    assert(stylesCss.includes('.uice-surface-pill'), 'Missing .uice-surface-pill class');
    assert(stylesCss.includes('.uice-surface-pill.active'), 'Missing .uice-surface-pill.active class');
});

test('styles.css defines 3D Card Flip Perspective and Keyframe Animation', () => {
    assert(stylesCss.includes('transform-style: preserve-3d'), 'Missing preserve-3d on artboard');
    assert(stylesCss.includes('.uice-artboard-card.uice-flip-anim'), 'Missing .uice-flip-anim class');
    assert(stylesCss.includes('@keyframes uice3DCardFlip'), 'Missing @keyframes uice3DCardFlip');
    assert(stylesCss.includes('rotateY(90deg)'), 'Missing 90deg intermediate flip rotation');
});

test('styles.css defines Archetype Presets Gallery Grid & Cards', () => {
    assert(stylesCss.includes('.uice-archetypes-grid'), 'Missing .uice-archetypes-grid');
    assert(stylesCss.includes('.uice-archetype-card'), 'Missing .uice-archetype-card');
    assert(stylesCss.includes('.uice-archetype-thumb'), 'Missing .uice-archetype-thumb');
    assert(stylesCss.includes('.uice-archetype-badge'), 'Missing .uice-archetype-badge');
    assert(stylesCss.includes('.uice-archetype-load-btn'), 'Missing .uice-archetype-load-btn');
});

// ============================================================================
// 3. ENGINE LOGIC & JAVASCRIPT ARCHITECTURE (APP.JS)
// ============================================================================
console.log('\n=== 3. ENGINE LOGIC & JAVASCRIPT ARCHITECTURE (APP.JS) ===');

test('UICE_STATE contains surface property initialized to "front"', () => {
    assert(appJs.includes("surface: 'front'"), 'Missing surface: "front" in UICE_STATE');
});

test('getUiceDefaultBackElements is defined and returns authentic back-of-card elements', () => {
    assert(appJs.includes('function getUiceDefaultBackElements(orientation, tpl = {})'), 'Missing getUiceDefaultBackElements function');
    assert(appJs.includes('uice-back-terms'), 'Missing terms and conditions in back elements');
    assert(appJs.includes('uice-back-return-text'), 'Missing return address in back elements');
    assert(appJs.includes('uice-back-emergency'), 'Missing emergency helpline in back elements');
    assert(appJs.includes('uice-back-signature'), 'Missing authority signature in back elements');
    assert(appJs.includes('uice-back-barcode'), 'Missing card serial barcode in back elements');
});

test('getUiceActiveElements returns backElements when surface is "back"', () => {
    assert(appJs.includes('function getUiceActiveElements(layout = null)'), 'Missing getUiceActiveElements function');
    assert(appJs.includes("if (UICE_STATE.surface === 'back')"), 'Missing surface check in getUiceActiveElements');
});

test('setUiceSurface and flipUiceCard are implemented', () => {
    assert(appJs.includes('function setUiceSurface(surface)'), 'Missing setUiceSurface');
    assert(appJs.includes('function flipUiceCard()'), 'Missing flipUiceCard');
    assert(appJs.includes('uice-flip-anim'), 'Missing uice-flip-anim trigger in flipUiceCard');
});

test('UICE_ARCHETYPES defines 6 curated master archetypes', () => {
    assert(appJs.includes("id: 'archetype-paramilitary-gold'"), 'Missing Paramilitary & Defense Force archetype');
    assert(appJs.includes("id: 'archetype-cyber-obsidian'"), 'Missing Modern Corporate & Cyber Tech archetype');
    assert(appJs.includes("id: 'archetype-healthcare-teal'"), 'Missing Healthcare & Hospital Manpower archetype');
    assert(appJs.includes("id: 'archetype-executive-platinum'"), 'Missing Executive VIP & Law Enforcement archetype');
    assert(appJs.includes("id: 'archetype-event-amber'"), 'Missing Event & Rapid Access Pass archetype');
    assert(appJs.includes("id: 'archetype-govt-navy'"), 'Missing Public Sector & Govt Standard archetype');
});

test('Archetype modal controls and template asset system functions are implemented', () => {
    assert(appJs.includes('function openUiceArchetypesModal()'), 'Missing openUiceArchetypesModal');
    assert(appJs.includes('function closeUiceArchetypesModal()'), 'Missing closeUiceArchetypesModal');
    assert(appJs.includes('function loadUiceArchetype('), 'Missing loadUiceArchetype');
    assert(appJs.includes('function exportUiceTemplateJson()'), 'Missing exportUiceTemplateJson');
    assert(appJs.includes('function importUiceTemplateJson('), 'Missing importUiceTemplateJson');
    assert(appJs.includes('function cloneUiceTemplate()'), 'Missing cloneUiceTemplate');
});

test('generateUiceCardHtml accepts side parameter and renders backElements for "back"', () => {
    assert(appJs.includes("function generateUiceCardHtml(emp, layout, template, validityYears = 3, issueDate = null, side = 'front')"), 'Missing side parameter in generateUiceCardHtml');
    assert(appJs.includes("if (side === 'back')") || appJs.includes("(side === 'back')"), 'Missing side check in generateUiceCardHtml');
});

test('printUiceSheet passes side = "back" for Page 2 duplex mirrored cards', () => {
    assert(appJs.includes("generateUiceCardHtml(guard, cardLayout, tpl, 3, null, 'back')"), 'Duplex mirrored back page does not render back surface');
});

test('Window global exports contain all Phase 8 functions', () => {
    assert(appJs.includes('window.setUiceSurface = setUiceSurface;'), 'Missing window.setUiceSurface export');
    assert(appJs.includes('window.flipUiceCard = flipUiceCard;'), 'Missing window.flipUiceCard export');
    assert(appJs.includes('window.getUiceDefaultBackElements = getUiceDefaultBackElements;'), 'Missing window.getUiceDefaultBackElements export');
    assert(appJs.includes('window.getUiceActiveElements = getUiceActiveElements;'), 'Missing window.getUiceActiveElements export');
    assert(appJs.includes('window.UICE_ARCHETYPES = UICE_ARCHETYPES;'), 'Missing window.UICE_ARCHETYPES export');
    assert(appJs.includes('window.openUiceArchetypesModal = openUiceArchetypesModal;'), 'Missing window.openUiceArchetypesModal export');
    assert(appJs.includes('window.closeUiceArchetypesModal = closeUiceArchetypesModal;'), 'Missing window.closeUiceArchetypesModal export');
    assert(appJs.includes('window.loadUiceArchetype = loadUiceArchetype;'), 'Missing window.loadUiceArchetype export');
    assert(appJs.includes('window.exportUiceTemplateJson = exportUiceTemplateJson;'), 'Missing window.exportUiceTemplateJson export');
    assert(appJs.includes('window.importUiceTemplateJson = importUiceTemplateJson;'), 'Missing window.importUiceTemplateJson export');
    assert(appJs.includes('window.cloneUiceTemplate = cloneUiceTemplate;'), 'Missing window.cloneUiceTemplate export');
});

// ============================================================================
// 4. FUNCTIONAL EXECUTION & CONTRACT VERIFICATION
// ============================================================================
console.log('\n=== 4. FUNCTIONAL EXECUTION & CONTRACT VERIFICATION ===');

test('Execute getUiceDefaultBackElements for horizontal orientation', () => {
    // Extract getUiceDefaultBackElements and execute in sandbox
    const sandbox = {};
    const fnCode = appJs.slice(
        appJs.indexOf('function getUiceDefaultBackElements'),
        appJs.indexOf('function getUiceActiveElements')
    );
    const fn = new Function('orientation', 'tpl', fnCode + '\nreturn getUiceDefaultBackElements(orientation, tpl);');
    const backElements = fn('horizontal', { headerBgColor: '#0e3e2b', accentColor: '#d97706' });
    
    assert(Array.isArray(backElements), 'Back elements must be an array');
    assert.strictEqual(backElements.length, 10, 'Horizontal back surface must have 10 elements');
    assert(backElements.some(e => e.id === 'uice-back-terms'), 'Must contain terms & conditions node');
    assert(backElements.some(e => e.id === 'uice-back-return-text'), 'Must contain return address node');
    assert(backElements.some(e => e.id === 'uice-back-emergency'), 'Must contain emergency helpline node');
    assert(backElements.some(e => e.id === 'uice-back-signature'), 'Must contain authority signature node');
    assert(backElements.some(e => e.id === 'uice-back-barcode'), 'Must contain card serial barcode node');
});

test('Execute getUiceDefaultBackElements for vertical orientation', () => {
    const fnCode = appJs.slice(
        appJs.indexOf('function getUiceDefaultBackElements'),
        appJs.indexOf('function getUiceActiveElements')
    );
    const fn = new Function('orientation', 'tpl', fnCode + '\nreturn getUiceDefaultBackElements(orientation, tpl);');
    const backElements = fn('vertical', { headerBgColor: '#0f172a', accentColor: '#06b6d4' });

    assert(Array.isArray(backElements), 'Back elements must be an array');
    assert.strictEqual(backElements.length, 10, 'Vertical back surface must have 10 elements');
    assert(backElements.some(e => e.id === 'uice-back-terms-v'), 'Must contain vertical terms node');
    assert(backElements.some(e => e.id === 'uice-back-return-text-v'), 'Must contain vertical return address node');
    assert(backElements.some(e => e.id === 'uice-back-signature-v'), 'Must contain vertical signature node');
    assert(backElements.some(e => e.id === 'uice-back-barcode-v'), 'Must contain vertical barcode node');
});

test('Verify All 6 Archetypes instantiate valid dual-orientation, dual-surface layouts', () => {
    // Extract createArchetypeLayouts and UICE_ARCHETYPES definitions
    const startIdx = appJs.indexOf('function getUiceDefaultElements');
    const endIdx = appJs.indexOf('function setUiceSurface');
    const snippet = appJs.slice(startIdx, endIdx);
    
    // Evaluate in function context
    const fn = new Function(snippet + '\nreturn UICE_ARCHETYPES;');
    const archetypes = fn();

    assert.strictEqual(archetypes.length, 6, 'Must define exactly 6 master archetypes');
    
    archetypes.forEach(arch => {
        assert(arch.id, `Archetype must have an ID: ${arch.name}`);
        assert(arch.name, `Archetype must have a name: ${arch.id}`);
        assert(arch.badge, `Archetype must have a badge: ${arch.id}`);
        assert(arch.colors && arch.colors.primary && arch.colors.accent, `Archetype must define primary and accent colors: ${arch.id}`);
        
        const layouts = arch.getLayouts();
        assert(layouts.horizontal, `Archetype ${arch.id} must define horizontal layout`);
        assert(layouts.vertical, `Archetype ${arch.id} must define vertical layout`);
        
        assert(Array.isArray(layouts.horizontal.elements) && layouts.horizontal.elements.length > 0, `Horizontal front elements missing in ${arch.id}`);
        assert(Array.isArray(layouts.horizontal.backElements) && layouts.horizontal.backElements.length > 0, `Horizontal back elements missing in ${arch.id}`);
        assert(Array.isArray(layouts.vertical.elements) && layouts.vertical.elements.length > 0, `Vertical front elements missing in ${arch.id}`);
        assert(Array.isArray(layouts.vertical.backElements) && layouts.vertical.backElements.length > 0, `Vertical back elements missing in ${arch.id}`);
    });
});

test('generateUiceCardHtml generates authentic front vs back HTML', () => {
    // Extract generateUiceCardHtml, renderUiceElementHtml, etc.
    const startIdx = appJs.indexOf('function getUiceDefaultElements');
    const endIdx = appJs.indexOf('function loadTemplateInStudio');
    const snippet = appJs.slice(startIdx, endIdx);

    const runner = new Function(`
        const window = { location: { hostname: 'localhost', origin: 'http://localhost' } };
        const document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };
        function getVsaDefaultLogo() { return ''; }
        function getVsaDefaultSig() { return ''; }
        function escapeHtml(str) { return str || ''; }
        const VSA_STATE = { templates: [] };
        ` + snippet + `
        const guard = { id: 'VSA-0042', name: 'Rajesh Kumar', designation: 'Armed Security Officer' };
        const tpl = { headerBgColor: '#0e3e2b', accentColor: '#d97706', font: "'Plus Jakarta Sans', sans-serif" };
        const layout = {
            width: 500,
            height: 320,
            background: { color: '#ffffff', headerBg: '#0e3e2b', accent: '#d97706' },
            elements: getUiceDefaultElements('horizontal', tpl),
            backElements: getUiceDefaultBackElements('horizontal', tpl)
        };
        const frontHtml = generateUiceCardHtml(guard, layout, tpl, 3, null, 'front');
        const backHtml = generateUiceCardHtml(guard, layout, tpl, 3, null, 'back');
        return { frontHtml, backHtml };
    `);

    const result = runner();
    assert(result.frontHtml.includes('SECURITY ID CARD') || result.frontHtml.includes('VALLEY SECURITY AGENCY'), 'Front HTML should render front elements');
    assert(result.backHtml.includes('TERMS OF ISSUE') || result.backHtml.includes('INSTRUCTIONS'), 'Back HTML should render authentic back elements');
    assert(result.backHtml.includes('VALLEY SECURITY AGENCY — HQ, SHAHIDGUNJ'), 'Back HTML should render return address');
});

// ============================================================================
// SUMMARY
// ============================================================================
console.log('\n================================================================');
console.log(`PHASE 8 VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED`);
console.log('================================================================\n');

if (failCount > 0) {
    process.exit(1);
}
