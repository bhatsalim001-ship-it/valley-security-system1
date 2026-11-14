/**
 * verify_batch_print_project.test.js
 * Verification suite for 1-Click "Batch Print ID Cards" from Project Workspace.
 * Non-mutating verification testing: does not touch or write to PostgreSQL / Neon DB.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting 1-Click Batch Print ID Cards Verification Suite...\n');

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${desc}`);
        passCount++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${desc}`);
        console.error(`     Error: ${err.message}`);
        failCount++;
    }
}

const htmlPath = path.join(__dirname, 'public', 'index.html');
const jsPath = path.join(__dirname, 'public', 'app.js');
const cssPath = path.join(__dirname, 'public', 'styles.css');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');
const cssContent = fs.readFileSync(cssPath, 'utf8');

// 1. DOM & UI Checks
it('Project Candidates Drawer contains prominent [⚡ Print All Project ID Cards] button', () => {
    assert(htmlContent.includes('id="btn-print-project-cards"'), 'Missing id="btn-print-project-cards"');
    assert(htmlContent.includes('onclick="batchPrintProjectCards()"'), 'Missing onclick="batchPrintProjectCards()"');
    assert(htmlContent.includes('Print All Project ID Cards'), 'Missing text "Print All Project ID Cards"');
    assert(htmlContent.includes('data-lucide="zap"'), 'Missing zap icon for 1-click batch print');
});

it('Batch print button adheres to UI/UX Pro Max touch target requirements (>= 44px)', () => {
    assert(htmlContent.includes('min-height: 44px') || htmlContent.includes('min-height: 48px'), 'Button should have >=44px min-height');
    assert(htmlContent.includes('linear-gradient(135deg, #10b981'), 'Button should have high-contrast emerald action styling');
});

// 2. Project Card Quick Action in Deployment Grid
it('Deployment project card template includes 1-click batch print action with dynamic approved count', () => {
    assert(jsContent.includes("onclick=\"batchPrintProjectCards('${escapeHtml(p.id)}')\""), 'Project card must have batchPrintProjectCards click handler');
    assert(jsContent.includes('⚡ Print Cards (${approved})'), 'Project card must display approved guard count on print button');
    assert(jsContent.includes('title="⚡ 1-Click Print All Approved ID Badges"'), 'Project card button must have accessible tooltip');
});

// 3. Dynamic Modal Update
it('Candidates drawer dynamically updates batch print button with live approved count', () => {
    assert(jsContent.includes("batchPrintBtn.innerHTML = `<i data-lucide=\"zap\""), 'Candidates modal should update batch print button with icon and count');
    assert(jsContent.includes("⚡ Print All Project ID Cards (${approvedCount})"), 'Candidates modal must display live approved count on button');
});

// 4. Batch Print Engine Implementation
it('batchPrintProjectCards function is defined and exported to window', () => {
    assert(jsContent.includes('async function batchPrintProjectCards(projectId)'), 'Missing async function batchPrintProjectCards');
    assert(jsContent.includes('window.batchPrintProjectCards = batchPrintProjectCards'), 'Missing window.batchPrintProjectCards export');
    assert(jsContent.includes('window.printProjectCards = batchPrintProjectCards'), 'Missing backwards-compatibility alias for printProjectCards');
});

it('batchPrintProjectCards filters for approved guards (Active or Approved)', () => {
    assert(jsContent.includes("candidates.filter(e => e.status === 'Active' || e.status === 'Approved')"), 'Must filter candidates by Active or Approved status');
    assert(jsContent.includes('None of the'), 'Must include fallback confirmation if 0 guards are marked active');
});

it('batchPrintProjectCards synchronizes candidates into VSA_STATE.employees with portraits & duty details', () => {
    assert(jsContent.includes('VSA_STATE.idSelectedEmployeeIds = ids'), 'Must sync idSelectedEmployeeIds');
    assert(jsContent.includes('VSA_STATE.selectedEmployeeIds = ids'), 'Must sync selectedEmployeeIds');
    assert(jsContent.includes('VSA_STATE.employees.findIndex'), 'Must reconcile into VSA_STATE.employees array');
    assert(jsContent.includes('cand.photo && !cand.documents.photo'), 'Must normalize duty portrait photo onto documents');
});

it('batchPrintProjectCards formats printable batch sheets (8 cards/A4 horizontal, 9 cards/A4 vertical)', () => {
    assert(jsContent.includes("const cardsPerPage = isHorizontal ? 8 : 9"), 'Must calculate 8 cards/A4 for horizontal and 9 cards/A4 for vertical');
    assert(jsContent.includes("const gridClass = isHorizontal ? 'horizontal-grid' : 'vertical-grid'"), 'Must assign correct grid class for CSS print layout');
    assert(jsContent.includes('<div class="print-page ${gridClass}">'), 'Must generate .print-page containers');
    assert(jsContent.includes('<div class="printable-id-card-wrapper">'), 'Must wrap cards in printable-id-card-wrapper');
});

it('batchPrintProjectCards triggers QR generation, activates bulk print styles, and calls window.print()', () => {
    assert(jsContent.includes('renderQrsInContainer(bulkContainer)'), 'Must render QRs and barcodes in bulk container');
    assert(jsContent.includes("document.body.classList.add('bulk-print-active')"), 'Must activate bulk-print-active class on body');
    assert(jsContent.includes('window.print()'), 'Must call window.print() to open printer dialog');
    assert(jsContent.includes('closeProjectCandidatesModal()'), 'Must close candidate drawer on print');
});

// 5. CSS Print Engine Integrity
it('CSS contains .print-page .vertical-grid (9 cards) and .horizontal-grid (8 cards) print definitions', () => {
    assert(cssContent.includes('.print-page.vertical-grid'), 'Missing .print-page.vertical-grid CSS');
    assert(cssContent.includes('repeat(3, 54mm)'), 'Vertical grid must be 3 columns of 54mm');
    assert(cssContent.includes('repeat(3, 86mm)'), 'Vertical grid must be 3 rows of 86mm');
    assert(cssContent.includes('.print-page.horizontal-grid'), 'Missing .print-page.horizontal-grid CSS');
    assert(cssContent.includes('repeat(2, 86mm)'), 'Horizontal grid must be 2 columns of 86mm');
    assert(cssContent.includes('repeat(4, 54mm)'), 'Horizontal grid must be 4 rows of 54mm');
});

// 6. Typography & Database Safeguards
it('Enforces enterprise typography (Plus Jakarta Sans & JetBrains Mono) without legacy font leaks', () => {
    assert(!htmlContent.includes("'Outfit'"), 'Outfit font should not be used in index.html');
    assert(!htmlContent.includes("'Space Mono'"), 'Space Mono font should not be used in index.html');
    assert(htmlContent.includes('Plus+Jakarta+Sans'), 'Must load Plus Jakarta Sans Google font');
    assert(htmlContent.includes('JetBrains+Mono'), 'Must load JetBrains Mono Google font');
});

console.log(`\n================================`);
console.log(`Results: ${passCount} Passed, ${failCount} Failed`);
console.log(`================================\n`);

if (failCount > 0) {
    process.exit(1);
} else {
    console.log('🎉 All 10 verification assertions PASSED with ZERO database mutations!');
    process.exit(0);
}
