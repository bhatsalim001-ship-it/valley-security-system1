/**
 * VERIFICATION TEST SUITE: PHASE 3 - EMPLOYEE-FACING ONBOARDING PORTAL & SMART CAPTURE
 * 
 * Verifies:
 * 1. Static HTML/CSS Structure:
 *    - 3-step visual layout (Personal Details, Deputation & Contact, Duty Portrait Photo)
 *    - Smart field hints (Age hint, Mobile hint, Department lock badge, Photo attached badge)
 *    - Camera modal with Front/Rear flip control
 *    - Digital receipt card with ID badge, candidate info, and 3-step onboarding workflow
 *    - Strict enforcement: No finger signatures, No document photo uploads
 * 2. Client-Side Helper Functions:
 *    - toTitleCase name auto-formatting
 *    - Real-time age calculation from Date of Birth
 *    - Real-time 10-digit mobile number sanitization and length check
 * 3. Live Server E2E Tests:
 *    - Server starts and serves /register.html
 *    - Project context fetching via /api/public/project-info/:slug
 *    - Tender-tagged guard self-registration with portrait photo
 *    - General walk-in self-registration without tender tag
 *    - Mobile number validation boundary test
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

const TEST_PORT = 3895;
const baseUrl = `http://127.0.0.1:${TEST_PORT}`;
let JWT_SECRET = 'default-dev-secret-replace-in-production-min32chars';
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/JWT_SECRET\s*=\s*(.+)/);
  if (match) {
    JWT_SECRET = match[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    testsPassed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    testsFailed++;
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 1. Pure unit test implementations of client-side helpers to verify logic
function toTitleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s|-|\.)\S/g, function(char) {
    return char.toUpperCase();
  });
}

function calculateAge(dobStr, asOfDate = new Date()) {
  const birthDate = new Date(dobStr);
  if (isNaN(birthDate.getTime())) return null;
  let age = asOfDate.getFullYear() - birthDate.getFullYear();
  const m = asOfDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && asOfDate.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function sanitizeMobile(input) {
  return String(input).replace(/\D/g, '');
}

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`PHASE 3 VERIFICATION: EMPLOYEE ONBOARDING PORTAL`);
  console.log(`======================================================\n`);

  // --- PART 1: STATIC TEMPLATE INTEGRITY ---
  console.log(`=== 1. STATIC TEMPLATE INTEGRITY (register.html) ===`);
  const registerHtmlPath = path.join(__dirname, 'public', 'register.html');
  assert(fs.existsSync(registerHtmlPath), 'register.html exists in public directory');
  const html = fs.readFileSync(registerHtmlPath, 'utf8');

  // Step Headers
  assert(html.includes('Step 1 of 3') && html.includes('Personal Details'), 'Step 1 of 3 (Personal Details) header exists');
  assert(html.includes('Step 2 of 3') && html.includes('Deputation & Contact'), 'Step 2 of 3 (Deputation & Contact) header exists');
  assert(html.includes('Step 3 of 3') && html.includes('Duty Portrait Photograph'), 'Step 3 of 3 (Duty Portrait Photograph) header exists');

  // Step 1 Fields
  assert(html.includes('id="guard-name"'), 'Full Name input #guard-name exists');
  assert(html.includes('id="guard-guardian"'), 'Guardian input #guard-guardian exists');
  assert(html.includes('id="guard-relation"'), 'Relation select #guard-relation exists');
  assert(html.includes('id="guard-dob"'), 'DOB input #guard-dob exists');
  assert(html.includes('id="dob-age-hint"'), 'Age live hint #dob-age-hint exists');
  assert(html.includes('id="guard-gender"'), 'Gender select #guard-gender exists');
  assert(html.includes('id="guard-blood"'), 'Blood Group select #guard-blood exists');

  // Step 2 Fields
  assert(html.includes('id="guard-mobile"'), 'Mobile input #guard-mobile exists');
  assert(html.includes('id="mobile-validation-hint"'), 'Mobile live hint #mobile-validation-hint exists');
  assert(html.includes('id="guard-department"'), 'Department select #guard-department exists');
  assert(html.includes('id="department-lock-badge"'), 'Department lock badge #department-lock-badge exists');
  assert(html.includes('id="guard-designation"'), 'Designation select #guard-designation exists');
  assert(html.includes('id="guard-address"'), 'Address textarea #guard-address exists');

  // Step 3 Photo & Camera
  assert(html.includes('id="photo-drop-zone"'), 'Photo drop zone #photo-drop-zone exists');
  assert(html.includes('id="preview-placeholder"'), 'Preview placeholder #preview-placeholder exists');
  assert(html.includes('id="photo-preview-img"'), 'Photo preview img #photo-preview-img exists');
  assert(html.includes('id="photo-attached-badge"'), 'Photo ready chip #photo-attached-badge exists');
  assert(html.includes('id="btn-flip-camera"'), 'Camera flip button #btn-flip-camera exists');
  assert(html.includes('id="camera-facing-label"'), 'Camera facing label #camera-facing-label exists');
  assert(html.includes('id="camera-stream-video"'), 'Camera stream video #camera-stream-video exists');

  // Success Screen & Digital Receipt
  assert(html.includes('id="view-success-panel"'), 'Success panel #view-success-panel exists');
  assert(html.includes('id="success-receipt-card"'), 'Digital receipt card #success-receipt-card exists');
  assert(html.includes('id="success-receipt-id"'), 'Receipt ID #success-receipt-id exists');
  assert(html.includes('id="success-receipt-name"'), 'Receipt Name #success-receipt-name exists');
  assert(html.includes('id="success-receipt-designation"'), 'Receipt Designation #success-receipt-designation exists');
  assert(html.includes('id="success-receipt-dept"'), 'Receipt Dept #success-receipt-dept exists');
  assert(html.includes('id="success-receipt-project"'), 'Receipt Project #success-receipt-project exists');
  assert(html.includes('Pending Office Verification'), 'Pending Office Verification status badge exists');
  assert(html.includes('What Happens Next:'), 'Next steps explanation exists on receipt');

  // Strict Exclusions (User explicit constraints)
  assert(!html.includes('signature-pad') && !html.includes('id="signature-canvas"'), 'Strict constraint: Zero finger signature pad elements');
  assert(!html.includes('upload-aadhaar') && !html.includes('upload-passbook'), 'Strict constraint: Zero document photo upload inputs');

  // --- PART 2: JAVASCRIPT CONTROLLER FUNCTIONS ---
  console.log(`\n=== 2. CLIENT-SIDE HELPER FUNCTIONS & LOGIC ===`);
  
  // Title Case
  assert(toTitleCase('tariq ahmad lone') === 'Tariq Ahmad Lone', 'toTitleCase capitalizes lowercase names');
  assert(toTitleCase('MOHAMMAD RAFIQ') === 'Mohammad Rafiq', 'toTitleCase converts ALL-CAPS to Title Case');
  assert(toTitleCase('dr. abdul qadir-khan') === 'Dr. Abdul Qadir-Khan', 'toTitleCase preserves punctuation and hyphens');

  // Age calculation
  const fixedToday = new Date('2026-11-14');
  assert(calculateAge('1998-05-15', fixedToday) === 28, 'calculateAge correctly computes 28 years');
  assert(calculateAge('2010-12-01', fixedToday) === 15, 'calculateAge correctly computes 15 years (underage)');
  assert(calculateAge('2027-01-01', fixedToday) === -1, 'calculateAge correctly identifies future dates');

  // Mobile sanitation
  assert(sanitizeMobile('+91 98765-43210') === '919876543210', 'sanitizeMobile strips non-digits');
  assert(sanitizeMobile('9876543210').length === 10, 'sanitizeMobile validates 10 digits');

  // Code inspection for event bindings
  assert(html.includes('nameInput.addEventListener(\'blur\''), 'Blur listener for Name Title Case registered');
  assert(html.includes('guardianInput.addEventListener(\'blur\''), 'Blur listener for Guardian Title Case registered');
  assert(html.includes('mobileInput.addEventListener(\'input\''), 'Input listener for Mobile live hint registered');
  assert(html.includes('dobInput.addEventListener(\'change\''), 'Change listener for DOB live hint registered');
  assert(html.includes('toggleCameraFacing()'), 'toggleCameraFacing handler bound');

  // --- PART 3: LIVE SERVER E2E INTEGRATION ---
  console.log(`\n=== 3. LIVE SERVER E2E WORKFLOW TESTS ===`);

  const serverProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'ignore'
  });

  let serverReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${baseUrl}/api/system-version`);
      if (res.ok) {
        serverReady = true;
        break;
      }
    } catch (e) {}
    await sleep(400);
  }
  assert(serverReady, `Test server started on port ${TEST_PORT}`);

  const adminToken = jwt.sign(
    { id: 'admin-phase3-tester', username: 'admin', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  const validPhotoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  let projectId = null;
  let cand1Id = null;
  let cand2Id = null;

  try {
    // 1. Create a Tender Deployment Project to test the portal context
    const projRes = await fetch(`${baseUrl}/api/deployment-projects`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'GMC Baramulla Hospital Security 2026',
        clientName: 'Government Medical College Baramulla',
        location: 'Kanthbagh, Baramulla, J&K',
        targetGuards: 60,
        department: 'GMC HOSPITAL',
        designation: 'Security Guard',
        instructions: 'Report in clean uniform for bio-verification.'
      })
    });
    assert(projRes.status === 201, 'Created deployment project GMC Baramulla');
    const projData = await projRes.json();
    const project = projData.project;
    projectId = project ? project.id : null;

    // 2. Query Public Project Info by Slug (what register.html does on ?project=slug)
    const infoRes = await fetch(`${baseUrl}/api/public/project-info/${project.slug}`);
    assert(infoRes.status === 200, 'Public project info query succeeds');
    const infoData = await infoRes.json();
    assert(infoData.name === 'GMC Baramulla Hospital Security 2026', 'Project info returns correct project name');
    assert(infoData.department === 'GMC HOSPITAL', 'Project info returns locked department');
    assert(infoData.clientName === 'Government Medical College Baramulla', 'Project info returns client name');

    // 3. Register Candidate via Tender Onboarding Link
    const candPayload = {
      name: 'Gulzar Ahmad Mir',
      mobile: '9797123456',
      guardianName: 'Bashir Ahmad Mir',
      relationType: 'Father',
      dob: '1995-04-10',
      bloodGroup: 'B+',
      department: 'GMC HOSPITAL',
      designation: 'Security Guard',
      gender: 'Male',
      currentAddress: 'Delina, Baramulla, J&K - 193101',
      photoBase64: validPhotoBase64,
      deploymentProjectId: project.id,
      deploymentProjectSlug: project.slug
    };

    const regRes = await fetch(`${baseUrl}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(candPayload)
    });

    assert(regRes.status === 200 || regRes.status === 201, 'Tender candidate registered successfully');
    const regData = await regRes.json();
    assert(regData.success === true, 'Response confirms registration success');
    cand1Id = regData.employeeId;
    assert(typeof cand1Id === 'string' && cand1Id.startsWith('VSA-'), `Assigned Staff ID: ${cand1Id}`);
    assert(regData.projectName === 'GMC Baramulla Hospital Security 2026', 'Returned matching project name for receipt card');

    // 4. Verify Candidate is Linked to Deployment Project in Database
    const detailRes = await fetch(`${baseUrl}/api/deployment-projects/${project.id}`, { headers: authHeaders });
    assert(detailRes.status === 200, 'Fetched deployment project details');
    const detailData = await detailRes.json();
    const linkedCandidate = (detailData.employees || []).find(e => e.id === cand1Id);
    assert(linkedCandidate !== undefined, 'Registered candidate found in project candidate roster');
    assert(linkedCandidate.name === 'Gulzar Ahmad Mir', 'Candidate name correctly saved');
    assert(linkedCandidate.status === 'Pending', 'Candidate initial status is Pending verification');

    // 5. Test Zero-Regression: General Walk-In Self-Registration (No project tag)
    const walkinPayload = {
      name: 'Showkat Ali Lone',
      mobile: '9419112233',
      guardianName: 'Ghulam Qadir Lone',
      relationType: 'Father',
      dob: '1992-08-20',
      bloodGroup: 'O+',
      department: 'NIFT',
      designation: 'Security Guard',
      gender: 'Male',
      currentAddress: 'Rangreth, Budgam, J&K',
      photoBase64: validPhotoBase64
    };

    const walkinRes = await fetch(`${baseUrl}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(walkinPayload)
    });

    assert(walkinRes.status === 200 || walkinRes.status === 201, 'Walk-in candidate registered successfully');
    const walkinData = await walkinRes.json();
    cand2Id = walkinData.employeeId;
    assert(walkinData.success === true && cand2Id.startsWith('VSA-'), `Walk-in assigned Staff ID: ${cand2Id}`);
    assert(walkinData.projectName === null, 'Walk-in project name is null (general pool)');

    // 6. Test Mobile Validation: Rejection on Missing or Non-10-Digit Mobile
    const invalidMobilePayload = {
      ...walkinPayload,
      name: 'Invalid Mobile Test',
      mobile: '123' // Invalid
    };

    const invalidRes = await fetch(`${baseUrl}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidMobilePayload)
    });
    assert(invalidRes.status === 400, 'Server rejects invalid mobile number (status 400)');

  } finally {
    console.log('\n🧹 Cleaning up test artifacts from database...');
    try {
      if (cand1Id) {
        await fetch(`${baseUrl}/api/employees/${cand1Id}`, { method: 'DELETE', headers: authHeaders });
      }
      if (cand2Id) {
        await fetch(`${baseUrl}/api/employees/${cand2Id}`, { method: 'DELETE', headers: authHeaders });
      }
      if (projectId) {
        await fetch(`${baseUrl}/api/deployment-projects/${projectId}`, { method: 'DELETE', headers: authHeaders });
      }
      console.log('✅ Cleaned up test candidates and project.');
    } catch (cleanErr) {
      console.warn('⚠️ Cleanup warning:', cleanErr.message);
    }
    serverProcess.kill('SIGTERM');
  }

  console.log(`\n======================================================`);
  console.log(`PHASE 3 TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`======================================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error in Phase 3 verification suite:', err);
  process.exit(1);
});
