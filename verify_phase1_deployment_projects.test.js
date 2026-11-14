// Automated Verification Suite for Phase 1: Deployment Projects & Smart Onboarding
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const TEST_PORT = 3892;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Load JWT secret from .env if present
let jwtSecret = 'default-dev-secret-replace-in-production-min32chars';
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const match = envContent.match(/JWT_SECRET\s*=\s*(.+)/);
  if (match) {
    jwtSecret = match[1].trim().replace(/^['"]|['"]$/g, '');
  }
}

// Generate Admin JWT Token
const adminToken = jwt.sign(
  { email: 'admin@valleysecurity.in', name: 'Super Admin', role: 'admin' },
  jwtSecret,
  { expiresIn: '1h' }
);

const authHeader = {
  'Authorization': `Bearer ${adminToken}`,
  'Content-Type': 'application/json'
};

let serverProcess = null;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServerReady(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE_URL}/api/system-version`);
      if (res.ok) {
        console.log(`✅ Test server is live on ${BASE_URL} (attempt ${i + 1})`);
        return true;
      }
    } catch (e) {
      // wait and retry
    }
    await sleep(400);
  }
  throw new Error(`Server failed to start on port ${TEST_PORT} within timeout`);
}

async function runTests() {
  console.log('================================================================');
  console.log('🧪 RUNNING PHASE 1 VERIFICATION TEST SUITE: DEPLOYMENT PROJECTS');
  console.log('================================================================');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failedTests++;
    }
  }

  try {
    // 1. Non-existent slug returns 404
    console.log('\n[Test 1] Public Project Info: 404 for invalid slug');
    const res1 = await fetch(`${BASE_URL}/api/public/project-info/non-existent-tender-slug-12345`);
    assert(res1.status === 404, 'Returns HTTP 404 for unknown project slug');

    // 2. Create Deployment Project (Admin Protected)
    console.log('\n[Test 2] Admin Creates Deployment Project');
    const uniqueSuffix = Date.now().toString().slice(-4);
    const projectName = `SKIMS Soura Security Tender ${uniqueSuffix}`;
    const targetGuards = 50;

    const res2 = await fetch(`${BASE_URL}/api/deployment-projects`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        name: projectName,
        clientName: 'Sher-i-Kashmir Institute of Medical Sciences (SKIMS)',
        location: 'Soura, Srinagar',
        targetGuards,
        department: `SKIMS SOURA ${uniqueSuffix}`,
        designation: 'Security Guard',
        deadline: '2026-12-31',
        instructions: 'Please bring your police clearance and wear formal clothes for photo capture.'
      })
    });

    const data2 = await res2.json();
    assert(res2.status === 201 && data2.success === true, 'Project created with HTTP 201');
    assert(data2.project && data2.project.id.startsWith('proj_'), 'Project ID has standard proj_ prefix');
    const projectSlug = data2.project.slug;
    const projectId = data2.project.id;
    assert(typeof projectSlug === 'string' && projectSlug.includes('skims-soura'), `Slug auto-generated cleanly: ${projectSlug}`);

    // 3. Public Project Info returns sanitized data
    console.log('\n[Test 3] Public Project Info Query by Slug (No Auth Needed)');
    const res3 = await fetch(`${BASE_URL}/api/public/project-info/${projectSlug}`);
    const data3 = await res3.json();
    assert(res3.status === 200, 'Public project info returned with HTTP 200');
    assert(data3.name === projectName, 'Public project name matches');
    assert(data3.clientName.includes('SKIMS'), 'Public client name matches');
    assert(data3.targetGuards === 50, 'Target guards count matches');

    // 4. Authenticated List of Deployment Projects
    console.log('\n[Test 4] Admin Project Listing & Initial Statistics');
    const res4 = await fetch(`${BASE_URL}/api/deployment-projects`, { headers: authHeader });
    const data4 = await res4.json();
    assert(res4.status === 200 && Array.isArray(data4), 'Projects list returned as array');
    const listedProj = data4.find(p => p.id === projectId);
    assert(!!listedProj, 'Created project is present in listing');
    assert(listedProj.stats.totalRegistered === 0, 'Initial totalRegistered is 0');
    assert(listedProj.stats.targetGuards === targetGuards, `Target guards is ${targetGuards}`);
    assert(listedProj.stats.progressPercent === 0, 'Initial progressPercent is 0%');

    // 5. Public Registration with Project Link
    console.log('\n[Test 5] Public Guard Self-Registration Tagged to Project');
    const guardMobile = `9906${Date.now().toString().slice(-6)}`;
    const res5 = await fetch(`${BASE_URL}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Tariq Ahmad Lone',
        mobile: guardMobile,
        guardianName: 'Ghulam Mohammad Lone',
        relationType: 'Father',
        dob: '1995-04-10',
        bloodGroup: 'B+',
        gender: 'Male',
        currentAddress: 'Soura, Srinagar, Kashmir',
        deploymentProjectSlug: projectSlug
      })
    });

    const data5 = await res5.json();
    assert(res5.status === 200 && data5.success === true, 'Public registration succeeded');
    const guardId = data5.employeeId;
    assert(typeof guardId === 'string' && guardId.startsWith('VSA-'), `Assigned valid ID ${guardId}`);
    assert(data5.projectName === projectName, 'Returned project name confirmation');

    // 6. Live Project Stats & Employee Linking
    console.log('\n[Test 6] Real-Time Stats Update & Employee Association');
    const res6 = await fetch(`${BASE_URL}/api/deployment-projects/${projectId}`, { headers: authHeader });
    const data6 = await res6.json();
    assert(res6.status === 200, 'Project details returned HTTP 200');
    assert(data6.stats.totalRegistered === 1, 'Live totalRegistered incremented to 1');
    assert(data6.stats.pendingCount === 1, 'Live pendingCount is 1');
    assert(data6.stats.approvedCount === 0, 'Live approvedCount is 0');
    assert(Array.isArray(data6.employees) && data6.employees.length === 1, 'Employees list contains exactly 1 guard');
    assert(data6.employees[0].id === guardId, 'Linked employee matches registered guard ID');
    assert(data6.employees[0].name === 'Tariq Ahmad Lone', 'Linked employee name matches');
    assert(data6.employees[0].status === 'Pending', 'Initial status is Pending');

    // 7. Bulk Approval of Project Guards
    console.log('\n[Test 7] Bulk Approval of Deployment Project Guards');
    const res7 = await fetch(`${BASE_URL}/api/deployment-projects/${projectId}/bulk-approve`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({ employeeIds: [guardId] })
    });
    const data7 = await res7.json();
    assert(res7.status === 200 && data7.success === true, 'Bulk approve API returned HTTP 200');
    assert(data7.count === 1, 'Approved exactly 1 guard');
    assert(data7.approvedIds.includes(guardId), 'Approved ID list contains guard');

    // Re-verify project stats after approval
    const res7b = await fetch(`${BASE_URL}/api/deployment-projects/${projectId}`, { headers: authHeader });
    const data7b = await res7b.json();
    assert(data7b.stats.approvedCount === 1, 'Live approvedCount is now 1');
    assert(data7b.stats.pendingCount === 0, 'Live pendingCount is now 0');
    assert(data7b.employees[0].status === 'Active', 'Employee status updated to Active');

    // 8. Zero Regressions on General Public Registration (Without Project Link)
    console.log('\n[Test 8] Zero-Regression Test on General Public Registration');
    const generalMobile = `9419${Date.now().toString().slice(-6)}`;
    const res8 = await fetch(`${BASE_URL}/api/public/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bilal Ahmad Dar',
        mobile: generalMobile,
        guardianName: 'Abdul Rashid Dar',
        relationType: 'Father',
        dob: '1992-08-15',
        bloodGroup: 'O+',
        gender: 'Male',
        currentAddress: 'Lal Chowk, Srinagar'
        // No project slug or ID passed
      })
    });
    const data8 = await res8.json();
    assert(res8.status === 200 && data8.success === true, 'Normal general registration succeeds without error');
    assert(data8.projectName === null, 'General registration has projectName null');

    // 9. Update Project Target & Deadline
    console.log('\n[Test 9] Update Deployment Project Target');
    const res9 = await fetch(`${BASE_URL}/api/deployment-projects/${projectId}`, {
      method: 'PUT',
      headers: authHeader,
      body: JSON.stringify({ targetGuards: 80, deadline: '2027-03-31' })
    });
    const data9 = await res9.json();
    assert(res9.status === 200 && data9.success === true, 'Project updated successfully');
    assert(data9.project.targetGuards === 80, 'Updated targetGuards is 80');

    // 10. Safe Deletion/Archival
    console.log('\n[Test 10] Deletion with Linked Employees Triggers Safe Archival');
    const res10 = await fetch(`${BASE_URL}/api/deployment-projects/${projectId}`, {
      method: 'DELETE',
      headers: authHeader
    });
    const data10 = await res10.json();
    assert(res10.status === 200 && data10.success === true, 'Delete API returned HTTP 200');
    assert(data10.archived === true, 'Safely archived instead of hard deleted because guards are linked');

    console.log('\n================================================================');
    console.log(`📊 TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('================================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('💥 Test execution failed with exception:', err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      console.log('🧹 Cleaned up test server process.');
    }
  }
}

// Start test server process and run tests
console.log(`🚀 Spawning test server process on PORT=${TEST_PORT}...`);
serverProcess = spawn('node', ['server.js'], {
  env: { ...process.env, PORT: TEST_PORT },
  stdio: 'inherit'
});

waitForServerReady()
  .then(runTests)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    if (serverProcess) serverProcess.kill('SIGTERM');
    process.exit(1);
  });
