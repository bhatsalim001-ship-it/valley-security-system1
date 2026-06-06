/* ==========================================================================
   VALLEY SECURITY SYSTEM - SPA FRONTEND CONTROLLER
   ========================================================================== */

// Global State
let VSA_STATE = {
    employees: [],
    clients: [],
    departments: [],
    designations: [],
    manpowerTypes: [],
    templates: [],
    selectedEmployeeIds: [],
    lanIp: 'localhost:3000'
};

// Selection pointers
let selectedClientId = null;
let activeIdCardSide = 'front'; // 'front' or 'back'
let currentRegistrationMode = 'add'; // 'add' or 'edit'
let currentRegistrationEmpId = null;
let directoryViewMode = 'card'; // 'card' or 'list'

// Document Ready Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const currentUser = sessionStorage.getItem('currentUser');
    if (!currentUser) {
        window.location.href = '/login.html';
        return;
    }
    
    // Set current user in state
    VSA_STATE.currentUser = JSON.parse(currentUser);
    updateUserHeader();
    
    VSA_STATE.selectedEmployeeIds = [];
    initLuxuryInteractions();
    initTiltCards();
    initThemeSwitch();
    initSpaRouter();
    fetchData();
    setupEventHandlers();
    setupClassificationsManager();
    setupTemplatesManager();
    
    // Bind afterprint event to clean print classes
    window.addEventListener('afterprint', () => {
        document.body.classList.remove('bulk-print-active');
        document.body.classList.remove('record-print-active');
        const bulkContainer = document.getElementById('printable-id-bulk');
        if (bulkContainer) {
            bulkContainer.innerHTML = '';
            bulkContainer.classList.add('hidden');
        }
    });
    
    lucide.createIcons();
});

/* ==========================================================================
   1. LUXURY INTERACTION DESIGN SYSTEM (Cursor & Physics)
   ========================================================================== */
function initLuxuryInteractions() {
    // Disabled
}

function initTiltCards() {
    // Disabled
}

function initThemeSwitch() {
    const themeBtn = document.getElementById('theme-toggle-btn');
    if (!themeBtn) return;

    // Check saved theme or default to light
    const savedTheme = localStorage.getItem('vsa-theme') || 'light';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeBtn.querySelector('.theme-icon-dark').classList.add('hidden');
        themeBtn.querySelector('.theme-icon-light').classList.remove('hidden');
    }

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        const isDark = document.body.classList.contains('dark-theme');
        localStorage.setItem('vsa-theme', isDark ? 'dark' : 'light');

        const darkIcon = themeBtn.querySelector('.theme-icon-dark');
        const lightIcon = themeBtn.querySelector('.theme-icon-light');

        if (isDark) {
            darkIcon.classList.add('hidden');
            lightIcon.classList.remove('hidden');
        } else {
            darkIcon.classList.remove('hidden');
            lightIcon.classList.add('hidden');
        }
    });
}

/* ==========================================================================
   USER AUTHENTICATION & SESSION MANAGEMENT
   ========================================================================== */
function updateUserHeader() {
    const user = VSA_STATE.currentUser;
    if (!user) return;
    
    // Find or create user info element in header
    let userWidget = document.querySelector('.user-widget');
    if (!userWidget) {
        const headerRight = document.querySelector('.header-right');
        if (headerRight) {
            userWidget = document.createElement('div');
            userWidget.className = 'user-widget';
            headerRight.appendChild(userWidget);
        }
    }
    
    if (userWidget) {
        userWidget.innerHTML = `
            <div class="user-profile">
                <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                    <div class="user-name">${user.name}</div>
                    <div class="user-role">${user.role.toUpperCase()}</div>
                </div>
                <button class="logout-btn" onclick="logoutUser()" title="Logout">
                    <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
                </button>
            </div>
        `;
        lucide.createIcons();
    }
}

function logoutUser() {
    if (confirm('Are you sure you want to logout?')) {
        sessionStorage.removeItem('currentUser');
        fetch('/api/logout', { method: 'POST' }).catch(err => {});
        window.location.href = '/login.html';
    }
}

/* ==========================================================================
   2. SPA ROUTER & API SYNCING
   ========================================================================== */
function initSpaRouter() {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.app-view');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.getAttribute('data-view');
            
            // Toggle sidebar active highlights
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            // View toggle viewport
            views.forEach(v => {
                if (v.id === `view-${targetView}`) {
                    v.classList.remove('hidden');
                } else {
                    v.classList.add('hidden');
                }
            });

            // Update Headers Text
            updateHeaderTitles(targetView);
        });
    });
}

function updateHeaderTitles(view) {
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    const titles = {
        dashboard: { main: "Dashboard Overview", sub: "Valley Security operations control center." },
        employees: { main: "Employee Directory", sub: "Manage active and suspended security guards." },
        deployments: { main: "Client Deployments", sub: "Monitor personnel deployed across active client locations." },
        "id-cards": { main: "ID Badge Generator", sub: "Design, review, and print security clearance ID badges." },
        templates: { main: "ID Card Templates", sub: "Create, customize, and manage security ID layout configurations." },
        "emp-record": { main: "Employee Record - Letterhead", sub: "Print employee records on company letterhead with photo for office files." },
        reports: { main: "Reports & Audits", sub: "Generate CSV spreadsheets and printable listings." },
        settings: { main: "System Config", sub: "Local database exports, backup logs, and PSARA license profile." }
    };

    if (titles[view]) {
        pageTitle.textContent = titles[view].main;
        pageSubtitle.textContent = titles[view].sub;
    }
}

// Fetch All Database details
async function fetchData() {
    try {
        const response = await fetch('/api/db');
        if (!response.ok) throw new Error('API Sync failure');
        const db = await response.json();
        
        VSA_STATE.employees = db.employees || [];
        VSA_STATE.clients = [];
        VSA_STATE.departments = db.departments || [];
        VSA_STATE.designations = db.designations || [];
        VSA_STATE.manpowerTypes = db.manpowerTypes || [];
        


        // Fetch templates
        try {
            const templatesResponse = await fetch('/api/templates');
            if (templatesResponse.ok) {
                VSA_STATE.templates = await templatesResponse.json();
            } else {
                VSA_STATE.templates = [];
            }
        } catch (e) {
            VSA_STATE.templates = [];
        }
        
        // LAN Connection Detect
        try {
            const lanResponse = await fetch('/api/lan-ip');
            if (lanResponse.ok) {
                const lanData = await lanResponse.json();
                VSA_STATE.lanIp = lanData.lanIp;
            } else {
                VSA_STATE.lanIp = window.location.host;
            }
        } catch (e) {
            VSA_STATE.lanIp = window.location.host;
        }
        document.getElementById('lan-ip-display').textContent = `http://${VSA_STATE.lanIp}`;
        
        // Refresh UI components
        renderDashboard();
        renderEmployeeDirectory();
        populateSelectors();
        renderClassificationsManager();
        renderTemplatesList();
        
        lucide.createIcons();
    } catch (err) {
        console.error('Fetch error:', err);
        // Fallback local mock alerts if server unreachable
        document.getElementById('lan-ip-display').textContent = "Offline Mode";
    }
}

/* ==========================================================================
   3. RENDERING ENGINE
   ========================================================================== */

// A. Dashboard Rendering
function renderDashboard() {
    const totalGuards = VSA_STATE.employees.length;
    const activeGuards = VSA_STATE.employees.filter(e => e.status === 'Active').length;
    
    // Check ID expirations (Expired or expiring within next 30 days)
    let expiredOrExpiring = 0;
    const now = new Date();
    const alertThreshold = new Date();
    alertThreshold.setDate(now.getDate() + 30);
    
    VSA_STATE.employees.forEach(emp => {
        // Mocking validation logic for dates
        if (emp.status === 'Active') {
            const expDate = new Date(emp.joiningDate);
            expDate.setFullYear(expDate.getFullYear() + 3); // 3 Years ID validity
            if (expDate <= alertThreshold) {
                expiredOrExpiring++;
            }
        }
    });

    const activeRate = totalGuards > 0 ? Math.round((activeGuards / totalGuards) * 100) : 0;

    document.getElementById('stat-total-employees').textContent = totalGuards;
    document.getElementById('stat-active-employees').textContent = activeGuards;
    document.getElementById('stat-expired-ids').textContent = expiredOrExpiring;
    document.getElementById('stat-active-rate').textContent = activeRate + '%';

    // Update semicircular gauge SVG
    const gaugePath = document.getElementById('gauge-active-path');
    const gaugeText = document.getElementById('gauge-percentage-text');
    if (gaugePath && gaugeText) {
        const offset = 251.3 * (1 - activeRate / 100);
        gaugePath.setAttribute('stroke-dashoffset', offset);
        gaugeText.textContent = activeRate + '%';
    }

    // Render client distribution chart using elegant SVGs
    renderDistributionChart();

    // Render Alerts
    renderDashboardAlerts();

    // Render Recent Personnel
    renderRecentEmployeesTable();
}

function renderDistributionChart() {
    const container = document.getElementById('distribution-chart-container');
    container.innerHTML = '';
    
    // Count active guards per department
    const distribution = {};
    VSA_STATE.employees.forEach(e => {
        if (e.status === 'Active' && e.department) {
            distribution[e.department] = (distribution[e.department] || 0) + 1;
        }
    });

    const entries = Object.entries(distribution);
    if (entries.length === 0) {
        container.innerHTML = '<div class="placeholder-message">No Active Department Distribution.</div>';
        return;
    }

    // Render gorgeous inline responsive SVG bar charts
    let svgHtml = `<svg width="100%" height="100%" viewBox="0 0 600 ${entries.length * 40 + 30}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Draw grid lines
    for (let i = 0; i <= 5; i++) {
        const x = 120 + i * 80;
        svgHtml += `<line x1="${x}" y1="10" x2="${x}" y2="${entries.length * 40 + 10}" stroke="var(--glass-border)" stroke-width="1" stroke-dasharray="2 2"/>`;
        svgHtml += `<text x="${x}" y="${entries.length * 40 + 25}" fill="var(--text-muted)" font-size="10" font-family="inherit" text-anchor="middle">${i * 2}</text>`;
    }

    entries.forEach(([dept, count], idx) => {
        const y = 20 + idx * 40;
        // Max value scale (normalizing relative width)
        const barWidth = Math.min(count * 40, 440);
        
        svgHtml += `
            <text x="10" y="${y + 14}" fill="var(--text-primary)" font-size="12" font-family="inherit" font-weight="600">${dept.substring(0, 15)}...</text>
            <rect x="120" y="${y}" width="${barWidth}" height="18" rx="9" fill="url(#barGradient)"/>
            <text x="${130 + barWidth}" y="${y + 14}" fill="var(--theme-accent)" font-size="11" font-family="inherit" font-weight="700">${count}</text>
        `;
    });

    // Gradients def
    svgHtml += `
        <defs>
            <linearGradient id="barGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="var(--theme-sage)"/>
                <stop offset="100%" stop-color="var(--theme-accent)"/>
            </linearGradient>
        </defs>
    </svg>`;

    container.innerHTML = svgHtml;
}

function renderDashboardAlerts() {
    const container = document.getElementById('dashboard-alerts');
    container.innerHTML = '';
    
    const alerts = [];
    const now = new Date();
    const alertThreshold = new Date();
    alertThreshold.setDate(now.getDate() + 30);

    VSA_STATE.employees.forEach(emp => {
        // 1. Expirations check
        const expDate = new Date(emp.joiningDate);
        expDate.setFullYear(expDate.getFullYear() + 3);
        if (expDate < now) {
            alerts.push({
                type: 'critical',
                title: `${emp.name} ID Expired`,
                desc: `Badge expired on ${expDate.toLocaleDateString()}`
            });
        } else if (expDate <= alertThreshold) {
            alerts.push({
                type: 'warning',
                title: `${emp.name} ID Expiring Soon`,
                desc: `Expiring on ${expDate.toLocaleDateString()}`
            });
        }

        // 2. Missing/Failed Documentations check
        if (emp.documents) {
            if (emp.documents.policeVerification === 'Pending') {
                alerts.push({
                    type: 'pending',
                    title: `${emp.name} Police Record Pending`,
                    desc: 'Clearance verification has not been uploaded.'
                });
            }
            if (emp.documents.aadhaar === 'Pending') {
                alerts.push({
                    type: 'pending',
                    title: `${emp.name} Aadhaar Verification Needed`,
                    desc: 'Missing scanned Aadhaar copy validation.'
                });
            }
        }
    });

    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="placeholder-message">
                <i data-lucide="check-circle" class="gold-text" style="font-size: 24px;"></i>
                <p class="text-muted mt-2">All personnel records are verified and up-to-date.</p>
            </div>
        `;
        return;
    }

    alerts.slice(0, 5).forEach(alert => {
        const borderStyle = alert.type === 'critical' ? 'style="border-left-color: var(--status-suspended);"' : 
                           alert.type === 'warning' ? 'style="border-left-color: var(--status-pending);"' : 
                           'style="border-left-color: var(--theme-gold);"';

        const alertItem = document.createElement('div');
        alertItem.className = 'alert-item';
        alertItem.setAttribute('style', borderStyle.substring(7, borderStyle.length - 1));
        
        let icon = 'alert-circle';
        if (alert.type === 'critical') icon = 'shield-alert';
        else if (alert.type === 'warning') icon = 'clock';

        alertItem.innerHTML = `
            <div class="alert-icon-wrapper">
                <i data-lucide="${icon}"></i>
            </div>
            <div class="alert-info-details">
                <span class="alert-info-title">${alert.title}</span>
                <span class="alert-info-desc">${alert.desc}</span>
            </div>
        `;
        container.appendChild(alertItem);
    });
}

function renderRecentEmployeesTable() {
    const tbody = document.getElementById('recent-employees-table');
    tbody.innerHTML = '';
    
    // Sort employees by joining date descending
    const sorted = [...VSA_STATE.employees].sort((a, b) => new Date(b.joiningDate) - new Date(a.joiningDate));
    const recent = sorted.slice(0, 4);

    if (recent.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">No employees found.</td></tr>';
        return;
    }

    recent.forEach(emp => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${emp.id}</strong></td>
            <td>${emp.name}</td>
            <td>${emp.designation}</td>
            <td>${emp.department || '-'}</td>
            <td>${emp.joiningDate}</td>
            <td><span class="badge ${emp.status === 'Active' ? 'badge-active' : 'badge-suspended'}">${emp.status}</span></td>
        `;
        tbody.appendChild(row);
    });
}

// B. Employee Directory
function renderEmployeeDirectory() {
    const tbody = document.getElementById('employees-list-tbody');
    const cardGrid = document.getElementById('employees-card-grid');
    const listTableContainer = document.getElementById('employees-list-table-container');
    const cardGridContainer = document.getElementById('employees-card-grid-container');

    tbody.innerHTML = '';
    cardGrid.innerHTML = '';

    // Apply Filter Criteria
    const searchVal = document.getElementById('emp-filter-search').value.toLowerCase();
    const designationVal = document.getElementById('emp-filter-designation').value;
    const statusVal = document.getElementById('emp-filter-status').value;

    const filtered = VSA_STATE.employees.filter(emp => {
        const matchesSearch = emp.name.toLowerCase().includes(searchVal) || 
                              emp.id.toLowerCase().includes(searchVal) || 
                              emp.mobile.includes(searchVal);
        const matchesDesignation = !designationVal || emp.designation === designationVal;
        const matchesStatus = !statusVal || emp.status === statusVal;

        return matchesSearch && matchesDesignation && matchesStatus;
    });

    // Toggle view containers based on directoryViewMode
    if (directoryViewMode === 'card') {
        cardGridContainer.classList.remove('hidden');
        listTableContainer.classList.add('hidden');
    } else {
        cardGridContainer.classList.add('hidden');
        listTableContainer.classList.remove('hidden');
    }

    if (filtered.length === 0) {
        if (directoryViewMode === 'card') {
            cardGrid.innerHTML = '<div class="text-center placeholder-message col-12" style="grid-column: 1 / -1; padding: 40px; text-align: center; width: 100%;">No matching security personnel located in directory.</div>';
        } else {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center placeholder-message">No matching security personnel located in directory.</td></tr>';
        }
        return;
    }

    filtered.forEach(emp => {
        // Document checklist summaries
        let docsText = '';
        if (emp.documents) {
            const pv = emp.documents.policeVerification === 'Verified' ? '✓ PV' : '✗ PV';
            const adh = emp.documents.aadhaar === 'Completed' ? '✓ AD' : '✗ AD';
            docsText = `${adh} | ${pv}`;
        }

        const isChecked = VSA_STATE.selectedEmployeeIds.includes(emp.id) ? 'checked' : '';
        const photoSrc = (emp.documents && emp.documents.photo) ? emp.documents.photo : '';
        const showPhoto = photoSrc ? `<img src="${photoSrc}" alt="${emp.name}">` : `<i data-lucide="user"></i>`;
        
        if (directoryViewMode === 'card') {
            const card = document.createElement('div');
            card.className = 'directory-card';
            
            card.innerHTML = `
                <div class="directory-card-select">
                    <input type="checkbox" class="directory-select-item" data-id="${emp.id}" ${isChecked} style="cursor: pointer;">
                </div>
                <div class="directory-card-photo">
                    ${showPhoto}
                </div>
                <div class="directory-card-info">
                    <div class="directory-card-name" title="${emp.name}">${emp.name}</div>
                    <div class="directory-card-empid">${emp.id}</div>
                    <div class="directory-card-subtext" title="${emp.designation}">${emp.designation}</div>
                    <div class="directory-card-client" title="${emp.department || '-'}">${emp.department || '<span class="text-muted">-</span>'}</div>
                    <div class="directory-card-chips" style="align-items: center; gap: 6px;">
                        <span class="directory-card-chip">${emp.manpowerType || 'Security'}</span>
                        <select class="directory-status-select" data-id="${emp.id}" data-status="${emp.status}" style="font-size: 10px; padding: 2px 6px;">
                            <option value="Active" ${emp.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="Suspended" ${emp.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                            <option value="Fired" ${emp.status === 'Fired' ? 'selected' : ''}>Fired</option>
                            <option value="Left" ${emp.status === 'Left' ? 'selected' : ''}>Left</option>
                        </select>
                    </div>
                    <div class="directory-card-actions">
                        <button class="btn btn-xs btn-outline btn-generate-card-img" data-id="${emp.id}" style="color: var(--theme-accent); border-color: rgba(212, 175, 55, 0.15)">ID Card</button>
                        <button class="btn btn-xs btn-outline btn-edit-emp" data-id="${emp.id}">Edit</button>
                        <button class="btn btn-xs btn-outline btn-delete-emp" data-id="${emp.id}" style="color: var(--status-suspended); border-color: rgba(255, 46, 147, 0.15)">Delete</button>
                    </div>
                </div>
            `;
            cardGrid.appendChild(card);
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" class="directory-select-item" data-id="${emp.id}" ${isChecked} style="cursor: pointer;"></td>
                <td><strong>${emp.id}</strong></td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="directory-list-avatar" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--glass-border); overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--input-bg);">
                            ${photoSrc ? `<img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user" style="width: 14px; height: 14px; color: var(--text-muted);"></i>`}
                        </div>
                        <span>${emp.name}</span>
                    </div>
                </td>
                <td>${emp.designation}</td>
                <td>${emp.department || '-'}</td>
                <td>${emp.mobile}</td>
                <td><span class="text-muted" style="font-size: 11px;">${docsText}</span></td>
                <td>
                    <select class="directory-status-select" data-id="${emp.id}" data-status="${emp.status}">
                        <option value="Active" ${emp.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Suspended" ${emp.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                        <option value="Fired" ${emp.status === 'Fired' ? 'selected' : ''}>Fired</option>
                        <option value="Left" ${emp.status === 'Left' ? 'selected' : ''}>Left</option>
                    </select>
                </td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-xs btn-outline btn-generate-card-img" data-id="${emp.id}" style="color: var(--theme-accent); border-color: rgba(212, 175, 55, 0.15)">ID Card</button>
                        <button class="btn btn-xs btn-outline btn-edit-emp" data-id="${emp.id}">Edit</button>
                        <button class="btn btn-xs btn-outline btn-delete-emp" data-id="${emp.id}" style="color: var(--status-suspended); border-color: rgba(255, 46, 147, 0.15)">Delete</button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        }
    });

    // Recreate Lucide Icons for dynamic content
    lucide.createIcons();

    // Wire up directory status changes
    document.querySelectorAll('.directory-status-select').forEach(select => {
        select.addEventListener('change', async function(e) {
            e.stopPropagation(); // Stop card/row selection toggle
            const empId = this.getAttribute('data-id');
            const newStatus = this.value;
            this.setAttribute('data-status', newStatus);
            await updateEmployeeStatus(empId, newStatus);
        });
        select.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop card/row selection toggle on click
        });
    });

    // Wire up dynamic generate-card, edit, and delete buttons
    document.querySelectorAll('.btn-generate-card-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop card click selection toggle
            const empId = btn.getAttribute('data-id');
            downloadIndividualCardImage(empId);
        });
    });

    document.querySelectorAll('.btn-edit-emp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop card click selection toggle
            const empId = btn.getAttribute('data-id');
            showRegistrationForm('edit', empId);
        });
    });

    document.querySelectorAll('.btn-delete-emp').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop card click selection toggle
            const empId = btn.getAttribute('data-id');
            deleteEmployeeRecord(empId);
        });
    });

    // Wire up dynamic checkbox selections
    document.querySelectorAll('.directory-select-item').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const empId = this.getAttribute('data-id');
            const checked = this.checked;
            
            if (checked) {
                if (!VSA_STATE.selectedEmployeeIds.includes(empId)) {
                    VSA_STATE.selectedEmployeeIds.push(empId);
                }
            } else {
                VSA_STATE.selectedEmployeeIds = VSA_STATE.selectedEmployeeIds.filter(id => id !== empId);
            }
            updateBulkActionBanner();
        });
    });

    // Wire up card and row clicking for easier bulk selection
    document.querySelectorAll('.directory-card').forEach(card => {
        card.addEventListener('click', function(e) {
            // Do not toggle selection if clicking buttons or checkboxes directly
            if (e.target.closest('.btn-edit-emp') || e.target.closest('.btn-delete-emp') || e.target.closest('.directory-select-item')) {
                return;
            }
            const checkbox = this.querySelector('.directory-select-item');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });
    });

    document.querySelectorAll('#employee-directory-body tr').forEach(row => {
        row.addEventListener('click', function(e) {
            // Do not toggle selection if clicking buttons or checkboxes directly
            if (e.target.closest('.btn-edit-emp') || e.target.closest('.btn-delete-emp') || e.target.closest('.directory-select-item')) {
                return;
            }
            const checkbox = this.querySelector('.directory-select-item');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });
    });

    updateBulkActionBanner();
}

// C. Client Deployment Section
// Clients section removed


// E. Selectors Populate
function populateSelectors() {
    // 2. Report Department filter
    const repDeptSel = document.getElementById('rep-department');
    if (repDeptSel) {
        let repDeptHtml = '<option value="">All Departments</option>';
        VSA_STATE.departments.forEach(d => {
            repDeptHtml += `<option value="${d}">${d}</option>`;
        });
        repDeptSel.innerHTML = repDeptHtml;
    }

    // 4. ID Card Employee Select & Filters
    const idFilterDeptSel = document.getElementById('id-filter-department');
    if (idFilterDeptSel) {
        idFilterDeptSel.innerHTML = '<option value="">All Departments</option>';
        VSA_STATE.departments.forEach(d => {
            idFilterDeptSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    const idFilterDesigSel = document.getElementById('id-filter-designation');
    if (idFilterDesigSel) {
        idFilterDesigSel.innerHTML = '<option value="">All Roles</option>';
        VSA_STATE.designations.forEach(d => {
            idFilterDesigSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    populateIdEmployeeSelect();

    // 4B. Populate templates select
    const idTplSel = document.getElementById('id-select-template');
    const bulkTplSel = document.getElementById('bulk-select-template');
    let tplHtml = '';
    VSA_STATE.templates.forEach(t => {
        tplHtml += `<option value="${t.id}">${t.name} (${t.layout === 'vertical' ? 'Vertical' : 'Horizontal'})</option>`;
    });
    if (idTplSel) idTplSel.innerHTML = tplHtml;
    if (bulkTplSel) bulkTplSel.innerHTML = tplHtml;

    // 5. Employee Record Filters and Select (Letterhead Form)
    const recFilterDeptSel = document.getElementById('rec-filter-department');
    if (recFilterDeptSel) {
        recFilterDeptSel.innerHTML = '<option value="">All Departments</option>';
        VSA_STATE.departments.forEach(d => {
            recFilterDeptSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    const recFilterDesigSel = document.getElementById('rec-filter-designation');
    if (recFilterDesigSel) {
        recFilterDesigSel.innerHTML = '<option value="">All Designations</option>';
        VSA_STATE.designations.forEach(d => {
            recFilterDesigSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    populateRecEmployeeSelect();

    // 6. Dynamic Classifications Dropdowns (Departments, Designations, Manpower Types)
    const regDeptSel = document.getElementById('reg-department');
    if (regDeptSel) {
        regDeptSel.innerHTML = '<option value="">Select Department</option>';
        VSA_STATE.departments.forEach(d => {
            regDeptSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    const regDesigSel = document.getElementById('reg-designation');
    if (regDesigSel) {
        regDesigSel.innerHTML = '<option value="">Select Designation</option>';
        VSA_STATE.designations.forEach(d => {
            regDesigSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    const regTypeSel = document.getElementById('reg-manpower-type');
    if (regTypeSel) {
        regTypeSel.innerHTML = '<option value="">Select Type</option>';
        VSA_STATE.manpowerTypes.forEach(t => {
            regTypeSel.innerHTML += `<option value="${t}">${t}</option>`;
        });
    }

    const formDesigSel = document.getElementById('form-designation');
    if (formDesigSel) {
        formDesigSel.innerHTML = '<option value="">Choose Designation</option>';
        VSA_STATE.designations.forEach(d => {
            formDesigSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    const empFilterDesigSel = document.getElementById('emp-filter-designation');
    if (empFilterDesigSel) {
        empFilterDesigSel.innerHTML = '<option value="">Select Role</option>';
        VSA_STATE.designations.forEach(d => {
            empFilterDesigSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }
}

VSA_STATE.idSelectedEmployeeIds = [];

function populateIdEmployeeSelect(filterQuery = '') {
    const idEmpSel = document.getElementById('id-select-employee');
    if (!idEmpSel) return;
    
    const prevSelectedValue = idEmpSel.value;
    idEmpSel.innerHTML = '<option value="">-- Select Guard --</option>';
    
    const query = filterQuery.toLowerCase().trim();
    VSA_STATE.employees.forEach(e => {
        const matches = !query || 
                        e.name.toLowerCase().includes(query) || 
                        e.id.toLowerCase().includes(query) ||
                        (e.clientLocation && e.clientLocation.toLowerCase().includes(query)) ||
                        (e.designation && e.designation.toLowerCase().includes(query));
        if (matches) {
            idEmpSel.innerHTML += `<option value="${e.id}">${e.name} (${e.id})</option>`;
        }
    });
    
    if (prevSelectedValue && Array.from(idEmpSel.options).some(o => o.value === prevSelectedValue)) {
        idEmpSel.value = prevSelectedValue;
    }

    populateIdEmployeeChecklist();
}

function populateIdEmployeeChecklist() {
    const listContainer = document.getElementById('id-employees-list-box');
    if (!listContainer) return;

    const searchVal = (document.getElementById('id-search-employee')?.value || '').toLowerCase().trim();
    const deptVal = document.getElementById('id-filter-department')?.value || '';
    const designationVal = document.getElementById('id-filter-designation')?.value || '';

    const filtered = VSA_STATE.employees.filter(emp => {
        const matchesSearch = !searchVal || 
                              emp.name.toLowerCase().includes(searchVal) || 
                              emp.id.toLowerCase().includes(searchVal);
        const matchesDept = !deptVal || emp.department === deptVal;
        const matchesDesignation = !designationVal || emp.designation === designationVal;

        return matchesSearch && matchesDept && matchesDesignation;
    });

    let listHtml = '';
    const allFilteredSelected = filtered.length > 0 && filtered.every(e => VSA_STATE.idSelectedEmployeeIds.includes(e.id));
    
    listHtml += `
        <div class="id-checklist-header">
            <label style="margin: 0; display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="id-select-all-filtered" ${allFilteredSelected ? 'checked' : ''} style="margin: 0;">
                <span>Select All (${filtered.length} matched)</span>
            </label>
        </div>
    `;

    if (filtered.length === 0) {
        listHtml += `<div style="padding: 15px; font-style: italic; color: var(--text-secondary); font-size: 11px; text-align: center;">No matching guards found</div>`;
    } else {
        const activePreviewId = document.getElementById('id-select-employee').value;
        
        filtered.forEach(emp => {
            const isChecked = VSA_STATE.idSelectedEmployeeIds.includes(emp.id) ? 'checked' : '';
            const isActive = emp.id === activePreviewId ? 'active-preview' : '';
            const photoSrc = (emp.documents && emp.documents.photo) ? emp.documents.photo : '';
            const avatarHtml = photoSrc ? `<img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user" style="width: 12px; height: 12px; color: var(--text-muted);"></i>`;

            listHtml += `
                <div class="id-checklist-item ${isActive}" data-id="${emp.id}">
                    <input type="checkbox" class="id-checklist-item-checkbox" data-id="${emp.id}" ${isChecked} style="margin: 0;">
                    <div class="id-checklist-item-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="id-checklist-item-info">
                        <span class="id-checklist-item-name">${emp.name}</span>
                        <span class="id-checklist-item-sub">${emp.id} | ${emp.designation} | ${emp.department || '-'}</span>
                    </div>
                </div>
            `;
        });
    }

    listContainer.innerHTML = listHtml;
    lucide.createIcons();

    // Wire up checkbox clicks
    listContainer.querySelectorAll('.id-checklist-item-checkbox').forEach(box => {
        box.addEventListener('click', (e) => {
            e.stopPropagation();
            const empId = box.getAttribute('data-id');
            const checked = box.checked;
            
            if (checked) {
                if (!VSA_STATE.idSelectedEmployeeIds.includes(empId)) {
                    VSA_STATE.idSelectedEmployeeIds.push(empId);
                }
            } else {
                VSA_STATE.idSelectedEmployeeIds = VSA_STATE.idSelectedEmployeeIds.filter(id => id !== empId);
            }
            
            const selectAllCheck = document.getElementById('id-select-all-filtered');
            if (selectAllCheck) {
                const cbList = listContainer.querySelectorAll('.id-checklist-item-checkbox');
                selectAllCheck.checked = Array.from(cbList).every(cb => cb.checked);
            }
        });
    });

    // Wire up row clicks
    listContainer.querySelectorAll('.id-checklist-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.classList.contains('id-checklist-item-checkbox')) return;
            const empId = item.getAttribute('data-id');
            document.getElementById('id-select-employee').value = empId;
            loadIdCardDetails(empId);
            populateIdEmployeeChecklist();
        });
    });

    // Wire up Select All checkbox click
    const selectAllCheck = document.getElementById('id-select-all-filtered');
    if (selectAllCheck) {
        selectAllCheck.addEventListener('change', function() {
            const checked = this.checked;
            filtered.forEach(emp => {
                if (checked) {
                    if (!VSA_STATE.idSelectedEmployeeIds.includes(emp.id)) {
                        VSA_STATE.idSelectedEmployeeIds.push(emp.id);
                    }
                } else {
                    VSA_STATE.idSelectedEmployeeIds = VSA_STATE.idSelectedEmployeeIds.filter(id => id !== emp.id);
                }
            });
            populateIdEmployeeChecklist();
        });
    }
}

async function triggerIdBulkPrint() {
    if (VSA_STATE.idSelectedEmployeeIds.length === 0) {
        alert('Please select at least one employee from the checklist.');
        return;
    }

    const templateId = document.getElementById('id-select-template').value;
    const template = VSA_STATE.templates.find(t => t.id === templateId) || VSA_STATE.templates[0];
    const validity = document.getElementById('id-validity-years').value;

    const printContainer = document.getElementById('printable-id-bulk');
    if (!printContainer) return;

    printContainer.innerHTML = '';
    printContainer.classList.remove('hidden');

    let bulkHtml = '';
    const cardsPerPage = template.layout === 'vertical' ? 9 : 8;

    for (let i = 0; i < VSA_STATE.idSelectedEmployeeIds.length; i += cardsPerPage) {
        const pageItems = VSA_STATE.idSelectedEmployeeIds.slice(i, i + cardsPerPage);
        let pageHtml = `<div class="a4-print-page print-layout-${template.layout}">`;
        pageItems.forEach(empId => {
            const emp = VSA_STATE.employees.find(e => e.id === empId);
            if (emp) {
                pageHtml += generateIdCardHtml(emp, template, emp.cardValidity || validity);
            }
        });
        pageHtml += `</div>`;
        bulkHtml += pageHtml;
    }

    printContainer.innerHTML = bulkHtml;
    renderQrsInContainer(printContainer);

    setTimeout(() => {
        window.print();
        printContainer.classList.add('hidden');
        printContainer.innerHTML = '';
    }, 500);
}

async function triggerIdBulkDownload() {
    if (VSA_STATE.idSelectedEmployeeIds.length === 0) {
        alert('Please select at least one employee from the checklist.');
        return;
    }

    const templateId = document.getElementById('id-select-template').value;
    const template = VSA_STATE.templates.find(t => t.id === templateId) || VSA_STATE.templates[0];
    const validity = document.getElementById('id-validity-years').value;

    const bulkContainer = document.getElementById('printable-id-bulk');
    if (!bulkContainer) return;

    const downloadBtn = document.getElementById('btn-id-bulk-download');
    const originalBtnText = downloadBtn.innerHTML;
    downloadBtn.disabled = true;
    downloadBtn.innerHTML = '<i data-lucide="loader" class="animate-spin" style="display:inline-block; vertical-align:middle; width:16px;"></i> Generating Photos...';
    lucide.createIcons();

    bulkContainer.classList.remove('hidden');
    bulkContainer.style.position = 'absolute';
    bulkContainer.style.left = '-9999px';
    bulkContainer.style.top = '0';
    bulkContainer.style.display = 'block';

    const zip = new JSZip();
    let renderCount = 0;

    for (let i = 0; i < VSA_STATE.idSelectedEmployeeIds.length; i++) {
        const empId = VSA_STATE.idSelectedEmployeeIds[i];
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (!emp) continue;

        bulkContainer.innerHTML = generateIdCardHtml(emp, template, emp.cardValidity || validity);
        renderQrsInContainer(bulkContainer);

        await new Promise(resolve => setTimeout(resolve, 300));

        const cardElement = bulkContainer.querySelector('.id-card-portrait') || bulkContainer.querySelector('.id-card-horizontal');
        if (cardElement) {
            try {
                const canvas = await html2canvas(cardElement, {
                    scale: 4,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });
                
                const base64Data = canvas.toDataURL('image/png').split(',')[1];
                const filename = `VSA_ID_${emp.id}_${emp.name.replace(/\s+/g, '_')}.png`;
                zip.file(filename, base64Data, {base64: true});
                renderCount++;
            } catch (err) {
                console.error(`Failed to generate image for ${emp.id}`, err);
            }
        }
    }

    if (renderCount > 0) {
        try {
            const content = await zip.generateAsync({type: 'blob'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `VSA_ID_Cards_Batch.zip`;
            link.click();
        } catch (err) {
            console.error("Failed to generate ZIP file:", err);
            alert("Failed to package batch files.");
        }
    }

    bulkContainer.innerHTML = '';
    bulkContainer.classList.add('hidden');
    bulkContainer.style.display = 'none';
    downloadBtn.disabled = false;
    downloadBtn.innerHTML = originalBtnText;
    lucide.createIcons();
}

/* ==========================================================================
   4. DATA TRANSACTIONS & CORE CRUD
   ========================================================================== */

// Add / Edit Employee Model Handler
function openEmployeeModal(empId = null) {
    const modal = document.getElementById('employee-modal');
    const form = document.getElementById('employee-form');
    const title = document.getElementById('employee-modal-title');
    
    form.reset();
    document.getElementById('form-photo-preview-box').innerHTML = '<span class="preview-placeholder">No image selected (Required for ID card)</span>';
    document.getElementById('form-sig-preview-box').innerHTML = '<span class="preview-placeholder">No signature selected (Required for ID card)</span>';
    
    if (empId) {
        // EDIT MODE
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (!emp) return;

        title.textContent = `Edit Details: ${emp.name} (${emp.id})`;
        document.getElementById('form-emp-id').value = emp.id;
        document.getElementById('form-name').value = emp.name;
        document.getElementById('form-father').value = emp.fatherName;
        document.getElementById('form-dob').value = emp.dob;
        document.getElementById('form-gender').value = emp.gender;
        document.getElementById('form-blood').value = emp.bloodGroup;
        document.getElementById('form-marital').value = emp.maritalStatus;
        document.getElementById('form-mobile').value = emp.mobile;
        document.getElementById('form-alt-mobile').value = emp.altMobile || '';
        document.getElementById('form-email').value = emp.email || '';
        document.getElementById('form-perm-address').value = emp.permanentAddress;
        document.getElementById('form-curr-address').value = emp.currentAddress;
        document.getElementById('form-district').value = emp.district;
        document.getElementById('form-state').value = emp.state;
        document.getElementById('form-pin').value = emp.pinCode;
        document.getElementById('form-designation').value = emp.designation;
        document.getElementById('form-manager').value = emp.reportingManager;
        document.getElementById('form-joining-date').value = emp.joiningDate;
        document.getElementById('form-status').value = emp.status;
        document.getElementById('form-category').value = emp.category;
        document.getElementById('form-emergency-name').value = emp.emergencyContactName;
        document.getElementById('form-emergency-relation').value = emp.emergencyContactRelation;
        document.getElementById('form-emergency-mobile').value = emp.emergencyContactMobile;

        document.getElementById('form-aadhaar-check').value = emp.documents?.aadhaar || 'Pending';
        document.getElementById('form-pan-check').value = emp.documents?.pan || 'Pending';
        document.getElementById('form-police-check').value = emp.documents?.policeVerification || 'Pending';

        if (emp.documents?.photo) {
            document.getElementById('form-photo-preview-box').innerHTML = `<img src="${emp.documents.photo}">`;
        }
        if (emp.documents?.signature) {
            document.getElementById('form-sig-preview-box').innerHTML = `<img src="${emp.documents.signature}">`;
        }
    } else {
        // ADD MODE
        title.textContent = "Register New Security Personnel";
        document.getElementById('form-emp-id').value = '';
        document.getElementById('form-joining-date').value = new Date().toISOString().substring(0, 10);
    }
    
    modal.classList.remove('hidden');
}

// Convert files to base64 utility helper
function handleImageCompression(fileInput, previewBoxId, callback) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        document.getElementById(previewBoxId).innerHTML = `<img src="${base64}">`;
        callback(base64);
    };
    reader.readAsDataURL(file);
}

// Save Employee Form submit
async function saveEmployee(event) {
    event.preventDefault();
    
    const empId = document.getElementById('form-emp-id').value;
    
    // Extrapolate photos from preview boxes to handle updates
    const photoImg = document.querySelector('#form-photo-preview-box img');
    const sigImg = document.querySelector('#form-sig-preview-box img');

    const empData = {
        name: document.getElementById('form-name').value,
        fatherName: document.getElementById('form-father').value,
        dob: document.getElementById('form-dob').value,
        gender: document.getElementById('form-gender').value,
        bloodGroup: document.getElementById('form-blood').value,
        maritalStatus: document.getElementById('form-marital').value,
        mobile: document.getElementById('form-mobile').value,
        altMobile: document.getElementById('form-alt-mobile').value,
        email: document.getElementById('form-email').value,
        permanentAddress: document.getElementById('form-perm-address').value,
        currentAddress: document.getElementById('form-curr-address').value,
        district: document.getElementById('form-district').value,
        state: document.getElementById('form-state').value,
        pinCode: document.getElementById('form-pin').value,
        designation: document.getElementById('form-designation').value,
        reportingManager: document.getElementById('form-manager').value,
        joiningDate: document.getElementById('form-joining-date').value,
        status: document.getElementById('form-status').value,
        category: document.getElementById('form-category').value,
        emergencyContactName: document.getElementById('form-emergency-name').value,
        emergencyContactRelation: document.getElementById('form-emergency-relation').value,
        emergencyContactMobile: document.getElementById('form-emergency-mobile').value,
        documents: {
            photo: photoImg ? photoImg.src : '',
            signature: sigImg ? sigImg.src : '',
            aadhaar: document.getElementById('form-aadhaar-check').value,
            pan: document.getElementById('form-pan-check').value,
            policeVerification: document.getElementById('form-police-check').value
        },
        assets: empId ? (VSA_STATE.employees.find(e => e.id === empId)?.assets || []) : []
    };

    try {
        let response;
        if (empId) {
            // Update
            response = await fetch(`/api/employees/${empId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(empData)
            });
        } else {
            // Create
            response = await fetch('/api/employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(empData)
            });
        }

        if (!response.ok) throw new Error('Saving guard record failed');
        
        document.getElementById('employee-modal').classList.add('hidden');
        fetchData(); // Reload UI state
    } catch (err) {
        alert(err.message);
    }
}

async function deleteEmployeeRecord(empId) {
    if (!confirm(`Are you sure you want to delete guard record ${empId}?`)) return;

    try {
        const response = await fetch(`/api/employees/${empId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Deletion failed');
        fetchData();
    } catch (err) {
        alert(err.message);
    }
}

// Client addition
// submitClientSite removed

// Reassignment Deployments
async function reassignGuard(empId, siteName) {
    const emp = VSA_STATE.employees.find(e => e.id === empId);
    if (!emp) return;

    emp.clientLocation = siteName;
    try {
        const response = await fetch(`/api/employees/${empId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emp)
        });
        if (!response.ok) throw new Error('Deployment assignment sync failed.');
        fetchData();
    } catch (err) {
        alert(err.message);
    }
}

/* ==========================================================================
   5. LUXURY ID CARD GENERATION SYSTEM
   ========================================================================== */
function generateIdCardHtml(emp, template, validityYears = 3) {
    if (!emp) return '';

    // Helper to format date
    const formatDateDDMMYYYYLocal = (date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    const issueDate = new Date(emp.joiningDate || new Date());
    const expDate = new Date(issueDate);
    expDate.setFullYear(issueDate.getFullYear() + validityYears);
    const validityStr = `${formatDateDDMMYYYYLocal(issueDate)} - ${formatDateDDMMYYYYLocal(expDate)}`;

    const getFallbackAvatarData = (initial) => {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='120' viewBox='0 0 100 120'><defs><linearGradient id='avatarGrad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23d4af37'/><stop offset='100%' stop-color='%230f1218'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23avatarGrad)'/><text x='50%' y='55%' font-family='sans-serif' font-weight='bold' font-size='32' fill='%23ffffff' text-anchor='middle'>${initial}</text></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getPresetShield = (color = '#dfba5f') => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getPresetStar = (color = '#dfba5f') => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getPresetEagle = (color = '#dfba5f') => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getPresetSig1 = (color = '#000000') => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40"><path d="M10,25 C30,10 50,35 70,15 C90,-5 110,30 130,20" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getPresetSig2 = (color = '#000000') => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40"><path d="M15,20 Q40,5 65,25 T115,15" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    // Use default template properties if none provided
    if (!template) {
        template = {
            layout: 'vertical',
            font: "'Outfit', sans-serif",
            backgroundColor: '#ffffff',
            headerBgColor: '#0e3e2b',
            accentColor: '#dfba5f',
            headerText: 'VALLEY SECURITY AGENCY',
            subheaderText: 'SHAHIDGUNJ SRINAGAR KASHMIR',
            backgroundImage: '',
            logo: 'preset-shield',
            signature: 'preset-sig1',
            logoSize: 50,
            headerHeight: 90,
            headerFontSize: 14,
            fields: {
                photo: true, name: true, designation: true, department: true, empid: true,
                father: true, phone: true, blood: true, address: true, signature: true,
                qrcode: true, barcode: true
            }
        };
    }

    const fields = template.fields || {};
    const logoSize = template.logoSize || 50;
    const headerHeight = template.headerHeight || 90;
    const headerFontSize = template.headerFontSize || 14;

    // Normalize fields to support both DB format and Form format
    const showPhoto = fields.photo !== false;
    const showName = fields.name !== false;
    const showDesignation = fields.designation !== false;
    const showDepartment = fields.department !== false;
    const showEmpId = (fields.empid !== false) && (fields.employeeId !== false);
    const showFather = (fields.father !== false) && (fields.fatherName !== false);
    const showPhone = fields.phone !== false;
    const showBlood = (fields.blood !== false) && (fields.bloodGroup !== false);
    const showAddress = fields.address !== false;
    const showQrCode = fields.qrcode !== false;
    const showBarcode = fields.barcode !== false;

    // Resolve Logo
    let logoSrc = '';
    if (template.logo) {
        if (template.logo === 'preset-shield') {
            logoSrc = getPresetShield(template.accentColor || '#dfba5f');
        } else if (template.logo === 'preset-star') {
            logoSrc = getPresetStar(template.accentColor || '#dfba5f');
        } else if (template.logo === 'preset-eagle') {
            logoSrc = getPresetEagle(template.accentColor || '#dfba5f');
        } else {
            logoSrc = template.logo;
        }
    } else {
        logoSrc = getPresetShield(template.accentColor || '#dfba5f');
    }

    // Resolve Signature (permanent scan)
    let sigSrc = '';
    if (template.signature) {
        if (template.signature === 'preset-sig1') {
            sigSrc = getPresetSig1('#000000');
        } else if (template.signature === 'preset-sig2') {
            sigSrc = getPresetSig2('#000000');
        } else {
            sigSrc = template.signature;
        }
    } else {
        sigSrc = getPresetSig1('#000000');
    }

    // Resolve Background styling
    let bgStyle = '';
    let isBgDark = false;
    if (template.backgroundImage === 'default-bg') {
        bgStyle = `background: linear-gradient(145deg, #0b0f19 0%, #161f30 100%); color: #ffffff;`;
        isBgDark = true;
    } else if (template.backgroundImage === 'vip-bg') {
        bgStyle = `background: linear-gradient(145deg, #0f1218 0%, #1c150c 100%); color: #ffffff;`;
        isBgDark = true;
    } else if (template.backgroundColor) {
        bgStyle = `background-color: ${template.backgroundColor}; color: #000000;`;
        const hex = template.backgroundColor.replace('#', '');
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            isBgDark = (r * 0.299 + g * 0.587 + b * 0.114) <= 150;
        }
    } else {
        bgStyle = `background-color: #ffffff; color: #000000;`;
    }

    const textColor = isBgDark ? '#ffffff' : '#111111';
    const subtextColor = isBgDark ? 'rgba(255, 255, 255, 0.7)' : '#555555';

    // Header light/dark detection
    const isColorLight = (hexColor) => {
        if (!hexColor) return false;
        const hex = hexColor.replace('#', '');
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
        }
        return false;
    };
    const isLightHeader = isColorLight(template.headerBgColor || '#0e3e2b');
    const headerTextColor = isLightHeader ? '#111111' : '#ffffff';
    const headerSubtextColor = isLightHeader ? '#555555' : 'rgba(255, 255, 255, 0.8)';

    // Photo Src
    let photoSrc = '';
    if (emp.documents && emp.documents.photo) {
        photoSrc = emp.documents.photo;
    } else {
        const initial = emp.name ? emp.name[0].toUpperCase() : '?';
        photoSrc = getFallbackAvatarData(initial);
    }

    const verificationUrl = `${window.location.protocol}//${window.location.host}/verification.html?id=${emp.id}`;

    if (template.layout === 'horizontal') {
        return `
        <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
            <!-- SINGLE-SIDED HORIZONTAL ID CARD -->
            <div class="id-card-horizontal visual-id-card-render" style="font-family: ${template.font || "'Outfit', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#dfba5f'}; display: flex; flex-direction: column; justify-content: flex-start; height: 320px; width: 500px; box-sizing: border-box; overflow: hidden; position: relative;">
                <!-- Header -->
                <div class="id-portrait-header" style="background: ${template.headerBgColor || '#0e3e2b'}; border-bottom: 2px solid ${template.accentColor || '#dfba5f'}; color: ${headerTextColor}; height: ${headerHeight}px; display: flex; align-items: center; gap: 12px; padding: 0 12px; margin: -15px -15px 8px -15px; border-radius: 10px 10px 0 0; box-sizing: border-box; overflow: hidden; flex-shrink: 0;">
                    <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        <img src="${logoSrc}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </div>
                    <div class="id-portrait-brand" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                        <h1 class="id-portrait-title" style="color: ${headerTextColor}; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.2; font-family: ${template.font || "'Outfit', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                        <p class="id-portrait-subtitle" style="color: ${headerSubtextColor}; font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 2px 0 0 0; text-transform: uppercase; line-height: 1.2; font-family: ${template.font || "'Outfit', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.9;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                    </div>
                </div>

                <!-- Body Content Split -->
                <div style="display: flex; gap: 15px; flex-grow: 1; min-height: 0; align-items: stretch; margin-top: 8px;">
                    
                    <!-- Column 1: Photo and Signature -->
                    <div style="width: 100px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        <!-- Photo -->
                        ${showPhoto ? `
                        <div class="id-portrait-photo-box" style="border: 2px solid ${template.accentColor || '#dfba5f'}; width: 90px; height: 110px; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.15); flex-shrink: 0; background: #eaeaea; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                            <img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        ` : ''}
                        
                        <!-- Signature (always visible) -->
                        <div style="width: 100px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: auto;">
                            <div style="height: 30px; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                <img src="${sigSrc}" style="max-height: 100%; max-width: 100%; object-fit: contain; mix-blend-mode: multiply; filter: contrast(1.4) brightness(1.1);">
                            </div>
                            <span style="font-size: 6px; color: ${subtextColor}; text-transform: uppercase; font-weight: bold; margin-top: 2px; text-align: center; white-space: nowrap; width: 100%;">Authority Sig</span>
                        </div>
                    </div>
                    
                    <!-- Column 2: Name, Designation, and Details Table -->
                    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; border-right: 1px solid rgba(128,128,128,0.15); padding-right: 10px;">
                        <!-- Name & Designation -->
                        <div style="margin-bottom: 4px; border-bottom: 1px solid rgba(128,128,128,0.15); padding-bottom: 2px;">
                            ${showName ? `
                            <h2 style="color: ${textColor}; font-size: 13px; font-weight: 800; text-transform: uppercase; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">
                                ${emp.name}
                            </h2>
                            ` : ''}
                            ${showDesignation ? `
                            <h3 style="color: ${template.accentColor || '#dfba5f'}; font-size: 9px; font-weight: 700; text-transform: uppercase; margin: 1px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${emp.designation}
                            </h3>
                            ` : ''}
                        </div>
                        
                        <!-- Details Table -->
                        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: auto;">
                            ${showEmpId ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 7.5px; font-weight: 600; color: ${subtextColor}; padding: 2px 0; width: 45%; text-transform: uppercase;">Staff ID:</td>
                                <td style="font-size: 7.5px; font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.id}</td>
                            </tr>
                            ` : ''}
                            ${showFather ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 7.5px; font-weight: 600; color: ${subtextColor}; padding: 2px 0; width: 45%; text-transform: uppercase;">Father:</td>
                                <td style="font-size: 7.5px; font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.fatherName || '-'}</td>
                            </tr>
                            ` : ''}
                            ${showDepartment ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 7.5px; font-weight: 600; color: ${subtextColor}; padding: 2px 0; width: 45%; text-transform: uppercase;">Dept:</td>
                                <td style="font-size: 7.5px; font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.department || '-'}</td>
                            </tr>
                            ` : ''}
                            ${showPhone ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 7.5px; font-weight: 600; color: ${subtextColor}; padding: 2px 0; width: 45%; text-transform: uppercase;">Mobile:</td>
                                <td style="font-size: 7.5px; font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.mobile || '-'}</td>
                            </tr>
                            ` : ''}
                            ${showBlood ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 7.5px; font-weight: 600; color: ${subtextColor}; padding: 2px 0; width: 45%; text-transform: uppercase;">Blood:</td>
                                <td style="font-size: 7.5px; font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.bloodGroup || '-'}</td>
                            </tr>
                            ` : ''}
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 7.5px; font-weight: 600; color: ${subtextColor}; padding: 2px 0; width: 45%; text-transform: uppercase;">Validity:</td>
                                <td style="font-size: 7.5px; font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${validityStr}</td>
                            </tr>
                            ${showAddress ? `
                            <tr>
                                <td style="font-size: 7.5px; font-weight: 600; color: ${subtextColor}; padding: 2px 0; width: 45%; text-transform: uppercase;">Address:</td>
                                <td style="font-size: 7.5px; font-weight: 700; color: ${textColor}; padding: 2px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${emp.currentAddress || emp.permanentAddress || '-'}">${emp.currentAddress || emp.permanentAddress || '-'}</td>
                            </tr>
                            ` : ''}
                        </table>
                    </div>
                    
                    <!-- Column 3: QR Code, Barcode, and terms -->
                    <div style="width: 85px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        <!-- QR Code -->
                        ${showQrCode ? `
                        <div style="width: 70px; height: 70px; background: #ffffff; padding: 3px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-bottom: 5px;">
                            <canvas class="qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="64" style="width: 64px; height: 64px; display: block;"></canvas>
                        </div>
                        ` : ''}
                        
                        <!-- Instructions -->
                        <div style="font-size: 4.8px; color: ${subtextColor}; line-height: 1.2; text-align: center; width: 100%; padding: 3px; border-radius: 3px; background: rgba(128,128,128,0.06); border: 1px solid rgba(128,128,128,0.1); margin-bottom: 5px;">
                            VSA property.<br>Return: Shaheed Gunj Srinagar.
                        </div>
                        
                        <!-- Barcode -->
                        ${showBarcode ? `
                        <div style="width: 100%; display: flex; justify-content: center; align-items: center; height: 20px; flex-shrink: 0; margin-top: auto;">
                            <canvas class="barcode-canvas-rendered" data-barcode-val="${emp.id}" data-barcode-type="CODE128" style="width: 85px; height: 18px;"></canvas>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
        `;
    } else {
        // VERTICAL LAYOUT
        return `
        <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
            <!-- SINGLE-SIDED VERTICAL ID CARD -->
            <div class="id-card-portrait visual-id-card-render" style="font-family: ${template.font || "'Outfit', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#dfba5f'}; display: flex; flex-direction: column; justify-content: flex-start; height: 500px; width: 320px; box-sizing: border-box; overflow: hidden; position: relative;">
                <!-- Header -->
                <div class="id-portrait-header" style="background: ${template.headerBgColor || '#0e3e2b'}; border-bottom: 2px solid ${template.accentColor || '#dfba5f'}; color: ${headerTextColor}; height: ${headerHeight}px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 10px; margin: -15px -15px 10px -15px; border-radius: 10px 10px 0 0; box-sizing: border-box; overflow: hidden; flex-shrink: 0;">
                    <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        <img src="${logoSrc}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </div>
                    <div class="id-portrait-brand" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                        <h1 class="id-portrait-title" style="color: ${headerTextColor}; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.2; font-family: ${template.font || "'Outfit', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                        <p class="id-portrait-subtitle" style="color: ${headerSubtextColor}; font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 2px 0 0 0; text-transform: uppercase; line-height: 1.2; font-family: ${template.font || "'Outfit', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.9;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                    </div>
                </div>

                <!-- Body Content Split -->
                <div style="display: flex; gap: 10px; flex-grow: 1; min-height: 0; align-items: stretch; margin-top: 5px;">
                    
                    <!-- Left column: Photo, QR Code, Signature -->
                    <div style="width: 100px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        <!-- Photo -->
                        ${showPhoto ? `
                        <div class="id-portrait-photo-box" style="border: 2px solid ${template.accentColor || '#dfba5f'}; width: 85px; height: 105px; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.15); flex-shrink: 0; background: #eaeaea; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                            <img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        ` : ''}
                        
                        <!-- QR Code -->
                        ${showQrCode ? `
                        <div style="width: 70px; height: 70px; background: #ffffff; padding: 3px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 5px; flex-shrink: 0;">
                            <canvas class="qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="64" style="width: 64px; height: 64px; display: block;"></canvas>
                        </div>
                        ` : ''}
                        
                        <!-- Signature (always visible) -->
                        <div style="width: 85px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: auto;">
                            <div style="height: 30px; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                <img src="${sigSrc}" style="max-height: 100%; max-width: 100%; object-fit: contain; mix-blend-mode: multiply; filter: contrast(1.4) brightness(1.1);">
                            </div>
                            <span style="font-size: 6px; color: ${subtextColor}; text-transform: uppercase; font-weight: bold; margin-top: 2px; text-align: center; white-space: nowrap; width: 100%;">Authority Sig</span>
                        </div>
                    </div>
                    
                    <!-- Right column: Name, Designation, Details Table -->
                    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; padding-left: 5px;">
                        <!-- Name & Designation -->
                        <div style="margin-bottom: 6px; border-bottom: 1px solid rgba(128,128,128,0.15); padding-bottom: 4px;">
                            ${showName ? `
                            <h2 style="color: ${textColor}; font-size: 14px; font-weight: 800; text-transform: uppercase; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;">
                                ${emp.name}
                            </h2>
                            ` : ''}
                            ${showDesignation ? `
                            <h3 style="color: ${template.accentColor || '#dfba5f'}; font-size: 10px; font-weight: 700; text-transform: uppercase; margin: 2px 0 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                                ${emp.designation}
                            </h3>
                            ` : ''}
                        </div>
                        
                        <!-- Details Table -->
                        <table style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 5px;">
                            ${showEmpId ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 8px; font-weight: 600; color: ${subtextColor}; padding: 3px 0; width: 45%; text-transform: uppercase;">Staff ID:</td>
                                <td style="font-size: 8px; font-weight: 700; color: ${textColor}; padding: 3px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.id}</td>
                            </tr>
                            ` : ''}
                            ${showFather ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 8px; font-weight: 600; color: ${subtextColor}; padding: 3px 0; width: 45%; text-transform: uppercase;">Father:</td>
                                <td style="font-size: 8px; font-weight: 700; color: ${textColor}; padding: 3px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.fatherName || '-'}</td>
                            </tr>
                            ` : ''}
                            ${showDepartment ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 8px; font-weight: 600; color: ${subtextColor}; padding: 3px 0; width: 45%; text-transform: uppercase;">Dept:</td>
                                <td style="font-size: 8px; font-weight: 700; color: ${textColor}; padding: 3px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.department || '-'}</td>
                            </tr>
                            ` : ''}
                            ${showPhone ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 8px; font-weight: 600; color: ${subtextColor}; padding: 3px 0; width: 45%; text-transform: uppercase;">Mobile:</td>
                                <td style="font-size: 8px; font-weight: 700; color: ${textColor}; padding: 3px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.mobile || '-'}</td>
                            </tr>
                            ` : ''}
                            ${showBlood ? `
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 8px; font-weight: 600; color: ${subtextColor}; padding: 3px 0; width: 45%; text-transform: uppercase;">Blood:</td>
                                <td style="font-size: 8px; font-weight: 700; color: ${textColor}; padding: 3px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.bloodGroup || '-'}</td>
                            </tr>
                            ` : ''}
                            <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                                <td style="font-size: 8px; font-weight: 600; color: ${subtextColor}; padding: 3px 0; width: 45%; text-transform: uppercase;">Validity:</td>
                                <td style="font-size: 8px; font-weight: 700; color: ${textColor}; padding: 3px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${validityStr}</td>
                            </tr>
                            ${showAddress ? `
                            <tr>
                                <td style="font-size: 8px; font-weight: 600; color: ${subtextColor}; padding: 3px 0; width: 45%; text-transform: uppercase;">Address:</td>
                                <td style="font-size: 8px; font-weight: 700; color: ${textColor}; padding: 3px 0; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${emp.currentAddress || emp.permanentAddress || '-'}">${emp.currentAddress || emp.permanentAddress || '-'}</td>
                            </tr>
                            ` : ''}
                        </table>
                        
                        <!-- Instructions/Footer -->
                        <div style="font-size: 5.5px; color: ${subtextColor}; line-height: 1.2; margin-top: auto; padding: 4px; border-radius: 4px; background: rgba(128,128,128,0.06); border: 1px solid rgba(128,128,128,0.1); word-break: break-word;">
                            1. Card is VSA property, display on duty.<br>2. Return to Shaheed Gunj Srinagar 190001.
                        </div>
                    </div>
                </div>
                
                <!-- Barcode at the bottom -->
                ${showBarcode ? `
                <div style="width: 100%; display: flex; justify-content: center; align-items: center; height: 26px; border-top: 1px solid rgba(128,128,128,0.15); padding-top: 4px; margin-top: 5px; flex-shrink: 0; box-sizing: border-box;">
                    <canvas class="barcode-canvas-rendered" data-barcode-val="${emp.id}" data-barcode-type="CODE128" style="width: 130px; height: 20px;"></canvas>
                </div>
                ` : ''}
            </div>
        </div>
        `;
    }
}

function renderQrsInContainer(container) {
    // Render QRs
    const canvases = container.querySelectorAll('.qr-canvas-rendered');
    canvases.forEach(canvas => {
        const val = canvas.getAttribute('data-qr-val');
        const size = parseInt(canvas.getAttribute('data-qr-size')) || 100;
        const bg = canvas.getAttribute('data-qr-bg') || '#ffffff';
        const fg = canvas.getAttribute('data-qr-fg') || '#000000';
        new QRious({
            element: canvas,
            value: val,
            size: size,
            background: bg,
            foreground: fg,
            level: 'H'
        });
        canvas.classList.remove('qr-canvas-rendered');
    });

    // Render Barcodes
    const barcodes = container.querySelectorAll('.barcode-canvas-rendered');
    barcodes.forEach(canvas => {
        const val = canvas.getAttribute('data-barcode-val');
        const format = canvas.getAttribute('data-barcode-type') || 'CODE128';
        const bg = canvas.getAttribute('data-barcode-bg') || '#ffffff';
        const fg = canvas.getAttribute('data-barcode-fg') || '#000000';
        try {
            if (typeof JsBarcode !== 'undefined') {
                JsBarcode(canvas, val, {
                    format: format,
                    background: bg,
                    lineColor: fg,
                    displayValue: false,
                    margin: 0
                });
            }
        } catch (e) {
            console.error("JsBarcode render error:", e);
        }
        canvas.classList.remove('barcode-canvas-rendered');
    });
}

async function updateEmployeeValidity(empId, validity) {
    const emp = VSA_STATE.employees.find(e => e.id === empId);
    if (!emp) return;
    emp.cardValidity = parseInt(validity);
    try {
        const response = await fetch(`/api/employees/${empId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emp)
        });
        if (!response.ok) throw new Error("Sync failure");
        await fetchData();
    } catch (err) {
        console.error("Error saving card validity:", err);
    }
}

async function updateEmployeeStatus(empId, status) {
    const emp = VSA_STATE.employees.find(e => e.id === empId);
    if (!emp) return;
    emp.status = status;
    try {
        const response = await fetch(`/api/employees/${empId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emp)
        });
        if (!response.ok) throw new Error("Sync failure");
        await fetchData();
        renderEmployeeDirectory();
    } catch (err) {
        console.error("Error saving card status:", err);
    }
}

function loadIdCardDetails(empId) {
    const container = document.getElementById('printable-id-single');
    if (!container) return;

    if (!empId) {
        container.innerHTML = `<div class="placeholder-card-preview" style="color: var(--text-muted); text-align: center; padding: 40px; font-style: italic;">Please select an employee profile first</div>`;
        return;
    }

    const emp = VSA_STATE.employees.find(e => e.id === empId);
    if (!emp) return;

    if (emp.cardValidity) {
        document.getElementById('id-validity-years').value = emp.cardValidity;
    } else {
        document.getElementById('id-validity-years').value = 3;
    }

    const tplId = document.getElementById('id-select-template').value;
    const template = VSA_STATE.templates.find(t => t.id === tplId) || VSA_STATE.templates[0];

    const validityYears = parseInt(document.getElementById('id-validity-years').value) || 3;

    container.innerHTML = generateIdCardHtml(emp, template, validityYears);
    renderQrsInContainer(container);
}

function formatDateDDMMYYYY(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

// Print Handler
function triggerIDCardPrint() {
    const selectedId = document.getElementById('id-select-employee').value;
    if (!selectedId) {
        alert("Please select a security guard profile first.");
        return;
    }
    // Set view to print
    window.print();
}

/* ==========================================================================
   6. REPORTING SYSTEM
   ========================================================================== */
function compileOperationalReport(e) {
    if (e) e.preventDefault();

    const type = document.getElementById('rep-type').value;
    const deptFilter = document.getElementById('rep-department').value;

    const headersRow = document.getElementById('report-headers');
    const tbody = document.getElementById('report-tbody');

    headersRow.innerHTML = '';
    tbody.innerHTML = '';

    let reportHeaders = [];
    let reportData = [];

    // Filter employees by status and department
    let dataset = [...VSA_STATE.employees];
    if (deptFilter) {
        dataset = dataset.filter(emp => emp.department === deptFilter);
    }

    if (type === 'master') {
        reportHeaders = ["ID", "Name", "Designation", "Joining Date", "Department", "Mobile Number", "Category", "Status"];
        dataset.forEach(emp => {
            reportData.push([
                emp.id, emp.name, emp.designation, emp.joiningDate, 
                emp.department || "-", emp.mobile, emp.category, emp.status
            ]);
        });
    } else if (type === 'active') {
        reportHeaders = ["ID", "Name", "Designation", "Joining Date", "Department", "Manager", "Mobile"];
        dataset.filter(emp => emp.status === 'Active').forEach(emp => {
            reportData.push([
                emp.id, emp.name, emp.designation, emp.joiningDate, 
                emp.department || "-", emp.reportingManager, emp.mobile
            ]);
        });
    } else if (type === 'inactive') {
        reportHeaders = ["ID", "Name", "Designation", "Joining Date", "Mobile", "Status"];
        dataset.filter(emp => emp.status !== 'Active').forEach(emp => {
            reportData.push([
                emp.id, emp.name, emp.designation, emp.joiningDate, emp.mobile, emp.status
            ]);
        });

    }

    // Render Headers
    reportHeaders.forEach(h => {
        headersRow.innerHTML += `<th>${h}</th>`;
    });

    // Render Body Rows
    if (reportData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${reportHeaders.length}" class="text-center placeholder-message">No matching operational records compiled.</td></tr>`;
        return;
    }

    reportData.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(val => {
            tr.innerHTML += `<td>${val}</td>`;
        });
        tbody.appendChild(tr);
    });
}

function exportReportToCSV() {
    const table = document.getElementById('report-result-table');
    const rows = table.querySelectorAll('tr');
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('th, td');
        const rowData = [];
        cols.forEach(c => {
            rowData.push(`"${c.textContent.replace(/"/g, '""')}"`);
        });
        csvContent += rowData.join(",") + "\r\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `VSA_Operational_Report_${new Date().toISOString().substring(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/* ==========================================================================
   7. EVENT HANDLERS & BACKUPS
   ========================================================================== */
function setupEventHandlers() {
    // === EMPLOYEE RECORD (LETTERHEAD) FORM HANDLERS ===
    document.getElementById('rec-select-employee').addEventListener('change', function() {
        loadEmployeeRecord(this.value);
    });
    const recSearchInput = document.getElementById('rec-search-employee');
    if (recSearchInput) {
        recSearchInput.addEventListener('input', function() {
            populateRecEmployeeSelect(this.value);
        });
    }
    const recFilterDepartment = document.getElementById('rec-filter-department');
    if (recFilterDepartment) {
        recFilterDepartment.addEventListener('change', function() {
            populateRecEmployeeChecklist();
        });
    }
    const recFilterDesignation = document.getElementById('rec-filter-designation');
    if (recFilterDesignation) {
        recFilterDesignation.addEventListener('change', function() {
            populateRecEmployeeChecklist();
        });
    }
    document.getElementById('btn-print-employee-record').addEventListener('click', printEmployeeRecord);

    // === EMPLOYEE REGISTRATION FORM HANDLERS ===
    document.getElementById('btn-add-employee').addEventListener('click', () => {
        showRegistrationForm('add');
    });

    document.getElementById('btn-back-to-list').addEventListener('click', () => {
        document.getElementById('view-emp-registration').classList.add('hidden');
        document.getElementById('view-employees').classList.remove('hidden');
        updateNavActive('employees');
    });

    document.getElementById('btn-reg-cancel').addEventListener('click', () => {
        document.getElementById('view-emp-registration').classList.add('hidden');
        document.getElementById('view-employees').classList.remove('hidden');
        updateNavActive('employees');
        resetRegistrationForm();
    });

    // Photo and Signature upload handlers
    document.getElementById('reg-photo').addEventListener('change', function(e) {
        handleImageUpload(e, 'reg-photo-preview');
    });

    document.getElementById('reg-signature').addEventListener('change', function(e) {
        handleImageUpload(e, 'reg-signature-preview');
    });

    // Relation dropdown change handler
    const relationTypeSelect = document.getElementById('reg-relation-type');
    if (relationTypeSelect) {
        relationTypeSelect.addEventListener('change', function(e) {
            const type = e.target.value;
            const label = document.getElementById('reg-father-label');
            if (label) {
                label.textContent = `${type}'s Name *`;
            }
            const input = document.getElementById('reg-father');
            if (input) {
                input.placeholder = `Enter ${type.toLowerCase()}'s name`;
            }
        });
    }

    document.getElementById('employee-registration-form').addEventListener('submit', saveEmployeeFromRegistration);

    // === OLD EMPLOYEE MODAL HANDLERS (KEEPING FOR BACKWARD COMPATIBILITY) ===
    // A. Employee Directory filtering
    document.getElementById('emp-filter-search').addEventListener('input', renderEmployeeDirectory);
    document.getElementById('emp-filter-designation').addEventListener('change', renderEmployeeDirectory);
    document.getElementById('emp-filter-status').addEventListener('change', renderEmployeeDirectory);

    // View Toggles: Card View & List View
    document.getElementById('btn-view-card').addEventListener('click', function() {
        document.getElementById('btn-view-card').classList.add('active');
        document.getElementById('btn-view-list').classList.remove('active');
        directoryViewMode = 'card';
        renderEmployeeDirectory();
    });

    document.getElementById('btn-view-list').addEventListener('click', function() {
        document.getElementById('btn-view-list').classList.add('active');
        document.getElementById('btn-view-card').classList.remove('active');
        directoryViewMode = 'list';
        renderEmployeeDirectory();
    });

    // B. Employee Modal trigger (old modal, for editing)
    document.getElementById('btn-close-emp-modal').addEventListener('click', () => {
        document.getElementById('employee-modal').classList.add('hidden');
    });
    document.getElementById('btn-cancel-emp').addEventListener('click', () => {
        document.getElementById('employee-modal').classList.add('hidden');
    });
    document.getElementById('employee-form').addEventListener('submit', saveEmployee);

    // Image Upload Handlers (old modal)
    document.getElementById('form-photo-upload').addEventListener('change', function() {
        handleImageCompression(this, 'form-photo-preview-box', () => {});
    });
    document.getElementById('form-sig-upload').addEventListener('change', function() {
        handleImageCompression(this, 'form-sig-preview-box', () => {});
    });

// Client modal listeners removed


    // E. ID Selection change details trigger
    document.getElementById('id-select-employee').addEventListener('change', function() {
        loadIdCardDetails(this.value);
    });

    const idSearchInput = document.getElementById('id-search-employee');
    if (idSearchInput) {
        idSearchInput.addEventListener('input', function() {
            populateIdEmployeeSelect(this.value);
        });
    }

    const idFilterDepartment = document.getElementById('id-filter-department');
    if (idFilterDepartment) {
        idFilterDepartment.addEventListener('change', function() {
            populateIdEmployeeChecklist();
        });
    }

    const idFilterDesignation = document.getElementById('id-filter-designation');
    if (idFilterDesignation) {
        idFilterDesignation.addEventListener('change', function() {
            populateIdEmployeeChecklist();
        });
    }

    const idBulkDownloadBtn = document.getElementById('btn-id-bulk-download');
    if (idBulkDownloadBtn) {
        idBulkDownloadBtn.addEventListener('click', triggerIdBulkDownload);
    }

    const idBulkPrintBtn = document.getElementById('btn-id-bulk-print');
    if (idBulkPrintBtn) {
        idBulkPrintBtn.addEventListener('click', triggerIdBulkPrint);
    }

    document.getElementById('id-select-template').addEventListener('change', function() {
        const empId = document.getElementById('id-select-employee').value;
        loadIdCardDetails(empId);
    });
    document.getElementById('id-validity-years').addEventListener('change', async function() {
        const empId = document.getElementById('id-select-employee').value;
        if (empId) {
            await updateEmployeeValidity(empId, this.value);
        }
        loadIdCardDetails(empId);
    });

    // Print handler
    document.getElementById('btn-print-id-card').addEventListener('click', triggerIDCardPrint);
    document.getElementById('btn-download-id-card').addEventListener('click', downloadIdCardImage);

    // Select All Checkbox toggler in Employee directory table
    const selectAllCheck = document.getElementById('select-all-employees');
    if (selectAllCheck) {
        selectAllCheck.addEventListener('change', function() {
            const checked = this.checked;
            const items = document.querySelectorAll('.directory-select-item');
            
            items.forEach(item => {
                item.checked = checked;
                const empId = item.getAttribute('data-id');
                if (checked) {
                    if (!VSA_STATE.selectedEmployeeIds.includes(empId)) {
                        VSA_STATE.selectedEmployeeIds.push(empId);
                    }
                } else {
                    VSA_STATE.selectedEmployeeIds = VSA_STATE.selectedEmployeeIds.filter(id => id !== empId);
                }
            });
            updateBulkActionBanner();
        });
    }

    // Clear selection click button
    const bulkClearBtn = document.getElementById('btn-bulk-clear');
    if (bulkClearBtn) {
        bulkClearBtn.addEventListener('click', () => {
            VSA_STATE.selectedEmployeeIds = [];
            const selectAllCheck = document.getElementById('select-all-employees');
            if (selectAllCheck) selectAllCheck.checked = false;
            
            document.querySelectorAll('.directory-select-item').forEach(item => {
                item.checked = false;
            });
            updateBulkActionBanner();
        });
    }

    // Bulk print and bulk download buttons click listeners
    const bulkPrintBtn = document.getElementById('btn-bulk-print');
    if (bulkPrintBtn) {
        bulkPrintBtn.addEventListener('click', triggerBulkPrint);
    }

    const bulkDownloadBtn = document.getElementById('btn-bulk-download');
    if (bulkDownloadBtn) {
        bulkDownloadBtn.addEventListener('click', triggerBulkDownload);
    }

    // F. Reports compiles
    document.getElementById('report-filter-form').addEventListener('submit', compileOperationalReport);
    document.getElementById('btn-export-csv').addEventListener('click', exportReportToCSV);

    // G. Settings/Backups
    document.getElementById('btn-backup-download').addEventListener('click', exportFullDatabase);
    document.getElementById('file-backup-import').addEventListener('change', importFullDatabase);

    // Quick global search wrapper dropdown close
    document.addEventListener('click', (e) => {
        const dropdown = document.getElementById('search-results-dropdown');
        if (!e.target.closest('.search-bar-wrapper')) {
            dropdown.classList.add('hidden');
        }
    });
    
    // global search input
    document.getElementById('global-search').addEventListener('input', handleGlobalSearchInput);

    // === DEVELOPER PROFILE MODAL HANDLERS ===
    const developerModal = document.getElementById('developer-modal');
    const btnOpenDevModal = document.getElementById('btn-open-developer-modal');
    const btnCloseDevModal = document.getElementById('btn-close-developer-modal');

    if (btnOpenDevModal && developerModal) {
        btnOpenDevModal.addEventListener('click', () => {
            developerModal.classList.remove('hidden');
        });
    }

    if (btnCloseDevModal && developerModal) {
        btnCloseDevModal.addEventListener('click', () => {
            developerModal.classList.add('hidden');
        });
    }

    if (developerModal) {
        developerModal.addEventListener('click', (e) => {
            if (e.target === developerModal) {
                developerModal.classList.add('hidden');
            }
        });
    }
}

// Global search handling
function handleGlobalSearchInput() {
    const val = this.value.toLowerCase();
    const dropdown = document.getElementById('search-results-dropdown');
    
    if (val.length < 2) {
        dropdown.classList.add('hidden');
        return;
    }

    const matches = VSA_STATE.employees.filter(emp => {
        return emp.name.toLowerCase().includes(val) || 
               emp.id.toLowerCase().includes(val) || 
               emp.designation.toLowerCase().includes(val);
    }).slice(0, 5);

    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="search-dropdown-item text-muted">No guards match details.</div>';
    } else {
        dropdown.innerHTML = matches.map(emp => `
            <div class="search-dropdown-item cursor-pointer" data-id="${emp.id}">
                <span class="search-dropdown-name">${emp.name} (${emp.id})</span>
                <span class="search-dropdown-meta">${emp.designation} • Status: ${emp.status}</span>
            </div>
        `).join('');

        // Wire selections inside dropdown
        dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const empId = item.getAttribute('data-id');
                dropdown.classList.add('hidden');
                document.getElementById('global-search').value = '';
                // Jump routing trigger to Employee Details registration edit
                showRegistrationForm('edit', empId);
            });
        });
    }

    dropdown.classList.remove('hidden');
}

// Backup database handlers
function exportFullDatabase() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(VSA_STATE));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `VSA_Database_Backup_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(dlAnchorElem);
    dlAnchorElem.click();
    document.body.removeChild(dlAnchorElem);
}

function importFullDatabase(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const db = JSON.parse(evt.target.result);
            if (!db.employees || !db.clients) {
                throw new Error("Invalid schema structure. Check backup authenticity.");
            }
            
            const response = await fetch('/api/db/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(db)
            });

            if (!response.ok) throw new Error("Sync import failed on local server.");
            alert("Local Database Backup Synced Successfully!");
            fetchData();
        } catch (err) {
            alert("Error importing database: " + err.message);
        }
    };
    reader.readAsText(file);
}

/* ==========================================================================
   8. NEW REGISTRATION FORM SYSTEM
   ========================================================================== */

function showRegistrationForm(mode = 'add', empId = null) {
    currentRegistrationMode = mode;
    currentRegistrationEmpId = empId;
    
    document.getElementById('view-employees').classList.add('hidden');
    document.getElementById('view-emp-registration').classList.remove('hidden');
    updateNavActive('emp-registration');
    
    if (mode === 'edit' && empId) {
        // Load existing employee data
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (emp) {
            populateRegistrationForm(emp);
            document.querySelector('.section-header h1').textContent = 'Edit Employee Record';
        }
    } else {
        resetRegistrationForm();
        document.querySelector('.section-header h1').textContent = 'Register New Employee';
    }
}

function resetRegistrationForm() {
    document.getElementById('employee-registration-form').reset();
    document.getElementById('reg-emp-id').value = '';
    
    // Reset Relation label/placeholder
    const label = document.getElementById('reg-father-label');
    if (label) {
        label.textContent = "Father's Name *";
    }
    const input = document.getElementById('reg-father');
    if (input) {
        input.placeholder = "Enter father's name";
    }

    document.getElementById('reg-photo-preview').innerHTML = '<span class="preview-placeholder">Click to upload photo</span>';
    document.getElementById('reg-signature-preview').innerHTML = '<span class="preview-placeholder">Click to upload signature</span>';
    
    // Clear dynamic file uploads data attributes
    delete document.getElementById('reg-photo').dataset.imageData;
    delete document.getElementById('reg-signature').dataset.imageData;
}

function populateRegistrationForm(emp) {
    document.getElementById('reg-emp-id').value = emp.id;
    document.getElementById('reg-name').value = emp.name;
    
    const relationType = emp.relationType || 'Father';
    document.getElementById('reg-relation-type').value = relationType;
    const label = document.getElementById('reg-father-label');
    if (label) {
        label.textContent = `${relationType}'s Name *`;
    }
    const input = document.getElementById('reg-father');
    if (input) {
        input.placeholder = `Enter ${relationType.toLowerCase()}'s name`;
    }
    document.getElementById('reg-father').value = emp.fatherName || '';
    
    document.getElementById('reg-dob').value = emp.dob;
    document.getElementById('reg-gender').value = emp.gender;
    document.getElementById('reg-blood').value = emp.bloodGroup;
    
    document.getElementById('reg-mobile').value = emp.mobile;
    document.getElementById('reg-curr-address').value = emp.currentAddress || emp.permanentAddress || '';
    
    document.getElementById('reg-designation').value = emp.designation || '';
    document.getElementById('reg-department').value = emp.department || '';

    document.getElementById('reg-joining-date').value = emp.joiningDate;
    document.getElementById('reg-card-validity').value = emp.cardValidity || 3;
    
    // Clear dynamic file upload data attributes first
    delete document.getElementById('reg-photo').dataset.imageData;
    delete document.getElementById('reg-signature').dataset.imageData;

    // Load images if available
    if (emp.documents?.photo) {
        document.getElementById('reg-photo-preview').innerHTML = `<img src="${emp.documents.photo}" style="max-height: 100px;">`;
    } else {
        document.getElementById('reg-photo-preview').innerHTML = '<span class="preview-placeholder">Click to upload photo</span>';
    }
    if (emp.documents?.signature) {
        document.getElementById('reg-signature-preview').innerHTML = `<img src="${emp.documents.signature}" style="max-height: 100px;">`;
    } else {
        document.getElementById('reg-signature-preview').innerHTML = '<span class="preview-placeholder">Click to upload signature</span>';
    }
}

function handleImageUpload(e, previewBoxId) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = document.createElement('img');
        img.src = event.target.result;
        img.style.maxHeight = '100px';
        
        const previewBox = document.getElementById(previewBoxId);
        previewBox.innerHTML = '';
        previewBox.appendChild(img);
        
        // Store the base64 in a data attribute for form submission
        const input = e.target;
        input.dataset.imageData = event.target.result;
    };
    reader.readAsDataURL(file);
}

function updateNavActive(viewName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === viewName) {
            item.classList.add('active');
        }
    });
}

async function saveEmployeeFromRegistration(e) {
    e.preventDefault();
    
    let photoData = document.getElementById('reg-photo').dataset.imageData || '';
    let signatureData = document.getElementById('reg-signature').dataset.imageData || '';
    let existingAssets = [];
    
    const empId = document.getElementById('reg-emp-id').value;
    
    // If in edit mode, detect if the photo/signature files are unchanged and preserve their existing base64 strings
    if (currentRegistrationMode === 'edit' && empId) {
        const existingEmp = VSA_STATE.employees.find(emp => emp.id === empId);
        if (existingEmp) {
            if (!photoData && existingEmp.documents && existingEmp.documents.photo) {
                photoData = existingEmp.documents.photo;
            }
            if (!signatureData && existingEmp.documents.signature) {
                signatureData = existingEmp.documents.signature;
            }
            if (existingEmp.assets) {
                existingAssets = existingEmp.assets;
            }
        }
    }
    
    const relationType = document.getElementById('reg-relation-type').value;
    const fatherName = document.getElementById('reg-father').value;
    const address = document.getElementById('reg-curr-address').value;
    const mobile = document.getElementById('reg-mobile').value;
    const cardValidity = parseInt(document.getElementById('reg-card-validity').value) || 3;

    const empData = {
        id: empId || generateEmployeeId(),
        name: document.getElementById('reg-name').value,
        relationType: relationType,
        fatherName: fatherName,
        dob: document.getElementById('reg-dob').value,
        gender: document.getElementById('reg-gender').value,
        bloodGroup: document.getElementById('reg-blood').value,
        maritalStatus: 'Single',
        category: 'Unskilled',
        mobile: mobile,
        altMobile: '',
        email: '',
        permanentAddress: address,
        currentAddress: address,
        district: 'Srinagar',
        state: 'Jammu & Kashmir',
        pinCode: '190001',
        designation: document.getElementById('reg-designation').value,
        department: document.getElementById('reg-department').value,
        manpowerType: 'Security Force',
        joiningDate: document.getElementById('reg-joining-date').value,
        cardValidity: cardValidity,
        reportingManager: 'Vikram Rathore',
        status: 'Active',
        emergencyContactName: fatherName,
        emergencyContactRelation: relationType,
        emergencyContactMobile: mobile,
        documents: {
            photo: photoData,
            signature: signatureData,
            aadhaar: 'Completed',
            pan: 'Completed',
            policeVerification: 'Verified'
        },
        assets: existingAssets
    };
    
    try {
        const method = currentRegistrationMode === 'edit' ? 'PUT' : 'POST';
        const endpoint = currentRegistrationMode === 'edit' ? `/api/employees/${empData.id}` : '/api/employees';
        
        const response = await fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(empData)
        });
        
        if (!response.ok) throw new Error('Employee registration failed');
        
        alert(`Employee ${currentRegistrationMode === 'edit' ? 'updated' : 'registered'} successfully!`);
        await fetchData();
        
        // Show ID card generation for new employee
        if (currentRegistrationMode === 'add') {
            document.getElementById('id-select-employee').value = empData.id;
            loadIdCardDetails(empData.id);
            
            // Switch to ID cards view
            document.getElementById('view-emp-registration').classList.add('hidden');
            document.getElementById('view-id-cards').classList.remove('hidden');
            updateNavActive('id-cards');
        } else {
            document.getElementById('view-emp-registration').classList.add('hidden');
            document.getElementById('view-employees').classList.remove('hidden');
            updateNavActive('employees');
        }
    } catch (err) {
        alert('Error: ' + err.message);
    }
}

function generateEmployeeId() {
    const count = VSA_STATE.employees.length + 1;
    return `VSA-${String(1000 + count).slice(-4)}`;
}

/* ==========================================================================
   9. UPDATED ID CARD SYSTEM (SINGLE-SIDED)
   ========================================================================== */

// loadIdCardDetails override replaced by single shared rendering engine at top of file

function formatDateDDMMYYYY(date) {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

function triggerIDCardPrint() {
    const selectedId = document.getElementById('id-select-employee').value;
    if (!selectedId) {
        alert('Please select an employee first');
        return;
    }
    window.print();
}

function downloadIdCardImage() {
    const selectedId = document.getElementById('id-select-employee').value;
    if (!selectedId) {
        alert('Please select an employee first');
        return;
    }
    
    const templateId = document.getElementById('id-select-template').value;
    const template = VSA_STATE.templates.find(t => t.id === templateId) || VSA_STATE.templates[0];
    
    if (template && template.isVisualTemplate) {
        // Visual template: download front and back sides separately
        const cards = document.querySelectorAll('#printable-id-single .visual-id-card-render');
        if (cards.length === 0) {
            alert('ID Card element not found.');
            return;
        }
        
        cards.forEach((cardElement, index) => {
            const sideName = index === 0 ? 'Front' : 'Back';
            html2canvas(cardElement, {
                scale: 4,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `VSA_ID_Card_${sideName}_${selectedId}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
            }).catch(err => {
                console.error(`Error generating ${sideName} ID card image:`, err);
            });
        });
    } else {
        const cardElement = document.querySelector('.id-card-portrait, .id-card-horizontal');
        if (!cardElement) {
            alert('ID Card element not found.');
            return;
        }
        
        html2canvas(cardElement, {
            scale: 4, // 4x scale for print-quality 300+ DPI sharpness
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `VSA_ID_Card_${selectedId}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(err => {
            console.error("Error generating ID card image:", err);
            alert("Failed to save ID card as image.");
        });
    }
}

async function downloadIndividualCardImage(empId) {
    const emp = VSA_STATE.employees.find(e => e.id === empId);
    if (!emp) return;
    
    // Default to vertical or horizontal template based on user selection or fallback to tpl-default
    const templateId = document.getElementById('id-select-template').value;
    const template = VSA_STATE.templates.find(t => t.id === templateId) || VSA_STATE.templates[0];
    
    const cardHtml = generateIdCardHtml(emp, template, emp.cardValidity || 3);
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.innerHTML = cardHtml;
    document.body.appendChild(tempDiv);
    
    // Render QRs and Barcodes inside container
    renderQrsInContainer(tempDiv);
    
    await new Promise(resolve => setTimeout(resolve, 150)); // Allow rendering time
    
    if (template && template.isVisualTemplate) {
        const cards = tempDiv.querySelectorAll('.visual-id-card-render');
        if (cards.length === 0) {
            document.body.removeChild(tempDiv);
            alert('Card element failed to generate.');
            return;
        }
        
        let successCount = 0;
        for (let idx = 0; idx < cards.length; idx++) {
            const cardElement = cards[idx];
            const sideName = idx === 0 ? 'Front' : 'Back';
            try {
                const canvas = await html2canvas(cardElement, {
                    scale: 4,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });
                const link = document.createElement('a');
                link.download = `VSA_ID_Card_${sideName}_${emp.id}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                successCount++;
            } catch (err) {
                console.error(`Error generating individual visual card ${sideName} image:`, err);
            }
        }
        document.body.removeChild(tempDiv);
        if (successCount === 0) alert("Failed to download individual card as image.");
    } else {
        const cardElement = tempDiv.querySelector('.id-card-portrait, .id-card-horizontal');
        if (!cardElement) {
            document.body.removeChild(tempDiv);
            alert('Card element failed to generate.');
            return;
        }
        
        html2canvas(cardElement, {
            scale: 4, // 300+ DPI sharp quality
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            logging: false
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `VSA_ID_Card_${emp.id}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            document.body.removeChild(tempDiv);
        }).catch(err => {
            console.error("Error generating individual card image:", err);
            document.body.removeChild(tempDiv);
            alert("Failed to download individual card as image.");
        });
    }
}

/* ==========================================================================
   10. EMPLOYEE RECORD (LETTERHEAD FORM) SYSTEM
   ========================================================================== */

function populateRecEmployeeSelect(filterQuery = '') {
    const recEmpSel = document.getElementById('rec-select-employee');
    if (!recEmpSel) return;
    
    const prevSelectedValue = recEmpSel.value;
    recEmpSel.innerHTML = '<option value="">-- Select Guard --</option>';
    
    const query = filterQuery.toLowerCase().trim();
    VSA_STATE.employees.forEach(e => {
        const matches = !query || 
                        e.name.toLowerCase().includes(query) || 
                        e.id.toLowerCase().includes(query) ||
                        (e.clientLocation && e.clientLocation.toLowerCase().includes(query)) ||
                        (e.designation && e.designation.toLowerCase().includes(query));
        if (matches) {
            recEmpSel.innerHTML += `<option value="${e.id}">${e.name} (${e.id})</option>`;
        }
    });
    
    if (prevSelectedValue && Array.from(recEmpSel.options).some(o => o.value === prevSelectedValue)) {
        recEmpSel.value = prevSelectedValue;
    }

    populateRecEmployeeChecklist();
}

function populateRecEmployeeChecklist() {
    const listContainer = document.getElementById('rec-employees-list-box');
    if (!listContainer) return;

    const searchVal = (document.getElementById('rec-search-employee')?.value || '').toLowerCase().trim();
    const deptVal = document.getElementById('rec-filter-department')?.value || '';
    const designationVal = document.getElementById('rec-filter-designation')?.value || '';

    const filtered = VSA_STATE.employees.filter(emp => {
        const matchesSearch = !searchVal || 
                              emp.name.toLowerCase().includes(searchVal) || 
                              emp.id.toLowerCase().includes(searchVal);
        const matchesDept = !deptVal || emp.department === deptVal;
        const matchesDesignation = !designationVal || emp.designation === designationVal;

        return matchesSearch && matchesDept && matchesDesignation;
    });

    let listHtml = '';

    if (filtered.length === 0) {
        listHtml += `<div style="padding: 15px; font-style: italic; color: var(--text-secondary); font-size: 11px; text-align: center;">No matching guards found</div>`;
    } else {
        const activePreviewId = document.getElementById('rec-select-employee').value;
        
        filtered.forEach(emp => {
            const isActive = emp.id === activePreviewId ? 'active-preview' : '';
            const photoSrc = (emp.documents && emp.documents.photo) ? emp.documents.photo : '';
            const avatarHtml = photoSrc ? `<img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user" style="width: 12px; height: 12px; color: var(--text-muted);"></i>`;

            listHtml += `
                <div class="id-checklist-item ${isActive}" data-id="${emp.id}">
                    <div class="id-checklist-item-avatar">
                        ${avatarHtml}
                    </div>
                    <div class="id-checklist-item-info">
                        <span class="id-checklist-item-name">${emp.name}</span>
                        <span class="id-checklist-item-sub">${emp.id} | ${emp.designation} | ${emp.department || '-'}</span>
                    </div>
                </div>
            `;
        });
    }

    listContainer.innerHTML = listHtml;
    lucide.createIcons();

    // Wire up row clicks
    listContainer.querySelectorAll('.id-checklist-item').forEach(item => {
        item.addEventListener('click', () => {
            const empId = item.getAttribute('data-id');
            document.getElementById('rec-select-employee').value = empId;
            loadEmployeeRecord(empId);
            populateRecEmployeeChecklist();
        });
    });
}

function loadEmployeeRecord(empId) {
    if (!empId) {
        resetEmployeeRecord();
        return;
    }

    const emp = VSA_STATE.employees.find(e => e.id === empId);
    if (!emp) return;

    // Helper function to safely set text content if element exists
    const setSafeText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    // Populate all record fields
    setSafeText('rec-empid', emp.id || '-');
    setSafeText('rec-name', emp.name || '-');
    const relationType = emp.relationType || 'Father';
    const relationLabel = document.getElementById('rec-relation-label');
    if (relationLabel) {
        relationLabel.textContent = `${relationType}'s Name:`;
    }
    setSafeText('rec-father', emp.fatherName || '-');
    setSafeText('rec-dob', emp.dob || '-');
    setSafeText('rec-gender', emp.gender || '-');
    setSafeText('rec-blood', emp.bloodGroup || '-');
    
    setSafeText('rec-mobile', emp.mobile || '-');
    setSafeText('rec-curr-address', emp.currentAddress || emp.permanentAddress || '-');
    
    setSafeText('rec-designation', emp.designation || '-');
    setSafeText('rec-department', emp.department || '-');

    setSafeText('rec-joining', emp.joiningDate || '-');
    setSafeText('rec-status', emp.status || '-');
    
    setSafeText('rec-validity', `${emp.cardValidity || 3} Years`);
    
    // Set date generated
    const today = new Date();
    setSafeText('rec-generated-date', formatDateDDMMYYYY(today));
    
    // Photo
    const photoEl = document.getElementById('rec-photo');
    const photoPlaceholder = document.getElementById('rec-photo-placeholder');
    if (photoEl && photoPlaceholder) {
        if (emp.documents?.photo) {
            photoEl.src = emp.documents.photo;
            photoEl.style.display = 'block';
            photoPlaceholder.style.display = 'none';
        } else {
            photoEl.style.display = 'none';
            photoPlaceholder.style.display = 'flex';
        }
    }

    // Signature
    const sigEl = document.getElementById('rec-signature-img');
    const sigPlaceholder = document.getElementById('rec-sig-placeholder');
    if (sigEl && sigPlaceholder) {
        if (emp.documents?.signature) {
            sigEl.src = emp.documents.signature;
            sigEl.style.display = 'block';
            sigPlaceholder.style.display = 'none';
        } else {
            sigEl.style.display = 'none';
            sigPlaceholder.style.display = 'block';
        }
    }
}

function resetEmployeeRecord() {
    // Reset all fields to default
    const fields = [
        'rec-empid', 'rec-name', 'rec-father', 'rec-dob', 'rec-gender',
        'rec-curr-address', 'rec-mobile', 'rec-designation', 'rec-department',
        'rec-joining', 'rec-status', 'rec-blood', 'rec-validity'
    ];
    
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
    
    const label = document.getElementById('rec-relation-label');
    if (label) label.textContent = "Father's Name:";
    
    const photoEl = document.getElementById('rec-photo');
    const photoPlaceholder = document.getElementById('rec-photo-placeholder');
    if (photoEl) photoEl.style.display = 'none';
    if (photoPlaceholder) photoPlaceholder.style.display = 'flex';

    const sigEl = document.getElementById('rec-signature-img');
    const sigPlaceholder = document.getElementById('rec-sig-placeholder');
    if (sigEl) sigEl.style.display = 'none';
    if (sigPlaceholder) sigPlaceholder.style.display = 'block';
}

function printEmployeeRecord() {
    const selectedId = document.getElementById('rec-select-employee').value;
    if (!selectedId) {
        alert('Please select an employee first');
        return;
    }
    document.body.classList.add('record-print-active');
    setTimeout(() => {
        window.print();
    }, 100);
}

/* ==========================================================================
   11. DYNAMIC MANPOWER CLASSIFICATIONS MANAGER
   ========================================================================== */

function renderClassificationsManager() {
    // 1. Render Department chips
    const deptsList = document.getElementById('class-list-depts');
    if (deptsList) {
        if (VSA_STATE.departments && VSA_STATE.departments.length > 0) {
            deptsList.innerHTML = VSA_STATE.departments.map((dept, idx) => `
                <div class="classification-chip">
                    <span>${dept}</span>
                    <button type="button" class="classification-chip-delete" onclick="deleteClassification('departments', ${idx})">&times;</button>
                </div>
            `).join('');
        } else {
            deptsList.innerHTML = '<div class="classification-list-placeholder">No departments configured.</div>';
        }
    }

    // 2. Render Designation chips
    const desigsList = document.getElementById('class-list-desigs');
    if (desigsList) {
        if (VSA_STATE.designations && VSA_STATE.designations.length > 0) {
            desigsList.innerHTML = VSA_STATE.designations.map((desig, idx) => `
                <div class="classification-chip">
                    <span>${desig}</span>
                    <button type="button" class="classification-chip-delete" onclick="deleteClassification('designations', ${idx})">&times;</button>
                </div>
            `).join('');
        } else {
            desigsList.innerHTML = '<div class="classification-list-placeholder">No designations configured.</div>';
        }
    }

    // 3. Render Manpower Type chips
    const typesList = document.getElementById('class-list-types');
    if (typesList) {
        if (VSA_STATE.manpowerTypes && VSA_STATE.manpowerTypes.length > 0) {
            typesList.innerHTML = VSA_STATE.manpowerTypes.map((type, idx) => `
                <div class="classification-chip">
                    <span>${type}</span>
                    <button type="button" class="classification-chip-delete" onclick="deleteClassification('manpowerTypes', ${idx})">&times;</button>
                </div>
            `).join('');
        } else {
            typesList.innerHTML = '<div class="classification-list-placeholder">No manpower types configured.</div>';
        }
    }
}

// Global hook for deleting classifications
window.deleteClassification = async function(type, idx) {
    let list = [];
    if (type === 'departments') list = [...VSA_STATE.departments];
    else if (type === 'designations') list = [...VSA_STATE.designations];
    else if (type === 'manpowerTypes') list = [...VSA_STATE.manpowerTypes];

    if (idx < 0 || idx >= list.length) return;
    const removedItem = list.splice(idx, 1)[0];
    
    if (!confirm(`Are you sure you want to remove "${removedItem}"? Employees assigned to this will retain it, but it will not be selectable for new profiles.`)) {
        return;
    }

    const payload = {
        departments: type === 'departments' ? list : VSA_STATE.departments,
        designations: type === 'designations' ? list : VSA_STATE.designations,
        manpowerTypes: type === 'manpowerTypes' ? list : VSA_STATE.manpowerTypes
    };

    try {
        const response = await fetch('/api/classifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to update categories');
        const res = await response.json();
        
        VSA_STATE.departments = res.departments || [];
        VSA_STATE.designations = res.designations || [];
        VSA_STATE.manpowerTypes = res.manpowerTypes || [];

        renderClassificationsManager();
        populateSelectors();
    } catch (err) {
        alert(err.message);
    }
};

function setupClassificationsManager() {
    // Tab switching event handlers
    const tabButtons = document.querySelectorAll('.classification-tab-btn');
    const panes = document.querySelectorAll('.classification-pane');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            panes.forEach(pane => {
                if (pane.id === `pane-${targetTab}`) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });

    // Form submissions
    const formAddDept = document.getElementById('form-add-dept');
    if (formAddDept) {
        formAddDept.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('input-add-dept');
            const val = input.value.trim();
            if (!val) return;

            if (VSA_STATE.departments.includes(val)) {
                alert('Department already exists');
                return;
            }

            const newList = [...VSA_STATE.departments, val];
            const success = await saveClassificationsList('departments', newList);
            if (success) input.value = '';
        });
    }

    const formAddDesig = document.getElementById('form-add-desig');
    if (formAddDesig) {
        formAddDesig.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('input-add-desig');
            const val = input.value.trim();
            if (!val) return;

            if (VSA_STATE.designations.includes(val)) {
                alert('Designation already exists');
                return;
            }

            const newList = [...VSA_STATE.designations, val];
            const success = await saveClassificationsList('designations', newList);
            if (success) input.value = '';
        });
    }

    const formAddType = document.getElementById('form-add-type');
    if (formAddType) {
        formAddType.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('input-add-type');
            const val = input.value.trim();
            if (!val) return;

            if (VSA_STATE.manpowerTypes.includes(val)) {
                alert('Manpower type already exists');
                return;
            }

            const newList = [...VSA_STATE.manpowerTypes, val];
            const success = await saveClassificationsList('manpowerTypes', newList);
            if (success) input.value = '';
        });
    }
}

async function saveClassificationsList(type, list) {
    const payload = {
        departments: type === 'departments' ? list : VSA_STATE.departments,
        designations: type === 'designations' ? list : VSA_STATE.designations,
        manpowerTypes: type === 'manpowerTypes' ? list : VSA_STATE.manpowerTypes
    };

    try {
        const response = await fetch('/api/classifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error('Failed to save category');
        const res = await response.json();
        
        VSA_STATE.departments = res.departments || [];
        VSA_STATE.designations = res.designations || [];
        VSA_STATE.manpowerTypes = res.manpowerTypes || [];

        renderClassificationsManager();
        populateSelectors();
        return true;
    } catch (err) {
        alert(err.message);
        return false;
    }
}

// ==========================================================================
// 10. ID CARD TEMPLATE AND BULK GENERATION IMPLEMENTATION
// ==========================================================================

function updateBulkActionBanner() {
    const banner = document.getElementById('bulk-action-banner');
    const countEl = document.getElementById('bulk-selected-count');
    const selectAllCheck = document.getElementById('select-all-employees');

    if (!banner || !countEl) return;

    const selectedCount = VSA_STATE.selectedEmployeeIds.length;
    countEl.textContent = selectedCount;

    if (selectedCount > 0) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }

    // Synchronize checkboxes and apply selected visual highlights to cards and rows
    document.querySelectorAll('.directory-select-item').forEach(item => {
        const empId = item.getAttribute('data-id');
        const isSelected = VSA_STATE.selectedEmployeeIds.includes(empId);
        item.checked = isSelected;
        
        const card = item.closest('.directory-card');
        const row = item.closest('tr');
        if (isSelected) {
            if (card) card.classList.add('selected');
            if (row) row.classList.add('selected');
        } else {
            if (card) card.classList.remove('selected');
            if (row) row.classList.remove('selected');
        }
    });

    if (selectAllCheck) {
        const visibleItems = document.querySelectorAll('.directory-select-item');
        if (visibleItems.length > 0) {
            const visibleChecked = Array.from(visibleItems).filter(item => item.checked);
            selectAllCheck.checked = (visibleChecked.length === visibleItems.length);
        } else {
            selectAllCheck.checked = false;
        }
    }
}

async function triggerBulkPrint() {
    const selectedTemplateId = document.getElementById('bulk-select-template').value;
    const template = VSA_STATE.templates.find(t => t.id === selectedTemplateId) || VSA_STATE.templates[0];
    
    if (VSA_STATE.selectedEmployeeIds.length === 0) {
        alert('Please select at least one employee from the directory.');
        return;
    }

    const bulkContainer = document.getElementById('printable-id-bulk');
    if (!bulkContainer) return;

    // Group cards by page size depending on layout
    const isHorizontal = template.layout === 'horizontal';
    const cardsPerPage = isHorizontal ? 8 : 9; // 8 cards for horizontal (2x4), 9 cards for vertical (3x3)
    const gridClass = isHorizontal ? 'horizontal-grid' : 'vertical-grid';
    
    let bulkHtml = '';
    const selectedEmps = VSA_STATE.selectedEmployeeIds
        .map(empId => VSA_STATE.employees.find(e => e.id === empId))
        .filter(Boolean);
        
    for (let i = 0; i < selectedEmps.length; i += cardsPerPage) {
        const pageCards = selectedEmps.slice(i, i + cardsPerPage);
        
        bulkHtml += `<div class="print-page ${gridClass}">`;
        pageCards.forEach(emp => {
            bulkHtml += `
            <div class="printable-id-card-wrapper">
                ${generateIdCardHtml(emp, template, emp.cardValidity || 3)}
            </div>
            `;
        });
        bulkHtml += `</div>`;
    }

    bulkContainer.innerHTML = bulkHtml;
    renderQrsInContainer(bulkContainer);

    bulkContainer.classList.remove('hidden');
    document.body.classList.add('bulk-print-active');
    
    setTimeout(() => {
        window.print();
    }, 300);
}

async function triggerBulkDownload() {
    const selectedTemplateId = document.getElementById('bulk-select-template').value;
    const template = VSA_STATE.templates.find(t => t.id === selectedTemplateId) || VSA_STATE.templates[0];
    
    if (VSA_STATE.selectedEmployeeIds.length === 0) {
        alert('Please select at least one employee.');
        return;
    }

    const bulkContainer = document.getElementById('printable-id-bulk');
    if (!bulkContainer) return;

    const originalBtnText = document.getElementById('btn-bulk-download').innerHTML;
    document.getElementById('btn-bulk-download').disabled = true;
    document.getElementById('btn-bulk-download').innerHTML = '<i data-lucide="loader" class="animate-spin" style="display:inline-block; vertical-align:middle; width:16px;"></i> Generating Photos...';
    lucide.createIcons();

    bulkContainer.classList.remove('hidden');
    bulkContainer.style.position = 'absolute';
    bulkContainer.style.left = '-9999px';
    bulkContainer.style.top = '0';
    bulkContainer.style.display = 'block';

    const zip = new JSZip();
    let renderCount = 0;

    for (let i = 0; i < VSA_STATE.selectedEmployeeIds.length; i++) {
        const empId = VSA_STATE.selectedEmployeeIds[i];
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (!emp) continue;

        bulkContainer.innerHTML = generateIdCardHtml(emp, template, emp.cardValidity || 3);
        renderQrsInContainer(bulkContainer);

        await new Promise(resolve => setTimeout(resolve, 300));

        const cardElement = bulkContainer.querySelector('.id-card-portrait') || bulkContainer.querySelector('.id-card-horizontal');
        if (cardElement) {
            try {
                const canvas = await html2canvas(cardElement, {
                    scale: 4,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false
                });
                
                const base64Data = canvas.toDataURL('image/png').split(',')[1];
                const filename = `VSA_ID_${emp.id}_${emp.name.replace(/\s+/g, '_')}.png`;
                zip.file(filename, base64Data, {base64: true});
                renderCount++;
            } catch (err) {
                console.error(`Failed to generate image for ${emp.id}`, err);
            }
        }
    }

    if (renderCount > 0) {
        try {
            const content = await zip.generateAsync({type: 'blob'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = `VSA_Bulk_ID_Cards_${new Date().toISOString().substring(0, 10)}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (err) {
            console.error("ZIP packaging error:", err);
            alert("Failed to build ZIP archive. Please retry.");
        }
    } else {
        alert("No ID Cards could be successfully rendered.");
    }

    bulkContainer.innerHTML = '';
    bulkContainer.style.position = '';
    bulkContainer.style.left = '';
    bulkContainer.style.top = '';
    bulkContainer.style.display = '';
    bulkContainer.classList.add('hidden');

    document.getElementById('btn-bulk-download').disabled = false;
    document.getElementById('btn-bulk-download').innerHTML = originalBtnText;
    lucide.createIcons();
}


let STUDIO_STATE = {
    activeTemplate: null,
    activeSide: 'front',
    zoom: 1.0,
    snapGrid: true,
    gridSize: 5,
    showMargins: true,
    selectedElementId: null,
    isDragging: false,
    isResizing: false,
    isRotating: false,
    dragStart: { x: 0, y: 0 },
    dragOffset: { x: 0, y: 0 },
    resizeHandle: null,
    initialElementState: null,
    initialMouseAngle: 0,
    clipboard: null,
    uploads: [],
    brandKits: [
        { name: "VSA Luxury Gold", primary: "#0f1218", accent: "#d4af37", text: "#ffffff" },
        { name: "VSA Forest Green", primary: "#0e3e2b", accent: "#52b788", text: "#ffffff" },
        { name: "Navy Guard", primary: "#0b1d33", accent: "#e2b23c", text: "#ffffff" },
        { name: "Steel Patrol", primary: "#1f2937", accent: "#9ca3af", text: "#ffffff" },
        { name: "High Vis Rescue", primary: "#1e293b", accent: "#f97316", text: "#ffffff" }
    ],
    logoPresets: [
        {
            name: "Classic Shield",
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50,10 L85,25 L85,55 C85,75 50,90 50,90 C50,90 15,75 15,55 L15,25 Z" fill="%230f1218" stroke="%23d4af37" stroke-width="4"/><path d="M50,20 L75,32 L75,55 C75,70 50,80 50,80 C50,80 25,70 25,55 L25,32 Z" fill="none" stroke="%23d4af37" stroke-width="1.5" stroke-dasharray="3,3"/><text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="22" fill="%23d4af37" text-anchor="middle">VSA</text></svg>'
        },
        {
            name: "Star Seal",
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="45" fill="%230e3e2b" stroke="%2352b788" stroke-width="4"/><circle cx="50" cy="50" r="38" fill="none" stroke="%2352b788" stroke-width="1" stroke-dasharray="2,2"/><polygon points="50,15 60,35 82,38 66,54 70,76 50,65 30,76 34,54 18,38 40,35" fill="%2352b788" opacity="0.3"/><text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="24" fill="%23ffffff" text-anchor="middle">VSA</text></svg>'
        },
        {
            name: "Eagle Wings",
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M10,40 Q30,10 50,35 Q70,10 90,40 Q50,70 10,40 Z" fill="%231f2937" stroke="%239ca3af" stroke-width="2"/><circle cx="50" cy="40" r="15" fill="%239ca3af"/><text x="50" y="46" font-family="sans-serif" font-weight="bold" font-size="16" fill="%231f2937" text-anchor="middle">VS</text></svg>'
        }
    ]
};

function snapToGrid(val) {
    if (!STUDIO_STATE.snapGrid) return val;
    return Math.round(val / STUDIO_STATE.gridSize) * STUDIO_STATE.gridSize;
}

function convertToVisualTemplate(template) {
    template.isVisualTemplate = true;
    template.width = template.layout === 'horizontal' ? 530 : 336;
    template.height = template.layout === 'horizontal' ? 336 : 530;
    template.backgroundColor = template.backgroundColor || '#ffffff';
    template.backgroundImage = template.backgroundImage || '';
    template.watermark = template.watermark || { enabled: false, src: 'logo', mode: 'center', opacity: 0.1, scale: 0.5 };

    const w = template.width;
    const h = template.height;

    // Default front side components
    template.frontElements = [
        {
            id: `el-${Date.now()}-1`,
            type: 'shape',
            shapeType: 'rect',
            left: 0,
            top: 0,
            width: w,
            height: 75,
            fill: template.headerBgColor || '#0e3e2b',
            stroke: 'transparent',
            strokeWidth: 0,
            borderRadius: 0,
            zIndex: 1,
            locked: true
        },
        {
            id: `el-${Date.now()}-2`,
            type: 'text',
            text: template.headerText || 'VALLEY SECURITY AGENCY',
            fontFamily: "'Outfit', sans-serif",
            fontSize: 14,
            fontWeight: '700',
            color: '#ffffff',
            textAlign: 'center',
            left: 10,
            top: 15,
            width: w - 20,
            height: 20,
            zIndex: 2,
            locked: true
        },
        {
            id: `el-${Date.now()}-3`,
            type: 'text',
            text: template.subheaderText || 'SHAHIDGUNJ SRINAGAR KASHMIR',
            fontFamily: "'Inter', sans-serif",
            fontSize: 8,
            fontWeight: '500',
            color: template.accentColor || '#dfba5f',
            textAlign: 'center',
            left: 10,
            top: 38,
            width: w - 20,
            height: 15,
            zIndex: 2,
            locked: true
        },
        {
            id: `el-${Date.now()}-4`,
            type: 'image',
            imageType: 'photo',
            left: Math.round((w - 100) / 2),
            top: 95,
            width: 100,
            height: 120,
            borderRadius: 8,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-5`,
            type: 'text',
            text: '{{employee_name}}',
            fontFamily: "'Outfit', sans-serif",
            fontSize: 16,
            fontWeight: '700',
            color: '#0e3e2b',
            textAlign: 'center',
            left: 10,
            top: 225,
            width: w - 20,
            height: 24,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-6`,
            type: 'text',
            text: '{{designation}}',
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: '600',
            color: '#888888',
            textAlign: 'center',
            left: 10,
            top: 250,
            width: w - 20,
            height: 16,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-7`,
            type: 'text',
            text: 'STAFF ID: {{employee_id}}',
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: '500',
            color: '#1a1a1a',
            textAlign: 'left',
            left: 30,
            top: 280,
            width: w - 60,
            height: 18,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-8`,
            type: 'text',
            text: 'DEPT: {{department}}',
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: '500',
            color: '#1a1a1a',
            textAlign: 'left',
            left: 30,
            top: 300,
            width: w - 60,
            height: 18,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-9`,
            type: 'text',
            text: 'FATHER: {{guardian_name}}',
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: '500',
            color: '#1a1a1a',
            textAlign: 'left',
            left: 30,
            top: 320,
            width: w - 60,
            height: 18,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-10`,
            type: 'text',
            text: 'PHONE: {{phone}}',
            fontFamily: "'Inter', sans-serif",
            fontSize: 10,
            fontWeight: '500',
            color: '#1a1a1a',
            textAlign: 'left',
            left: 30,
            top: 340,
            width: w - 60,
            height: 18,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-11`,
            type: 'text',
            text: 'ADDRESS: {{address}}',
            fontFamily: "'Inter', sans-serif",
            fontSize: 9,
            fontWeight: '500',
            color: '#1a1a1a',
            textAlign: 'left',
            left: 30,
            top: 360,
            width: w - 60,
            height: 35,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-12`,
            type: 'qrcode',
            widgetType: 'verification',
            left: w - 95,
            top: 415,
            width: 70,
            height: 70,
            bgColor: '#ffffff',
            fgColor: '#000000',
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-13`,
            type: 'image',
            imageType: 'signature',
            left: 30,
            top: 415,
            width: 100,
            height: 35,
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-14`,
            type: 'shape',
            shapeType: 'rect',
            left: 30,
            top: 453,
            width: 100,
            height: 1,
            fill: '#888888',
            zIndex: 3
        },
        {
            id: `el-${Date.now()}-15`,
            type: 'text',
            text: 'Authority Signature',
            fontFamily: "'Inter', sans-serif",
            fontSize: 8,
            fontWeight: '500',
            color: '#888888',
            textAlign: 'center',
            left: 30,
            top: 457,
            width: 100,
            height: 12,
            zIndex: 3
        }
    ];

    // Default back side components
    template.backElements = [
        {
            id: `el-${Date.now()}-b1`,
            type: 'text',
            text: 'TERMS & CONDITIONS',
            fontFamily: "'Outfit', sans-serif",
            fontSize: 12,
            fontWeight: '700',
            color: template.headerBgColor || '#0e3e2b',
            textAlign: 'center',
            left: 20,
            top: 25,
            width: w - 40,
            height: 20,
            zIndex: 1
        },
        {
            id: `el-${Date.now()}-b2`,
            type: 'text',
            text: '1. This card is property of Valley Security Agency.\n2. Card must be displayed at all times on duty.\n3. If found, please return to nearest branch office.\n4. Any misuse will lead to immediate suspension and legal action.',
            fontFamily: "'Inter', sans-serif",
            fontSize: 8,
            fontWeight: '500',
            color: '#444444',
            textAlign: 'left',
            left: 20,
            top: 55,
            width: w - 40,
            height: 80,
            zIndex: 1
        },
        {
            id: `el-${Date.now()}-b3`,
            type: 'text',
            text: 'PSARA License No:\nPSA | L | 99 | JK | 2024 | DEC',
            fontFamily: "'Outfit', sans-serif",
            fontSize: 8,
            fontWeight: '700',
            color: '#0e3e2b',
            textAlign: 'center',
            left: 20,
            top: 150,
            width: w - 40,
            height: 30,
            zIndex: 1
        },
        {
            id: `el-${Date.now()}-b4`,
            type: 'text',
            text: 'In Case of Emergency, Contact:\nPhone: 7889311608 | 7006810234',
            fontFamily: "'Inter', sans-serif",
            fontSize: 8,
            fontWeight: '600',
            color: '#ea580c',
            textAlign: 'center',
            left: 20,
            top: 190,
            width: w - 40,
            height: 30,
            zIndex: 1
        },
        {
            id: `el-${Date.now()}-b5`,
            type: 'barcode',
            widgetType: 'verification',
            left: Math.round((w - 180) / 2),
            top: 240,
            width: 180,
            height: 50,
            bgColor: '#ffffff',
            fgColor: '#000000',
            zIndex: 1
        },
        {
            id: `el-${Date.now()}-b6`,
            type: 'shape',
            shapeType: 'rect',
            left: 0,
            top: h - 30,
            width: w,
            height: 30,
            fill: template.headerBgColor || '#0e3e2b',
            zIndex: 1,
            locked: true
        },
        {
            id: `el-${Date.now()}-b7`,
            type: 'text',
            text: 'VALLEY SECURITY SYSTEMS',
            fontFamily: "'Outfit', sans-serif",
            fontSize: 8,
            fontWeight: '600',
            color: '#ffffff',
            textAlign: 'center',
            left: 10,
            top: h - 22,
            width: w - 20,
            height: 15,
            zIndex: 2,
            locked: true
        }
    ];

    return template;
}

function renderTemplatesList() {
    const tbody = document.getElementById('templates-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Auto-load first template if none is active
    if (!STUDIO_STATE.activeTemplate && VSA_STATE.templates && VSA_STATE.templates.length > 0) {
        loadTemplateInStudio(VSA_STATE.templates[0].id);
    }

    if (!VSA_STATE.templates || VSA_STATE.templates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center placeholder-message">No templates registered yet.</td></tr>';
        return;
    }

    VSA_STATE.templates.forEach(t => {
        const row = document.createElement('tr');
        const isDefault = t.id === 'tpl-default';
        row.innerHTML = `
            <td><strong>${t.name}</strong> ${isDefault ? '<span class="badge badge-active" style="padding: 2px 6px; font-size: 9px; margin-left: 5px;">Default</span>' : ''}</td>
            <td><span class="badge" style="background: rgba(255,255,255,0.05); color: #ffffff;">${t.layout === 'vertical' ? 'Vertical' : 'Horizontal'}</span></td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-xs btn-outline btn-edit-template" data-id="${t.id}">Edit</button>
                    ${!isDefault ? `<button class="btn btn-xs btn-outline btn-delete-template" data-id="${t.id}" style="color: var(--status-suspended); border-color: rgba(255, 46, 147, 0.15)">Delete</button>` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.querySelectorAll('.btn-edit-template').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            loadTemplateInStudio(id);
        });
    });

    document.querySelectorAll('.btn-delete-template').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            deleteTemplate(id);
        });
    });
}

function getSelectedElement() {
    if (!STUDIO_STATE.activeTemplate || !STUDIO_STATE.selectedElementId) return null;
    const elements = STUDIO_STATE.activeSide === 'front' ? STUDIO_STATE.activeTemplate.frontElements : STUDIO_STATE.activeTemplate.backElements;
    return elements.find(el => el.id === STUDIO_STATE.selectedElementId);
}

const MOCK_GUARD = {
    id: "VS-0042",
    name: "Vikram Singh",
    designation: "Head Security Guard",
    department: "Security Operations",
    fatherName: "Karan Singh",
    mobile: "+91 98765 43210",
    bloodGroup: "O+",
    currentAddress: "Sector 4, Police Line, Srinagar, J&K, 190001",
    joiningDate: "2024-05-15",
    documents: {
        photo: "",
        signature: ""
    }
};

function loadTemplateInStudio(id) {
    const tplSource = VSA_STATE.templates.find(t => t.id === id) || VSA_STATE.templates[0];
    if (!tplSource) return;

    // Deep clone template to avoid direct mutation of state list
    const tpl = JSON.parse(JSON.stringify(tplSource));

    document.getElementById('tpl-id').value = tpl.id || '';
    document.getElementById('tpl-name').value = tpl.name || '';
    document.getElementById('tpl-layout').value = tpl.layout || 'vertical';
    document.getElementById('tpl-font').value = tpl.font || "'Outfit', sans-serif";
    document.getElementById('tpl-bg-color').value = tpl.backgroundColor || '#ffffff';
    document.getElementById('tpl-header-bg').value = tpl.headerBgColor || '#0e3e2b';
    document.getElementById('tpl-accent-color').value = tpl.accentColor || '#dfba5f';
    document.getElementById('tpl-header-text').value = tpl.headerText || '';
    document.getElementById('tpl-subheader-text').value = tpl.subheaderText || '';

    // Load sizes range sliders
    const logoSizeVal = tpl.logoSize || 50;
    document.getElementById('tpl-logo-size').value = logoSizeVal;
    document.getElementById('lbl-logo-size').textContent = logoSizeVal;

    const headerHeightVal = tpl.headerHeight || 90;
    document.getElementById('tpl-header-height').value = headerHeightVal;
    document.getElementById('lbl-header-height').textContent = headerHeightVal;

    const headerFontSizeVal = tpl.headerFontSize || 14;
    document.getElementById('tpl-header-font-size').value = headerFontSizeVal;
    document.getElementById('lbl-header-font-size').textContent = headerFontSizeVal;

    // Active background pattern preset
    document.querySelectorAll('.btn-bg-preset').forEach(btn => {
        if (btn.getAttribute('data-bg') === (tpl.backgroundImage || '')) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Active logo preset/upload
    document.querySelectorAll('.btn-logo-preset').forEach(btn => {
        if (btn.getAttribute('data-logo') === tpl.logo) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    if (tpl.logo && !tpl.logo.startsWith('preset-')) {
        document.querySelectorAll('.btn-logo-preset').forEach(btn => btn.classList.remove('active'));
        VSA_STATE.customLogoBase64 = tpl.logo;
        document.getElementById('tpl-logo-filename').textContent = "Custom logo loaded";
    } else {
        VSA_STATE.customLogoBase64 = null;
        document.getElementById('tpl-logo-filename').textContent = "";
    }

    // Active signature preset/upload
    document.querySelectorAll('.btn-sig-preset').forEach(btn => {
        if (btn.getAttribute('data-sig') === tpl.signature) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    if (tpl.signature && !tpl.signature.startsWith('preset-')) {
        document.querySelectorAll('.btn-sig-preset').forEach(btn => btn.classList.remove('active'));
        VSA_STATE.customSigBase64 = tpl.signature;
        document.getElementById('tpl-sig-filename').textContent = "Custom signature loaded";
    } else {
        VSA_STATE.customSigBase64 = null;
        document.getElementById('tpl-sig-filename').textContent = "";
    }

    // Checkboxes toggles
    const fields = tpl.fields || {};
    document.getElementById('field-tpl-photo').checked = fields.photo !== false;
    document.getElementById('field-tpl-name').checked = fields.name !== false;
    document.getElementById('field-tpl-designation').checked = fields.designation !== false;
    document.getElementById('field-tpl-department').checked = fields.department !== false;
    document.getElementById('field-tpl-empid').checked = fields.empid !== false;
    document.getElementById('field-tpl-father').checked = fields.father !== false;
    document.getElementById('field-tpl-phone').checked = fields.phone !== false;
    document.getElementById('field-tpl-blood').checked = fields.blood !== false;
    document.getElementById('field-tpl-address').checked = fields.address !== false;
    document.getElementById('field-tpl-signature').checked = fields.signature !== false;
    document.getElementById('field-tpl-qrcode').checked = fields.qrcode !== false;
    document.getElementById('field-tpl-barcode').checked = fields.barcode !== false;

    updateLivePreview();
}

function getActiveTemplateFromForm() {
    const id = document.getElementById('tpl-id').value;
    const name = document.getElementById('tpl-name').value.trim() || 'Standard Guard Card';
    const layout = document.getElementById('tpl-layout').value;
    const font = document.getElementById('tpl-font').value;
    const backgroundColor = document.getElementById('tpl-bg-color').value;
    const headerBgColor = document.getElementById('tpl-header-bg').value;
    const accentColor = document.getElementById('tpl-accent-color').value;
    const headerText = document.getElementById('tpl-header-text').value.trim() || 'VALLEY SECURITY AGENCY';
    const subheaderText = document.getElementById('tpl-subheader-text').value.trim() || 'SHAHIDGUNJ SRINAGAR';

    // Retrieve sizes range sliders
    const logoSize = parseInt(document.getElementById('tpl-logo-size').value) || 50;
    const headerHeight = parseInt(document.getElementById('tpl-header-height').value) || 90;
    const headerFontSize = parseInt(document.getElementById('tpl-header-font-size').value) || 14;

    // Active background pattern preset
    const activeBgBtn = document.querySelector('.btn-bg-preset.active');
    const backgroundImage = activeBgBtn ? activeBgBtn.getAttribute('data-bg') : '';

    // Active logo preset or custom
    const activeLogoBtn = document.querySelector('.btn-logo-preset.active');
    let logo = activeLogoBtn ? activeLogoBtn.getAttribute('data-logo') : '';
    if (!logo) {
        logo = VSA_STATE.customLogoBase64 || 'preset-shield';
    }

    // Active signature preset or custom
    const activeSigBtn = document.querySelector('.btn-sig-preset.active');
    let signature = activeSigBtn ? activeSigBtn.getAttribute('data-sig') : '';
    if (!signature) {
        signature = VSA_STATE.customSigBase64 || 'preset-sig1';
    }

    // Checkboxes
    const fields = {
        photo: document.getElementById('field-tpl-photo').checked,
        name: document.getElementById('field-tpl-name').checked,
        designation: document.getElementById('field-tpl-designation').checked,
        department: document.getElementById('field-tpl-department').checked,
        empid: document.getElementById('field-tpl-empid').checked,
        father: document.getElementById('field-tpl-father').checked,
        phone: document.getElementById('field-tpl-phone').checked,
        blood: document.getElementById('field-tpl-blood').checked,
        address: document.getElementById('field-tpl-address').checked,
        signature: document.getElementById('field-tpl-signature').checked,
        qrcode: document.getElementById('field-tpl-qrcode').checked,
        barcode: document.getElementById('field-tpl-barcode').checked
    };

    return {
        id,
        name,
        layout,
        font,
        backgroundColor,
        headerBgColor,
        accentColor,
        headerText,
        subheaderText,
        logoSize,
        headerHeight,
        headerFontSize,
        backgroundImage,
        logo,
        signature,
        fields,
        isVisualTemplate: true
    };
}

function updateLivePreview() {
    const container = document.getElementById('live-tpl-preview-container');
    if (!container) return;

    const activeTpl = getActiveTemplateFromForm();
    const previewEmp = VSA_STATE.employees.length > 0 ? VSA_STATE.employees[0] : MOCK_GUARD;
    
    container.innerHTML = generateIdCardHtml(previewEmp, activeTpl);
    renderQrsInContainer(container);
}

async function deleteTemplate(id) {
    try {
        const response = await fetch(`/api/templates/${id}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('API delete error');
        
        VSA_STATE.templates = VSA_STATE.templates.filter(t => t.id !== id);
        renderTemplatesList();
        populateSelectors();
        
        // Reset form if deleted template was active in editor
        const activeId = document.getElementById('tpl-id').value;
        if (activeId === id) {
            resetTemplateForm();
        }
        alert('Template deleted successfully.');
    } catch (err) {
        console.error("Error deleting template:", err);
        alert('Failed to delete template.');
    }
}

async function saveTemplate() {
    const activeTpl = getActiveTemplateFromForm();
    if (!activeTpl.name) {
        alert('Please enter a template name.');
        return;
    }

    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activeTpl)
        });

        if (!response.ok) throw new Error('API save error');
        const savedTpl = await response.json();

        const idx = VSA_STATE.templates.findIndex(t => t.id === savedTpl.id);
        if (idx !== -1) {
            VSA_STATE.templates[idx] = savedTpl;
        } else {
            VSA_STATE.templates.push(savedTpl);
        }

        renderTemplatesList();
        populateSelectors();
        
        // Load the saved template to sync state
        loadTemplateInStudio(savedTpl.id);
        alert('Template saved successfully!');
    } catch (err) {
        console.error("Error saving template:", err);
        alert('Failed to save template.');
    }
}

function resetTemplateForm() {
    document.getElementById('tpl-id').value = '';
    document.getElementById('tpl-name').value = '';
    document.getElementById('tpl-layout').value = 'vertical';
    document.getElementById('tpl-font').value = "'Outfit', sans-serif";
    document.getElementById('tpl-bg-color').value = '#ffffff';
    document.getElementById('tpl-header-bg').value = '#0e3e2b';
    document.getElementById('tpl-accent-color').value = '#dfba5f';
    document.getElementById('tpl-header-text').value = '';
    document.getElementById('tpl-subheader-text').value = '';

    // Reset range sliders
    document.getElementById('tpl-logo-size').value = 50;
    document.getElementById('lbl-logo-size').textContent = 50;

    document.getElementById('tpl-header-height').value = 90;
    document.getElementById('lbl-header-height').textContent = 90;

    document.getElementById('tpl-header-font-size').value = 14;
    document.getElementById('lbl-header-font-size').textContent = 14;

    VSA_STATE.customLogoBase64 = null;
    VSA_STATE.customSigBase64 = null;
    document.getElementById('tpl-logo-filename').textContent = "";
    document.getElementById('tpl-sig-filename').textContent = "";

    // Set presets back to default
    document.querySelectorAll('.btn-bg-preset').forEach(btn => btn.classList.remove('active'));
    const defaultBgBtn = document.querySelector('.btn-bg-preset[data-bg=""]');
    if (defaultBgBtn) defaultBgBtn.classList.add('active');

    document.querySelectorAll('.btn-logo-preset').forEach(btn => btn.classList.remove('active'));
    const defaultLogoBtn = document.querySelector('.btn-logo-preset[data-logo="preset-shield"]');
    if (defaultLogoBtn) defaultLogoBtn.classList.add('active');

    document.querySelectorAll('.btn-sig-preset').forEach(btn => btn.classList.remove('active'));
    const defaultSigBtn = document.querySelector('.btn-sig-preset[data-sig="preset-sig1"]');
    if (defaultSigBtn) defaultSigBtn.classList.add('active');

    // All checkboxes enabled by default
    document.querySelectorAll('.field-toggles-grid input[type="checkbox"]').forEach(chk => chk.checked = true);

    updateLivePreview();
}

function setupTemplatesManager() {
    // 1. Text and value listeners
    const inputs = ['tpl-name', 'tpl-header-text', 'tpl-subheader-text'];
    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateLivePreview);
    });

    const selects = ['tpl-layout', 'tpl-font'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateLivePreview);
    });

    const colors = ['tpl-bg-color', 'tpl-header-bg', 'tpl-accent-color'];
    colors.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateLivePreview);
    });

    // 1B. Range sliders listeners
    const rangeSliders = ['tpl-logo-size', 'tpl-header-height', 'tpl-header-font-size'];
    rangeSliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function() {
                const val = this.value;
                if (id === 'tpl-logo-size') document.getElementById('lbl-logo-size').textContent = val;
                if (id === 'tpl-header-height') document.getElementById('lbl-header-height').textContent = val;
                if (id === 'tpl-header-font-size') document.getElementById('lbl-header-font-size').textContent = val;
                updateLivePreview();
            });
        }
    });

    // 2. Checkboxes listeners
    document.querySelectorAll('.field-toggles-grid input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', updateLivePreview);
    });

    // 3. Preset background patterns listeners
    document.querySelectorAll('.btn-bg-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-bg-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateLivePreview();
        });
    });

    // 4. Preset logo listeners
    document.querySelectorAll('.btn-logo-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-logo-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Clear custom upload preview
            VSA_STATE.customLogoBase64 = null;
            document.getElementById('tpl-logo-filename').textContent = "";
            document.getElementById('tpl-logo-upload').value = "";
            
            updateLivePreview();
        });
    });

    // 5. Preset signature listeners
    document.querySelectorAll('.btn-sig-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.btn-sig-preset').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Clear custom upload preview
            VSA_STATE.customSigBase64 = null;
            document.getElementById('tpl-sig-filename').textContent = "";
            document.getElementById('tpl-sig-upload').value = "";
            
            updateLivePreview();
        });
    });

    // 6. Custom uploads listeners
    const logoUpload = document.getElementById('tpl-logo-upload');
    if (logoUpload) {
        logoUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (evt) => {
                VSA_STATE.customLogoBase64 = evt.target.result;
                document.getElementById('tpl-logo-filename').textContent = file.name;
                
                // Deactivate preset buttons
                document.querySelectorAll('.btn-logo-preset').forEach(btn => btn.classList.remove('active'));
                updateLivePreview();
            };
            reader.readAsDataURL(file);
        });
    }

    const sigUpload = document.getElementById('tpl-sig-upload');
    if (sigUpload) {
        sigUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (evt) => {
                VSA_STATE.customSigBase64 = evt.target.result;
                document.getElementById('tpl-sig-filename').textContent = file.name;
                
                // Deactivate preset buttons
                document.querySelectorAll('.btn-sig-preset').forEach(btn => btn.classList.remove('active'));
                updateLivePreview();
            };
            reader.readAsDataURL(file);
        });
    }

    // 7. Save / Reset buttons
    const btnSave = document.getElementById('btn-tpl-save');
    if (btnSave) btnSave.addEventListener('click', saveTemplate);

    const btnReset = document.getElementById('btn-tpl-reset');
    if (btnReset) btnReset.addEventListener('click', resetTemplateForm);

    const btnNew = document.getElementById('btn-tpl-new');
    if (btnNew) btnNew.addEventListener('click', resetTemplateForm);

    // Initial render / load
    if (VSA_STATE.templates && VSA_STATE.templates.length > 0) {
        loadTemplateInStudio(VSA_STATE.templates[0].id);
    } else {
        resetTemplateForm();
    }
}

