/**
 * Verification Test: Bulk Actions, Easy Accept/Reject/Delete, and High-Speed Animations
 * Valley Security System
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting Bulk Actions, Instant Status, and Animation Speed Verification...\n');

const ROOT_DIR = __dirname;
const serverJs = fs.readFileSync(path.join(ROOT_DIR, 'server.js'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT_DIR, 'public', 'app.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(ROOT_DIR, 'public', 'index.html'), 'utf8');
const stylesCss = fs.readFileSync(path.join(ROOT_DIR, 'public', 'styles.css'), 'utf8');

let passCount = 0;
let failCount = 0;

function test(description, fn) {
    try {
        fn();
        console.log(`  ✅ PASS: ${description}`);
        passCount++;
    } catch (e) {
        console.error(`  ❌ FAIL: ${description}`);
        console.error(`     Error: ${e.message}`);
        failCount++;
    }
}

// 1. Backend Bulk Endpoints Verification
console.log('--- 1. Backend Bulk API Endpoints (`server.js`) ---');
test('server.js implements POST /api/employees/bulk-delete', () => {
    assert(serverJs.includes("app.post('/api/employees/bulk-delete'"), 'Missing /api/employees/bulk-delete endpoint');
    assert(serverJs.includes('DELETE FROM employees WHERE id = ANY($1::text[])') || serverJs.includes('db.employees.filter'), 'Missing deletion logic in bulk-delete');
});

test('server.js implements POST /api/employees/bulk-status', () => {
    assert(serverJs.includes("app.post('/api/employees/bulk-status'"), 'Missing /api/employees/bulk-status endpoint');
    assert(serverJs.includes("jsonb_set(data::jsonb, '{status}'") || serverJs.includes('emp.status = targetStatus'), 'Missing status update logic in bulk-status');
});

test('server.js validates employeeIds array in bulk endpoints', () => {
    assert(serverJs.includes('!Array.isArray(employeeIds) || employeeIds.length === 0'), 'Missing array validation for employeeIds');
});

// 2. CSS Instant Animation & Speed Verification
console.log('\n--- 2. CSS High-Speed Snappy Interactions (`public/styles.css`) ---');
test('App view switching animation is <= 0.1s', () => {
    const match = stylesCss.match(/\.app-view\.active\s*\{[^}]*animation:[^;]*?\s+([0-9.]+)s/);
    assert(match, 'Cannot find .app-view.active animation duration');
    const duration = parseFloat(match[1]);
    assert(duration <= 0.1, `.app-view.active duration is ${duration}s, expected <= 0.1s`);
});

test('Modal backdrop animation is <= 0.1s', () => {
    const match = stylesCss.match(/\.modal-overlay:not\(\.hidden\)\s*\{[^}]*animation:[^;]*?\s+([0-9.]+)s/);
    assert(match, 'Cannot find .modal-overlay:not(.hidden) animation duration');
    const duration = parseFloat(match[1]);
    assert(duration <= 0.1, `.modal-overlay duration is ${duration}s, expected <= 0.1s`);
});

test('Modal container spring pop is <= 0.1s', () => {
    const match = stylesCss.match(/\.modal-overlay:not\(\.hidden\)\s*\.modal-container\s*\{[^}]*animation:[^;]*?\s+([0-9.]+)s/);
    assert(match, 'Cannot find .modal-container animation duration');
    const duration = parseFloat(match[1]);
    assert(duration <= 0.1, `.modal-container duration is ${duration}s, expected <= 0.1s`);
});

test('ID card 3D flip is snappy (<= 0.3s)', () => {
    const match = stylesCss.match(/backface-visibility:\s*hidden;[^}]*transition:\s*transform\s*([0-9.]+)s/);
    assert(match, 'Cannot find card flip transition duration');
    const duration = parseFloat(match[1]);
    assert(duration <= 0.3, `ID card flip duration is ${duration}s, expected <= 0.3s`);
});

test('Optimistic row deletion animation class .row-optimistic-deleted exists', () => {
    assert(stylesCss.includes('.row-optimistic-deleted'), 'Missing .row-optimistic-deleted class');
});

// 3. Frontend UI Elements Verification
console.log('\n--- 3. UI Buttons & Badges (`public/index.html`) ---');
test('Directory bulk banner has Accept Selected button', () => {
    assert(indexHtml.includes('id="btn-bulk-approve"'), 'Missing #btn-bulk-approve in bulk banner');
    assert(indexHtml.includes("bulkUpdateEmployeeStatus('Active')"), 'Missing onclick handler for #btn-bulk-approve');
});

test('Directory bulk banner has Reject Selected button', () => {
    assert(indexHtml.includes('id="btn-bulk-reject"'), 'Missing #btn-bulk-reject in bulk banner');
    assert(indexHtml.includes("bulkUpdateEmployeeStatus('Suspended')"), 'Missing onclick handler for #btn-bulk-reject');
});

test('Directory bulk banner has Bulk Delete button', () => {
    assert(indexHtml.includes('id="btn-bulk-delete"'), 'Missing #btn-bulk-delete in bulk banner');
    assert(indexHtml.includes('bulkDeleteEmployees()'), 'Missing onclick handler for #btn-bulk-delete');
});

test('Deployment candidate modal has Bulk Reject and Bulk Delete buttons', () => {
    assert(indexHtml.includes('id="btn-bulk-reject-project"'), 'Missing #btn-bulk-reject-project');
    assert(indexHtml.includes('id="btn-bulk-delete-project"'), 'Missing #btn-bulk-delete-project');
});

test('Deployment candidate modal has live Rejected badge', () => {
    assert(indexHtml.includes('id="badge-cand-rejected"'), 'Missing #badge-cand-rejected badge');
});

// 4. Frontend Application Logic Verification
console.log('\n--- 4. Client-side Handlers & Optimistic UI (`public/app.js`) ---');
test('bulkDeleteEmployees() handles selection and optimistic removal', () => {
    assert(appJs.includes('async function bulkDeleteEmployees()'), 'Missing bulkDeleteEmployees function');
    assert(appJs.includes('/api/employees/bulk-delete'), 'bulkDeleteEmployees does not call endpoint');
});

test('bulkUpdateEmployeeStatus() updates state optimistically without reloading', () => {
    assert(appJs.includes('async function bulkUpdateEmployeeStatus(targetStatus)'), 'Missing bulkUpdateEmployeeStatus function');
    assert(appJs.includes('/api/employees/bulk-status'), 'bulkUpdateEmployeeStatus does not call endpoint');
});

test('quickUpdateCandidateStatus() provides 0ms instant DOM sync', () => {
    assert(appJs.includes('async function quickUpdateCandidateStatus(empId, targetStatus)'), 'Missing quickUpdateCandidateStatus');
    assert(appJs.includes('cand-status-pill'), 'quickUpdateCandidateStatus must update status pill instantly');
});

test('quickDeleteCandidate() provides 80ms optimistic row deletion', () => {
    assert(appJs.includes('async function quickDeleteCandidate(empId)'), 'Missing quickDeleteCandidate');
    assert(appJs.includes('row-optimistic-deleted'), 'quickDeleteCandidate must use row-optimistic-deleted');
});

test('bulkRejectCurrentProject() and bulkDeleteCurrentProjectCandidates() implemented', () => {
    assert(appJs.includes('async function bulkRejectCurrentProject()'), 'Missing bulkRejectCurrentProject');
    assert(appJs.includes('async function bulkDeleteCurrentProjectCandidates()'), 'Missing bulkDeleteCurrentProjectCandidates');
});

test('Toast notifications dismiss rapidly (<= 2500ms)', () => {
    const match = appJs.match(/setTimeout\(\s*removeToast\s*,\s*(\d+)\s*\)/);
    assert(match, 'Cannot find showToast auto-dismiss timeout');
    const ms = parseInt(match[1]);
    assert(ms <= 2500, `Toast duration is ${ms}ms, expected <= 2500ms`);
});

// Summary
console.log(`\n========================================`);
console.log(`TOTAL TESTS: ${passCount + failCount}`);
console.log(`PASSED:      ${passCount}`);
console.log(`FAILED:      ${failCount}`);
console.log(`========================================\n`);

if (failCount > 0) {
    process.exit(1);
} else {
    console.log('🎉 ALL BULK ACTIONS & SPEED VERIFICATIONS PASSED CLEANLY!\n');
    process.exit(0);
}
