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

    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('vsa-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        themeBtn.querySelector('.theme-icon-dark').classList.add('hidden');
        themeBtn.querySelector('.theme-icon-light').classList.remove('hidden');
    }

    themeBtn.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        const isLight = document.body.classList.contains('light-theme');
        localStorage.setItem('vsa-theme', isLight ? 'light' : 'dark');

        const darkIcon = themeBtn.querySelector('.theme-icon-dark');
        const lightIcon = themeBtn.querySelector('.theme-icon-light');

        if (isLight) {
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
        VSA_STATE.clients = db.clients || [];
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
        renderClientsSection();
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

    document.getElementById('stat-total-employees').textContent = totalGuards;
    document.getElementById('stat-active-employees').textContent = activeGuards;
    document.getElementById('stat-expired-ids').textContent = expiredOrExpiring;
    document.getElementById('stat-total-clients').textContent = VSA_STATE.clients.length;



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
    
    // Count active guards per client site
    const distribution = {};
    VSA_STATE.employees.forEach(e => {
        if (e.status === 'Active' && e.clientLocation) {
            distribution[e.clientLocation] = (distribution[e.clientLocation] || 0) + 1;
        }
    });

    const entries = Object.entries(distribution);
    if (entries.length === 0) {
        container.innerHTML = '<div class="placeholder-message">No Active Deployments Tracked.</div>';
        return;
    }

    // Render gorgeous inline responsive SVG bar charts
    let svgHtml = `<svg width="100%" height="100%" viewBox="0 0 600 ${entries.length * 40 + 30}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Draw grid lines
    for (let i = 0; i <= 5; i++) {
        const x = 120 + i * 80;
        svgHtml += `<line x1="${x}" y1="10" x2="${x}" y2="${entries.length * 40 + 10}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`;
        svgHtml += `<text x="${x}" y="${entries.length * 40 + 25}" fill="#6b7280" font-size="10" text-anchor="middle">${i * 2}</text>`;
    }

    entries.forEach(([client, count], idx) => {
        const y = 20 + idx * 40;
        // Max value scale (normalizing relative width)
        const barWidth = Math.min(count * 40, 440);
        
        // Render bar gradient
        svgHtml += `
            <text x="10" y="${y + 15}" fill="#c5c6c7" font-size="12" font-weight="500">${client.substring(0, 15)}...</text>
            <rect x="120" y="${y}" width="${barWidth}" height="18" rx="4" fill="url(#goldGradient)"/>
            <text x="${130 + barWidth}" y="${y + 14}" fill="#d4af37" font-size="11" font-weight="700">${count}</text>
        `;
    });

    // Gradients def
    svgHtml += `
        <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#d4af37" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#d4af37" stop-opacity="0.9"/>
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
            <td>${emp.clientLocation || 'Not Assigned'}</td>
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
                    <div class="directory-card-client" title="${emp.clientLocation || 'HQ Standby'}">${emp.clientLocation || '<span class="text-muted">HQ Standby</span>'}</div>
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
                <td>${emp.clientLocation || '<span class="text-muted">Unassigned</span>'}</td>
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
function renderClientsSection() {
    const listContainer = document.getElementById('client-list-container');
    listContainer.innerHTML = '';

    if (VSA_STATE.clients.length === 0) {
        listContainer.innerHTML = '<p class="text-muted">No client sites registered.</p>';
        return;
    }

    VSA_STATE.clients.forEach((client, idx) => {
        // Calculate count of guards deployed
        const count = VSA_STATE.employees.filter(e => e.clientLocation === client.name && e.status === 'Active').length;

        const div = document.createElement('div');
        div.className = `client-list-item cursor-pointer ${selectedClientId === idx ? 'active' : ''}`;
        div.setAttribute('data-idx', idx);
        div.innerHTML = `
            <div class="client-item-name">${client.name}</div>
            <div class="client-item-location">${client.location} • ${count} Deployed</div>
        `;
        
        div.addEventListener('click', () => {
            selectedClientId = idx;
            renderClientsSection();
            renderSelectedClientDetails(client);
        });

        listContainer.appendChild(div);
    });
}

function renderSelectedClientDetails(client) {
    document.getElementById('client-placeholder-message').classList.add('hidden');
    document.getElementById('client-details-section').classList.remove('hidden');

    document.getElementById('current-selected-client-title').textContent = client.name;
    document.getElementById('client-meta-manager').textContent = client.manager;
    document.getElementById('client-meta-contact').textContent = client.contact;
    document.getElementById('client-meta-location').textContent = client.location;

    // Filter guards assigned to this site
    const guards = VSA_STATE.employees.filter(e => e.clientLocation === client.name);
    document.getElementById('client-guard-count').textContent = `${guards.length} Guards`;

    const tbody = document.getElementById('deployed-guards-tbody');
    tbody.innerHTML = '';

    if (guards.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center placeholder-message">No security guards currently deployed to this site.</td></tr>';
        return;
    }

    guards.forEach(g => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${g.id}</strong></td>
            <td>${g.name}</td>
            <td>${g.designation}</td>
            <td>
                <select class="deployment-reassign-select" data-empid="${g.id}">
                    <option value="${client.name}" selected>Retain Here</option>
                    ${VSA_STATE.clients.filter(c => c.name !== client.name).map(c => `
                        <option value="${c.name}">Transfer: ${c.name.substring(0, 20)}...</option>
                    `).join('')}
                    <option value="">Recall to HQ / Unassign</option>
                </select>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Wire re-assignment
    document.querySelectorAll('.deployment-reassign-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
            const empId = sel.getAttribute('data-empid');
            const targetSite = sel.value;
            reassignGuard(empId, targetSite);
        });
    });
}


// E. Selectors Populate
function populateSelectors() {
    // 2. Client selections in forms (OLD MODAL & NEW REGISTRATION FORM)
    const clientFormSel = document.getElementById('form-client');
    const regClientSel = document.getElementById('reg-client');
    
    let clientHtml = '<option value="">-- No Deployment (HQ Standby) --</option>';
    let clientHtml2 = '<option value="">Select Working Place</option>';
    
    const repClientSel = document.getElementById('rep-client');
    let repClientHtml = '<option value="">All Locations</option>';
    
    VSA_STATE.clients.forEach(c => {
        clientHtml += `<option value="${c.name}">${c.name}</option>`;
        clientHtml2 += `<option value="${c.name}">${c.name}</option>`;
        repClientHtml += `<option value="${c.name}">${c.name}</option>`;
    });
    
    if (clientFormSel) clientFormSel.innerHTML = clientHtml;
    if (regClientSel) regClientSel.innerHTML = clientHtml2;
    if (repClientSel) repClientSel.innerHTML = repClientHtml;



    // 4. ID Card Employee Select & Filters
    const idFilterLocSel = document.getElementById('id-filter-location');
    if (idFilterLocSel) {
        idFilterLocSel.innerHTML = '<option value="">All Locations</option>';
        VSA_STATE.clients.forEach(c => {
            idFilterLocSel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
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
    const recFilterLocSel = document.getElementById('rec-filter-location');
    if (recFilterLocSel) {
        recFilterLocSel.innerHTML = '<option value="">All Locations</option>';
        VSA_STATE.clients.forEach(c => {
            recFilterLocSel.innerHTML += `<option value="${c.name}">${c.name}</option>`;
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
    const locationVal = document.getElementById('id-filter-location')?.value || '';
    const designationVal = document.getElementById('id-filter-designation')?.value || '';

    const filtered = VSA_STATE.employees.filter(emp => {
        const matchesSearch = !searchVal || 
                              emp.name.toLowerCase().includes(searchVal) || 
                              emp.id.toLowerCase().includes(searchVal);
        const matchesLocation = !locationVal || emp.clientLocation === locationVal;
        const matchesDesignation = !designationVal || emp.designation === designationVal;

        return matchesSearch && matchesLocation && matchesDesignation;
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
                        <span class="id-checklist-item-sub">${emp.id} | ${emp.designation} | ${emp.clientLocation || 'HQ'}</span>
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
        document.getElementById('form-client').value = emp.clientLocation || '';
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
        clientLocation: document.getElementById('form-client').value,
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
async function submitClientSite(event) {
    event.preventDefault();
    
    const clientData = {
        name: document.getElementById('form-client-name').value,
        location: document.getElementById('form-client-location').value,
        manager: document.getElementById('form-client-manager').value,
        contact: document.getElementById('form-client-contact').value
    };

    try {
        const response = await fetch('/api/clients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clientData)
        });
        if (!response.ok) throw new Error('Client creation failed');
        
        document.getElementById('client-modal').classList.add('hidden');
        fetchData();
    } catch (err) {
        alert(err.message);
    }
}

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
    if (!template) {
        template = {
            layout: 'vertical',
            headerText: 'VALLEY SECURITY SERVICES',
            subheaderText: 'ShahidGunj Srinagar Kashmir',
            headerBgColor: '#0f1218',
            accentColor: '#d4af37',
            logo: '',
            background: '',
            signature: '',
            fields: {
                name: true,
                employeeId: true,
                designation: true,
                department: true,
                fatherName: true,
                phone: true,
                bloodGroup: true,
                address: true
            }
        };
    }

    // Helper to determine if a color is light or dark to switch text color dynamically
    const isColorLight = (hexColor) => {
        if (!hexColor) return false;
        const hex = hexColor.replace('#', '');
        if (hex.length === 3) {
            const r = parseInt(hex[0] + hex[0], 16);
            const g = parseInt(hex[1] + hex[1], 16);
            const b = parseInt(hex[2] + hex[2], 16);
            return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
        } else if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return (r * 0.299 + g * 0.587 + b * 0.114) > 186;
        }
        const lightNames = ['white', 'lightgray', 'gray', 'yellow', 'lightgrey'];
        if (lightNames.includes(hexColor.toLowerCase())) return true;
        return false;
    };

    const headerBg = template.headerBgColor || '#ffffff';
    const isLightHeader = isColorLight(headerBg);
    const headerTitleColor = isLightHeader ? '#111111' : '#ffffff';
    const headerSubtitleColor = isLightHeader ? '#555555' : 'rgba(255, 255, 255, 0.8)';

    const issueDate = new Date(emp.joiningDate || new Date());
    const expDate = new Date(issueDate);
    expDate.setFullYear(issueDate.getFullYear() + validityYears);
    const validityStr = `${formatDateDDMMYYYY(issueDate)} - ${formatDateDDMMYYYY(expDate)}`;

    const getFallbackAvatarData = (initial) => {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='120' viewBox='0 0 100 120'><defs><linearGradient id='avatarGrad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23d4af37'/><stop offset='100%' stop-color='%230f1218'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23avatarGrad)'/><text x='50%' y='55%' font-family='sans-serif' font-weight='bold' font-size='32' fill='%23ffffff' text-anchor='middle'>${initial}</text></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getFallbackLogoData = (color) => {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'><rect width='100' height='100' fill='none'/><circle cx='50' cy='50' r='40' stroke='${color}' stroke-width='4' fill='none'/><text x='50' y='58' font-family='sans-serif' font-weight='900' font-size='24' fill='${color}' text-anchor='middle'>VS</text></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const logoSrc = template.logo || getFallbackLogoData(template.accentColor || '#d4af37');
    
    let bgStyle = `background: #ffffff;`;
    if (template.background) {
        bgStyle = `background: url('${template.background}') no-repeat center center; background-size: cover;`;
    }

    let photoHtml = `<span class="photo-placeholder">No Photo</span>`;
    if (emp.documents && emp.documents.photo) {
        photoHtml = `<img src="${emp.documents.photo}" alt="Employee Photo" class="employee-photo">`;
    } else {
        const initial = emp.name ? emp.name[0].toUpperCase() : '?';
        photoHtml = `<img src="${getFallbackAvatarData(initial)}" class="employee-photo">`;
    }

    let sigHtml = `<span class="sig-placeholder">Signature Scan</span>`;
    if (emp.documents && emp.documents.signature) {
        sigHtml = `<img src="${emp.documents.signature}" alt="Signature" class="signature-img">`;
    } else if (template.signature) {
        sigHtml = `<img src="${template.signature}" alt="Signature" class="signature-img">`;
    }

    const verificationUrl = `${window.location.protocol}//${VSA_STATE.lanIp}/verification.html?id=${emp.id}`;

    if (template.layout === 'horizontal') {
        return `
        <div class="id-card-horizontal" style="${bgStyle} border-color: ${template.accentColor};">
            <div class="id-portrait-header" style="border-bottom: 2px solid ${template.accentColor}; background: ${template.headerBgColor}; padding: 6px 12px; margin: -12px -12px 8px -12px; border-radius: 10px 10px 0 0; display: flex; align-items: center; gap: 12px;">
                <div class="id-portrait-logo" style="width: 85px; height: 85px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <img src="${logoSrc}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
                <div class="id-portrait-brand" style="flex-grow: 1;">
                    <h1 class="id-portrait-title" style="color: ${headerTitleColor}; font-size: 20px; font-weight: 900; margin: 0; line-height: 1.1; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.8px;">${template.headerText}</h1>
                    <p class="id-portrait-subtitle" style="color: ${headerSubtitleColor}; font-size: 10px; margin: 3px 0 0 0; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">${template.subheaderText || ''}</p>
                    <p class="id-portrait-contact" style="color: ${headerTitleColor}; font-size: 9px; margin: 3px 0 0 0; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 900;">PH: 7889311608 | EMAIL: VLLSCRTSERVICE@GMAIL.COM</p>
                </div>
            </div>
            
            <div class="id-horizontal-body">
                <div class="id-horizontal-left">
                    <div class="id-portrait-photo-box" style="border-color: ${template.accentColor}; width: 100px; height: 120px; margin-bottom: 4px; overflow: hidden; display: flex; justify-content: center; align-items: center;">
                        ${photoHtml}
                    </div>
                    <div class="id-portrait-qr" style="width: 60px; height: 60px;">
                        <canvas class="qr-canvas-rendered" data-qr-val="${verificationUrl}" style="width: 60px; height: 60px;"></canvas>
                    </div>
                </div>
                
                <div class="id-horizontal-right">
                    <div class="id-portrait-meta">
                        ${template.fields.name ? `<h2 class="id-portrait-name" style="font-size: 15px; font-weight: 800; margin: 0 0 2px 0; color: #111111; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 350px;">${emp.name}</h2>` : ''}
                        ${template.fields.designation ? `<h3 class="id-portrait-designation" style="font-size: 11px; font-weight: 700; color: ${template.accentColor}; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 350px;">${emp.designation}</h3>` : ''}
                    </div>
                    
                    <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                        ${template.fields.employeeId ? `<tr>
                            <td class="id-table-label" style="font-size: 12px; font-weight: bold; color: #666666; width: 100px; padding: 1.5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Staff ID:</td>
                            <td class="id-table-value" style="font-size: 12px; font-weight: bold; color: #000000; padding: 1.5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.id}</td>
                        </tr>` : ''}
                        ${template.fields.department ? `<tr>
                            <td class="id-table-label" style="font-size: 12px; font-weight: bold; color: #666666; width: 100px; padding: 1.5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Site/Dept:</td>
                            <td class="id-table-value" style="font-size: 12px; color: #000000; padding: 1.5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.clientLocation || emp.department || 'Reserve'}</td>
                        </tr>` : ''}
                        ${template.fields.fatherName ? `<tr>
                            <td class="id-table-label" style="font-size: 12px; font-weight: bold; color: #666666; width: 100px; padding: 1.5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${emp.relationType || 'Father'}'s Name:</td>
                            <td class="id-table-value" style="font-size: 12px; color: #000000; padding: 1.5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.fatherName || '-'}</td>
                        </tr>` : ''}
                        <tr>
                            <td class="id-table-label" style="font-size: 12px; font-weight: bold; color: #666666; width: 100px; padding: 1.5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Phone:</td>
                            <td class="id-table-value" style="font-size: 12px; color: #000000; padding: 1.5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.mobile || '-'}</td>
                        </tr>
                        ${template.fields.bloodGroup ? `<tr>
                            <td class="id-table-label" style="font-size: 12px; font-weight: bold; color: #666666; width: 100px; padding: 1.5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Blood Group:</td>
                            <td class="id-table-value" style="font-size: 12px; color: #000000; padding: 1.5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.bloodGroup || '-'}</td>
                        </tr>` : ''}
                        ${template.fields.address ? `<tr>
                            <td class="id-table-label" style="font-size: 12px; font-weight: bold; color: #666666; width: 100px; padding: 1.5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Address:</td>
                            <td class="id-table-value" style="font-size: 12px; color: #000000; padding: 1.5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.currentAddress || emp.permanentAddress || '-'}</td>
                        </tr>` : ''}
                        <tr>
                            <td class="id-table-label" style="font-size: 12px; font-weight: bold; color: #666666; width: 100px; padding: 1.5px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Validity:</td>
                            <td class="id-table-value" style="font-size: 12px; font-weight: bold; color: #000000; padding: 1.5px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${validityStr}</td>
                        </tr>
                    </table>
                    
                    <div class="id-portrait-signature-box" style="margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #dddddd; padding-top: 2px;">
                        <span style="font-size: 7px; color: #888888; font-style: italic;">Authority Signature</span>
                        <div class="id-portrait-signature" style="width: 80px; height: 25px; border: none;">
                            ${sigHtml}
                        </div>
                    </div>

                    <!-- Footer spacing -->
                    <div style="height: 2px;"></div>
                </div>
            </div>
        </div>
        `;
    } else {
        return `
        <div class="id-card-portrait" style="${bgStyle} border-color: ${template.accentColor};">
            <div class="id-portrait-header" style="border-bottom: 2px solid ${template.accentColor}; background: ${template.headerBgColor}; padding: 8px; margin: -15px -15px 12px -15px; border-radius: 10px 10px 0 0; display: flex; align-items: center; gap: 12px;">
                <div class="id-portrait-logo" style="width: 72px; height: 72px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <img src="${logoSrc}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                </div>
                <div class="id-portrait-brand" style="flex-grow: 1;">
                    <h1 class="id-portrait-title" style="color: ${headerTitleColor}; font-size: 17.5px; font-weight: 900; margin: 0; line-height: 1.1; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.8px;">${template.headerText}</h1>
                    <p class="id-portrait-subtitle" style="color: ${headerSubtitleColor}; font-size: 9px; margin: 3px 0 0 0; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">${template.subheaderText || ''}</p>
                    <p class="id-portrait-contact" style="color: ${headerTitleColor}; font-size: 8px; margin: 3px 0 0 0; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 900;">PH: 7889311608 | EMAIL: VLLSCRTSERVICE@GMAIL.COM</p>
                </div>
            </div>
            
            <div class="id-portrait-photo-box" style="border-color: ${template.accentColor}; width: 112px; height: 134px; margin: 0 auto 12px auto; overflow: hidden; display: flex; justify-content: center; align-items: center; border-radius: 6px; border: 1.5px solid rgba(var(--theme-accent-rgb), 0.2);">
                ${photoHtml}
            </div>
            
            <div class="id-portrait-meta" style="text-align: center; margin-bottom: 10px;">
                ${template.fields.name ? `<h2 class="id-portrait-name" style="font-size: 17px; font-weight: 800; margin: 0 0 3px 0; color: #111111; font-family: 'Outfit', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 290px;">${emp.name}</h2>` : ''}
                ${template.fields.designation ? `<h3 class="id-portrait-designation" style="font-size: 12px; font-weight: 700; color: ${template.accentColor}; margin: 0; font-family: 'Plus Jakarta Sans', sans-serif; text-transform: uppercase; letter-spacing: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 290px;">${emp.designation}</h3>` : ''}
            </div>
            
            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; margin-bottom: 12px; table-layout: fixed;">
                ${template.fields.employeeId ? `<tr>
                    <td class="id-table-label" style="font-size: 13px; font-weight: bold; color: #666666; width: 110px; padding: 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Staff ID:</td>
                    <td class="id-table-value" style="font-size: 13px; font-weight: bold; color: #000000; padding: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.id}</td>
                </tr>` : ''}
                ${template.fields.department ? `<tr>
                    <td class="id-table-label" style="font-size: 13px; font-weight: bold; color: #666666; width: 110px; padding: 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Department:</td>
                    <td class="id-table-value" style="font-size: 13px; color: #000000; padding: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.clientLocation || emp.department || 'Reserve'}</td>
                </tr>` : ''}
                ${template.fields.fatherName ? `<tr>
                    <td class="id-table-label" style="font-size: 13px; font-weight: bold; color: #666666; width: 110px; padding: 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${emp.relationType || 'Father'}'s Name:</td>
                    <td class="id-table-value" style="font-size: 13px; color: #000000; padding: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.fatherName || '-'}</td>
                </tr>` : ''}
                <tr>
                    <td class="id-table-label" style="font-size: 13px; font-weight: bold; color: #666666; width: 110px; padding: 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Phone:</td>
                    <td class="id-table-value" style="font-size: 13px; color: #000000; padding: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.mobile || '-'}</td>
                </tr>
                ${template.fields.bloodGroup ? `<tr>
                    <td class="id-table-label" style="font-size: 13px; font-weight: bold; color: #666666; width: 110px; padding: 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Blood Group:</td>
                    <td class="id-table-value" style="font-size: 13px; color: #000000; padding: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.bloodGroup || '-'}</td>
                </tr>` : ''}
                ${template.fields.address ? `<tr>
                    <td class="id-table-label" style="font-size: 13px; font-weight: bold; color: #666666; width: 110px; padding: 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Address:</td>
                    <td class="id-table-value" style="font-size: 13px; color: #000000; padding: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${emp.currentAddress || emp.permanentAddress || '-'}</td>
                </tr>` : ''}
                <tr>
                    <td class="id-table-label" style="font-size: 13px; font-weight: bold; color: #666666; width: 110px; padding: 3px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Validity:</td>
                    <td class="id-table-value" style="font-size: 13px; color: #000000; padding: 3px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${validityStr}</td>
                </tr>
            </table>
            
            <div class="id-portrait-footer-row" style="margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px dashed #dddddd; padding-top: 4px;">
                <div class="id-portrait-signature-box" style="display: flex; flex-direction: column; gap: 2px; align-items: flex-start;">
                    <div class="id-portrait-signature" style="width: 80px; height: 25px; border: none;">
                        ${sigHtml}
                    </div>
                    <span style="font-size: 7px; color: #888888; font-style: italic;">Authority Signature</span>
                </div>
                
                <div class="id-portrait-qr" style="width: 60px; height: 60px;">
                    <canvas class="qr-canvas-rendered" data-qr-val="${verificationUrl}" style="width: 60px; height: 60px;"></canvas>
                </div>
            </div>

            <!-- Footer spacing -->
            <div style="height: 2px;"></div>
        </div>
        `;
    }
}

function renderQrsInContainer(container) {
    const canvases = container.querySelectorAll('.qr-canvas-rendered');
    canvases.forEach(canvas => {
        const val = canvas.getAttribute('data-qr-val');
        new QRious({
            element: canvas,
            value: val,
            size: 150,
            background: '#ffffff',
            foreground: '#000000',
            level: 'H'
        });
        canvas.classList.remove('qr-canvas-rendered');
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
    const clientFilter = document.getElementById('rep-client').value;

    const headersRow = document.getElementById('report-headers');
    const tbody = document.getElementById('report-tbody');

    headersRow.innerHTML = '';
    tbody.innerHTML = '';

    let reportHeaders = [];
    let reportData = [];

    // Filter employees by status and client
    let dataset = [...VSA_STATE.employees];
    if (clientFilter) {
        dataset = dataset.filter(emp => emp.clientLocation === clientFilter);
    }

    if (type === 'master') {
        reportHeaders = ["ID", "Name", "Designation", "Joining Date", "Site Location", "Mobile Number", "Category", "Status"];
        dataset.forEach(emp => {
            reportData.push([
                emp.id, emp.name, emp.designation, emp.joiningDate, 
                emp.clientLocation || "HQ (Reserve)", emp.mobile, emp.category, emp.status
            ]);
        });
    } else if (type === 'active') {
        reportHeaders = ["ID", "Name", "Designation", "Joining Date", "Site Location", "Manager", "Mobile"];
        dataset.filter(emp => emp.status === 'Active').forEach(emp => {
            reportData.push([
                emp.id, emp.name, emp.designation, emp.joiningDate, 
                emp.clientLocation || "HQ (Reserve)", emp.reportingManager, emp.mobile
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
    const recFilterLocation = document.getElementById('rec-filter-location');
    if (recFilterLocation) {
        recFilterLocation.addEventListener('change', function() {
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

    // C. Client Creation triggers
    document.getElementById('btn-add-client').addEventListener('click', () => {
        document.getElementById('client-modal').classList.remove('hidden');
    });
    document.getElementById('btn-close-client-modal').addEventListener('click', () => {
        document.getElementById('client-modal').classList.add('hidden');
    });
    document.getElementById('btn-cancel-client').addEventListener('click', () => {
        document.getElementById('client-modal').classList.add('hidden');
    });
    document.getElementById('client-form').addEventListener('submit', submitClientSite);


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

    const idFilterLocation = document.getElementById('id-filter-location');
    if (idFilterLocation) {
        idFilterLocation.addEventListener('change', function() {
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
    document.getElementById('reg-client').value = emp.clientLocation || '';
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
        clientLocation: document.getElementById('reg-client').value,
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
    
    const cardElement = document.querySelector('.id-card-portrait, .id-card-horizontal');
    if (!cardElement) {
        alert('ID Card element not found.');
        return;
    }
    
    // Temporarily ensure card is fully visible and not hidden by parent layouts during snapshot
    const originalStyle = cardElement.style.cssText;
    
    // Render the card using html2canvas
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
        alert("Failed to save ID card as image. Please use your browser's Print to PDF option (Ctrl+P) as a fallback.");
    });
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
    
    // Render QRs inside container
    const canvases = tempDiv.querySelectorAll('.qr-canvas-rendered');
    canvases.forEach(canvas => {
        const val = canvas.getAttribute('data-qr-val');
        new QRious({
            element: canvas,
            value: val,
            size: 150,
            background: '#ffffff',
            foreground: '#000000',
            level: 'H'
        });
    });
    
    await new Promise(resolve => setTimeout(resolve, 60));
    
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
    const locationVal = document.getElementById('rec-filter-location')?.value || '';
    const designationVal = document.getElementById('rec-filter-designation')?.value || '';

    const filtered = VSA_STATE.employees.filter(emp => {
        const matchesSearch = !searchVal || 
                              emp.name.toLowerCase().includes(searchVal) || 
                              emp.id.toLowerCase().includes(searchVal);
        const matchesLocation = !locationVal || emp.clientLocation === locationVal;
        const matchesDesignation = !designationVal || emp.designation === designationVal;

        return matchesSearch && matchesLocation && matchesDesignation;
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
                        <span class="id-checklist-item-sub">${emp.id} | ${emp.designation} | ${emp.clientLocation || 'HQ'}</span>
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
    setSafeText('rec-workplace', emp.clientLocation || '-');
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
        'rec-workplace', 'rec-joining', 'rec-status', 'rec-blood', 'rec-validity'
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

function renderTemplatesList() {
    const tbody = document.getElementById('templates-list-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!VSA_STATE.templates || VSA_STATE.templates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center placeholder-message">No templates registered yet.</td></tr>';
        return;
    }

    VSA_STATE.templates.forEach(t => {
        const row = document.createElement('tr');
        const isDefault = t.id === 'tpl-default';
        row.innerHTML = `
            <td><strong>${t.name}</strong> ${isDefault ? '<span class="badge badge-active" style="padding: 2px 6px; font-size: 9px; margin-left: 5px;">Default</span>' : ''}</td>
            <td><span class="badge" style="background: rgba(255,255,255,0.05); color: #ffffff;">${t.layout === 'vertical' ? 'Vertical' : 'Horizontal'}</span></td>
            <td><span class="text-muted">${t.headerText}</span></td>
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
            editTemplate(id);
        });
    });

    document.querySelectorAll('.btn-delete-template').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-id');
            deleteTemplate(id);
        });
    });
}

function editTemplate(id) {
    const tpl = VSA_STATE.templates.find(t => t.id === id);
    if (!tpl) return;

    document.getElementById('template-form-title').innerHTML = `<i data-lucide="edit"></i> Edit Template: ${tpl.name}`;
    lucide.createIcons();

    document.getElementById('template-id').value = tpl.id;
    document.getElementById('template-name').value = tpl.name;
    document.getElementById('template-layout').value = tpl.layout;
    document.getElementById('template-header-text').value = tpl.headerText;
    document.getElementById('template-subheader-text').value = tpl.subheaderText || '';
    document.getElementById('template-header-bg').value = tpl.headerBgColor || '#0f1218';
    document.getElementById('template-accent-color').value = tpl.accentColor || '#d4af37';

    const logoFile = document.getElementById('template-logo-file');
    const bgFile = document.getElementById('template-bg-file');
    const sigFile = document.getElementById('template-sig-file');

    logoFile.dataset.imageData = tpl.logo || '';
    bgFile.dataset.imageData = tpl.background || '';
    sigFile.dataset.imageData = tpl.signature || '';

    const logoPreview = document.getElementById('template-logo-preview');
    if (tpl.logo) {
        logoPreview.innerHTML = `<img src="${tpl.logo}" style="max-height: 100px;">`;
    } else {
        logoPreview.innerHTML = `<span class="preview-placeholder">Click to upload logo (Optional)</span>`;
    }

    const bgPreview = document.getElementById('template-bg-preview');
    if (tpl.background) {
        bgPreview.innerHTML = `<img src="${tpl.background}" style="max-height: 100px;">`;
    } else {
        bgPreview.innerHTML = `<span class="preview-placeholder">Click to upload background (Optional)</span>`;
    }

    const sigPreview = document.getElementById('template-sig-preview');
    if (tpl.signature) {
        sigPreview.innerHTML = `<img src="${tpl.signature}" style="max-height: 100px;">`;
    } else {
        sigPreview.innerHTML = `<span class="preview-placeholder">Click to upload signature (Optional)</span>`;
    }

    document.getElementById('field-show-name').checked = !!tpl.fields.name;
    document.getElementById('field-show-empid').checked = !!tpl.fields.employeeId;
    document.getElementById('field-show-designation').checked = !!tpl.fields.designation;
    document.getElementById('field-show-department').checked = !!tpl.fields.department;
    document.getElementById('field-show-father').checked = !!tpl.fields.fatherName;
    document.getElementById('field-show-phone').checked = !!tpl.fields.phone;
    document.getElementById('field-show-blood').checked = !!tpl.fields.bloodGroup;
    document.getElementById('field-show-address').checked = !!tpl.fields.address;
    
    // Scroll builder form card into view
    const builderCard = document.getElementById('template-builder-form').closest('.dashboard-card');
    if (builderCard) {
        builderCard.scrollIntoView({ behavior: 'smooth' });
    }
}

async function deleteTemplate(id) {
    if (id === 'tpl-default') {
        alert('The default template cannot be deleted.');
        return;
    }

    if (!confirm('Are you sure you want to delete this template layout design?')) {
        return;
    }

    try {
        const response = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Template deletion failed');
        
        VSA_STATE.templates = VSA_STATE.templates.filter(t => t.id !== id);
        renderTemplatesList();
        populateSelectors();
    } catch (err) {
        alert(err.message);
    }
}

function resetTemplateForm() {
    document.getElementById('template-form-title').innerHTML = '<i data-lucide="layout"></i> Create New Template';
    lucide.createIcons();

    document.getElementById('template-id').value = '';
    document.getElementById('template-builder-form').reset();

    const logoFile = document.getElementById('template-logo-file');
    const bgFile = document.getElementById('template-bg-file');
    const sigFile = document.getElementById('template-sig-file');

    if (logoFile) delete logoFile.dataset.imageData;
    if (bgFile) delete bgFile.dataset.imageData;
    if (sigFile) delete sigFile.dataset.imageData;

    document.getElementById('template-logo-preview').innerHTML = '<span class="preview-placeholder">Click to upload logo (Optional)</span>';
    document.getElementById('template-bg-preview').innerHTML = '<span class="preview-placeholder">Click to upload background (Optional)</span>';
    document.getElementById('template-sig-preview').innerHTML = '<span class="preview-placeholder">Click to upload signature (Optional)</span>';
}

function setupTemplatesManager() {
    const logoPreview = document.getElementById('template-logo-preview');
    if (logoPreview) {
        logoPreview.addEventListener('click', () => {
            document.getElementById('template-logo-file').click();
        });
    }
    const logoFile = document.getElementById('template-logo-file');
    if (logoFile) {
        logoFile.addEventListener('change', (e) => {
            handleImageUpload(e, 'template-logo-preview');
        });
    }

    const bgPreview = document.getElementById('template-bg-preview');
    if (bgPreview) {
        bgPreview.addEventListener('click', () => {
            document.getElementById('template-bg-file').click();
        });
    }
    const bgFile = document.getElementById('template-bg-file');
    if (bgFile) {
        bgFile.addEventListener('change', (e) => {
            handleImageUpload(e, 'template-bg-preview');
        });
    }

    const sigPreview = document.getElementById('template-sig-preview');
    if (sigPreview) {
        sigPreview.addEventListener('click', () => {
            document.getElementById('template-sig-file').click();
        });
    }
    const sigFile = document.getElementById('template-sig-file');
    if (sigFile) {
        sigFile.addEventListener('change', (e) => {
            handleImageUpload(e, 'template-sig-preview');
        });
    }

    const resetBtn = document.getElementById('btn-reset-template-form');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetTemplateForm();
        });
    }

    const autofillBtn = document.getElementById('btn-autofill-assets');
    if (autofillBtn) {
        autofillBtn.addEventListener('click', () => {
            const layout = document.getElementById('template-layout').value;
            const defaultTpl = VSA_STATE.templates.find(t => t.id === 'tpl-default');
            const defaultVip = VSA_STATE.templates.find(t => t.id === 'tpl-vip-landscape');
            
            const logoSvg = defaultTpl ? defaultTpl.logo : '';
            const sigSvg = defaultTpl ? defaultTpl.signature : '';
            const bgSvg = (layout === 'horizontal' && defaultVip) ? defaultVip.background : (defaultTpl ? defaultTpl.background : '');
            
            const logoFile = document.getElementById('template-logo-file');
            const bgFile = document.getElementById('template-bg-file');
            const sigFile = document.getElementById('template-sig-file');
            
            if (logoSvg && logoFile) {
                logoFile.dataset.imageData = logoSvg;
                document.getElementById('template-logo-preview').innerHTML = `<img src="${logoSvg}" style="max-height: 100px;">`;
            }
            if (bgSvg && bgFile) {
                bgFile.dataset.imageData = bgSvg;
                document.getElementById('template-bg-preview').innerHTML = `<img src="${bgSvg}" style="max-height: 100px;">`;
            }
            if (sigSvg && sigFile) {
                sigFile.dataset.imageData = sigSvg;
                document.getElementById('template-sig-preview').innerHTML = `<img src="${sigSvg}" style="max-height: 100px;">`;
            }
        });
    }

    const layoutSelect = document.getElementById('template-layout');
    if (layoutSelect) {
        layoutSelect.addEventListener('change', (e) => {
            const layout = e.target.value;
            const defaultTpl = VSA_STATE.templates.find(t => t.id === 'tpl-default');
            const defaultVip = VSA_STATE.templates.find(t => t.id === 'tpl-vip-landscape');
            
            const bgFile = document.getElementById('template-bg-file');
            if (bgFile && bgFile.dataset.imageData) {
                const currentBg = bgFile.dataset.imageData;
                const isDefaultBg = (defaultTpl && currentBg === defaultTpl.background) || 
                                     (defaultVip && currentBg === defaultVip.background);
                
                if (isDefaultBg) {
                    const newBg = (layout === 'horizontal' && defaultVip) ? defaultVip.background : (defaultTpl ? defaultTpl.background : '');
                    if (newBg) {
                        bgFile.dataset.imageData = newBg;
                        document.getElementById('template-bg-preview').innerHTML = `<img src="${newBg}" style="max-height: 100px;">`;
                    }
                }
            }
        });
    }

    const builderForm = document.getElementById('template-builder-form');
    if (builderForm) {
        builderForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const id = document.getElementById('template-id').value;
            const name = document.getElementById('template-name').value.trim();
            const layout = document.getElementById('template-layout').value;
            const headerText = document.getElementById('template-header-text').value.trim();
            const subheaderText = document.getElementById('template-subheader-text').value.trim();
            const headerBgColor = document.getElementById('template-header-bg').value;
            const accentColor = document.getElementById('template-accent-color').value;

            let logo = document.getElementById('template-logo-file').dataset.imageData || '';
            let background = document.getElementById('template-bg-file').dataset.imageData || '';
            let signature = document.getElementById('template-sig-file').dataset.imageData || '';

            // Fallback to default VSA assets if empty
            if (!logo || !background || !signature) {
                const defaultTpl = VSA_STATE.templates.find(t => t.id === 'tpl-default');
                const defaultVip = VSA_STATE.templates.find(t => t.id === 'tpl-vip-landscape');
                if (!logo && defaultTpl) logo = defaultTpl.logo;
                if (!signature && defaultTpl) signature = defaultTpl.signature;
                if (!background) {
                    if (layout === 'horizontal' && defaultVip) {
                        background = defaultVip.background;
                    } else if (defaultTpl) {
                        background = defaultTpl.background;
                    }
                }
            }

            const fields = {
                name: document.getElementById('field-show-name').checked,
                employeeId: document.getElementById('field-show-empid').checked,
                designation: document.getElementById('field-show-designation').checked,
                department: document.getElementById('field-show-department').checked,
                fatherName: document.getElementById('field-show-father').checked,
                phone: document.getElementById('field-show-phone').checked,
                bloodGroup: document.getElementById('field-show-blood').checked,
                address: document.getElementById('field-show-address').checked
            };

            const payload = {
                name, layout, headerText, subheaderText, headerBgColor, accentColor,
                logo, background, signature, fields
            };

            if (id) {
                payload.id = id;
            }

            try {
                const response = await fetch('/api/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) throw new Error('Failed to save ID template layout design.');
                const savedTpl = await response.json();

                if (id) {
                    const idx = VSA_STATE.templates.findIndex(t => t.id === id);
                    if (idx !== -1) VSA_STATE.templates[idx] = savedTpl;
                } else {
                    VSA_STATE.templates.push(savedTpl);
                }

                resetTemplateForm();
                renderTemplatesList();
                populateSelectors();
                alert('Template saved successfully!');
            } catch (err) {
                alert(err.message);
            }
        });
    }
}
