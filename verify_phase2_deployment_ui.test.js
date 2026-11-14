/**
 * Automated Verification: Phase 2 Administrative Command Center UI & Deployment Operations
 * Verifies:
 * 1. HTML markup integrity (sections, modals, nav links, KPI cards, tables)
 * 2. JavaScript controller functions and state definitions
 * 3. End-to-end API lifecycle from project creation -> candidate registration -> candidate list -> approval -> bulk approval -> safe archival
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('=== PHASE 2: STATIC CODE INTEGRITY TESTS ===');

  const indexPath = path.join(__dirname, 'public', 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf8');

  // 1. Navigation & Views
  assert(indexHtml.includes('href="#deployments"'), 'Navigation link to #deployments exists');
  assert(indexHtml.includes('data-view="deployments"'), 'data-view="deployments" exists on nav link');
  assert(indexHtml.includes('id="nav-deployments-badge"'), 'Live badge #nav-deployments-badge exists');
  assert(indexHtml.includes('id="view-deployments"'), 'View container #view-deployments exists');

  // 2. KPI Cards
  assert(indexHtml.includes('id="stat-dep-active-projects"'), 'KPI #stat-dep-active-projects exists');
  assert(indexHtml.includes('id="stat-dep-target-guards"'), 'KPI #stat-dep-target-guards exists');
  assert(indexHtml.includes('id="stat-dep-registered-guards"'), 'KPI #stat-dep-registered-guards exists');
  assert(indexHtml.includes('id="stat-dep-approved-guards"'), 'KPI #stat-dep-approved-guards exists');

  // 3. Grid & Controls
  assert(indexHtml.includes('id="deployments-search-input"'), 'Search input #deployments-search-input exists');
  assert(indexHtml.includes('id="deployments-status-filter"'), 'Status filter #deployments-status-filter exists');
  assert(indexHtml.includes('id="deployment-projects-grid"'), 'Projects grid container #deployment-projects-grid exists');
  assert(indexHtml.includes('id="deployment-projects-empty"'), 'Empty state container #deployment-projects-empty exists');

  // 4. Modals
  assert(indexHtml.includes('id="deployment-project-modal"'), 'Project modal #deployment-project-modal exists');
  assert(indexHtml.includes('id="dep-project-name"'), 'Input #dep-project-name exists');
  assert(indexHtml.includes('id="dep-project-target"'), 'Input #dep-project-target exists');
  assert(indexHtml.includes('id="project-candidates-modal"'), 'Candidates drawer #project-candidates-modal exists');
  assert(indexHtml.includes('id="btn-bulk-approve-project"'), 'Button #btn-bulk-approve-project exists');
  assert(indexHtml.includes('id="btn-print-project-cards"'), 'Button #btn-print-project-cards exists');
  assert(indexHtml.includes('id="project-candidates-tbody"'), 'Table body #project-candidates-tbody exists');
  assert(indexHtml.includes('id="deployment-qr-modal"'), 'QR modal #deployment-qr-modal exists');
  assert(indexHtml.includes('id="deployment-qr-canvas"'), 'QR canvas #deployment-qr-canvas exists');

  // 5. JavaScript App.js Verification
  const appJsPath = path.join(__dirname, 'public', 'app.js');
  const appJs = fs.readFileSync(appJsPath, 'utf8');

  assert(appJs.includes('deploymentProjects: []'), 'VSA_STATE.deploymentProjects initialized');
  assert(appJs.includes('activeDeploymentProjectId: null'), 'VSA_STATE.activeDeploymentProjectId initialized');
  assert(appJs.includes('function loadDeploymentsData('), 'loadDeploymentsData function defined');
  assert(appJs.includes('function updateDeploymentsBadge('), 'updateDeploymentsBadge function defined');
  assert(appJs.includes('function filterDeploymentProjects('), 'filterDeploymentProjects function defined');
  assert(appJs.includes('function renderDeploymentProjects('), 'renderDeploymentProjects function defined');
  assert(appJs.includes('function openCreateProjectModal('), 'openCreateProjectModal function defined');
  assert(appJs.includes('function openEditProjectModal('), 'openEditProjectModal function defined');
  assert(appJs.includes('function closeDeploymentProjectModal('), 'closeDeploymentProjectModal function defined');
  assert(appJs.includes('function handleDeploymentProjectSubmit('), 'handleDeploymentProjectSubmit function defined');
  assert(appJs.includes('function openProjectCandidatesModal('), 'openProjectCandidatesModal function defined');
  assert(appJs.includes('function closeProjectCandidatesModal('), 'closeProjectCandidatesModal function defined');
  assert(appJs.includes('function approveIndividualCandidate('), 'approveIndividualCandidate function defined');
  assert(appJs.includes('function bulkApproveCurrentProject('), 'bulkApproveCurrentProject function defined');
  assert(appJs.includes('function printProjectCards('), 'printProjectCards function defined');
  assert(appJs.includes('function openDeploymentQrModal('), 'openDeploymentQrModal function defined');
  assert(appJs.includes('function closeDeploymentQrModal('), 'closeDeploymentQrModal function defined');
  assert(appJs.includes('function copyProjectLink('), 'copyProjectLink function defined');
  assert(appJs.includes('function shareProjectWhatsApp('), 'shareProjectWhatsApp function defined');
  assert(appJs.includes('function deleteOrArchiveProject('), 'deleteOrArchiveProject function defined');

  console.log('\n=== PHASE 2: E2E API & WORKSPACE WORKFLOW VERIFICATION ===');

  const TEST_PORT = 3894;
  const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

  let jwtSecret = 'default-dev-secret-replace-in-production-min32chars';
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/JWT_SECRET\s*=\s*(.+)/);
    if (match) {
      jwtSecret = match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  const adminToken = jwt.sign(
    { email: 'admin@valleysecurity.in', name: 'Super Admin', role: 'admin' },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const authHeaders = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  // Spawn test server
  const serverProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT: String(TEST_PORT) },
    stdio: 'ignore'
  });

  // Wait for server ready
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

  try {
    // 1. Create Deployment Project
    const createRes = await fetch(`${baseUrl}/api/deployment-projects`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'SKIMS Medical Security Onboarding 2026',
        clientName: 'SKIMS Hospital',
        location: 'Soura, Srinagar, J&K',
        targetGuards: 120,
        department: 'SKIMS SOURA',
        designation: 'Security Guard',
        deadline: '2026-12-31',
        instructions: 'Please report with uniform portrait photo.',
        notes: 'Tender Ref #SKIMS/SEC/2026'
      })
    });

    assert(createRes.status === 201, 'Created deployment project successfully (status 201)');
    const createData = await createRes.json();
    const project = createData.project;
    assert(project && project.id && project.slug.includes('skims-medical-security-onboarding-2026'), 'Project slug auto-generated correctly');

    // 2. Public Project Info
    const pubInfoRes = await fetch(`${baseUrl}/api/public/project-info/${project.slug}`);
    assert(pubInfoRes.status === 200, 'Public project info endpoint accessible (status 200)');
    const pubData = await pubInfoRes.json();
    assert(pubData?.department === 'SKIMS SOURA', 'Department locked to SKIMS SOURA');

    // 3. Register Candidate 1 via public registration
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const mob1 = '9419' + Math.floor(100000 + Math.random() * 900000);
    const regRes1 = await fetch(`${baseUrl}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Mohammad Tariq Bhat',
        fatherName: 'Ghulam Rasool Bhat',
        guardianName: 'Ghulam Rasool Bhat',
        relationType: 'Father',
        dob: '1995-04-12',
        gender: 'Male',
        bloodGroup: 'O+',
        mobile: mob1,
        currentAddress: 'Soura, Srinagar',
        department: 'SKIMS SOURA',
        designation: 'Security Guard',
        deploymentProjectId: project.id,
        deploymentProjectSlug: project.slug,
        photo: validPng
      })
    });
    const regData1 = await regRes1.json();
    if (regRes1.status !== 200 && regRes1.status !== 201) {
      console.error('Registration 1 error:', regRes1.status, regData1);
    }
    assert(regRes1.status === 200 || regRes1.status === 201, 'Candidate 1 registered via tender link');
    const cand1Id = regData1.employeeId;
    assert(Boolean(cand1Id), `Candidate 1 assigned ID: ${cand1Id}`);

    // 4. Register Candidate 2
    const mob2 = '9419' + Math.floor(100000 + Math.random() * 900000);
    const regRes2 = await fetch(`${baseUrl}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Aijaz Ahmad Wani',
        fatherName: 'Abdul Ahad Wani',
        guardianName: 'Abdul Ahad Wani',
        relationType: 'Father',
        dob: '1998-08-20',
        gender: 'Male',
        bloodGroup: 'B+',
        mobile: mob2,
        currentAddress: 'Soura, Srinagar',
        department: 'SKIMS SOURA',
        designation: 'Security Guard',
        deploymentProjectId: project.id,
        deploymentProjectSlug: project.slug,
        photo: validPng
      })
    });
    const regData2 = await regRes2.json();
    if (regRes2.status !== 200 && regRes2.status !== 201) {
      console.error('Registration 2 error:', regRes2.status, regData2);
    }
    assert(regRes2.status === 200 || regRes2.status === 201, 'Candidate 2 registered via tender link');
    const cand2Id = regData2.employeeId;
    assert(Boolean(cand2Id), `Candidate 2 assigned ID: ${cand2Id}`);

    // 5. Check Protected Deployment Projects List with Live Stats
    const listRes = await fetch(`${baseUrl}/api/deployment-projects`, { headers: authHeaders });
    assert(listRes.status === 200, 'Fetched deployment projects list');
    const listData = await listRes.json();
    const listedProj = listData.find(p => p.id === project.id);
    assert(listedProj && listedProj.stats.totalRegistered >= 2, 'Live stats: totalRegistered is >= 2');
    assert(listedProj.stats.pendingCount >= 2, 'Live stats: pendingCount is >= 2');

    // 6. Check Protected Project Details & Candidates
    const detailRes = await fetch(`${baseUrl}/api/deployment-projects/${project.id}`, { headers: authHeaders });
    assert(detailRes.status === 200, 'Fetched deployment project details');
    const detailData = await detailRes.json();
    assert(detailData?.employees?.length >= 2, 'Project candidates count is >= 2');

    // 7. Individual Candidate Approval
    const approveRes = await fetch(`${baseUrl}/api/employees/${cand1Id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({ status: 'Active' })
    });
    assert(approveRes.status === 200, 'Candidate 1 approved individually');

    // Check stats after individual approval
    const statsCheck1Res = await fetch(`${baseUrl}/api/deployment-projects/${project.id}`, { headers: authHeaders });
    const statsCheck1 = await statsCheck1Res.json();
    assert(statsCheck1.stats.approvedCount >= 1, 'Stats reflect approved guard');

    // 8. Bulk Approval of Remaining Pending Candidates
    const bulkRes = await fetch(`${baseUrl}/api/deployment-projects/${project.id}/bulk-approve`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({})
    });
    assert(bulkRes.status === 200, 'Bulk approve succeeded');
    const bulkData = await bulkRes.json();
    assert(bulkData.approvedCount >= 1, 'Bulk approved remaining candidate(s)');

    // 9. Update Project Details
    const updateRes = await fetch(`${baseUrl}/api/deployment-projects/${project.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        targetGuards: 150,
        notes: 'Tender expanded by 30 guards'
      })
    });
    assert(updateRes.status === 200, 'Updated project target guards to 150');

    // 10. Safe Archival when guards exist
    const deleteRes = await fetch(`${baseUrl}/api/deployment-projects/${project.id}`, {
      method: 'DELETE',
      headers: authHeaders
    });
    assert(deleteRes.status === 200, 'Delete request processed successfully');
    const delData = await deleteRes.json();
    assert(delData.archived === true, 'Project safely archived instead of hard-deleted to preserve guard history');

  } finally {
    serverProcess.kill('SIGTERM');
  }

  console.log(`\n========================================`);
  console.log(`TEST RESULTS: ${testsPassed} passed, ${testsFailed} failed`);
  console.log(`========================================\n`);

  if (testsFailed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
