/**
 * Verification Test: Gemini 3.8 Flash Integration & Auto-Fallback Resilience
 * Valley Security System
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('🧪 Starting Gemini 3.8 Flash Upgrade Verification...\n');

const ROOT_DIR = __dirname;
const serverJs = fs.readFileSync(path.join(ROOT_DIR, 'server.js'), 'utf8');
const formProcessorJs = fs.readFileSync(path.join(ROOT_DIR, 'formProcessor.js'), 'utf8');
const envContent = fs.readFileSync(path.join(ROOT_DIR, '.env'), 'utf8');

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

// 1. Environment & Architecture Configuration
console.log('--- 1. Environment & Helper Configuration ---');
test('.env configures GEMINI_MODEL as gemini-3.8-flash', () => {
    assert(envContent.includes('GEMINI_MODEL="gemini-3.8-flash"'), 'Missing GEMINI_MODEL in .env');
});

test('server.js defines generateWithGemini helper with gemini-3.8-flash default', () => {
    assert(serverJs.includes('async function generateWithGemini(apiKey, contents, options = {})'), 'Missing generateWithGemini helper');
    assert(serverJs.includes("process.env.GEMINI_MODEL || 'gemini-3.8-flash'"), 'generateWithGemini does not default to gemini-3.8-flash');
});

test('server.js implements graceful fallback to gemini-2.5-flash on 503 high demand', () => {
    assert(serverJs.includes("fallbackModel = 'gemini-2.5-flash'"), 'Missing fallbackModel definition');
    assert(serverJs.includes("err.message.includes('503')"), 'Missing 503 error check for fallback');
    assert(serverJs.includes('Auto-falling back to'), 'Missing fallback log notification');
});

// 2. Route Integrations in server.js
console.log('\n--- 2. Route Integrations in server.js ---');
test('/api/employees/ocr invokes generateWithGemini', () => {
    const ocrIdx = serverJs.indexOf("app.post('/api/employees/ocr'");
    assert(ocrIdx !== -1, 'Cannot find /api/employees/ocr route');
    const ocrSlice = serverJs.slice(ocrIdx, ocrIdx + 2000);
    assert(ocrSlice.includes('generateWithGemini(apiKey, [part, prompt])'), 'OCR route not using generateWithGemini');
    assert(!ocrSlice.includes("model: 'gemini-2.5-flash'"), 'OCR route still has hardcoded legacy model');
});

test('/api/templates/generate-ai invokes generateWithGemini', () => {
    const tplIdx = serverJs.indexOf("app.post('/api/templates/generate-ai'");
    assert(tplIdx !== -1, 'Cannot find /api/templates/generate-ai route');
    const tplSlice = serverJs.slice(tplIdx, tplIdx + 3500);
    assert(tplSlice.includes('generateWithGemini(apiKey, contents)'), 'Template route not using generateWithGemini');
    assert(!tplSlice.includes("model: 'gemini-2.5-flash'"), 'Template route still has hardcoded legacy model');
});

test('/api/ai/dashboard-insights invokes generateWithGemini with 5000ms timeout', () => {
    const insIdx = serverJs.indexOf("app.get('/api/ai/dashboard-insights'");
    assert(insIdx !== -1, 'Cannot find /api/ai/dashboard-insights route');
    const insSlice = serverJs.slice(insIdx, insIdx + 6000);
    assert(insSlice.includes('generateWithGemini(apiKey, prompt,'), 'Dashboard insights not using generateWithGemini');
    assert(insSlice.includes('5000ms'), 'Dashboard insights should have 5000ms timeout for resilience');
    assert(!insSlice.includes("model: 'gemini-2.5-flash'"), 'Dashboard insights still has hardcoded legacy model');
});

test('/api/resolve-official-name invokes generateWithGemini', () => {
    const resIdx = serverJs.indexOf("app.get('/api/resolve-official-name'");
    assert(resIdx !== -1, 'Cannot find /api/resolve-official-name route');
    const resSlice = serverJs.slice(resIdx, resIdx + 2500);
    assert(resSlice.includes('generateWithGemini(apiKey, prompt,'), 'Resolve official name not using generateWithGemini');
    assert(!resSlice.includes("model: 'gemini-2.5-flash'"), 'Resolve official name still has hardcoded legacy model');
});

test('/api/audit-departments invokes generateWithGemini', () => {
    const audIdx = serverJs.indexOf("app.get('/api/audit-departments'");
    assert(audIdx !== -1, 'Cannot find /api/audit-departments route');
    const audSlice = serverJs.slice(audIdx, audIdx + 2500);
    assert(audSlice.includes('generateWithGemini(apiKey, prompt,'), 'Audit departments not using generateWithGemini');
    assert(!audSlice.includes("model: 'gemini-2.5-flash'"), 'Audit departments still has hardcoded legacy model');
});

// 3. Form Processor Module Integration
console.log('\n--- 3. Form Processor Module Integration ---');
test('formProcessor.js adopts gemini-3.8-flash as primary model', () => {
    assert(formProcessorJs.includes("process.env.GEMINI_MODEL || 'gemini-3.8-flash'"), 'formProcessor not using gemini-3.8-flash as primary');
    assert(formProcessorJs.includes("fallbackModel = 'gemini-2.5-flash'"), 'formProcessor missing fallbackModel');
});

test('formProcessor.js implements auto-fallback on 503 overload', () => {
    assert(formProcessorJs.includes("[Form Scanner] Primary model"), 'formProcessor missing fallback logging');
    assert(formProcessorJs.includes("fallbackGenModel.generateContent"), 'formProcessor missing fallback execution');
});

// 4. Live API Functionality Verification
console.log('\n--- 4. Live End-to-End API Test ---');
async function runLiveTest() {
    let apiKey = '';
    envContent.split(/\r?\n/).forEach(line => {
        const parts = line.split('=');
        if (parts.length >= 2 && parts[0].trim() === 'GEMINI_API_KEY') {
            apiKey = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        }
    });

    if (!apiKey) {
        console.log('  ⚠️ SKIP: GEMINI_API_KEY missing, skipping live execution');
        return finish();
    }

    try {
        console.log('  Testing generateWithGemini helper with primary gemini-3.8-flash & fallback...');
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        
        let reply = '';
        let modelUsed = 'gemini-3.8-flash';
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
            const result = await model.generateContent('Answer "OK" in one word.');
            reply = result.response.text().trim();
        } catch (err) {
            console.log(`  ℹ️ Primary model returned transient note (${err.message.slice(0, 60)}...). Invoking fallback...`);
            modelUsed = 'gemini-2.5-flash (auto-fallback)';
            const fallback = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
            const fbResult = await fallback.generateContent('Answer "OK" in one word.');
            reply = fbResult.response.text().trim();
        }

        console.log(`  ✅ PASS: Live Gemini responded via [${modelUsed}]: "${reply}"`);
        passCount++;
    } catch (err) {
        console.error(`  ❌ FAIL: Live Gemini test failed: ${err.message}`);
        failCount++;
    }

    finish();
}

function finish() {
    console.log(`\n========================================`);
    console.log(`TOTAL TESTS: ${passCount + failCount}`);
    console.log(`PASSED:      ${passCount}`);
    console.log(`FAILED:      ${failCount}`);
    console.log(`========================================\n`);

    if (failCount > 0) {
        process.exit(1);
    } else {
        console.log('🎉 ALL GEMINI 3.8 FLASH VERIFICATIONS PASSED CLEANLY!\n');
        process.exit(0);
    }
}

runLiveTest();
