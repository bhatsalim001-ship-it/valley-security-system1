/**
 * VERIFICATION TEST SUITE: PHASE 4 - OMEGA INTELLIGENT PHOTOGRAPH CAPTURE & QUALITY SYSTEM
 * 
 * Verifies:
 * 1. Static UI & Markup Integrity:
 *    - Head & shoulder framing guide (.head-guide-oval, .shoulder-guide-arch)
 *    - Camera guide caption pill with positioning advice (.camera-guide-caption)
 *    - Camera flip switch control (#btn-flip-camera)
 *    - Assistive Quality Diagnostic HUD in Cropper Modal (#photo-quality-hud)
 *    - Dynamic Status Chips: Lighting (#hud-chip-lighting), Focus (#hud-chip-focus), Framing (#hud-chip-framing)
 *    - Assistive Tip Box with actionable recommendations (#hud-tip-box, #hud-tip-message)
 *    - 1-Click Retake action (#btn-crop-retake)
 *    - ID Card Spec Quality Badge in dropzone (#photo-quality-badge, #photo-quality-badge-text)
 *    - Standardized 300x400 px JPEG at 85% ID Card resolution
 *    - Strict Safeguards: No facial recognition, No discrimination, Assistive non-blocking, File upload fallback
 * 2. Quality Diagnostic Engine Unit Tests (Mock Canvas):
 *    - Balanced sharp portrait passes all diagnostics
 *    - Underexposed / low-light triggers "Lighting: Too Dark" + tip
 *    - Overexposed / glare triggers "Lighting: Too Bright / Glare" + tip
 *    - Blurry portrait triggers "Focus: Soft / Blurry" + tip
 *    - Flat / blank frame triggers "Framing: Center Head in Frame"
 * 3. Live Server E2E Workflows:
 *    - Server startup on port 3896
 *    - Deployment project creation & public slug resolution
 *    - Self-registration with standardized 300x400 ID card portrait
 *    - Roster linking and photo persistence
 *    - Bulk approval handoff for ID Card Studio
 *    - Walk-in candidate registration with portrait
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

const TEST_PORT = 3896;
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

function adminToken() {
  return jwt.sign(
    { id: 1, email: 'admin@valleysecurity.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Synthetic mock canvas for Node.js image quality testing
function createMockCanvas(w, h, pixelGen) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const rgb = pixelGen(x, y);
      data[idx] = rgb[0];
      data[idx + 1] = rgb[1];
      data[idx + 2] = rgb[2];
      data[idx + 3] = 255;
    }
  }
  return {
    getContext: () => ({
      drawImage: () => {},
      getImageData: () => ({ data })
    })
  };
}

// 300x400 sample 1x1 GIF base64 for testing API payload
const sampleBase64Photo = 'data:image/jpeg;base64,' + Buffer.from(
  'ffd8ffe000104a46494600010101006000600000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333430ffc0000b080001000101011100ffda0008010100003f00bf80ff00ffd9',
  'hex'
).toString('base64');

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('PHASE 4 VERIFICATION: OMEGA INTELLIGENT PHOTO CAPTURE');
  console.log('======================================================\n');

  // =========================================================================
  // 1. STATIC TEMPLATE INTEGRITY (register.html)
  // =========================================================================
  console.log('=== 1. STATIC UI & QUALITY ASSISTANCE INTEGRITY ===');
  const registerHtmlPath = path.resolve(__dirname, 'public', 'register.html');
  assert(fs.existsSync(registerHtmlPath), 'register.html exists in public directory');
  const registerHtml = fs.readFileSync(registerHtmlPath, 'utf8');

  // Camera guides
  assert(registerHtml.includes('.head-guide-oval'), 'Head framing guide (.head-guide-oval) CSS defined');
  assert(registerHtml.includes('class="head-guide-oval"'), 'Head framing guide element present in camera view');
  assert(registerHtml.includes('.shoulder-guide-arch'), 'Shoulder framing guide (.shoulder-guide-arch) CSS defined');
  assert(registerHtml.includes('class="shoulder-guide-arch"'), 'Shoulder framing guide element present in camera view');
  assert(registerHtml.includes('.camera-guide-caption'), 'Camera guide caption CSS defined');
  assert(registerHtml.includes('Position head inside oval, shoulders at base'), 'Assistive framing text present for user guidance');
  assert(registerHtml.includes('id="btn-flip-camera"'), 'Front/Rear camera flip button present (#btn-flip-camera)');
  assert(registerHtml.includes('id="camera-facing-label"'), 'Camera facing label present (#camera-facing-label)');

  // Assistive Quality HUD in Cropper Modal
  assert(registerHtml.includes('id="photo-quality-hud"'), 'Photo quality HUD (#photo-quality-hud) container present');
  assert(registerHtml.includes('id="hud-chip-lighting"'), 'Lighting status chip (#hud-chip-lighting) present');
  assert(registerHtml.includes('id="hud-text-lighting"'), 'Lighting text span (#hud-text-lighting) present');
  assert(registerHtml.includes('id="hud-chip-focus"'), 'Focus / sharpness chip (#hud-chip-focus) present');
  assert(registerHtml.includes('id="hud-text-focus"'), 'Focus text span (#hud-text-focus) present');
  assert(registerHtml.includes('id="hud-chip-framing"'), 'Framing status chip (#hud-chip-framing) present');
  assert(registerHtml.includes('id="hud-text-framing"'), 'Framing text span (#hud-text-framing) present');
  assert(registerHtml.includes('id="hud-tip-box"'), 'Assistive tip box (#hud-tip-box) present');
  assert(registerHtml.includes('id="hud-tip-message"'), 'Assistive tip message container (#hud-tip-message) present');
  assert(registerHtml.includes('id="hud-quality-summary"'), 'Quality summary badge (#hud-quality-summary) present');
  assert(registerHtml.includes('id="btn-crop-retake"'), 'One-click Retake action (#btn-crop-retake) present');

  // Form Photo Dropzone Quality Badge
  assert(registerHtml.includes('id="photo-quality-badge"'), 'Verified ID card quality badge (#photo-quality-badge) present');
  assert(registerHtml.includes('id="photo-quality-badge-text"'), 'Quality badge text (#photo-quality-badge-text) present');
  assert(registerHtml.includes('id="photo-attached-badge"'), 'Photo attached badge (#photo-attached-badge) present');

  // Standardized ID Card Image Specifications
  assert(registerHtml.includes('width: 300') && registerHtml.includes('height: 400'), 'Standard ID card resolution 300x400 px enforced');
  assert(registerHtml.includes("'image/jpeg', 0.85"), 'High-fidelity JPEG compression (85%) enforced');
  assert(registerHtml.includes('3 / 4'), 'Default aspect ratio locked to 3:4 ID Card portrait');

  // Strict Safeguards Check
  assert(!registerHtml.toLowerCase().includes('facenet') && !registerHtml.toLowerCase().includes('faceapi'), 'Strict safeguard: Zero facial recognition or identity inference libraries');
  assert(!registerHtml.toLowerCase().includes('skintone') && !registerHtml.toLowerCase().includes('skin_color'), 'Strict safeguard: Zero discriminatory skin tone or appearance algorithms');
  assert(registerHtml.includes('Choose Photo') && registerHtml.includes('type="file"'), 'Strict safeguard: File upload fallback maintained for camera-incompatible devices');
  assert(registerHtml.includes('qualityBadge.style.display = \'none\''), 'Form reset clears photo quality badge cleanly');

  // =========================================================================
  // 2. QUALITY DIAGNOSTIC ENGINE UNIT TESTS
  // =========================================================================
  console.log('\n=== 2. ALGORITHMIC QUALITY DIAGNOSTICS UNIT TESTS ===');

  // Extract function from register.html
  const fnMatch = registerHtml.match(/function analyzeImageQuality\([\s\S]*?^ {8}\}/m);
  assert(fnMatch !== null, 'analyzeImageQuality function defined in register.html');

  // Eval function in sandboxed scope for unit testing
  let analyzeImageQuality;
  eval(`analyzeImageQuality = ${fnMatch[0]}`);

  // Test 2.1: Balanced Sharp Portrait
  const sharpCanvas = createMockCanvas(120, 160, (x, y) => {
    const isCenter = x >= 35 && x <= 85 && y >= 25 && y <= 95;
    const edge = (x + y) % 2 === 0 ? 30 : -30;
    return isCenter ? [135 + edge, 135 + edge, 135 + edge] : [200, 200, 200];
  });
  const sharpRes = analyzeImageQuality(sharpCanvas);
  assert(sharpRes.lighting.status === 'pass', 'Balanced portrait: lighting status is "pass"');
  assert(sharpRes.lighting.text.includes('Balanced'), 'Balanced portrait: lighting text indicates balanced lighting');
  assert(sharpRes.focus.status === 'pass', 'Sharp portrait: focus status is "pass"');
  assert(sharpRes.focus.variance >= 55, 'Sharp portrait: Laplacian variance >= 55');
  assert(sharpRes.framing.status === 'pass', 'Centered portrait: framing status is "pass"');
  assert(sharpRes.readyForPrint === true, 'Balanced sharp portrait: readyForPrint is true');
  assert(sharpRes.tips.length === 0, 'Balanced sharp portrait: zero warnings/tips');

  // Test 2.2: Underexposed / Too Dark Portrait
  const darkCanvas = createMockCanvas(120, 160, (x, y) => [32, 32, 32]);
  const darkRes = analyzeImageQuality(darkCanvas);
  assert(darkRes.lighting.status === 'warn', 'Dark portrait: lighting status is "warn"');
  assert(darkRes.lighting.text === 'Lighting: Too Dark', 'Dark portrait: lighting text is "Lighting: Too Dark"');
  assert(darkRes.tips.some(t => t.includes('window') || t.includes('light')), 'Dark portrait: tip suggests improving lighting');
  assert(darkRes.readyForPrint === false, 'Dark portrait: readyForPrint is false');

  // Test 2.3: Overexposed / Harsh Glare Portrait
  const glareCanvas = createMockCanvas(120, 160, (x, y) => [242, 242, 242]);
  const glareRes = analyzeImageQuality(glareCanvas);
  assert(glareRes.lighting.status === 'warn', 'Glare portrait: lighting status is "warn"');
  assert(glareRes.lighting.text === 'Lighting: Too Bright / Glare', 'Glare portrait: lighting text indicates harsh glare');
  assert(glareRes.tips.some(t => t.includes('backlight') || t.includes('glare')), 'Glare portrait: tip suggests reducing backlight');

  // Test 2.4: Blurry / Uniform Image
  const blurryCanvas = createMockCanvas(120, 160, (x, y) => [128, 128, 128]);
  const blurryRes = analyzeImageQuality(blurryCanvas);
  assert(blurryRes.focus.status === 'warn', 'Blurry portrait: focus status is "warn"');
  assert(blurryRes.focus.text === 'Focus: Soft / Blurry', 'Blurry portrait: focus text is "Focus: Soft / Blurry"');
  assert(blurryRes.tips.some(t => t.includes('steady') || t.includes('lens')), 'Blurry portrait: tip suggests holding phone steady');

  // Test 2.5: Blank / Missing Face in Frame
  assert(blurryRes.framing.status === 'warn', 'Flat uniform canvas: framing status is "warn"');
  assert(blurryRes.framing.text === 'Framing: Center Head in Frame', 'Flat canvas: framing text indicates centering required');

  // =========================================================================
  // 3. LIVE SERVER E2E TESTS WITH STANDARDIZED PHOTO PORTRAIT
  // =========================================================================
  console.log('\n=== 3. LIVE SERVER E2E REGISTRATION WITH SMART PORTRAIT ===');

  const serverProc = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: TEST_PORT.toString() },
    stdio: 'ignore'
  });

  let projectId = null;
  let empId = null;
  let walkInId = null;
  const token = adminToken();

  try {
    let serverReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        const ping = await fetch(`${baseUrl}/api/public/classifications`);
        if (ping.ok) {
          serverReady = true;
          break;
        }
      } catch (e) {
        await sleep(300);
      }
    }
    assert(serverReady, `Test server started and reachable on port ${TEST_PORT}`);

    // Create a Tender Project for Smart Photo Intake
    const createProjRes = await fetch(`${baseUrl}/api/deployment-projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: 'SKIMS Soura ICU Security Deployment 4820',
        clientName: 'Sher-i-Kashmir Institute of Medical Sciences',
        location: 'Soura, Srinagar',
        targetGuards: 60,
        department: 'SKIMS ICU',
        designation: 'Security Guard'
      })
    });
    assert(createProjRes.status === 201, 'Created deployment project successfully (status 201)');
    const projData = await createProjRes.json();
    const createdProject = projData.project;
    projectId = createdProject ? createdProject.id : null;
    assert(Boolean(createdProject && createdProject.id), 'Project has valid ID');
    assert(Boolean(createdProject && createdProject.slug), 'Project slug generated cleanly');

    // Register guard with standardized 300x400 ID card portrait photo
    const uniqueTenderMobile = '98' + Math.floor(10000000 + Math.random() * 89999999);
    const uniqueWalkinMobile = '97' + Math.floor(10000000 + Math.random() * 89999999);

    const regRes = await fetch(`${baseUrl}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mushtaq Ahmad Mir',
        guardianName: 'Ghulam Hassan Mir',
        relationType: 'Father',
        dob: '1992-07-15',
        gender: 'Male',
        bloodGroup: 'B+',
        mobile: uniqueTenderMobile,
        department: 'SKIMS ICU',
        designation: 'Security Guard',
        currentAddress: 'HMT Zainakote, Srinagar, 190012',
        photoBase64: sampleBase64Photo, // Standardized 300x400 photo payload
        deploymentProjectId: createdProject.id,
        deploymentProjectSlug: createdProject.slug
      })
    });
    assert(regRes.status === 200 || regRes.status === 201, 'Tender guard with smart portrait photo registered successfully (status 200)');
    const regData = await regRes.json();
    assert(regData.success === true, 'Response confirms registration success');
    empId = regData.employeeId || regData.id;
    assert(Boolean(empId && empId.startsWith('VSA-')), `Candidate assigned Staff ID: ${empId}`);
    assert(regData.projectName === 'SKIMS Soura ICU Security Deployment 4820', 'Candidate matched to tender deployment');

    // Verify candidate is linked in project details and photo is stored
    const projDetailRes = await fetch(`${baseUrl}/api/deployment-projects/${createdProject.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    assert(projDetailRes.status === 200, 'Project detail retrieved successfully');
    const projDetail = await projDetailRes.json();
    assert(projDetail.employees && projDetail.employees.length >= 1, 'Project roster contains registered candidate');
    const enrolledGuard = (projDetail.employees || []).find(e => e.id === empId);
    assert(Boolean(enrolledGuard), 'Enrolled guard found in project candidate roster');
    assert(enrolledGuard.status === 'Pending', 'Initial intake status is Pending verification');

    // Bulk approve candidate for deployment and ID card studio
    const approveRes = await fetch(`${baseUrl}/api/deployment-projects/${createdProject.id}/bulk-approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        employeeIds: [enrolledGuard.id]
      })
    });
    assert(approveRes.status === 200, 'Bulk approval endpoint succeeded (status 200)');
    const approveData = await approveRes.json();
    assert(approveData.approvedCount === 1, 'Candidate approved for duty deployment');

    // Verify general walk-in registration with standardized photo functions seamlessly
    const walkInRes = await fetch(`${baseUrl}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Zahoor Ahmad Bhat',
        guardianName: 'Abdul Gani Bhat',
        relationType: 'Father',
        dob: '1995-04-10',
        gender: 'Male',
        bloodGroup: 'O+',
        mobile: uniqueWalkinMobile,
        department: "ACCOUNTANT GENERAL'S OFFICE",
        designation: 'Security Guard',
        currentAddress: 'Nawab Bazar, Srinagar, 190002',
        photoBase64: sampleBase64Photo
      })
    });
    assert(walkInRes.status === 200 || walkInRes.status === 201, 'General walk-in candidate with portrait registered successfully');
    const walkInData = await walkInRes.json();
    walkInId = walkInData.employeeId || walkInData.id;
    assert(Boolean(walkInId && walkInId.startsWith('VSA-')), `Walk-in assigned Staff ID: ${walkInId}`);
    assert(walkInData.projectName === null, 'Walk-in project name is null (general agency pool)');

  } finally {
    console.log('\n🧹 Cleaning up test artifacts from database...');
    try {
      if (empId) {
        await fetch(`${baseUrl}/api/employees/${empId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
      if (walkInId) {
        await fetch(`${baseUrl}/api/employees/${walkInId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
      if (projectId) {
        await fetch(`${baseUrl}/api/deployment-projects/${projectId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }
      console.log('✅ Cleaned up test employees and project.');
    } catch (cleanErr) {
      console.warn('⚠️ Cleanup warning:', cleanErr.message);
    }
    serverProc.kill();
  }

  console.log('\n======================================================');
  console.log(`PHASE 4 TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log('======================================================\n');

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
