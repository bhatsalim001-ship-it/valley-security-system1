// --- Premium Override for Native browser alert() ---
(function() {
    const createContainer = () => {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
    };
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createContainer);
    } else {
        createContainer();
    }

    window.alert = function(message) {
        createContainer();
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        
        let color = '#cfa15c'; // gold
        let iconName = 'info';
        
        const msgLower = message.toLowerCase();
        if (msgLower.includes('success') || msgLower.includes('save') || msgLower.includes('add') || msgLower.includes('sync') || msgLower.includes('approved') || msgLower.includes('deleted')) {
            color = '#10b981'; // green
            iconName = 'check-circle';
        } else if (msgLower.includes('fail') || msgLower.includes('error') || msgLower.includes('incorrect') || msgLower.includes('invalid') || msgLower.includes('missing') || msgLower.includes('not found') || msgLower.includes('already')) {
            color = '#ef4444'; // red
            iconName = 'alert-circle';
        }
        
        toast.style.setProperty('--toast-color', color);
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i>
            </div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button type="button" class="toast-close">&times;</button>
        `;
        
        container.appendChild(toast);
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        setTimeout(() => toast.classList.add('active'), 50);
        
        const removeToast = () => {
            if (toast.classList.contains('remove')) return;
            toast.classList.add('remove');
            setTimeout(() => toast.remove(), 400);
        };
        
        toast.querySelector('.toast-close').addEventListener('click', removeToast);
        setTimeout(removeToast, 4500);
    };
})();

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

// Formatting helper to convert strings to Title Case (e.g. "salim ilyas bhat" -> "Salim Ilyas Bhat")
function toTitleCase(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// Helper to calculate actual card expiration date based on cardIssueDate/joiningDate and validity
function getCardExpirationDate(emp) {
    let issueDateObj;
    if (emp.cardIssueDate) {
        issueDateObj = new Date(emp.cardIssueDate);
    } else if (emp.joiningDate) {
        issueDateObj = new Date(emp.joiningDate);
    } else {
        issueDateObj = new Date();
    }
    if (isNaN(issueDateObj.getTime())) {
        issueDateObj = new Date();
    }
    const validityYears = parseInt(emp.cardValidity) || 3;
    const expDate = new Date(issueDateObj);
    expDate.setFullYear(issueDateObj.getFullYear() + validityYears);
    return expDate;
}

// XSS Prevention: escape HTML special characters before injecting into innerHTML
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Performance: debounce a function so it only fires after the user stops triggering it
function debounce(fn, delay) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Attach a live Title Case auto-formatting listener to input elements
function setupLiveTitleCaseInput(inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    el.addEventListener('input', function() {
        const selectionStart = this.selectionStart;
        const selectionEnd = this.selectionEnd;
        const val = this.value;
        const formatted = toTitleCase(val);
        if (val !== formatted) {
            this.value = formatted;
            this.setSelectionRange(selectionStart, selectionEnd);
        }
    });
}
let activeIdCardSide = 'front'; // 'front' or 'back'
let currentRegistrationMode = 'add'; // 'add' or 'edit'
let currentRegistrationEmpId = null;
let isApprovalAction = false;
let directoryViewMode = 'card'; // 'card' or 'list'

// Background activity check to detect if the server has been killed
function startServerStatusHeartbeat() {
    setInterval(async () => {
        try {
            const response = await fetch('/api/lan-ip');
            if (!response.ok) {
                window.location.reload();
            }
        } catch (err) {
            // Server offline (connection reset / fail to fetch), force reload to display the connection reset error page
            window.location.reload();
        }
    }, 5000); // Check every 5 seconds
}

// System Auto-Updates Checking Logic
const CLIENT_VERSION = '1.0.1';

async function checkForUpdates() {
    try {
        const response = await fetch('/api/system-version');
        if (response.ok) {
            const data = await response.json();
            if (data.version && data.version !== CLIENT_VERSION) {
                showUpdateBanner(data.version);
            }
        }
    } catch (err) {
        console.warn('Failed to check for system updates:', err);
    }
}

function showUpdateBanner(newVersion) {
    if (document.getElementById('system-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'system-update-banner';
    banner.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 24px;
        background: rgba(10, 11, 14, 0.95);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid rgba(207, 161, 92, 0.3);
        border-left: 4px solid var(--theme-accent, #cfa15c);
        border-radius: 12px;
        padding: 16px;
        color: #fff;
        box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        gap: 15px;
        z-index: 999999;
        font-family: inherit;
        animation: slideInUpdateBanner 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    `;

    banner.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; color: var(--theme-accent, #cfa15c); flex-shrink: 0;">
            <i data-lucide="sparkles" style="width: 20px; height: 20px; animation: pulse 2s infinite;"></i>
        </div>
        <div style="flex-grow: 1;">
            <div style="font-size: 13px; font-weight: 600; margin-bottom: 2px; text-align: left;">System Update Available (v${newVersion})</div>
            <div style="font-size: 11px; color: var(--text-secondary, #a0a0ab); text-align: left;">New features, security updates, and performance improvements are ready.</div>
        </div>
        <button type="button" onclick="window.location.reload()" style="background: var(--theme-accent, #cfa15c); border: none; border-radius: 8px; color: #000; font-size: 12px; font-weight: 700; padding: 8px 14px; cursor: pointer; white-space: nowrap; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            Update Now
        </button>
    `;

    document.body.appendChild(banner);

    // Add keyframe animation dynamically if not present
    if (!document.getElementById('update-banner-animation-styles')) {
        const style = document.createElement('style');
        style.id = 'update-banner-animation-styles';
        style.textContent = `
            @keyframes slideInUpdateBanner {
                from { transform: translateX(-120%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

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
    initEtherealShadowAnimation();
    initSpaRouter();
    fetchData();
    setupEventHandlers();
    setupClassificationsManager();
    setupTemplatesManager();
    setupCropperControls();
    setupModalA11y();
    setupMobileSidebar();

    // Set today's date as default for Card Issue Date input
    const issueDateInput = document.getElementById('id-card-issue-date');
    if (issueDateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        issueDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
    
    // Start background status heartbeat
    startServerStatusHeartbeat();
    
    // Start system update checking (run immediately on load, then every 30 seconds)
    checkForUpdates();
    setInterval(checkForUpdates, 30000);
    
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

    // Check saved theme or default to dark
    const savedTheme = localStorage.getItem('vsa-theme') || 'dark';
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        const darkIcon = themeBtn.querySelector('.theme-icon-dark');
        const lightIcon = themeBtn.querySelector('.theme-icon-light');
        if (darkIcon) darkIcon.classList.add('hidden');
        if (lightIcon) lightIcon.classList.remove('hidden');
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

function initEtherealShadowAnimation() {
    // Disabled to optimize performance and prevent dashboard rendering lag
    return;
    const canvas = document.getElementById('lightning-bg-canvas');
    if (!canvas) return;

    const resizeCanvas = () => {
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const gl = canvas.getContext("webgl");
    if (!gl) {
        console.error("WebGL not supported");
        return;
    }

    const vertexShaderSource = `
      attribute vec2 aPosition;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      uniform vec2 iResolution;
      uniform float iTime;
      uniform float uHue;
      uniform float uXOffset;
      uniform float uSpeed;
      uniform float uIntensity;
      uniform float uSize;
      
      #define OCTAVE_COUNT 10

      vec3 hsv2rgb(vec3 c) {
          vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float hash11(float p) {
          p = fract(p * .1031);
          p *= p + 33.33;
          p *= p + p;
          return fract(p);
      }

      float hash12(vec2 p) {
          vec3 p3 = fract(vec3(p.xyx) * .1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      mat2 rotate2d(float theta) {
          float c = cos(theta);
          float s = sin(theta);
          return mat2(c, -s, s, c);
      }

      float noise(vec2 p) {
          vec2 ip = floor(p);
          vec2 fp = fract(p);
          float a = hash12(ip);
          float b = hash12(ip + vec2(1.0, 0.0));
          float c = hash12(ip + vec2(0.0, 1.0));
          float d = hash12(ip + vec2(1.0, 1.0));
          
          vec2 t = smoothstep(0.0, 1.0, fp);
          return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
      }

      float fbm(vec2 p) {
          float value = 0.0;
          float amplitude = 0.5;
          for (int i = 0; i < OCTAVE_COUNT; ++i) {
              value += amplitude * noise(p);
              p *= rotate2d(0.45);
              p *= 2.0;
              amplitude *= 0.5;
          }
          return value;
      }

      void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
          vec2 uv = fragCoord / iResolution.xy;
          uv = 2.0 * uv - 1.0;
          uv.x *= iResolution.x / iResolution.y;
          uv.x += uXOffset;
          uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;
          
          float dist = abs(uv.x);
          vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
          vec3 col = baseColor * pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / dist, 1.0) * uIntensity;
          col = pow(col, vec3(1.0));
          fragColor = vec4(col, 1.0);
      }

      void main() {
          mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

    const compileShader = (source, type) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      return;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const uHueLocation = gl.getUniformLocation(program, "uHue");
    const uXOffsetLocation = gl.getUniformLocation(program, "uXOffset");
    const uSpeedLocation = gl.getUniformLocation(program, "uSpeed");
    const uIntensityLocation = gl.getUniformLocation(program, "uIntensity");
    const uSizeLocation = gl.getUniformLocation(program, "uSize");

    const startTime = performance.now();
    
    function render(currentTime) {
      let currentHue = 220;
      const accentVal = document.getElementById('tpl-accent-color') ? document.getElementById('tpl-accent-color').value : '';
      if (accentVal) {
          const parsed = hexToHsl(accentVal);
          currentHue = parsed.h;
      }
      
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(iTimeLocation, (currentTime - startTime) / 1000.0);
      gl.uniform1f(uHueLocation, currentHue);
      gl.uniform1f(uXOffsetLocation, 0.0);
      gl.uniform1f(uSpeedLocation, 1.2);
      gl.uniform1f(uIntensityLocation, 0.7);
      gl.uniform1f(uSizeLocation, 2.0);
      
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
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
function switchToView(targetView) {
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.app-view');
    
    // Toggle sidebar active highlights
    navItems.forEach(n => {
        if (n.getAttribute('data-view') === targetView) {
            n.classList.add('active');
        } else {
            n.classList.remove('active');
        }
    });

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
}

function initSpaRouter() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = item.getAttribute('data-view');
            window.location.hash = targetView;
        });
    });

    // Listen to hash changes in URL
    window.addEventListener('hashchange', handleHashRoute);
    
    // Initial route invocation
    handleHashRoute();
}

function handleHashRoute() {
    const defaultView = 'dashboard';
    const hashStr = window.location.hash.substring(1); // strip '#'
    
    if (!hashStr) {
        window.location.hash = defaultView;
        return;
    }
    
    const parts = hashStr.split('?');
    const targetView = parts[0];
    const queryStr = parts[1] || '';
    
    const validViews = ['dashboard', 'employees', 'emp-registration', 'deployments', 'id-cards', 'templates', 'emp-record', 'reports', 'settings'];
    
    if (!validViews.includes(targetView)) {
        window.location.hash = defaultView;
        return;
    }
    
    // Parse query params
    const params = {};
    queryStr.split('&').forEach(pair => {
        const [k, v] = pair.split('=');
        if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    
    // Perform standard view switching
    switchToView(targetView);
    
    // Execute specific setup logic for certain views if needed
    if (targetView === 'emp-registration') {
        const mode = params.mode || 'add';
        const empId = params.id || null;
        showRegistrationForm(mode, empId);
    }
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

        // Fetch Database Status
        try {
            const dbStatusResponse = await fetch('/api/db-status');
            if (dbStatusResponse.ok) {
                const dbStatus = await dbStatusResponse.json();
                const dbStatusEl = document.getElementById('sysinfo-db-status');
                if (dbStatusEl) {
                    dbStatusEl.textContent = dbStatus.databaseType;
                    if (dbStatus.usePostgres) {
                        dbStatusEl.style.color = '#2e7d32'; // Active green
                    } else {
                        dbStatusEl.style.color = '#d32f2f'; // Suspended red
                    }
                }
            }
        } catch (e) {
            console.error('Error fetching DB status:', e);
        }
        
        // Refresh UI components
        renderDashboard();
        renderEmployeeDirectory();
        populateSelectors();
        renderClassificationsManager();
        renderTemplatesList();
        if (typeof updateInboxBadgeCounter === 'function') updateInboxBadgeCounter();
        
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
    const pendingGuards = VSA_STATE.employees.filter(e => e.status === 'Pending').length;

    const alertBanner = document.getElementById('pending-approval-alert');
    const alertText = document.getElementById('pending-approval-alert-text');
    if (alertBanner && alertText) {
        if (pendingGuards > 0) {
            alertText.textContent = `You have ${pendingGuards} pending employee registration${pendingGuards > 1 ? 's' : ''} awaiting review.`;
            alertBanner.classList.remove('hidden');
        } else {
            alertBanner.classList.add('hidden');
        }
    }
    
    // Check ID expirations (Expired or expiring within next 30 days)
    let expiredOrExpiring = 0;
    const now = new Date();
    const alertThreshold = new Date();
    alertThreshold.setDate(now.getDate() + 30);
    
    VSA_STATE.employees.forEach(emp => {
        if (emp.status === 'Active') {
            const expDate = getCardExpirationDate(emp);
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

window.showPendingApprovals = function() {
    window.location.hash = 'employees';
    setTimeout(() => {
        const statusFilter = document.getElementById('emp-filter-status');
        if (statusFilter) {
            statusFilter.value = 'Pending';
        }
        renderEmployeeDirectory();
    }, 50);
};

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
        const fullDeptName = toTitleCase(dept);
        const displayDeptName = fullDeptName.length > 15 ? fullDeptName.substring(0, 13) + '..' : fullDeptName;
        
        svgHtml += `
            <g class="chart-bar-group" data-dept="${dept}">
                <title>${fullDeptName} (${count} guards)</title>
                <text x="10" y="${y + 14}" fill="var(--text-primary)" font-size="12" font-family="inherit" font-weight="600">${displayDeptName}</text>
                <rect x="120" y="${y}" width="${barWidth}" height="18" rx="9" fill="url(#barGradient)"/>
                <text x="${130 + barWidth}" y="${y + 14}" fill="var(--theme-accent)" font-size="11" font-family="inherit" font-weight="700">${count}</text>
            </g>
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

    // Wire up clicks on chart bars
    container.querySelectorAll('.chart-bar-group').forEach(group => {
        group.addEventListener('click', function() {
            const dept = this.getAttribute('data-dept');
            document.getElementById('emp-filter-designation').value = '';
            document.getElementById('emp-filter-department').value = dept;
            document.getElementById('emp-filter-location').value = '';
            document.getElementById('emp-filter-status').value = '';
            document.getElementById('emp-filter-search').value = '';
            switchToView('employees');
            renderEmployeeDirectory();
        });
    });
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
        const expDate = getCardExpirationDate(emp);
        if (expDate < now) {
            alerts.push({
                type: 'critical',
                title: `${toTitleCase(emp.name)} ID Expired`,
                desc: `Badge expired on ${expDate.toLocaleDateString()}`,
                empId: emp.id,
                actionLabel: 'Renew ID'
            });
        } else if (expDate <= alertThreshold) {
            alerts.push({
                type: 'warning',
                title: `${toTitleCase(emp.name)} ID Expiring Soon`,
                desc: `Expiring on ${expDate.toLocaleDateString()}`,
                empId: emp.id,
                actionLabel: 'Renew ID'
            });
        }

        // 2. Missing/Failed Documentations check
        if (emp.documents) {
            if (emp.documents.policeVerification === 'Pending') {
                alerts.push({
                    type: 'pending',
                    title: `${toTitleCase(emp.name)} Police Record Pending`,
                    desc: 'Clearance verification has not been uploaded.',
                    empId: emp.id,
                    actionLabel: 'Upload PV'
                });
            }
            if (emp.documents.aadhaar === 'Pending') {
                alerts.push({
                    type: 'pending',
                    title: `${toTitleCase(emp.name)} Aadhaar Verification Needed`,
                    desc: 'Missing scanned Aadhaar copy validation.',
                    empId: emp.id,
                    actionLabel: 'Upload AD'
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
            <div class="alert-info-details" style="flex: 1; min-width: 0;">
                <span class="alert-info-title">${alert.title}</span>
                <span class="alert-info-desc">${alert.desc}</span>
            </div>
            ${alert.empId ? `
            <button class="btn btn-xs btn-primary alert-action-btn" data-id="${alert.empId}" style="font-size: 10px; padding: 4px 10px; margin-left: 12px; white-space: nowrap;">
                ${alert.actionLabel}
            </button>
            ` : ''}
        `;
        container.appendChild(alertItem);
    });

    // Wire up alert action buttons
    container.querySelectorAll('.alert-action-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const empId = this.getAttribute('data-id');
            window.location.hash = `emp-registration?mode=edit&id=${empId}`;
        });
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
        const photoSrc = (emp.documents && emp.documents.photo) ? emp.documents.photo : '';
        const avatarHtml = photoSrc ? 
            `<img src="${photoSrc}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--glass-border);">` : 
            `<div style="width: 24px; height: 24px; border-radius: 50%; background: var(--input-bg); display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: var(--text-muted); border: 1px solid var(--glass-border);">${emp.name ? emp.name[0].toUpperCase() : '?'}</div>`;

        row.innerHTML = `
            <td><strong>${emp.id}</strong></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    ${avatarHtml}
                    <span>${toTitleCase(emp.name)}</span>
                </div>
            </td>
            <td>${toTitleCase(emp.designation)}</td>
            <td>${toTitleCase(emp.department || '-')}</td>
            <td>${emp.joiningDate}</td>
            <td>
                <div style="display: flex; align-items: center; gap: 10px; justify-content: space-between;">
                    <span class="badge ${emp.status === 'Active' ? 'badge-active' : (emp.status === 'Pending' ? 'badge-pending' : 'badge-suspended')}">${emp.status}</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-xs btn-outline btn-recent-edit" data-id="${emp.id}" title="Edit details" style="padding: 2px 6px; font-size: 10px; min-width: 24px;"><i data-lucide="edit-3" style="width: 10px; height: 10px;"></i></button>
                        <button class="btn btn-xs btn-outline btn-recent-card" data-id="${emp.id}" title="Download ID" style="color: var(--theme-accent); border-color: rgba(212, 175, 55, 0.15); padding: 2px 6px; font-size: 10px; min-width: 24px;"><i data-lucide="credit-card" style="width: 10px; height: 10px;"></i></button>
                    </div>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Reinitialize Lucide Icons for dynamic content
    lucide.createIcons();

    // Wire up quick-edit and print-card listeners
    tbody.querySelectorAll('.btn-recent-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const empId = btn.getAttribute('data-id');
            window.location.hash = `emp-registration?mode=edit&id=${empId}`;
        });
    });

    tbody.querySelectorAll('.btn-recent-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const empId = btn.getAttribute('data-id');
            downloadIndividualCardImage(empId);
        });
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
    const departmentVal = document.getElementById('emp-filter-department').value;
    const locationVal = document.getElementById('emp-filter-location').value;
    const statusVal = document.getElementById('emp-filter-status').value;

    const filtered = VSA_STATE.employees.filter(emp => {
        // Hard rule: Pending employees belong in the Inbox, Rejected in the rejected log.
        // Neither should ever appear in the Employee Directory.
        if (emp.status === 'Pending' || emp.status === 'Rejected') return false;

        const matchesSearch = emp.name.toLowerCase().includes(searchVal) || 
                              emp.id.toLowerCase().includes(searchVal) || 
                              emp.mobile.includes(searchVal);
        const matchesDesignation = !designationVal || emp.designation === designationVal;
        const matchesDepartment = !departmentVal || emp.department === departmentVal;
        const matchesLocation = !locationVal || emp.clientLocation === locationVal;
        let matchesStatus = true;
        if (statusVal === 'Expired') {
            const now = new Date();
            const alertThreshold = new Date();
            alertThreshold.setDate(now.getDate() + 30);
            const expDate = getCardExpirationDate(emp);
            matchesStatus = expDate <= alertThreshold;
        } else if (statusVal) {
            matchesStatus = emp.status === statusVal;
        }

        return matchesSearch && matchesDesignation && matchesDepartment && matchesLocation && matchesStatus;
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
                    <input type="checkbox" class="directory-select-item" data-id="${escapeHtml(emp.id)}" ${isChecked} style="cursor: pointer;">
                </div>
                <div class="directory-card-photo">
                    ${showPhoto}
                </div>
                <div class="directory-card-info">
                    <div class="directory-card-name" title="${escapeHtml(toTitleCase(emp.name))}">${escapeHtml(toTitleCase(emp.name))}</div>
                    <div class="directory-card-empid">${escapeHtml(emp.id)}</div>
                    <div class="directory-card-subtext" title="${escapeHtml(toTitleCase(emp.designation))}">${escapeHtml(toTitleCase(emp.designation))}</div>
                    <div class="directory-card-client" title="${escapeHtml(toTitleCase(emp.department || '-'))}">${escapeHtml(toTitleCase(emp.department || '-'))}</div>
                    <div class="directory-card-chips" style="align-items: center; gap: 6px;">
                        <span class="directory-card-chip">${escapeHtml(emp.manpowerType || 'Security')}</span>
                        <select class="directory-status-select" data-id="${escapeHtml(emp.id)}" data-status="${escapeHtml(emp.status)}" style="font-size: 10px; padding: 2px 6px;">
                            <option value="Active" ${emp.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="Suspended" ${emp.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                            <option value="Fired" ${emp.status === 'Fired' ? 'selected' : ''}>Fired</option>
                            <option value="Left" ${emp.status === 'Left' ? 'selected' : ''}>Left</option>
                        </select>
                    </div>
                    <div class="directory-card-actions">
                        <button class="btn btn-xs btn-outline btn-generate-card-img" data-id="${escapeHtml(emp.id)}" style="color: var(--theme-accent); border-color: rgba(212, 175, 55, 0.15)">ID Card</button>
                        <button class="btn btn-xs btn-outline btn-edit-emp" data-id="${escapeHtml(emp.id)}">Edit</button>
                        <button class="btn btn-xs btn-outline btn-delete-emp" data-id="${escapeHtml(emp.id)}" style="color: var(--status-suspended); border-color: rgba(255, 46, 147, 0.15)">Delete</button>
                    </div>
                </div>
            `;
            cardGrid.appendChild(card);
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" class="directory-select-item" data-id="${escapeHtml(emp.id)}" ${isChecked} style="cursor: pointer;"></td>
                <td><strong>${escapeHtml(emp.id)}</strong></td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="directory-list-avatar" style="width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--glass-border); overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: var(--input-bg);">
                            ${photoSrc ? `<img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover;">` : `<i data-lucide="user" style="width: 14px; height: 14px; color: var(--text-muted);"></i>`}
                        </div>
                        <span>${escapeHtml(toTitleCase(emp.name))}</span>
                    </div>
                </td>
                <td>${escapeHtml(toTitleCase(emp.designation))}</td>
                <td>${escapeHtml(toTitleCase(emp.department || '-'))}</td>
                <td>${escapeHtml(emp.mobile)}</td>
                <td><span class="text-muted" style="font-size: 11px;">${escapeHtml(docsText)}</span></td>
                <td>
                    <select class="directory-status-select" data-id="${escapeHtml(emp.id)}" data-status="${escapeHtml(emp.status)}">
                        <option value="Active" ${emp.status === 'Active' ? 'selected' : ''}>Active</option>
                        <option value="Suspended" ${emp.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                        <option value="Fired" ${emp.status === 'Fired' ? 'selected' : ''}>Fired</option>
                        <option value="Left" ${emp.status === 'Left' ? 'selected' : ''}>Left</option>
                    </select>
                </td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-xs btn-outline btn-generate-card-img" data-id="${escapeHtml(emp.id)}" style="color: var(--theme-accent); border-color: rgba(212, 175, 55, 0.15)">ID Card</button>
                        <button class="btn btn-xs btn-outline btn-edit-emp" data-id="${escapeHtml(emp.id)}">Edit</button>
                        <button class="btn btn-xs btn-outline btn-delete-emp" data-id="${escapeHtml(emp.id)}" style="color: var(--status-suspended); border-color: rgba(255, 46, 147, 0.15)">Delete</button>
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
            window.location.hash = `emp-registration?mode=edit&id=${empId}`;
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

    // Populate templates preview employee select
    const tplPreviewEmpSel = document.getElementById('tpl-preview-emp-select');
    if (tplPreviewEmpSel) {
        const currentVal = tplPreviewEmpSel.value;
        let empHtml = '';
        if (VSA_STATE.employees.length === 0) {
            empHtml = '<option value="">No Guards/Employees</option>';
        } else {
            VSA_STATE.employees.forEach(e => {
                empHtml += `<option value="${e.id}">${e.name} (${e.id})</option>`;
            });
        }
        tplPreviewEmpSel.innerHTML = empHtml;
        if (currentVal && VSA_STATE.employees.some(e => e.id == currentVal)) {
            tplPreviewEmpSel.value = currentVal;
        } else if (VSA_STATE.employees.length > 0) {
            tplPreviewEmpSel.value = VSA_STATE.employees[0].id;
        }
    }

    // 4B. Populate templates select
    const idTplSel = document.getElementById('id-select-template');
    const bulkTplSel = document.getElementById('bulk-select-template');
    const tplEditSel = document.getElementById('tpl-edit-select');
    let tplHtml = '';
    VSA_STATE.templates.forEach(t => {
        tplHtml += `<option value="${t.id}">${t.name} (${t.layout === 'vertical' ? 'Vertical' : 'Horizontal'})</option>`;
    });
    if (idTplSel) idTplSel.innerHTML = tplHtml;
    if (bulkTplSel) bulkTplSel.innerHTML = tplHtml;
    if (tplEditSel) {
        tplEditSel.innerHTML = '<option value="">-- Select Template to Edit/Delete --</option>' + tplHtml;
        const activeTplId = document.getElementById('tpl-id').value;
        tplEditSel.value = activeTplId || '';
    }

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

    const empFilterDeptSel = document.getElementById('emp-filter-department');
    if (empFilterDeptSel) {
        empFilterDeptSel.innerHTML = '<option value="">All Departments</option>';
        VSA_STATE.departments.forEach(d => {
            empFilterDeptSel.innerHTML += `<option value="${d}">${d}</option>`;
        });
    }

    const empFilterLocSel = document.getElementById('emp-filter-location');
    if (empFilterLocSel) {
        empFilterLocSel.innerHTML = '<option value="">All Places</option>';
        const uniqueLocations = [...new Set(VSA_STATE.employees
            .map(e => e.clientLocation)
            .filter(loc => loc && loc.trim() !== ''))]
            .sort();
        uniqueLocations.forEach(loc => {
            empFilterLocSel.innerHTML += `<option value="${loc}">${loc}</option>`;
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
                        <span class="id-checklist-item-name">${toTitleCase(emp.name)}</span>
                        <span class="id-checklist-item-sub">${emp.id} | ${toTitleCase(emp.designation)} | ${toTitleCase(emp.department || '-')}</span>
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
    const issueDateVal = document.getElementById('id-card-issue-date')?.value || null;

    for (let i = 0; i < VSA_STATE.idSelectedEmployeeIds.length; i += cardsPerPage) {
        const pageItems = VSA_STATE.idSelectedEmployeeIds.slice(i, i + cardsPerPage);
        let pageHtml = `<div class="a4-print-page print-layout-${template.layout}">`;
        pageItems.forEach(empId => {
            const emp = VSA_STATE.employees.find(e => e.id === empId);
            if (emp) {
                pageHtml += generateIdCardHtml(emp, template, emp.cardValidity || validity, issueDateVal);
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

    const issueDateVal = document.getElementById('id-card-issue-date')?.value || null;

    for (let i = 0; i < VSA_STATE.idSelectedEmployeeIds.length; i++) {
        const empId = VSA_STATE.idSelectedEmployeeIds[i];
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (!emp) continue;

        bulkContainer.innerHTML = generateIdCardHtml(emp, template, emp.cardValidity || validity, issueDateVal);
        renderQrsInContainer(bulkContainer);

        try {
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }
        } catch (e) {
            console.warn('Font loading wait failed:', e);
        }
        await new Promise(resolve => setTimeout(resolve, 300));

        if (template && template.isVisualTemplate) {
            const cards = bulkContainer.querySelectorAll('.visual-id-card-render');
            for (let idx = 0; idx < cards.length; idx++) {
                const cardElement = cards[idx];
                const sideName = idx === 0 ? 'Front' : 'Back';
                try {
                    const canvas = await html2canvas(cardElement, {
                        scale: 4,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                        letterRendering: true
                    });
                    
                    const base64Data = canvas.toDataURL('image/png').split(',')[1];
                    const filename = `VSA_ID_${emp.id}_${emp.name.replace(/\s+/g, '_')}_${sideName}.png`;
                    zip.file(filename, base64Data, {base64: true});
                    renderCount++;
                } catch (err) {
                    console.error(`Failed to generate ${sideName} visual card for ${emp.id}`, err);
                }
            }
        } else {
            const cardElement = bulkContainer.querySelector('.id-card-portrait') || bulkContainer.querySelector('.id-card-horizontal');
            if (cardElement) {
                try {
                    const canvas = await html2canvas(cardElement, {
                        scale: 4,
                        useCORS: true,
                        allowTaint: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                        letterRendering: true
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

        title.textContent = `Edit Details: ${toTitleCase(emp.name)} (${emp.id})`;
        document.getElementById('form-emp-id').value = emp.id;
        document.getElementById('form-name').value = toTitleCase(emp.name);
        const relType = emp.relationType || 'Father';
        const formRelSelect = document.getElementById('form-relation-type');
        if (formRelSelect) formRelSelect.value = relType;
        const formRelLabel = document.getElementById('form-father-label');
        if (formRelLabel) formRelLabel.textContent = `${relType}'s Name *`;

        document.getElementById('form-father').value = toTitleCase(emp.fatherName);
        document.getElementById('form-dob').value = emp.dob;
        document.getElementById('form-gender').value = emp.gender;
        document.getElementById('form-blood').value = emp.bloodGroup;
        document.getElementById('form-marital').value = emp.maritalStatus;
        document.getElementById('form-mobile').value = emp.mobile;
        document.getElementById('form-alt-mobile').value = emp.altMobile || '';
        document.getElementById('form-email').value = emp.email || '';
        document.getElementById('form-perm-address').value = toTitleCase(emp.permanentAddress);
        document.getElementById('form-curr-address').value = toTitleCase(emp.currentAddress);
        document.getElementById('form-district').value = emp.district;
        document.getElementById('form-state').value = emp.state;
        document.getElementById('form-pin').value = emp.pinCode;
        document.getElementById('form-designation').value = emp.designation || '';
        document.getElementById('form-manager').value = emp.reportingManager || '';
        document.getElementById('form-joining-date').value = emp.joiningDate;
        document.getElementById('form-status').value = emp.status;
        document.getElementById('form-category').value = emp.category;
        document.getElementById('form-emergency-name').value = emp.emergencyContactName;
        document.getElementById('form-emergency-relation').value = emp.emergencyContactRelation;
        document.getElementById('form-emergency-mobile').value = emp.emergencyContactMobile;

        // New fields
        document.getElementById('form-bank-account').value = emp.bankAccount || '';
        document.getElementById('form-ifsc').value = emp.ifsc || '';
        document.getElementById('form-aadhaar-no').value = emp.aadhaarNo || '';
        document.getElementById('form-guardian-name').value = emp.guardianName || '';
        document.getElementById('form-guardian-mobile').value = emp.guardianMobile || '';
        document.getElementById('form-verification-by').value = emp.verificationIssuedBy || '';
        document.getElementById('form-verification-validity').value = emp.verificationValidity || '';
        document.getElementById('form-documents-received').value = emp.originalDocuments || '';
        document.getElementById('form-reference-by').value = emp.referenceBy || '';
        document.getElementById('form-company').value = emp.companyName || 'Valley Security Service Agency Pvt Ltd.';
        document.getElementById('form-salary').value = emp.salaryMonth || '';
        document.getElementById('form-age').value = emp.age || '';
        document.getElementById('form-remarks').value = emp.remarks || '';

        document.getElementById('form-aadhaar-check').value = emp.documents?.aadhaar || 'Pending';
        document.getElementById('form-pan-check').value = emp.documents?.pan || 'Pending';
        document.getElementById('form-police-check').value = emp.documents?.policeVerification || 'Pending';

        if (emp.documents?.photo) {
            document.getElementById('form-photo-preview-box').innerHTML = `<img src="${emp.documents.photo}">`;
        } else {
            document.getElementById('form-photo-preview-box').innerHTML = `<span class="preview-placeholder">No image selected (Required for ID card)</span>`;
        }
        if (emp.documents?.signature) {
            document.getElementById('form-sig-preview-box').innerHTML = `<img src="${emp.documents.signature}">`;
        } else {
            document.getElementById('form-sig-preview-box').innerHTML = `<span class="preview-placeholder">No signature selected (Required for ID card)</span>`;
        }
    } else {
        // ADD MODE
        title.textContent = "Register New Security Personnel";
        document.getElementById('form-emp-id').value = '';
        document.getElementById('form-joining-date').value = new Date().toISOString().substring(0, 10);
        
        // Reset form inputs
        document.getElementById('form-name').value = '';
        document.getElementById('form-father').value = '';
        document.getElementById('form-dob').value = '';
        document.getElementById('form-gender').value = 'Male';
        document.getElementById('form-blood').value = 'O+';
        document.getElementById('form-marital').value = 'Single';
        document.getElementById('form-mobile').value = '';
        document.getElementById('form-alt-mobile').value = '';
        document.getElementById('form-email').value = '';
        document.getElementById('form-perm-address').value = '';
        document.getElementById('form-curr-address').value = '';
        document.getElementById('form-district').value = '';
        document.getElementById('form-state').value = 'Jammu & Kashmir';
        document.getElementById('form-pin').value = '';
        document.getElementById('form-designation').value = 'Security Guard';
        document.getElementById('form-manager').value = '';
        document.getElementById('form-status').value = 'Active';
        document.getElementById('form-category').value = 'Unskilled';
        document.getElementById('form-emergency-name').value = '';
        document.getElementById('form-emergency-relation').value = '';
        document.getElementById('form-emergency-mobile').value = '';

        document.getElementById('form-bank-account').value = '';
        document.getElementById('form-ifsc').value = '';
        document.getElementById('form-aadhaar-no').value = '';
        document.getElementById('form-guardian-name').value = '';
        document.getElementById('form-guardian-mobile').value = '';
        document.getElementById('form-verification-by').value = '';
        document.getElementById('form-verification-validity').value = '';
        document.getElementById('form-documents-received').value = '';
        document.getElementById('form-reference-by').value = '';
        document.getElementById('form-company').value = 'Valley Security Service Agency Pvt Ltd.';
        document.getElementById('form-salary').value = '';
        document.getElementById('form-age').value = '';
        document.getElementById('form-remarks').value = '';

        document.getElementById('form-aadhaar-check').value = 'Pending';
        document.getElementById('form-pan-check').value = 'Pending';
        document.getElementById('form-police-check').value = 'Pending';

        document.getElementById('form-photo-preview-box').innerHTML = `<span class="preview-placeholder">No image selected (Required for ID card)</span>`;
        document.getElementById('form-sig-preview-box').innerHTML = `<span class="preview-placeholder">No signature selected (Required for ID card)</span>`;
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
        relationType: document.getElementById('form-relation-type')?.value || 'Father',
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
        
        // New VSA Form Fields
        bankAccount: document.getElementById('form-bank-account').value,
        ifsc: document.getElementById('form-ifsc').value,
        aadhaarNo: document.getElementById('form-aadhaar-no').value,
        guardianName: document.getElementById('form-guardian-name').value,
        guardianMobile: document.getElementById('form-guardian-mobile').value,
        verificationIssuedBy: document.getElementById('form-verification-by').value,
        verificationValidity: document.getElementById('form-verification-validity').value,
        originalDocuments: document.getElementById('form-documents-received').value,
        referenceBy: document.getElementById('form-reference-by').value,
        companyName: document.getElementById('form-company').value,
        salaryMonth: document.getElementById('form-salary').value,
        age: document.getElementById('form-age').value,
        remarks: document.getElementById('form-remarks').value,

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

// Global cache for processed signature base64 strings to ensure fast rendering
const VSA_PROCESSED_SIG_CACHE = {};

/**
 * Programmatically processes a signature image (removes gray background, applies
 * smooth anti-aliased transparency, and tones strokes to a realistic navy-black ink).
 */
function processSignatureBase64(base64Str, targetColor = {r: 16, g: 32, b: 82}) {
    return new Promise((resolve) => {
        if (!base64Str || !base64Str.startsWith('data:image/')) {
            resolve(base64Str);
            return;
        }
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 400; // Max width or height to optimize processing & DB storage size
            let w = img.width;
            let h = img.height;
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    const originalAlpha = data[i+3];
                    
                    // Calculate brightness (luminance)
                    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    // Thresholds for realistic ink and background removal
                    const upperThreshold = 220; // values above this are paper background
                    const lowerThreshold = 140; // values below this are solid ink
                    
                    let alphaFactor = 1.0;
                    if (brightness >= upperThreshold) {
                        alphaFactor = 0.0;
                    } else if (brightness <= lowerThreshold) {
                        alphaFactor = 1.0;
                    } else {
                        // Smooth transition for edge anti-aliasing
                        alphaFactor = 1.0 - (brightness - lowerThreshold) / (upperThreshold - lowerThreshold);
                    }
                    
                    const newAlpha = Math.round(originalAlpha * alphaFactor);
                    
                    // Check if this pixel is part of the background to avoid turning it blue/black if it's transparent
                    if (newAlpha > 0) {
                        // Tone ink to target realistic navy-black ink color
                        data[i] = targetColor.r;
                        data[i+1] = targetColor.g;
                        data[i+2] = targetColor.b;
                    }
                    data[i+3] = newAlpha;
                }
                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error("Signature processing failed:", e);
                resolve(base64Str);
            }
        };
        img.onerror = () => {
            resolve(base64Str);
        };
        img.src = base64Str;
    });
}

function getProcessedSignature(src) {
    if (!src || !src.startsWith('data:image/')) {
        return src;
    }
    if (VSA_PROCESSED_SIG_CACHE[src]) {
        return VSA_PROCESSED_SIG_CACHE[src];
    }
    
    // Cache original temporarily to prevent multiple simultaneous processing requests
    VSA_PROCESSED_SIG_CACHE[src] = src;
    
    processSignatureBase64(src).then(processed => {
        VSA_PROCESSED_SIG_CACHE[src] = processed;
        
        // Refresh previews
        const selectedId = document.getElementById('id-select-employee')?.value;
        if (selectedId) {
            loadIdCardDetails(selectedId);
        }
        updateLivePreview();
        
        // Also update any inline previews
        const recSigEl = document.getElementById('rec-signature-img');
        if (recSigEl && recSigEl.src === src) {
            recSigEl.src = processed;
        }
    });
    
    return src;
}

// Helpers to fetch the default VSA logo and signature scans from the templates array.
const VSA_FALLBACK_LOGO = "data:image/png;base64,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";
const VSA_FALLBACK_SIG = "data:image/jpeg;base64,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";

function getVsaDefaultLogo() {
    const tpl = VSA_STATE.templates.find(t => t.id === 'tpl-default');
    const dbLogo = (tpl && tpl.logo) ? tpl.logo : '';
    return dbLogo.startsWith('data:image/') ? dbLogo : VSA_FALLBACK_LOGO;
}

function getVsaDefaultSig() {
    const tpl = VSA_STATE.templates.find(t => t.id === 'tpl-default');
    const dbSig = (tpl && tpl.signature) ? tpl.signature : '';
    const rawSig = dbSig.startsWith('data:image/') ? dbSig : VSA_FALLBACK_SIG;
    return getProcessedSignature(rawSig);
}

/* ==========================================================================
   5. LUXURY ID CARD GENERATION SYSTEM
   ========================================================================== */
function ensureFontLoaded(fontFamilyStr) {
    if (!fontFamilyStr) return;
    
    // Extract font family name (e.g. 'Playfair Display' from "'Playfair Display', serif")
    const match = fontFamilyStr.match(/'([^']+)'/);
    if (!match) return;
    const fontName = match[1];
    
    // Core fonts are already loaded on startup
    const coreFonts = ['Plus Jakarta Sans', 'Outfit', 'Inter'];
    if (coreFonts.includes(fontName)) return;
    
    const fontId = `gfont-${fontName.toLowerCase().replace(/ /g, '-')}`;
    if (document.getElementById(fontId)) return; // Already loaded
    
    console.log(`Dynamically loading font: ${fontName}`);
    const link = document.createElement('link');
    link.id = fontId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;600;700;800&display=swap`;
    document.head.appendChild(link);
}

function generateIdCardHtml(emp, template, validityYears = 3, issueDate = null) {
    if (template && template.font) {
        ensureFontLoaded(template.font);
    }

    if (!emp) return '';

    // Helper to format date
    const formatDateDDMMYYYYLocal = (date) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        return `${d}-${m}-${y}`;
    };

    // Helper to sanitize multiple spaces, trim, and title-case strings safely
    const cleanTextVal = (val, isTitle = true) => {
        if (!val) return '-';
        let normalizedVal = val.trim();
        const upperVal = normalizedVal.toUpperCase();
        if (upperVal === 'MTS') {
            normalizedVal = 'MULTI TASKING STAFF';
        } else if (upperVal === 'DEO') {
            normalizedVal = 'DATA ENTRY OPERATOR';
        } else if (upperVal === 'SCD') {
            normalizedVal = 'STAFF CAR DRIVER';
        }
        let text = isTitle ? toTitleCase(normalizedVal) : normalizedVal;
        return text.replace(/\s+/g, ' ').trim();
    };

    // Determine the card issue date (priority: passed param > emp.cardIssueDate > today)
    let issueDateObj;
    if (issueDate) {
        issueDateObj = new Date(issueDate);
    } else if (emp.cardIssueDate) {
        issueDateObj = new Date(emp.cardIssueDate);
    } else {
        issueDateObj = new Date(); // Default to today, NOT joining date
    }
    // Fallback: if date is invalid, use today
    if (isNaN(issueDateObj.getTime())) {
        issueDateObj = new Date();
    }

    const expDate = new Date(issueDateObj);
    expDate.setFullYear(issueDateObj.getFullYear() + validityYears);
    const validityStr = `${formatDateDDMMYYYYLocal(issueDateObj)} - ${formatDateDDMMYYYYLocal(expDate)}`;

    const getFallbackAvatarData = (initial) => {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='120' viewBox='0 0 100 120'><defs><linearGradient id='avatarGrad' x1='0%' y1='0%' x2='100%' y2='100%'><stop offset='0%' stop-color='%23c8102e'/><stop offset='100%' stop-color='%230f1218'/></linearGradient></defs><rect width='100%' height='100%' fill='url(%23avatarGrad)'/><text x='50%' y='55%' font-family='sans-serif' font-weight='bold' font-size='32' fill='%23ffffff' text-anchor='middle'>${initial}</text></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getPresetShield = (color = '#c8102e') => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getPresetStar = (color = '#c8102e') => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    };

    const getPresetEagle = (color = '#c8102e') => {
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
            accentColor: '#c8102e',
            headerText: 'VALLEY SECURITY AGENCY',
            subheaderText: 'SHAHIDGUNJ SRINAGAR KASHMIR',
            backgroundImage: '',
            logo: 'preset-vsa-logo',
            signature: 'preset-vsa-sig',
            logoSize: 50,
            headerHeight: 90,
            headerFontSize: 14,
            photoWidth: 85,
            photoHeight: 105,
            qrSize: 70,
            detailsFontSize: 8,
            fields: {
                photo: true, name: true, designation: true, department: true, empid: true,
                father: true, phone: true, email: true, blood: true, address: true, signature: true,
                qrcode: true, barcode: true, validity: true
            },
            fieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email']
        };
    }

    const fields = template.fields || {};
    const logoSize = template.logoSize || 50;
    const headerHeight = template.headerHeight || 90;
    const headerFontSize = template.headerFontSize || 14;
    const photoWidth = template.photoWidth || (template.layout === 'horizontal' ? 90 : 85);
    const photoHeight = template.photoHeight || (template.layout === 'horizontal' ? 110 : 105);
    const qrSize = template.qrSize || 70;
    const detailsFontSize = template.detailsFontSize || (template.layout === 'horizontal' ? 7.5 : 8);
    const nameFontSize = template.nameFontSize || (template.layout === 'horizontal' ? 13 : 14);
    const designationFontSize = template.designationFontSize || (template.layout === 'horizontal' ? 9 : 10);

    // Normalize fields to support both DB format and Form format
    const isNift = template.id === 'tpl-nift';
    const showPhoto = fields.photo !== false;
    const showName = fields.name !== false && !isNift;
    const showDesignation = fields.designation !== false && !isNift;
    const showDepartment = fields.department !== false;
    const showEmpId = (fields.empid !== false) && (fields.employeeId !== false);
    const showFather = (fields.father !== false) && (fields.fatherName !== false);
    const showPhone = fields.phone !== false;
    const showEmail = fields.email !== false;
    const showBlood = (fields.blood !== false) && (fields.bloodGroup !== false);
    const showAddress = fields.address !== false;
    const showQrCode = fields.qrcode !== false;
    const showBarcode = fields.barcode !== false;
    const showValidity = fields.validity !== false;

    // Resolve Logo
    let logoSrc = '';
    if (template.logo) {
        if (template.logo === 'preset-vsa-logo') {
            const vsaLogo = getVsaDefaultLogo();
            if (vsaLogo && vsaLogo.startsWith('data:image/')) {
                logoSrc = vsaLogo;
            } else {
                logoSrc = getPresetShield(template.accentColor || '#dfba5f');
            }
        } else if (template.logo === 'preset-shield') {
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
        if (template.signature === 'preset-vsa-sig') {
            const vsaSig = getVsaDefaultSig();
            if (vsaSig && vsaSig.startsWith('data:image/')) {
                sigSrc = vsaSig;
            } else {
                sigSrc = getPresetSig1('#000000');
            }
        } else if (template.signature === 'preset-sig1') {
            sigSrc = getPresetSig1('#000000');
        } else if (template.signature === 'preset-sig2') {
            sigSrc = getPresetSig2('#000000');
        } else {
            sigSrc = template.signature;
        }
    } else {
        sigSrc = getPresetSig1('#000000');
    }
    
    // Apply dynamic client-side signature background cleaning & ink-toning
    sigSrc = getProcessedSignature(sigSrc);

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

    // User-overridable label/value colors and layout
    const labelColor = template.labelColor || subtextColor;
    const valueColor = template.valueColor || textColor;
    const rowPadding = template.rowPadding !== undefined ? template.rowPadding : 3;
    const labelWidth = template.labelWidth !== undefined ? template.labelWidth : 45;
    const labelValueSpacing = template.labelValueSpacing !== undefined ? template.labelValueSpacing : 10;

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

    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const qrHost = (isLocalhost && VSA_STATE.lanIp && !VSA_STATE.lanIp.startsWith('localhost'))
        ? VSA_STATE.lanIp
        : window.location.host;
    const secureTokenParam = emp.secureToken ? `&token=${emp.secureToken}` : '';
    const verificationUrl = `${window.location.protocol}//${qrHost}/verification.html?id=${emp.id}${secureTokenParam}`;

    // Dynamically construct details table rows based on template.fieldOrder
    const fieldOrder = template.fieldOrder || ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email'];
    const defaultOrder = ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email'];
    const finalOrder = [...fieldOrder];
    defaultOrder.forEach(key => {
        if (!finalOrder.includes(key)) {
            finalOrder.push(key);
        }
    });

    let detailsTableRowsHtml = '';
    if (template.id === 'tpl-nift') {
        detailsTableRowsHtml = `
        <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
            <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Employee ID:</td>
            <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.id, false)}</td>
        </tr>
        <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
            <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Employee Name:</td>
            <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.name)}</td>
        </tr>
        <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
            <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Designation:</td>
            <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.designation)}</td>
        </tr>
        <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
            <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Address:</td>
            <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; white-space: normal; line-height: 1.1; letter-spacing: 0.5px;">${cleanTextVal(emp.currentAddress || emp.permanentAddress || '-')}</td>
        </tr>
        <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
            <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Contact No:</td>
            <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.mobile || '-')}</td>
        </tr>
        <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
            <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Blood Group:</td>
            <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.bloodGroup || '-')}</td>
        </tr>
        <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
            <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Deputed At:</td>
            <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; white-space: normal; line-height: 1.1; word-break: break-word; letter-spacing: 0.5px;">National Institute of Fashion Technology, Srinagar</td>
        </tr>`;
    } else {
        finalOrder.forEach(key => {
            if (key === 'empid' && showEmpId) {
                detailsTableRowsHtml += `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Staff ID:</td>
                    <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.id, false)}</td>
                </tr>`;
            } else if (key === 'father' && showFather) {
                const relationLabel = emp.relationType ? `${emp.relationType}:` : 'Father:';
                detailsTableRowsHtml += `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">${relationLabel}</td>
                    <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.fatherName || '-')}</td>
                </tr>`;
            } else if (key === 'department' && showDepartment) {
                detailsTableRowsHtml += `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Dept:</td>
                    <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; white-space: normal; line-height: 1.1; word-break: break-word; letter-spacing: 0.5px;">${cleanTextVal(emp.department || '-')}</td>
                </tr>`;
            } else if (key === 'blood' && showBlood) {
                detailsTableRowsHtml += `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Blood Group:</td>
                    <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.bloodGroup || '-')}</td>
                </tr>`;
            } else if (key === 'validity' && showValidity) {
                detailsTableRowsHtml += `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Validity:</td>
                    <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${validityStr}</td>
                </tr>`;
            } else if (key === 'address' && showAddress) {
                detailsTableRowsHtml += `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Address:</td>
                    <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; white-space: normal; line-height: 1.1; letter-spacing: 0.5px;" title="${cleanTextVal(emp.currentAddress || emp.permanentAddress || '-')}">${cleanTextVal(emp.currentAddress || emp.permanentAddress || '-')}</td>
                </tr>`;
            } else if (key === 'phone' && showPhone) {
                detailsTableRowsHtml += `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Mobile:</td>
                    <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;">${cleanTextVal(emp.mobile || '-')}</td>
                </tr>`;
            } else if (key === 'email' && showEmail) {
                detailsTableRowsHtml += `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPadding}px 0; width: ${labelWidth}% !important; max-width: ${labelWidth}%; text-transform: uppercase; text-align: left; white-space: nowrap; letter-spacing: 0.5px;">Email:</td>
                    <td class="id-table-value" style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPadding}px 0; width: ${100 - labelWidth}% !important; max-width: ${100 - labelWidth}%; text-align: left; padding-left: ${labelValueSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.5px;" title="${emp.email || '-'}">${emp.email || '-'}</td>
                </tr>`;
            }
        });
    }

    if (template.layout === 'horizontal') {
        return `
        <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
            <!-- SINGLE-SIDED HORIZONTAL ID CARD -->
            <div class="id-card-horizontal visual-id-card-render" style="font-family: ${template.font || "'Outfit', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#dfba5f'}; display: flex; flex-direction: column; justify-content: flex-start; height: 320px; width: 500px; box-sizing: border-box; overflow: hidden; position: relative; --logo-size: ${logoSize}px; --photo-width: ${photoWidth}px; --photo-height: ${photoHeight}px; --qr-size: ${qrSize}px; --name-font-size: ${nameFontSize}px; --designation-font-size: ${designationFontSize}px; --details-font-size: ${detailsFontSize}px; --row-padding: ${rowPadding}px;">
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
                <div class="id-horizontal-body" style="display: flex; gap: 15px; flex-grow: 1; min-height: 0; align-items: stretch; margin-top: 8px;">
                    
                    <!-- Column 1: Photo and Signature -->
                    <div class="id-horizontal-left" style="width: ${photoWidth}px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        <!-- Photo -->
                        ${showPhoto ? `
                        <div class="id-portrait-photo-box" style="border: 2px solid ${template.accentColor || '#dfba5f'}; width: ${photoWidth}px; height: ${photoHeight}px; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.15); flex-shrink: 0; background: #eaeaea; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                            <img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        ` : ''}
                        
                        <!-- Signature (always visible) -->
                        <div style="width: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: auto;">
                            <div style="height: 30px; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                <img src="${sigSrc}" style="max-height: 100%; max-width: 100%; object-fit: contain; mix-blend-mode: multiply; filter: blur(0.22px) contrast(1.4) brightness(1.02) drop-shadow(0 0 0.18px rgba(10, 25, 47, 0.45)); opacity: 0.93;">
                            </div>
                            <span style="font-size: 6px; color: ${subtextColor}; text-transform: uppercase; font-weight: bold; margin-top: 2px; text-align: center; white-space: nowrap; width: 100%;">Authority Sig</span>
                        </div>
                    </div>
                    
                    <!-- Column 2: Name, Designation, and Details Table -->
                    <div class="id-horizontal-right" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; border-right: 1px solid rgba(128,128,128,0.15); padding-right: 10px;">
                        <!-- Name & Designation -->
                        <div style="margin-bottom: 4px; border-bottom: 1px solid rgba(128,128,128,0.15); padding-bottom: 2px;">
                            ${showName ? `
                            <h2 class="id-portrait-name" style="color: ${textColor}; font-size: ${nameFontSize}px; font-weight: 800; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; letter-spacing: 0.5px;">
                                ${cleanTextVal(emp.name)}
                            </h2>
                            ` : ''}
                            ${showDesignation ? `
                            <h3 class="id-portrait-designation" style="color: ${template.accentColor || '#dfba5f'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 1px 0 0 0; white-space: normal; line-height: 1.1; word-break: break-word; letter-spacing: 0.5px;">
                                ${cleanTextVal(emp.designation)}
                            </h3>
                            ` : ''}
                        </div>
                        
                        <!-- Details Table -->
                        <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: auto;">
                            ${detailsTableRowsHtml}
                        </table>
                    </div>
                    
                    <!-- Column 3: QR Code, Barcode, and terms -->
                    <div style="width: ${Math.max(85, qrSize + 15)}px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        <!-- QR Code -->
                        ${showQrCode ? `
                        <div class="id-portrait-qr" style="width: ${qrSize}px; height: ${qrSize}px; background: #ffffff; padding: 3px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-bottom: 5px;">
                            <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${qrSize - 6}" style="width: ${qrSize - 6}px; height: ${qrSize - 6}px; display: block;"></canvas>
                        </div>
                        ` : ''}
                        
                        <!-- Instructions -->
                        <div style="font-size: ${Math.max(4.2, detailsFontSize * 0.6)}px; color: ${subtextColor}; line-height: 1.2; text-align: center; width: 100%; padding: 3px; border-radius: 3px; background: rgba(128,128,128,0.06); border: 1px solid rgba(128,128,128,0.1); margin-bottom: 5px;">
                            VSA property.<br>Return: Shaheed Gunj Srinagar.
                        </div>
                        
                        <!-- Barcode -->
                        ${showBarcode ? `
                        <div style="width: 100%; display: flex; justify-content: center; align-items: center; height: 20px; flex-shrink: 0; margin-top: auto;">
                            <canvas class="barcode-canvas-rendered" data-barcode-val="${emp.id}" data-barcode-type="CODE128" style="width: ${Math.max(85, qrSize + 15)}px; height: 18px;"></canvas>
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
            <div class="id-card-portrait visual-id-card-render" style="font-family: ${template.font || "'Outfit', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#dfba5f'}; display: flex; flex-direction: column; justify-content: flex-start; height: 500px; width: 320px; box-sizing: border-box; overflow: hidden; position: relative; --logo-size: ${logoSize}px; --photo-width: ${photoWidth}px; --photo-height: ${photoHeight}px; --qr-size: ${qrSize}px; --name-font-size: ${nameFontSize}px; --designation-font-size: ${designationFontSize}px; --details-font-size: ${detailsFontSize}px; --row-padding: ${rowPadding}px;">
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
                    <div style="width: ${Math.max(85, photoWidth, qrSize)}px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        <!-- Photo -->
                        ${showPhoto ? `
                        <div class="id-portrait-photo-box" style="border: 2px solid ${template.accentColor || '#dfba5f'}; width: ${photoWidth}px; height: ${photoHeight}px; border-radius: 6px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.15); flex-shrink: 0; background: #eaeaea; display: flex; align-items: center; justify-content: center; margin-bottom: 5px;">
                            <img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover;">
                        </div>
                        ` : ''}
                        
                        <!-- QR Code -->
                        ${showQrCode ? `
                        <div class="id-portrait-qr" style="width: ${qrSize}px; height: ${qrSize}px; background: #ffffff; padding: 3px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 5px; flex-shrink: 0;">
                            <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${qrSize - 6}" style="width: ${qrSize - 6}px; height: ${qrSize - 6}px; display: block;"></canvas>
                        </div>
                        ` : ''}
                        
                        <!-- Signature (always visible) -->
                        <div style="width: ${Math.max(85, photoWidth)}px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: auto;">
                            <div style="height: 30px; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                <img src="${sigSrc}" style="max-height: 100%; max-width: 100%; object-fit: contain; mix-blend-mode: multiply; filter: blur(0.22px) contrast(1.4) brightness(1.02) drop-shadow(0 0 0.18px rgba(10, 25, 47, 0.45)); opacity: 0.93;">
                            </div>
                            <span style="font-size: 6px; color: ${subtextColor}; text-transform: uppercase; font-weight: bold; margin-top: 2px; text-align: center; white-space: nowrap; width: 100%;">Authority Sig</span>
                        </div>
                    </div>
                    
                    <!-- Right column: Name, Designation, Details Table -->
                    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; padding-left: 5px;">
                        <!-- Name & Designation -->
                        <div style="margin-bottom: 6px; border-bottom: 1px solid rgba(128,128,128,0.15); padding-bottom: 4px;">
                            ${showName ? `
                            <h2 class="id-portrait-name" style="color: ${textColor}; font-size: ${nameFontSize}px; font-weight: 800; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; letter-spacing: 0.5px;">
                                ${cleanTextVal(emp.name)}
                            </h2>
                            ` : ''}
                            ${showDesignation ? `
                            <h3 class="id-portrait-designation" style="color: ${template.accentColor || '#dfba5f'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 2px 0 0 0; white-space: normal; line-height: 1.1; word-break: break-word; letter-spacing: 0.5px;">
                                ${cleanTextVal(emp.designation)}
                            </h3>
                            ` : ''}
                        </div>
                        
                        <!-- Details Table -->
                        <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 5px;">
                            ${detailsTableRowsHtml}
                        </table>
                        
                        <!-- Instructions/Footer -->
                        <div style="font-size: ${Math.max(4.5, detailsFontSize * 0.65)}px; color: ${subtextColor}; line-height: 1.2; margin-top: auto; padding: 4px; border-radius: 4px; background: rgba(128,128,128,0.06); border: 1px solid rgba(128,128,128,0.1); word-break: break-word;">
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

function adjustCardTextSizes(container) {
    const cards = container.querySelectorAll('.visual-id-card-render');
    cards.forEach(card => {
        const isHorizontal = card.classList.contains('id-card-horizontal');
        
        // 1. Fit Header Brand Title and Subtitle
        const titleEl = card.querySelector('.id-portrait-title');
        const subtitleEl = card.querySelector('.id-portrait-subtitle');
        if (titleEl) {
            let originalSize = parseFloat(window.getComputedStyle(titleEl).fontSize) || 14;
            if (!titleEl.dataset.originalSize) {
                titleEl.dataset.originalSize = originalSize;
            }
            let size = originalSize;
            const targetWidth = titleEl.clientWidth || (isHorizontal ? 400 : 230);
            const origWhiteSpace = titleEl.style.whiteSpace;
            titleEl.style.whiteSpace = 'nowrap';
            while (titleEl.scrollWidth > targetWidth + 2 && size > 7.5) {
                size -= 0.5;
                titleEl.style.fontSize = size + 'px';
            }
            if (origWhiteSpace) {
                titleEl.style.whiteSpace = origWhiteSpace;
            }
        }
        if (subtitleEl) {
            let originalSize = parseFloat(window.getComputedStyle(subtitleEl).fontSize) || 8;
            if (!subtitleEl.dataset.originalSize) {
                subtitleEl.dataset.originalSize = originalSize;
            }
            let size = originalSize;
            const targetWidth = subtitleEl.clientWidth || (isHorizontal ? 400 : 230);
            const origWhiteSpace = subtitleEl.style.whiteSpace;
            subtitleEl.style.whiteSpace = 'nowrap';
            while (subtitleEl.scrollWidth > targetWidth + 2 && size > 6.0) {
                size -= 0.5;
                subtitleEl.style.fontSize = size + 'px';
            }
            if (origWhiteSpace) {
                subtitleEl.style.whiteSpace = origWhiteSpace;
            }
        }

        // 2. Fit Name
        const nameEl = card.querySelector('.id-portrait-name');
        const designationEl = card.querySelector('.id-portrait-designation');
        
        if (nameEl) {
            let originalSize = parseFloat(window.getComputedStyle(nameEl).fontSize) || (isHorizontal ? 13 : 14);
            if (!nameEl.dataset.originalSize) {
                nameEl.dataset.originalSize = originalSize;
            }
            let size = originalSize;
            const targetWidth = nameEl.clientWidth || (isHorizontal ? 240 : 200);
            const origWhiteSpace = nameEl.style.whiteSpace;
            nameEl.style.whiteSpace = 'nowrap';
            while (nameEl.scrollWidth > targetWidth + 2 && size > 7.5) {
                size -= 0.5;
                nameEl.style.fontSize = size + 'px';
            }
            if (origWhiteSpace) {
                nameEl.style.whiteSpace = origWhiteSpace;
            }
        }

        // 3. Fit nowrap table values horizontally
        const nowrapValues = card.querySelectorAll('.id-table-value');
        nowrapValues.forEach(valEl => {
            const style = window.getComputedStyle(valEl);
            if (style.whiteSpace === 'nowrap' || valEl.style.whiteSpace === 'nowrap' || valEl.style.textOverflow === 'ellipsis') {
                let originalSize = parseFloat(style.fontSize) || 8;
                if (!valEl.dataset.originalSize) {
                    valEl.dataset.originalSize = originalSize;
                }
                let size = originalSize;
                const targetWidth = valEl.clientWidth || (isHorizontal ? 130 : 110);
                
                // Temporarily force nowrap for accurate measurement
                const origWhiteSpace = valEl.style.whiteSpace;
                valEl.style.whiteSpace = 'nowrap';
                
                while (valEl.scrollWidth > targetWidth + 2 && size > 7.5) {
                    size -= 0.5;
                    valEl.style.fontSize = size + 'px';
                    // Scale label as well
                    const tr = valEl.closest('tr');
                    if (tr) {
                        const labelEl = tr.querySelector('td:first-child');
                        if (labelEl) {
                            labelEl.style.fontSize = size + 'px';
                        }
                    }
                }
                if (origWhiteSpace) {
                    valEl.style.whiteSpace = origWhiteSpace;
                }
            }
        });

        // 4. Vertical Fit Pass
        // If the card scrollHeight is larger than the card clientHeight, scale down designation & all table rows.
        const targetCardHeight = card.clientHeight || (isHorizontal ? 320 : 500);
        let maxIterations = 20;
        
        while (card.scrollHeight > targetCardHeight + 4 && maxIterations > 0) {
            let reducedAny = false;
            const resizableElements = [];
            
            // Add designation
            if (designationEl) {
                const currentSize = parseFloat(window.getComputedStyle(designationEl).fontSize) || (isHorizontal ? 9 : 10);
                if (currentSize > 7.5) {
                    resizableElements.push({ el: designationEl, currentSize });
                }
            }
            
            // Add all table values/labels
            const tableRows = card.querySelectorAll('.id-portrait-table tr');
            tableRows.forEach(tr => {
                const label = tr.querySelector('td:first-child');
                const val = tr.querySelector('.id-table-value');
                if (val) {
                    const currentSize = parseFloat(window.getComputedStyle(val).fontSize) || 8;
                    if (currentSize > 7.5) {
                        resizableElements.push({ el: val, labelEl: label, currentSize });
                    }
                }
            });
            
            if (resizableElements.length === 0) break;
            
            resizableElements.forEach(item => {
                const newSize = item.currentSize - 0.5;
                item.el.style.fontSize = newSize + 'px';
                if (item.labelEl) {
                    item.labelEl.style.fontSize = newSize + 'px';
                }
                reducedAny = true;
            });
            
            if (!reducedAny) break;
            maxIterations--;
        }
    });
}

function renderQrsInContainer(container) {
    // Render QRs
    const canvases = container.querySelectorAll('.qr-canvas-rendered');
    canvases.forEach(canvas => {
        const val = canvas.getAttribute('data-qr-val');
        if (!val) return; // skip blank QR
        const size = parseInt(canvas.getAttribute('data-qr-size')) || 100;
        const bg = canvas.getAttribute('data-qr-bg') || '#ffffff';
        const fg = canvas.getAttribute('data-qr-fg') || '#000000';
        // Fix blank QR: set actual pixel dimensions before QRious renders
        canvas.width = size;
        canvas.height = size;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        try {
            new QRious({
                element: canvas,
                value: val,
                size: size,
                background: bg,
                foreground: fg,
                level: 'H',
                padding: 0
            });
        } catch(e) {
            console.warn('QR render failed:', e);
        }
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

    // Auto-adjust font sizes to fit card layout perfectly
    adjustCardTextSizes(container);
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
    const issueDateVal = document.getElementById('id-card-issue-date')?.value || null;

    container.innerHTML = generateIdCardHtml(emp, template, validityYears, issueDateVal);
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
        reportHeaders = ["S.No", "ID", "Name", "Designation", "Joining Date", "Department", "Mobile Number", "Category", "Status"];
        dataset.forEach((emp, idx) => {
            reportData.push([
                idx + 1, emp.id, emp.name, emp.designation, emp.joiningDate, 
                emp.department || "-", emp.mobile, emp.category, emp.status
            ]);
        });
    } else if (type === 'active') {
        reportHeaders = ["S.No", "ID", "Name", "Designation", "Joining Date", "Department", "Mobile"];
        dataset.filter(emp => emp.status === 'Active').forEach((emp, idx) => {
            reportData.push([
                idx + 1, emp.id, emp.name, emp.designation, emp.joiningDate, 
                emp.department || "-", emp.mobile
            ]);
        });
    } else if (type === 'inactive') {
        reportHeaders = ["S.No", "ID", "Name", "Designation", "Joining Date", "Mobile", "Status"];
        dataset.filter(emp => emp.status !== 'Active').forEach((emp, idx) => {
            reportData.push([
                idx + 1, emp.id, emp.name, emp.designation, emp.joiningDate, emp.mobile, emp.status
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
    // Setup live Title Case auto-capitalization on input fields
    setupLiveTitleCaseInput('reg-name');
    setupLiveTitleCaseInput('reg-father');
    setupLiveTitleCaseInput('reg-curr-address');
    setupLiveTitleCaseInput('form-name');
    setupLiveTitleCaseInput('form-father');
    setupLiveTitleCaseInput('form-curr-address');
    setupLiveTitleCaseInput('form-perm-address');

    // Setup nav shortcuts globally (e.g. "View All Personnel" dashboard button)
    document.querySelectorAll('.nav-shortcut').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');
            switchToView(target);
        });
    });

    // KPI stats cards redirection filters
    const kpiTotal = document.getElementById('stat-card-total');
    if (kpiTotal) {
        kpiTotal.addEventListener('click', () => {
            document.getElementById('emp-filter-designation').value = '';
            document.getElementById('emp-filter-department').value = '';
            document.getElementById('emp-filter-location').value = '';
            document.getElementById('emp-filter-status').value = '';
            document.getElementById('emp-filter-search').value = '';
            switchToView('employees');
            renderEmployeeDirectory();
        });
    }

    const kpiActive = document.getElementById('stat-card-active');
    if (kpiActive) {
        kpiActive.addEventListener('click', () => {
            document.getElementById('emp-filter-designation').value = '';
            document.getElementById('emp-filter-department').value = '';
            document.getElementById('emp-filter-location').value = '';
            document.getElementById('emp-filter-status').value = 'Active';
            document.getElementById('emp-filter-search').value = '';
            switchToView('employees');
            renderEmployeeDirectory();
        });
    }

    const kpiExpirations = document.getElementById('stat-card-expirations');
    if (kpiExpirations) {
        kpiExpirations.addEventListener('click', () => {
            document.getElementById('emp-filter-designation').value = '';
            document.getElementById('emp-filter-department').value = '';
            document.getElementById('emp-filter-location').value = '';
            document.getElementById('emp-filter-status').value = 'Expired';
            document.getElementById('emp-filter-search').value = '';
            switchToView('employees');
            renderEmployeeDirectory();
        });
    }

    const kpiRate = document.getElementById('stat-card-rate');
    if (kpiRate) {
        kpiRate.addEventListener('click', () => {
            document.getElementById('emp-filter-designation').value = '';
            document.getElementById('emp-filter-department').value = '';
            document.getElementById('emp-filter-location').value = '';
            document.getElementById('emp-filter-status').value = 'Active';
            document.getElementById('emp-filter-search').value = '';
            switchToView('employees');
            renderEmployeeDirectory();
        });
    }

    // Quick Actions Panel click handlers
    const qaRegister = document.getElementById('qa-register-new');
    if (qaRegister) {
        qaRegister.addEventListener('click', () => {
            window.location.hash = 'emp-registration';
        });
    }

    const qaExport = document.getElementById('qa-export-csv');
    if (qaExport) {
        qaExport.addEventListener('click', () => {
            exportReportToCSV();
        });
    }

    const qaTemplates = document.getElementById('qa-manage-templates');
    if (qaTemplates) {
        qaTemplates.addEventListener('click', () => {
            window.location.hash = 'templates';
        });
    }

    const qaConfig = document.getElementById('qa-sys-config');
    if (qaConfig) {
        qaConfig.addEventListener('click', () => {
            window.location.hash = 'settings';
        });
    }

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
        window.location.hash = 'emp-registration';
    });

    document.getElementById('btn-back-to-list').addEventListener('click', () => {
        window.location.hash = 'employees';
    });

    document.getElementById('btn-reg-cancel').addEventListener('click', () => {
        window.location.hash = 'employees';
        resetRegistrationForm();
    });

    const regApproveBtn = document.getElementById('btn-reg-approve');
    if (regApproveBtn) {
        regApproveBtn.addEventListener('click', async () => {
            const empId = document.getElementById('reg-emp-id').value;
            if (!empId) return;

            const confirmApprove = confirm(`Are you sure you want to APPROVE and ACTIVATE guard ${empId}?`);
            if (!confirmApprove) return;

            isApprovalAction = true;
            // Submit form to save edits and set status to Active
            document.getElementById('employee-registration-form').requestSubmit();
        });
    }

    const regRejectBtn = document.getElementById('btn-reg-reject');
    if (regRejectBtn) {
        regRejectBtn.addEventListener('click', async () => {
            const empId = document.getElementById('reg-emp-id').value;
            if (!empId) return;

            const confirmReject = confirm(`Are you sure you want to REJECT and DELETE guard registration ${empId}?`);
            if (!confirmReject) return;

            try {
                const response = await fetch(`/api/employees/${empId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Rejection failed');
                alert('Registration rejected and deleted.');
                
                window.location.hash = 'employees';
                resetRegistrationForm();
                fetchData();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    // Photo and Signature upload handlers
    document.getElementById('reg-photo').addEventListener('change', function(e) {
        openPhotoCropper(this, 'reg-photo-preview');
    });

    document.getElementById('reg-signature').addEventListener('change', function(e) {
        handleImageUpload(e, 'reg-signature-preview');
    });

    // Auto-calculate age listener when reg-dob changes
    document.getElementById('reg-dob').addEventListener('change', function() {
        const dobVal = this.value;
        if (dobVal) {
            const dobDate = new Date(dobVal);
            const today = new Date();
            let age = today.getFullYear() - dobDate.getFullYear();
            const m = today.getMonth() - dobDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                age--;
            }
            document.getElementById('reg-age').value = age > 0 ? age : '';
        } else {
            document.getElementById('reg-age').value = '';
        }
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

    const formRelationTypeSelect = document.getElementById('form-relation-type');
    if (formRelationTypeSelect) {
        formRelationTypeSelect.addEventListener('change', function(e) {
            const type = e.target.value;
            const label = document.getElementById('form-father-label');
            if (label) {
                label.textContent = `${type}'s Name *`;
            }
            const input = document.getElementById('form-father');
            if (input) {
                input.placeholder = `Enter ${type.toLowerCase()}'s name`;
            }
        });
    }

    document.getElementById('employee-registration-form').addEventListener('submit', saveEmployeeFromRegistration);

    // === OLD EMPLOYEE MODAL HANDLERS (KEEPING FOR BACKWARD COMPATIBILITY) ===
    // A. Employee Directory filtering
    document.getElementById('emp-filter-search').addEventListener('input', debounce(renderEmployeeDirectory, 300));
    document.getElementById('emp-filter-designation').addEventListener('change', renderEmployeeDirectory);
    document.getElementById('emp-filter-status').addEventListener('change', renderEmployeeDirectory);
    
    const empFilterDept = document.getElementById('emp-filter-department');
    if (empFilterDept) empFilterDept.addEventListener('change', renderEmployeeDirectory);
    
    const empFilterLoc = document.getElementById('emp-filter-location');
    if (empFilterLoc) empFilterLoc.addEventListener('change', renderEmployeeDirectory);

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
        openPhotoCropper(this, 'form-photo-preview-box');
    });
    document.getElementById('form-sig-upload').addEventListener('change', function() {
        handleImageCompression(this, 'form-sig-preview-box', () => {});
    });

    // Auto-calculate age listener when DOB changes
    document.getElementById('form-dob').addEventListener('change', function() {
        const dobVal = this.value;
        if (dobVal) {
            const dobDate = new Date(dobVal);
            const today = new Date();
            let age = today.getFullYear() - dobDate.getFullYear();
            const m = today.getMonth() - dobDate.getMonth();
            if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                age--;
            }
            document.getElementById('form-age').value = age > 0 ? age : '';
        } else {
            document.getElementById('form-age').value = '';
        }
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

    // Refresh card preview when issue date changes
    const issueDateInputEl = document.getElementById('id-card-issue-date');
    if (issueDateInputEl) {
        issueDateInputEl.addEventListener('change', function() {
            const empId = document.getElementById('id-select-employee').value;
            if (empId) loadIdCardDetails(empId);
        });
    }

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
    setupInboxModalHandlers();
    setupOcrScanner();
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
                <span class="search-dropdown-name">${toTitleCase(emp.name)} (${emp.id})</span>
                <span class="search-dropdown-meta">${toTitleCase(emp.designation)} • Status: ${emp.status}</span>
            </div>
        `).join('');

        // Wire selections inside dropdown
        dropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                const empId = item.getAttribute('data-id');
                dropdown.classList.add('hidden');
                document.getElementById('global-search').value = '';
                // Jump routing trigger to Employee Details registration edit
                window.location.hash = `emp-registration?mode=edit&id=${empId}`;
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
    
    const approveBtn = document.getElementById('btn-reg-approve');
    const rejectBtn = document.getElementById('btn-reg-reject');
    const saveBtn = document.getElementById('btn-reg-save');

    if (mode === 'edit' && empId) {
        // Load existing employee data
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (emp) {
            populateRegistrationForm(emp);
            document.querySelector('.section-header h1').textContent = 'Edit Employee Record';
            
            if (emp.status === 'Pending') {
                if (approveBtn) approveBtn.classList.remove('hidden');
                if (rejectBtn) rejectBtn.classList.remove('hidden');
                if (saveBtn) saveBtn.classList.add('hidden');
            } else {
                if (approveBtn) approveBtn.classList.add('hidden');
                if (rejectBtn) rejectBtn.classList.add('hidden');
                if (saveBtn) saveBtn.classList.remove('hidden');
            }
        }
    } else {
        resetRegistrationForm();
        document.querySelector('.section-header h1').textContent = 'Register New Employee';
        if (approveBtn) approveBtn.classList.add('hidden');
        if (rejectBtn) rejectBtn.classList.add('hidden');
        if (saveBtn) saveBtn.classList.remove('hidden');
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
    
    const regCompany = document.getElementById('reg-company');
    if (regCompany) {
        regCompany.value = 'Valley Security Service Agency Pvt Ltd.';
    }

    // Clear dynamic file uploads data attributes
    delete document.getElementById('reg-photo').dataset.imageData;
    delete document.getElementById('reg-signature').dataset.imageData;
}

function populateRegistrationForm(emp) {
    document.getElementById('reg-emp-id').value = emp.id;
    document.getElementById('reg-name').value = toTitleCase(emp.name);
    
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
    document.getElementById('reg-father').value = toTitleCase(emp.fatherName || emp.guardianName || '');
    
    document.getElementById('reg-dob').value = emp.dob;
    document.getElementById('reg-gender').value = emp.gender;
    document.getElementById('reg-blood').value = emp.bloodGroup;
    
    document.getElementById('reg-mobile').value = emp.mobile;
    document.getElementById('reg-curr-address').value = toTitleCase(emp.currentAddress || emp.permanentAddress || '');
    
    document.getElementById('reg-designation').value = emp.designation || '';
    document.getElementById('reg-department').value = emp.department || '';

    document.getElementById('reg-joining-date').value = emp.joiningDate;
    document.getElementById('reg-card-validity').value = emp.cardValidity || 3;
    if (document.getElementById('reg-card-issue-date')) {
        document.getElementById('reg-card-issue-date').value = emp.cardIssueDate || '';
    }
    
    // Populate new VSA form fields
    document.getElementById('reg-bank-account').value = emp.bankAccount || '';
    document.getElementById('reg-ifsc').value = emp.ifsc || '';
    document.getElementById('reg-aadhaar-no').value = emp.aadhaarNo || '';
    document.getElementById('reg-pincode').value = emp.pinCode || '';
    document.getElementById('reg-esic-no').value = emp.esicNo || '';
    document.getElementById('reg-uan-no').value = emp.uanNo || '';
    document.getElementById('reg-guardian-name').value = emp.guardianName || '';
    document.getElementById('reg-guardian-mobile').value = emp.guardianMobile || '';
    document.getElementById('reg-verification-by').value = emp.verificationIssuedBy || '';
    document.getElementById('reg-verification-validity').value = emp.verificationValidity || '';
    document.getElementById('reg-documents-received').value = emp.originalDocuments || '';
    document.getElementById('reg-reference-by').value = emp.referenceBy || '';
    document.getElementById('reg-company').value = emp.companyName || 'Valley Security Service Agency Pvt Ltd.';
    document.getElementById('reg-salary').value = emp.salaryMonth || '';
    document.getElementById('reg-age').value = emp.age || '';
    document.getElementById('reg-remarks').value = emp.remarks || '';

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
        document.getElementById('reg-signature-preview').innerHTML = `<img src="${getProcessedSignature(emp.documents.signature)}" style="max-height: 100px;">`;
    } else {
        document.getElementById('reg-signature-preview').innerHTML = '<span class="preview-placeholder">Click to upload signature</span>';
    }
}

/**
 * Automatically detects the background color of a portrait photo (by sampling corners)
 * and uses a BFS flood-fill algorithm from the edges to replace the colored background
 * (like red, blue, green, etc.) with a solid white background.
 */
function removePortraitBackground(base64Str, threshold = 40) {
    return new Promise((resolve) => {
        if (!base64Str || !base64Str.startsWith('data:image/')) {
            resolve(base64Str);
            return;
        }
        
        const runFallback = (img, res) => {
            try {
                const canvas = document.createElement('canvas');
                const maxDim = 400;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                
                const imgData = ctx.getImageData(0, 0, w, h);
                const data = imgData.data;
                const width = w;
                const height = h;
                
                const getPixel = (x, y) => {
                    const idx = (y * width + x) * 4;
                    return {r: data[idx], g: data[idx+1], b: data[idx+2]};
                };
                
                const borderPixels = [];
                const sampleStep = 4;
                for (let x = 0; x < width; x += sampleStep) {
                    borderPixels.push(getPixel(x, 0));
                }
                for (let y = 1; y < height; y += sampleStep) {
                    borderPixels.push(getPixel(0, y));
                    borderPixels.push(getPixel(width - 1, y));
                }
                
                const colorDist = (c1, c2) => {
                    return Math.sqrt((c1.r - c2.r)**2 + (c1.g - c2.g)**2 + (c1.b - c2.b)**2);
                };
                
                const density = borderPixels.map(p => {
                    let count = 0;
                    borderPixels.forEach(other => {
                        if (colorDist(p, other) < 25) count++;
                    });
                    return { pixel: p, count };
                });
                
                density.sort((a, b) => b.count - a.count);
                
                const anchors = [];
                const maxAnchors = 4;
                const minAcceptableCount = borderPixels.length * 0.15;
                
                for (let i = 0; i < density.length; i++) {
                    const candidate = density[i].pixel;
                    const count = density[i].count;
                    if (count < minAcceptableCount) break;
                    
                    let tooClose = false;
                    for (let j = 0; j < anchors.length; j++) {
                        if (colorDist(candidate, anchors[j]) < 30) {
                            tooClose = true;
                            break;
                        }
                    }
                    if (!tooClose) {
                        anchors.push(candidate);
                        if (anchors.length >= maxAnchors) break;
                    }
                }
                
                if (anchors.length === 0) {
                    anchors.push(getPixel(0, 0));
                }
                
                const visited = new Uint8Array(width * height);
                const queue = [];
                for (let x = 0; x < width; x++) {
                    queue.push({ x, y: 0 });
                    visited[x] = 1;
                }
                for (let y = 1; y < height; y++) {
                    queue.push({ x: 0, y });
                    queue.push({ x: width - 1, y });
                    visited[y * width] = 1;
                    visited[y * width + (width - 1)] = 1;
                }
                
                const isColorSimilarToAnchors = (r, g, b) => {
                    const p = { r, g, b };
                    for (let i = 0; i < anchors.length; i++) {
                        if (colorDist(p, anchors[i]) < threshold) return true;
                    }
                    return false;
                };
                
                let head = 0;
                while (head < queue.length) {
                    const {x, y} = queue[head++];
                    const idx = (y * width + x) * 4;
                    const r = data[idx];
                    const g = data[idx+1];
                    const b = data[idx+2];
                    
                    if (isColorSimilarToAnchors(r, g, b)) {
                        data[idx] = 255;
                        data[idx+1] = 255;
                        data[idx+2] = 255;
                        data[idx+3] = 255;
                        
                        const neighbors = [
                            {x: x - 1, y},
                            {x: x + 1, y},
                            {x, y: y - 1},
                            {x, y: y + 1}
                        ];
                        neighbors.forEach(n => {
                            if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                                const nIdx = n.y * width + n.x;
                                if (!visited[nIdx]) {
                                    visited[nIdx] = 1;
                                    queue.push(n);
                                }
                            }
                        });
                    }
                }
                
                ctx.putImageData(imgData, 0, 0);
                res(canvas.toDataURL('image/jpeg', 0.95));
            } catch (err) {
                console.error("Fallback background removal failed:", err);
                res(base64Str);
            }
        };

        const img = new Image();
        img.onload = async () => {
            if (typeof window !== 'undefined' && window.SelfieSegmentation) {
                try {
                    const canvas = document.createElement('canvas');
                    const maxDim = 400;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    
                    // Initialize MediaPipe Selfie Segmentation locally with fully qualified absolute URLs
                    const selfieSegmentation = new window.SelfieSegmentation({
                        locateFile: (file) => {
                            return window.location.origin + `/lib/selfie_segmentation/${file}`;
                        }
                    });
                    
                    selfieSegmentation.setOptions({
                        modelSelection: 0, // General model (highly precise head/shoulder outlines)
                    });
                    
                    // Set a timeout of 3.5 seconds to prevent hanging if WebGL context creation fails
                    let resolved = false;
                    const timeoutId = setTimeout(() => {
                        if (!resolved) {
                            resolved = true;
                            console.warn("MediaPipe Selfie Segmentation timed out, using flood fill fallback...");
                            try { selfieSegmentation.close(); } catch(e){}
                            runFallback(img, resolve);
                        }
                    }, 3500);

                    selfieSegmentation.onResults((results) => {
                        if (resolved) return;
                        resolved = true;
                        clearTimeout(timeoutId);

                        try {
                            // Clear canvas to white background
                            ctx.fillStyle = '#FFFFFF';
                            ctx.fillRect(0, 0, w, h);
                            
                            // Draw original image first
                            ctx.drawImage(img, 0, 0, w, h);
                            
                            // Draw mask onto temporary canvas to read pixels
                            const maskCanvas = document.createElement('canvas');
                            maskCanvas.width = w;
                            maskCanvas.height = h;
                            const maskCtx = maskCanvas.getContext('2d');
                            maskCtx.drawImage(results.segmentationMask, 0, 0, w, h);
                            
                            const imgData = ctx.getImageData(0, 0, w, h);
                            const maskData = maskCtx.getImageData(0, 0, w, h);
                            const data = imgData.data;
                            const mData = maskData.data;
                            
                            // MediaPipe mask outputs white (255) for person, black (0) for background.
                            // We replace any pixel with low mask probability (< 125) with solid white background.
                            // For transitional edge pixels (125 to 230), we blend smoothly with white to eliminate halos.
                            const lowerVal = 125;
                            const upperVal = 230;
                            const range = upperVal - lowerVal;
                            
                            for (let i = 0; i < data.length; i += 4) {
                                const maskVal = mData[i]; // Grayscale/Red channel
                                if (maskVal < lowerVal) {
                                    data[i] = 255;
                                    data[i+1] = 255;
                                    data[i+2] = 255;
                                    data[i+3] = 255;
                                } else if (maskVal < upperVal) {
                                    const alpha = (maskVal - lowerVal) / range;
                                    data[i] = Math.round(data[i] * alpha + 255 * (1 - alpha));
                                    data[i+1] = Math.round(data[i+1] * alpha + 255 * (1 - alpha));
                                    data[i+2] = Math.round(data[i+2] * alpha + 255 * (1 - alpha));
                                    data[i+3] = 255;
                                }
                            }
                            
                            ctx.putImageData(imgData, 0, 0);
                            selfieSegmentation.close();
                            resolve(canvas.toDataURL('image/jpeg', 0.95));
                        } catch(e) {
                            console.error("Error applying MediaPipe mask, falling back:", e);
                            runFallback(img, resolve);
                        }
                    });
                    
                    await selfieSegmentation.send({ image: img });
                } catch (err) {
                    console.error("MediaPipe processing failed, falling back:", err);
                    runFallback(img, resolve);
                }
            } else {
                runFallback(img, resolve);
            }
        };
        img.onerror = () => {
            resolve(base64Str);
        };
        img.src = base64Str;
    });
}


function handleImageUpload(e, previewBoxId) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const rawBase64 = event.target.result;
        const input = e.target;
        
        if (previewBoxId === 'reg-photo-preview') {
            // Automatically clean color background to white for employee photo
            const previewBox = document.getElementById(previewBoxId);
            previewBox.innerHTML = '<span class="preview-placeholder" style="color: var(--theme-accent); font-weight: 500;">✨ Auto-cleaning background to white...</span>';
            
            removePortraitBackground(rawBase64, 55).then(processedBase64 => {
                const img = document.createElement('img');
                img.src = processedBase64;
                img.style.maxHeight = '100px';
                
                previewBox.innerHTML = '';
                previewBox.appendChild(img);
                input.dataset.imageData = processedBase64;
            }).catch(err => {
                console.error("Failed auto-cleaning photo background:", err);
                const img = document.createElement('img');
                img.src = rawBase64;
                img.style.maxHeight = '100px';
                previewBox.innerHTML = '';
                previewBox.appendChild(img);
                input.dataset.imageData = rawBase64;
            });
        } else {
            const img = document.createElement('img');
            if (previewBoxId.includes('signature') || previewBoxId.includes('sig')) {
                img.src = getProcessedSignature(rawBase64);
            } else {
                img.src = rawBase64;
            }
            img.style.maxHeight = '100px';
            
            const previewBox = document.getElementById(previewBoxId);
            previewBox.innerHTML = '';
            previewBox.appendChild(img);
            input.dataset.imageData = rawBase64;
        }
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
    const cardIssueDateVal = document.getElementById('reg-card-issue-date')?.value || null;

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
        pinCode: document.getElementById('reg-pincode').value || '190001',
        designation: document.getElementById('reg-designation').value,
        department: document.getElementById('reg-department').value,
        manpowerType: 'Security Force',
        joiningDate: document.getElementById('reg-joining-date').value,
        cardValidity: cardValidity,
        cardIssueDate: cardIssueDateVal,
        reportingManager: 'Vikram Rathore',
        status: isApprovalAction ? 'Active' : (currentRegistrationMode === 'edit' ? (VSA_STATE.employees.find(emp => emp.id === empId)?.status || 'Active') : 'Active'),
        emergencyContactName: fatherName,
        emergencyContactRelation: relationType,
        emergencyContactMobile: mobile,
        
        // VSA physical form fields
        bankAccount: document.getElementById('reg-bank-account').value,
        ifsc: document.getElementById('reg-ifsc').value,
        aadhaarNo: document.getElementById('reg-aadhaar-no').value,
        esicNo: document.getElementById('reg-esic-no').value,
        uanNo: document.getElementById('reg-uan-no').value,
        guardianName: document.getElementById('reg-guardian-name').value,
        guardianMobile: document.getElementById('reg-guardian-mobile').value,
        verificationIssuedBy: document.getElementById('reg-verification-by').value,
        verificationValidity: document.getElementById('reg-verification-validity').value,
        originalDocuments: document.getElementById('reg-documents-received').value,
        referenceBy: document.getElementById('reg-reference-by').value,
        companyName: document.getElementById('reg-company').value,
        salaryMonth: document.getElementById('reg-salary').value,
        age: document.getElementById('reg-age').value,
        remarks: document.getElementById('reg-remarks').value,
        
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
            window.location.hash = 'id-cards';
        } else {
            window.location.hash = 'employees';
        }
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        isApprovalAction = false;
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

async function downloadIdCardImage() {
    const selectedId = document.getElementById('id-select-employee').value;
    if (!selectedId) {
        alert('Please select an employee first');
        return;
    }
    
    const templateId = document.getElementById('id-select-template').value;
    const template = VSA_STATE.templates.find(t => t.id === templateId) || VSA_STATE.templates[0];
    
    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
    } catch (e) {
        console.warn('Font loading wait failed:', e);
    }
    await new Promise(resolve => setTimeout(resolve, 200));

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
                logging: false,
                letterRendering: true
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
            logging: false,
            letterRendering: true
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
    
    const issueDateVal = document.getElementById('id-card-issue-date')?.value || null;
    const cardHtml = generateIdCardHtml(emp, template, emp.cardValidity || 3, issueDateVal);
    
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.left = '-9999px';
    tempDiv.style.top = '-9999px';
    tempDiv.innerHTML = cardHtml;
    document.body.appendChild(tempDiv);
    
    // Render QRs and Barcodes inside container
    renderQrsInContainer(tempDiv);
    
    try {
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
    } catch (e) {
        console.warn('Font loading wait failed:', e);
    }
    await new Promise(resolve => setTimeout(resolve, 200)); // Allow rendering time
    
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
                    logging: false,
                    letterRendering: true
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
            logging: false,
            letterRendering: true
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
    setSafeText('rec-name', toTitleCase(emp.name) || '-');
    const relationType = emp.relationType || 'Father';
    const relationLabel = document.getElementById('rec-relation-label');
    if (relationLabel) {
        relationLabel.textContent = `${relationType}'s Name:`;
    }
    setSafeText('rec-father', toTitleCase(emp.fatherName) || '-');
    setSafeText('rec-dob', emp.dob || '-');
    setSafeText('rec-gender', emp.gender || '-');
    setSafeText('rec-blood', emp.bloodGroup || '-');
    
    setSafeText('rec-mobile', emp.mobile || '-');
    setSafeText('rec-curr-address', toTitleCase(emp.currentAddress || emp.permanentAddress) || '-');
    
    setSafeText('rec-designation', emp.designation || '-');
    setSafeText('rec-department', emp.department || '-');

    setSafeText('rec-joining', emp.joiningDate || '-');
    setSafeText('rec-status', emp.status || '-');
    
    setSafeText('rec-validity', `${emp.cardValidity || 3} Years`);
    
    // New fields
    setSafeText('rec-age', emp.age || '-');
    setSafeText('rec-ifsc', emp.ifsc || '-');
    setSafeText('rec-bank-account', emp.bankAccount || '-');
    setSafeText('rec-guardian-name', emp.guardianName || '-');
    setSafeText('rec-guardian-mobile', emp.guardianMobile || '-');
    setSafeText('rec-verification-by', emp.verificationIssuedBy || '-');
    setSafeText('rec-verification-validity', emp.verificationValidity || '-');
    setSafeText('rec-aadhaar-no', emp.aadhaarNo || '-');
    setSafeText('rec-documents-received', emp.originalDocuments || '-');
    setSafeText('rec-reference-by', emp.referenceBy || '-');
    setSafeText('rec-company', emp.companyName || 'Valley Security Service Agency Pvt Ltd.');
    setSafeText('rec-salary', emp.salaryMonth || '-');
    setSafeText('rec-remarks', emp.remarks || '-');
    setSafeText('rec-agreement-name', toTitleCase(emp.name) || '-');

    // DOJ boxes split
    const dojVal = emp.joiningDate || '';
    const dojBoxes = document.getElementById('rec-doj-boxes');
    if (dojBoxes) {
        const spans = dojBoxes.querySelectorAll('span');
        if (dojVal && dojVal.length === 10) {
            const year = dojVal.substring(0, 4);
            const month = dojVal.substring(5, 7);
            const day = dojVal.substring(8, 10);
            const digits = day + month + year;
            for (let i = 0; i < 8; i++) {
                if (spans[i]) spans[i].textContent = digits[i] || '';
            }
        } else {
            const defaults = ['D', 'D', 'M', 'M', 'Y', 'Y', 'Y', 'Y'];
            for (let i = 0; i < 8; i++) {
                if (spans[i]) spans[i].textContent = defaults[i];
            }
        }
    }
    
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
            sigEl.src = getProcessedSignature(emp.documents.signature);
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
        'rec-joining', 'rec-status', 'rec-blood', 'rec-validity',
        'rec-age', 'rec-ifsc', 'rec-bank-account', 'rec-guardian-name', 'rec-guardian-mobile',
        'rec-verification-by', 'rec-verification-validity', 'rec-aadhaar-no',
        'rec-documents-received', 'rec-reference-by', 'rec-company', 'rec-salary', 'rec-remarks',
        'rec-agreement-name'
    ];
    
    fields.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
    
    const label = document.getElementById('rec-relation-label');
    if (label) label.textContent = "Father's Name:";
    
    // Reset DOJ boxes
    const dojBoxes = document.getElementById('rec-doj-boxes');
    if (dojBoxes) {
        const spans = dojBoxes.querySelectorAll('span');
        const defaults = ['D', 'D', 'M', 'M', 'Y', 'Y', 'Y', 'Y'];
        for (let i = 0; i < 8; i++) {
            if (spans[i]) spans[i].textContent = defaults[i];
        }
    }
    
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

    // Resolve Official Department Name using Gemini
    const btnResolveDept = document.getElementById('btn-resolve-dept');
    if (btnResolveDept) {
        btnResolveDept.addEventListener('click', async () => {
            const input = document.getElementById('input-add-dept');
            const val = input.value.trim();
            if (!val) {
                alert('Please enter a location or colloquial name to resolve (e.g. "ag office srinagar").');
                return;
            }

            btnResolveDept.disabled = true;
            const originalText = btnResolveDept.textContent;
            btnResolveDept.textContent = '⏳ Resolving...';

            try {
                const response = await fetch(`/api/resolve-official-name?query=${encodeURIComponent(val)}`);
                const data = await response.json();
                if (data.success && data.officialName) {
                    input.value = data.officialName;
                    if (data.warning) {
                        console.warn(data.warning);
                    }
                } else {
                    alert(data.error || 'Failed to resolve official name. Please check connection.');
                }
            } catch (err) {
                console.error('Resolve error:', err);
                alert('Error resolving name. Using fallback.');
            } finally {
                btnResolveDept.disabled = false;
                btnResolveDept.textContent = originalText;
            }
        });
    }

    // Audit Departments Modal Handlers
    const btnAuditDepts = document.getElementById('btn-audit-depts');
    const modalDeptsAudit = document.getElementById('modal-depts-audit');
    const btnCloseDeptsAudit = document.getElementById('btn-close-depts-audit');
    const btnCancelDeptsAudit = document.getElementById('btn-cancel-depts-audit');
    const deptsAuditList = document.getElementById('depts-audit-list');

    function openDeptsAuditModal() {
        if (modalDeptsAudit) {
            modalDeptsAudit.classList.remove('hidden');
        }
    }

    function closeDeptsAuditModal() {
        if (modalDeptsAudit) {
            modalDeptsAudit.classList.add('hidden');
        }
    }

    if (btnCloseDeptsAudit) btnCloseDeptsAudit.addEventListener('click', closeDeptsAuditModal);
    if (btnCancelDeptsAudit) btnCancelDeptsAudit.addEventListener('click', closeDeptsAuditModal);

    if (btnAuditDepts) {
        btnAuditDepts.addEventListener('click', async () => {
            openDeptsAuditModal();
            if (!deptsAuditList) return;

            deptsAuditList.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 40px; width: 100%; box-sizing: border-box;">
                    <div style="width: 32px; height: 32px; border: 3px solid rgba(212,175,55,0.25); border-top-color: var(--theme-gold); border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <span style="font-size: 13px; color: var(--text-muted); font-weight: 500;">Running AI Department Audit...</span>
                </div>
            `;

            try {
                const response = await fetch('/api/audit-departments');
                const data = await response.json();
                if (data.success && data.audit) {
                    renderAuditRows(data.audit);
                } else {
                    deptsAuditList.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px; font-weight: 600;">Failed to load audit results.</div>`;
                }
            } catch (err) {
                console.error(err);
                deptsAuditList.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px; font-weight: 600;">Error running audit check.</div>`;
            }
        });
    }

    function renderAuditRows(auditMap) {
        if (!deptsAuditList) return;
        deptsAuditList.innerHTML = '';

        const keys = Object.keys(auditMap);
        if (keys.length === 0) {
            deptsAuditList.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px; font-style: italic;">No departments found to audit.</div>`;
            return;
        }

        keys.forEach(key => {
            const official = auditMap[key];
            const hasDiff = key.trim().toLowerCase() !== official.trim().toLowerCase();

            const row = document.createElement('div');
            row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; gap: 15px; font-size: 13px; box-sizing: border-box;';

            const info = document.createElement('div');
            info.style.cssText = 'display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0;';

            const currentDiv = document.createElement('div');
            currentDiv.style.cssText = 'font-weight: 700; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
            currentDiv.textContent = key;
            info.appendChild(currentDiv);

            let suggestion = null;
            if (hasDiff) {
                suggestion = document.createElement('div');
                suggestion.style.cssText = 'font-size: 11px; color: var(--theme-accent, #cfa15c); display: flex; align-items: center; gap: 4px; font-weight: 600;';
                suggestion.textContent = `💡 Suggested: ${official}`;
                info.appendChild(suggestion);
            }
            row.appendChild(info);

            const status = document.createElement('div');
            status.style.cssText = 'display: flex; align-items: center; gap: 10px; flex-shrink: 0;';

            if (hasDiff) {
                const btnFix = document.createElement('button');
                btnFix.type = 'button';
                btnFix.style.cssText = 'background: rgba(212,175,55,0.15); border: 1px solid var(--theme-gold); color: var(--theme-gold); font-size: 11px; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: 700; white-space: nowrap;';
                btnFix.textContent = 'Auto-Fix';
                
                btnFix.addEventListener('click', async () => {
                    btnFix.disabled = true;
                    btnFix.textContent = '⏳ Fixing...';
                    try {
                        const res = await fetch('/api/rename-department', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ oldName: key, newName: official })
                        });
                        const resData = await res.json();
                        if (resData.success) {
                            status.innerHTML = `<span style="color: #10b981; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 4px;">Fixed</span>`;
                            currentDiv.textContent = official;
                            if (suggestion && info.contains(suggestion)) {
                                info.removeChild(suggestion);
                            }
                            
                            // Re-fetch all database details and refresh dropdowns/view list
                            if (typeof fetchData === 'function') {
                                await fetchData();
                            }
                        } else {
                            alert(resData.error || 'Failed to rename department.');
                            btnFix.disabled = false;
                            btnFix.textContent = 'Auto-Fix';
                        }
                    } catch (err) {
                        console.error(err);
                        alert('Error renaming department.');
                        btnFix.disabled = false;
                        btnFix.textContent = 'Auto-Fix';
                    }
                });
                status.appendChild(btnFix);
            } else {
                status.innerHTML = `<span style="color: #10b981; font-weight: 700; font-size: 12px; display: flex; align-items: center; gap: 4px;">Verified</span>`;
            }
            row.appendChild(status);
            deptsAuditList.appendChild(row);
        });
    }

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
        const issueDateVal = document.getElementById('id-card-issue-date')?.value || null;
        pageCards.forEach(emp => {
            bulkHtml += `
            <div class="printable-id-card-wrapper">
                ${generateIdCardHtml(emp, template, emp.cardValidity || 3, issueDateVal)}
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

    const bulkIssueDateVal = document.getElementById('id-card-issue-date')?.value || null;

    for (let i = 0; i < VSA_STATE.selectedEmployeeIds.length; i++) {
        const empId = VSA_STATE.selectedEmployeeIds[i];
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (!emp) continue;

        bulkContainer.innerHTML = generateIdCardHtml(emp, template, emp.cardValidity || 3, bulkIssueDateVal);
        renderQrsInContainer(bulkContainer);

        try {
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }
        } catch (e) {
            console.warn('Font loading wait failed:', e);
        }
        await new Promise(resolve => setTimeout(resolve, 300));

        const cardElement = bulkContainer.querySelector('.id-card-portrait') || bulkContainer.querySelector('.id-card-horizontal');
        if (cardElement) {
            try {
                const canvas = await html2canvas(cardElement, {
                    scale: 4,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    letterRendering: true
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
        { name: "VSA Luxury Crimson", primary: "#0f1218", accent: "#c8102e", text: "#ffffff" },
        { name: "VSA Forest Green", primary: "#0e3e2b", accent: "#52b788", text: "#ffffff" },
        { name: "Navy Guard", primary: "#0b1d33", accent: "#e2b23c", text: "#ffffff" },
        { name: "Steel Patrol", primary: "#1f2937", accent: "#9ca3af", text: "#ffffff" },
        { name: "High Vis Rescue", primary: "#1e293b", accent: "#f97316", text: "#ffffff" }
    ],
    logoPresets: [
        {
            name: "Classic Shield",
            src: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><path d="M50,10 L85,25 L85,55 C85,75 50,90 50,90 C50,90 15,75 15,55 L15,25 Z" fill="%230f1218" stroke="%23c8102e" stroke-width="4"/><path d="M50,20 L75,32 L75,55 C75,70 50,80 50,80 C50,80 25,70 25,55 L25,32 Z" fill="none" stroke="%23c8102e" stroke-width="1.5" stroke-dasharray="3,3"/><text x="50" y="58" font-family="sans-serif" font-weight="900" font-size="22" fill="%23c8102e" text-anchor="middle">VSA</text></svg>'
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
            text: template.headerText || (typeof FIRM_CONFIG !== 'undefined' ? FIRM_CONFIG.badgeHeader : 'VALLEY SECURITY AGENCY'),
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
            color: template.accentColor || '#c8102e',
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
            text: '1. This card is property of ' + (typeof FIRM_CONFIG !== 'undefined' ? FIRM_CONFIG.name : 'Valley Security Agency') + '.\n2. Card must be displayed at all times on duty.\n3. If found, please return to nearest branch office.\n4. Any misuse will lead to immediate suspension and legal action.',
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
            text: 'In Case of Emergency, Contact:\nPhone: ' + (typeof FIRM_CONFIG !== 'undefined' ? FIRM_CONFIG.phone : '7889311608'),
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
            text: typeof FIRM_CONFIG !== 'undefined' ? FIRM_CONFIG.name.toUpperCase() : 'VALLEY SECURITY SYSTEMS',
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
            <td><span style="font-size: 11px; opacity: 0.85;">${t.headerText || '-'}</span></td>
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
            if (confirm('Are you sure you want to delete this template layout?')) {
                deleteTemplate(id);
            }
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
    email: "vikram.singh@valleysecurity.in",
    bloodGroup: "O+",
    currentAddress: "Sector 4, Police Line, Srinagar, J&K, 190001",
    joiningDate: "2024-05-15",
    documents: {
        photo: "",
        signature: ""
    }
};

const DEFAULT_FIELD_ORDER = ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email'];
let fieldDragSrcEl = null;

function handleFieldDragStart(e) {
    fieldDragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.getAttribute('data-field-key'));
    this.classList.add('dragging');
}

function handleFieldDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleFieldDragEnter(e) {
    this.classList.add('drag-over');
}

function handleFieldDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleFieldDrop(e) {
    e.stopPropagation();
    e.preventDefault();
    
    if (fieldDragSrcEl !== this) {
        const srcKey = fieldDragSrcEl.getAttribute('data-field-key');
        const targetKey = this.getAttribute('data-field-key');
        
        if (!VSA_STATE.activeFieldOrder) {
            VSA_STATE.activeFieldOrder = [...DEFAULT_FIELD_ORDER];
        }
        
        const srcIndex = VSA_STATE.activeFieldOrder.indexOf(srcKey);
        const targetIndex = VSA_STATE.activeFieldOrder.indexOf(targetKey);
        
        if (srcIndex !== -1 && targetIndex !== -1) {
            VSA_STATE.activeFieldOrder.splice(srcIndex, 1);
            VSA_STATE.activeFieldOrder.splice(targetIndex, 0, srcKey);
            
            renderReorderableFieldsList();
            updateLivePreview();
        }
    }
    return false;
}

function handleFieldDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.draggable-field-row').forEach(row => {
        row.classList.remove('drag-over');
    });
}

function moveFieldUp(key) {
    if (!VSA_STATE.activeFieldOrder) {
        VSA_STATE.activeFieldOrder = [...DEFAULT_FIELD_ORDER];
    }
    const idx = VSA_STATE.activeFieldOrder.indexOf(key);
    if (idx > 0) {
        const temp = VSA_STATE.activeFieldOrder[idx];
        VSA_STATE.activeFieldOrder[idx] = VSA_STATE.activeFieldOrder[idx - 1];
        VSA_STATE.activeFieldOrder[idx - 1] = temp;
        
        renderReorderableFieldsList();
        updateLivePreview();
    }
}

function moveFieldDown(key) {
    if (!VSA_STATE.activeFieldOrder) {
        VSA_STATE.activeFieldOrder = [...DEFAULT_FIELD_ORDER];
    }
    const idx = VSA_STATE.activeFieldOrder.indexOf(key);
    if (idx !== -1 && idx < VSA_STATE.activeFieldOrder.length - 1) {
        const temp = VSA_STATE.activeFieldOrder[idx];
        VSA_STATE.activeFieldOrder[idx] = VSA_STATE.activeFieldOrder[idx + 1];
        VSA_STATE.activeFieldOrder[idx + 1] = temp;
        
        renderReorderableFieldsList();
        updateLivePreview();
    }
}

function renderReorderableFieldsList() {
    const container = document.getElementById('tpl-details-fields-reorder-container');
    if (!container) return;

    const fieldLabels = {
        'empid': 'Staff ID',
        'father': "Father's Name",
        'department': 'Department',
        'blood': 'Blood Group',
        'validity': 'Validity Date',
        'address': 'Address',
        'phone': 'Mobile No',
        'email': 'Email'
    };

    container.innerHTML = '';
    
    if (!VSA_STATE.activeFieldOrder) {
        VSA_STATE.activeFieldOrder = [...DEFAULT_FIELD_ORDER];
    }

    VSA_STATE.activeFieldOrder.forEach((key) => {
        const label = fieldLabels[key] || key;
        
        // Find if checkbox is checked
        let isChecked = true;
        const chk = document.getElementById(`field-tpl-${key}`);
        if (chk) {
            isChecked = chk.checked;
        }
        
        const row = document.createElement('div');
        row.className = 'draggable-field-row';
        if (!isChecked) {
            row.style.opacity = '0.5';
        }
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-field-key', key);
        
        row.innerHTML = `
            <div class="field-info" style="pointer-events: none;">
                <span class="drag-handle" style="margin-right: 10px; color: var(--text-muted);">☰</span>
                <span>${label} ${!isChecked ? '<small style="opacity: 0.6; margin-left: 5px;">(Hidden)</small>' : ''}</span>
            </div>
            <div class="reorder-actions" style="display: flex; gap: 4px;">
                <button type="button" class="reorder-btn move-up-btn" data-key="${key}" title="Move Up">▲</button>
                <button type="button" class="reorder-btn move-down-btn" data-key="${key}" title="Move Down">▼</button>
            </div>
        `;
        
        // Add drag & drop listeners
        row.addEventListener('dragstart', handleFieldDragStart);
        row.addEventListener('dragover', handleFieldDragOver);
        row.addEventListener('dragenter', handleFieldDragEnter);
        row.addEventListener('dragleave', handleFieldDragLeave);
        row.addEventListener('drop', handleFieldDrop);
        row.addEventListener('dragend', handleFieldDragEnd);
        
        // Add button listeners
        row.querySelector('.move-up-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            moveFieldUp(key);
        });
        row.querySelector('.move-down-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            moveFieldDown(key);
        });
        
        container.appendChild(row);
    });
}

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
    document.getElementById('tpl-accent-color').value = tpl.accentColor || '#c8102e';
    const parsedHsl = hexToHsl(tpl.accentColor || '#c8102e');
    updateHslSlidersUI(parsedHsl.h, parsedHsl.s, parsedHsl.l);
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

    const photoWidthVal = tpl.photoWidth || 85;
    document.getElementById('tpl-photo-width').value = photoWidthVal;
    document.getElementById('lbl-photo-width').textContent = photoWidthVal;

    const photoHeightVal = tpl.photoHeight || 105;
    document.getElementById('tpl-photo-height').value = photoHeightVal;
    document.getElementById('lbl-photo-height').textContent = photoHeightVal;

    const qrSizeVal = tpl.qrSize || 70;
    document.getElementById('tpl-qr-size').value = qrSizeVal;
    document.getElementById('lbl-qr-size').textContent = qrSizeVal;

    const detailsFontSizeVal = tpl.detailsFontSize || 8;
    document.getElementById('tpl-details-font-size').value = detailsFontSizeVal;
    document.getElementById('lbl-details-font-size').textContent = detailsFontSizeVal;

    // New controls: label color, value color, row padding, label width
    document.getElementById('tpl-label-color').value = tpl.labelColor || '#555555';
    document.getElementById('tpl-value-color').value = tpl.valueColor || '#111111';
    const rowPaddingVal = tpl.rowPadding !== undefined ? tpl.rowPadding : 3;
    document.getElementById('tpl-row-padding').value = rowPaddingVal;
    document.getElementById('lbl-row-padding').textContent = rowPaddingVal;
    const labelWidthVal = tpl.labelWidth !== undefined ? tpl.labelWidth : 45;
    document.getElementById('tpl-label-width').value = labelWidthVal;
    document.getElementById('lbl-label-width').textContent = labelWidthVal;
    const labelValueSpacingVal = tpl.labelValueSpacing !== undefined ? tpl.labelValueSpacing : 10;
    document.getElementById('tpl-label-value-spacing').value = labelValueSpacingVal;
    document.getElementById('lbl-label-value-spacing').textContent = labelValueSpacingVal;

    const nameFontSizeVal = tpl.nameFontSize !== undefined ? tpl.nameFontSize : (tpl.layout === 'horizontal' ? 13 : 14);
    document.getElementById('tpl-name-font-size').value = nameFontSizeVal;
    document.getElementById('lbl-name-font-size').textContent = nameFontSizeVal;

    const designationFontSizeVal = tpl.designationFontSize !== undefined ? tpl.designationFontSize : (tpl.layout === 'horizontal' ? 9 : 10);
    document.getElementById('tpl-designation-font-size').value = designationFontSizeVal;
    document.getElementById('lbl-designation-font-size').textContent = designationFontSizeVal;

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
    if (document.getElementById('field-tpl-email')) {
        document.getElementById('field-tpl-email').checked = fields.email !== false;
    }
    document.getElementById('field-tpl-blood').checked = fields.blood !== false;
    document.getElementById('field-tpl-address').checked = fields.address !== false;
    document.getElementById('field-tpl-signature').checked = fields.signature !== false;
    document.getElementById('field-tpl-qrcode').checked = fields.qrcode !== false;
    document.getElementById('field-tpl-barcode').checked = fields.barcode !== false;
    if (document.getElementById('field-tpl-validity')) {
        document.getElementById('field-tpl-validity').checked = fields.validity !== false;
    }

    // Load custom fields order
    if (tpl.fieldOrder && Array.isArray(tpl.fieldOrder)) {
        VSA_STATE.activeFieldOrder = [...tpl.fieldOrder];
        // Ensure all default order keys exist
        DEFAULT_FIELD_ORDER.forEach(key => {
            if (!VSA_STATE.activeFieldOrder.includes(key)) {
                VSA_STATE.activeFieldOrder.push(key);
            }
        });
    } else {
        VSA_STATE.activeFieldOrder = [...DEFAULT_FIELD_ORDER];
    }
    renderReorderableFieldsList();

    // Sync template selector dropdown
    const tplEditSel = document.getElementById('tpl-edit-select');
    if (tplEditSel) {
        tplEditSel.value = tpl.id || '';
    }

    // Toggle delete selected button
    const btnDeleteSelected = document.getElementById('btn-tpl-delete-selected');
    if (btnDeleteSelected) {
        if (tpl.id === 'tpl-default') {
            btnDeleteSelected.style.display = 'none';
        } else {
            btnDeleteSelected.style.display = 'inline-flex';
        }
    }

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
    const headerText = document.getElementById('tpl-header-text').value.trim() || (typeof FIRM_CONFIG !== 'undefined' ? FIRM_CONFIG.badgeHeader : 'VALLEY SECURITY AGENCY');
    const subheaderText = document.getElementById('tpl-subheader-text').value.trim() || 'SHAHIDGUNJ SRINAGAR';

    // Retrieve sizes range sliders
    const logoSize = parseInt(document.getElementById('tpl-logo-size').value) || 50;
    const headerHeight = parseInt(document.getElementById('tpl-header-height').value) || 90;
    const headerFontSize = parseInt(document.getElementById('tpl-header-font-size').value) || 14;
    const photoWidth = parseInt(document.getElementById('tpl-photo-width').value) || 85;
    const photoHeight = parseInt(document.getElementById('tpl-photo-height').value) || 105;
    const qrSize = parseInt(document.getElementById('tpl-qr-size').value) || 70;
    const detailsFontSize = parseInt(document.getElementById('tpl-details-font-size').value) || 8;
    const labelColor = document.getElementById('tpl-label-color').value || '#555555';
    const valueColor = document.getElementById('tpl-value-color').value || '#111111';
    const rowPadding = parseInt(document.getElementById('tpl-row-padding').value) || 3;
    const labelWidth = parseInt(document.getElementById('tpl-label-width').value) || 45;
    const labelValueSpacing = parseInt(document.getElementById('tpl-label-value-spacing').value) || 10;
    const nameFontSize = parseInt(document.getElementById('tpl-name-font-size').value) || (layout === 'horizontal' ? 13 : 14);
    const designationFontSize = parseInt(document.getElementById('tpl-designation-font-size').value) || (layout === 'horizontal' ? 9 : 10);

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
        email: document.getElementById('field-tpl-email') ? document.getElementById('field-tpl-email').checked : true,
        blood: document.getElementById('field-tpl-blood').checked,
        address: document.getElementById('field-tpl-address').checked,
        signature: document.getElementById('field-tpl-signature').checked,
        qrcode: document.getElementById('field-tpl-qrcode').checked,
        barcode: document.getElementById('field-tpl-barcode').checked,
        validity: document.getElementById('field-tpl-validity') ? document.getElementById('field-tpl-validity').checked : true
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
        photoWidth,
        photoHeight,
        qrSize,
        detailsFontSize,
        labelColor,
        valueColor,
        rowPadding,
        labelWidth,
        labelValueSpacing,
        nameFontSize,
        designationFontSize,
        backgroundImage,
        logo,
        signature,
        fields,
        fieldOrder: VSA_STATE.activeFieldOrder || [...DEFAULT_FIELD_ORDER],
        isVisualTemplate: true
    };
}

function updateLivePreview() {
    const container = document.getElementById('live-tpl-preview-container');
    if (!container) return;

    const activeTpl = getActiveTemplateFromForm();
    let previewEmp = MOCK_GUARD;
    const previewEmpSel = document.getElementById('tpl-preview-emp-select');
    if (previewEmpSel && previewEmpSel.value) {
        const empId = previewEmpSel.value;
        const found = VSA_STATE.employees.find(e => e.id == empId);
        if (found) {
            previewEmp = found;
        }
    } else if (VSA_STATE.employees.length > 0) {
        previewEmp = VSA_STATE.employees[0];
    }
    
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
        alert('Template deleted successfully! Syncing changes to GitHub & Render...');
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

    // Overwrite protection: If editing 'tpl-default' but they changed the name, save as new layout!
    if (activeTpl.id === 'tpl-default' && activeTpl.name !== 'Default Badges') {
        activeTpl.id = ''; // Clear ID so it saves as a new template
    } else if (activeTpl.id && activeTpl.id !== 'tpl-default') {
        // Double check if name was changed to something else that already exists
        const nameCollides = VSA_STATE.templates.find(t => t.name.toLowerCase() === activeTpl.name.toLowerCase() && t.id !== activeTpl.id);
        if (nameCollides) {
            if (!confirm(`A template layout named "${activeTpl.name}" already exists. Overwrite it?`)) {
                return;
            }
            activeTpl.id = nameCollides.id;
        }
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
        alert('Template saved successfully! Syncing changes to GitHub & Render...');
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
    document.getElementById('tpl-accent-color').value = '#c8102e';
    const parsedHsl = hexToHsl('#c8102e');
    updateHslSlidersUI(parsedHsl.h, parsedHsl.s, parsedHsl.l);
    document.getElementById('tpl-header-text').value = '';

    document.getElementById('tpl-subheader-text').value = '';

    // Reset range sliders
    document.getElementById('tpl-logo-size').value = 50;
    document.getElementById('lbl-logo-size').textContent = 50;

    document.getElementById('tpl-header-height').value = 90;
    document.getElementById('lbl-header-height').textContent = 90;

    document.getElementById('tpl-header-font-size').value = 14;
    document.getElementById('lbl-header-font-size').textContent = 14;

    document.getElementById('tpl-photo-width').value = 85;
    document.getElementById('lbl-photo-width').textContent = 85;

    document.getElementById('tpl-photo-height').value = 105;
    document.getElementById('lbl-photo-height').textContent = 105;

    document.getElementById('tpl-qr-size').value = 70;
    document.getElementById('lbl-qr-size').textContent = 70;

    document.getElementById('tpl-details-font-size').value = 8;
    document.getElementById('lbl-details-font-size').textContent = 8;

    document.getElementById('tpl-name-font-size').value = 14;
    document.getElementById('lbl-name-font-size').textContent = 14;

    document.getElementById('tpl-designation-font-size').value = 10;
    document.getElementById('lbl-designation-font-size').textContent = 10;

    VSA_STATE.customLogoBase64 = null;
    VSA_STATE.customSigBase64 = null;
    document.getElementById('tpl-logo-filename').textContent = "";
    document.getElementById('tpl-sig-filename').textContent = "";

    // Set presets back to default
    document.querySelectorAll('.btn-bg-preset').forEach(btn => btn.classList.remove('active'));
    const defaultBgBtn = document.querySelector('.btn-bg-preset[data-bg=""]');
    if (defaultBgBtn) defaultBgBtn.classList.add('active');

    document.querySelectorAll('.btn-logo-preset').forEach(btn => btn.classList.remove('active'));
    const defaultLogoBtn = document.querySelector('.btn-logo-preset[data-logo="preset-vsa-logo"]');
    if (defaultLogoBtn) defaultLogoBtn.classList.add('active');

    document.querySelectorAll('.btn-sig-preset').forEach(btn => btn.classList.remove('active'));
    const defaultSigBtn = document.querySelector('.btn-sig-preset[data-sig="preset-vsa-sig"]');
    if (defaultSigBtn) defaultSigBtn.classList.add('active');

    // All checkboxes enabled by default
    document.querySelectorAll('.field-toggles-grid input[type="checkbox"]').forEach(chk => chk.checked = true);

    VSA_STATE.activeFieldOrder = ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email'];
    renderReorderableFieldsList();

    const tplEditSel = document.getElementById('tpl-edit-select');
    if (tplEditSel) {
        tplEditSel.value = '';
    }
    const btnDeleteSelected = document.getElementById('btn-tpl-delete-selected');
    if (btnDeleteSelected) {
        btnDeleteSelected.style.display = 'none';
    }

    updateLivePreview();
}

function setupTemplatesManager() {
    // HSL range inputs logic
    const hueInput = document.getElementById('val-hsl-hue');
    const satInput = document.getElementById('val-hsl-sat');
    const lightInput = document.getElementById('val-hsl-light');

    const handleHslChange = () => {
        if (hueInput && satInput && lightInput) {
            updateHslSlidersUI(hueInput.value, satInput.value, lightInput.value);
        }
    };

    if (hueInput) hueInput.addEventListener('input', handleHslChange);
    if (satInput) satInput.addEventListener('input', handleHslChange);
    if (lightInput) lightInput.addEventListener('input', handleHslChange);

    // 1. Text and value listeners
    const inputs = ['tpl-name', 'tpl-header-text', 'tpl-subheader-text'];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateLivePreview);
    });

    const selects = ['tpl-layout', 'tpl-font', 'tpl-preview-emp-select'];
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
    const rangeSliders = [
        'tpl-logo-size', 'tpl-header-height', 'tpl-header-font-size',
        'tpl-photo-width', 'tpl-photo-height', 'tpl-qr-size', 'tpl-details-font-size',
        'tpl-row-padding', 'tpl-label-width', 'tpl-label-value-spacing', 'tpl-name-font-size', 'tpl-designation-font-size'
    ];
    rangeSliders.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function() {
                const val = this.value;
                if (id === 'tpl-logo-size') document.getElementById('lbl-logo-size').textContent = val;
                if (id === 'tpl-header-height') document.getElementById('lbl-header-height').textContent = val;
                if (id === 'tpl-header-font-size') document.getElementById('lbl-header-font-size').textContent = val;
                if (id === 'tpl-photo-width') document.getElementById('lbl-photo-width').textContent = val;
                if (id === 'tpl-photo-height') document.getElementById('lbl-photo-height').textContent = val;
                if (id === 'tpl-qr-size') document.getElementById('lbl-qr-size').textContent = val;
                if (id === 'tpl-details-font-size') document.getElementById('lbl-details-font-size').textContent = val;
                if (id === 'tpl-row-padding') document.getElementById('lbl-row-padding').textContent = val;
                if (id === 'tpl-label-width') document.getElementById('lbl-label-width').textContent = val;
                if (id === 'tpl-label-value-spacing') document.getElementById('lbl-label-value-spacing').textContent = val;
                if (id === 'tpl-name-font-size') document.getElementById('lbl-name-font-size').textContent = val;
                if (id === 'tpl-designation-font-size') document.getElementById('lbl-designation-font-size').textContent = val;
                updateLivePreview();
            });
        }
    });

    // Color picker listeners for new controls
    ['tpl-label-color', 'tpl-value-color'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateLivePreview);
    });

    // 2. Checkboxes listeners
    document.querySelectorAll('.field-toggles-grid input[type="checkbox"]').forEach(chk => {
        chk.addEventListener('change', () => {
            renderReorderableFieldsList();
            updateLivePreview();
        });
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

    // AI Template Designer Event Listeners
    let tplReferenceImageBase64 = null;
    const aiRefFile = document.getElementById('tpl-ai-reference-file');
    if (aiRefFile) {
        aiRefFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (evt) => {
                tplReferenceImageBase64 = evt.target.result;
                document.getElementById('tpl-ai-reference-filename').textContent = file.name;
            };
            reader.readAsDataURL(file);
        });
    }

    const btnGenerateAI = document.getElementById('btn-tpl-generate-ai');
    if (btnGenerateAI) {
        btnGenerateAI.addEventListener('click', async () => {
            const prompt = document.getElementById('tpl-ai-prompt').value;
            if (!prompt || prompt.trim() === '') {
                alert('Please enter a description prompt for the AI to design.');
                return;
            }

            const loader = document.getElementById('tpl-ai-loader');
            if (loader) loader.classList.remove('hidden');

            try {
                const response = await fetch('/api/templates/generate-ai', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + localStorage.getItem('vsa_token')
                    },
                    body: JSON.stringify({
                        prompt: prompt,
                        image: tplReferenceImageBase64
                    })
                });

                const resData = await response.json();
                if (!response.ok || !resData.success) {
                    throw new Error(resData.error || 'Failed to generate layout.');
                }

                const data = resData.data;
                console.log('AI Generated Layout Config:', data);

                // Populate form fields
                if (data.name) document.getElementById('tpl-name').value = data.name;
                if (data.layout) document.getElementById('tpl-layout').value = data.layout;
                if (data.font) document.getElementById('tpl-font').value = data.font;
                if (data.backgroundColor) document.getElementById('tpl-bg-color').value = data.backgroundColor;
                if (data.headerBgColor) document.getElementById('tpl-header-bg').value = data.headerBgColor;
                if (data.accentColor) {
                    document.getElementById('tpl-accent-color').value = data.accentColor;
                    const swatch = document.getElementById('hsl-swatch');
                    if (swatch) swatch.style.backgroundColor = data.accentColor;
                    const lblCurrent = document.getElementById('lbl-hsl-current');
                    if (lblCurrent) lblCurrent.textContent = data.accentColor;
                }
                if (data.headerText) document.getElementById('tpl-header-text').value = data.headerText;
                if (data.subheaderText) document.getElementById('tpl-subheader-text').value = data.subheaderText;
                
                // Sliders
                const setSliderVal = (id, val, lblId) => {
                    const slider = document.getElementById(id);
                    if (slider && val !== undefined) {
                        slider.value = val;
                        const label = document.getElementById(lblId || `lbl-${id.replace('tpl-', '')}`);
                        if (label) label.textContent = val;
                    }
                };

                setSliderVal('tpl-logo-size', data.logoSize, 'lbl-logo-size');
                setSliderVal('tpl-header-height', data.headerHeight, 'lbl-header-height');
                setSliderVal('tpl-header-font-size', data.headerFontSize, 'lbl-header-font-size');
                setSliderVal('tpl-photo-width', data.photoWidth, 'lbl-photo-width');
                setSliderVal('tpl-photo-height', data.photoHeight, 'lbl-photo-height');
                setSliderVal('tpl-qr-size', data.qrSize, 'lbl-qr-size');
                setSliderVal('tpl-details-font-size', data.detailsFontSize, 'lbl-details-font-size');
                setSliderVal('tpl-name-font-size', data.nameFontSize, 'lbl-name-font-size');
                setSliderVal('tpl-designation-font-size', data.designationFontSize, 'lbl-designation-font-size');
                setSliderVal('tpl-row-padding', data.rowPadding, 'lbl-row-padding');
                setSliderVal('tpl-label-width', data.labelWidth, 'lbl-label-width');
                setSliderVal('tpl-label-value-spacing', data.labelValueSpacing, 'lbl-label-value-spacing');

                if (data.labelColor) document.getElementById('tpl-label-color').value = data.labelColor;
                if (data.valueColor) document.getElementById('tpl-value-color').value = data.valueColor;

                // Preset logo button active toggle
                if (data.logo) {
                    document.querySelectorAll('.btn-logo-preset').forEach(btn => {
                        if (btn.getAttribute('data-logo') === data.logo) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });
                    VSA_STATE.customLogoBase64 = null;
                    document.getElementById('tpl-logo-filename').textContent = "";
                    document.getElementById('tpl-logo-upload').value = "";
                }

                // Preset signature button active toggle
                if (data.signature) {
                    document.querySelectorAll('.btn-sig-preset').forEach(btn => {
                        if (btn.getAttribute('data-sig') === data.signature) {
                            btn.classList.add('active');
                        } else {
                            btn.classList.remove('active');
                        }
                    });
                    VSA_STATE.customSigBase64 = null;
                    document.getElementById('tpl-sig-filename').textContent = "";
                    document.getElementById('tpl-sig-upload').value = "";
                }

                // Checkboxes
                const setCheckbox = (id, checked) => {
                    const cb = document.getElementById(id);
                    if (cb && checked !== undefined) cb.checked = !!checked;
                };

                if (data.fields) {
                    setCheckbox('field-tpl-photo', data.fields.photo);
                    setCheckbox('field-tpl-name', data.fields.name);
                    setCheckbox('field-tpl-designation', data.fields.designation);
                    setCheckbox('field-tpl-department', data.fields.department);
                    setCheckbox('field-tpl-empid', data.fields.empid);
                    setCheckbox('field-tpl-father', data.fields.father);
                    setCheckbox('field-tpl-phone', data.fields.phone);
                    setCheckbox('field-tpl-email', data.fields.email);
                    setCheckbox('field-tpl-blood', data.fields.blood);
                    setCheckbox('field-tpl-address', data.fields.address);
                    setCheckbox('field-tpl-signature', data.fields.signature);
                    setCheckbox('field-tpl-qrcode', data.fields.qrcode);
                    setCheckbox('field-tpl-barcode', data.fields.barcode);
                    setCheckbox('field-tpl-validity', data.fields.validity);
                }

                // Trigger live preview update
                updateLivePreview();
                alert('AI Layout designed and loaded successfully!');

            } catch (err) {
                console.error(err);
                alert('AI Design Generation Failed: ' + err.message);
            } finally {
                if (loader) loader.classList.add('hidden');
            }
        });
    }


    // 7. Save / Reset buttons
    const btnSave = document.getElementById('btn-tpl-save');
    if (btnSave) btnSave.addEventListener('click', saveTemplate);

    const btnReset = document.getElementById('btn-tpl-reset');
    if (btnReset) btnReset.addEventListener('click', resetTemplateForm);

    const btnNew = document.getElementById('btn-tpl-new');
    if (btnNew) btnNew.addEventListener('click', resetTemplateForm);

    const btnNewTop = document.getElementById('btn-tpl-new-top');
    if (btnNewTop) btnNewTop.addEventListener('click', resetTemplateForm);

    const tplEditSel = document.getElementById('tpl-edit-select');
    if (tplEditSel) {
        tplEditSel.addEventListener('change', function() {
            const id = this.value;
            if (id) {
                loadTemplateInStudio(id);
            }
        });
    }

    const btnDeleteSelected = document.getElementById('btn-tpl-delete-selected');
    if (btnDeleteSelected) {
        btnDeleteSelected.addEventListener('click', function() {
            const id = document.getElementById('tpl-edit-select').value;
            if (id && id !== 'tpl-default') {
                if (confirm('Are you sure you want to delete this template?')) {
                    deleteTemplate(id);
                }
            }
        });
    }

    // Initial render / load
    if (VSA_STATE.templates && VSA_STATE.templates.length > 0) {
        loadTemplateInStudio(VSA_STATE.templates[0].id);
    } else {
        resetTemplateForm();
    }
}

// --- Image Cropper Logic ---
let activeCropper = null;
let cropperTriggerInputId = null;
let cropperPreviewBoxId = null;
let isAspectLocked = false; // Default to free crop (like a phone)

function openPhotoCropper(fileInput, previewBoxId) {
    const file = fileInput.files[0];
    if (!file) return;

    // Calculate aspect ratio from active template
    let targetRatio = 85 / 105;
    try {
        const idSelTpl = document.getElementById('id-select-template');
        if (idSelTpl && idSelTpl.value) {
            const template = VSA_STATE.templates.find(t => t.id === idSelTpl.value);
            if (template && template.photoWidth && template.photoHeight) {
                targetRatio = template.photoWidth / template.photoHeight;
            }
        } else if (VSA_STATE.templates && VSA_STATE.templates.length > 0) {
            const template = VSA_STATE.templates[0];
            if (template && template.photoWidth && template.photoHeight) {
                targetRatio = template.photoWidth / template.photoHeight;
            }
        }
    } catch (err) {
        console.error("Error determining dynamic aspect ratio:", err);
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        // Step 1: destroy any stale cropper
        if (activeCropper) {
            activeCropper.destroy();
            activeCropper = null;
        }

        // Step 2: set tracking vars
        cropperTriggerInputId = fileInput.id;
        cropperPreviewBoxId = previewBoxId;

        // Step 3: get elements
        const targetImage = document.getElementById('cropper-target-image');
        const modal = document.getElementById('cropper-modal');

        // Step 4: reset image src so onload always fires (even for cached images)
        targetImage.src = '';
        targetImage.onload = null;

        // Step 5: show modal FIRST so container has real pixel size
        modal.classList.remove('hidden');

        // Step 6: update aspect toggle button
        const aspectText = document.getElementById('crop-aspect-text');
        const aspectIcon = document.querySelector('#btn-crop-aspect-toggle i');
        if (aspectText) aspectText.textContent = isAspectLocked ? 'Card Ratio' : 'Free Crop';
        if (aspectIcon) {
            aspectIcon.className = '';
            aspectIcon.setAttribute('data-lucide', isAspectLocked ? 'lock' : 'unlock');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Step 7: define the init function
        function initCropper() {
            console.log('=== CROPPER INIT ===');
            console.log('window.Cropper exists:', typeof window.Cropper);
            console.log('targetImage element:', targetImage);
            console.log('targetImage dimensions:', targetImage.offsetWidth, 'x', targetImage.offsetHeight);
            console.log('targetImage naturalSize:', targetImage.naturalWidth, 'x', targetImage.naturalHeight);
            console.log('targetImage src length:', targetImage.src ? targetImage.src.length : 0);

            if (!window.Cropper) {
                console.error('CROPPER ERROR: window.Cropper is not defined! CDN script not loaded.');
                return;
            }
            if (!targetImage) {
                console.error('CROPPER ERROR: targetImage element not found!');
                return;
            }

            if (activeCropper) {
                activeCropper.destroy();
                activeCropper = null;
            }
            try {
                activeCropper = new Cropper(targetImage, {
                    aspectRatio: isAspectLocked ? targetRatio : NaN,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.85,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: true,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    movable: true,
                    scalable: true,
                    zoomable: true,
                    toggleDragModeOnDblclick: false,
                });
                console.log('Cropper initialized OK:', activeCropper);
            } catch(err) {
                console.error('CROPPER ERROR during new Cropper():', err);
            }
        }

        // Step 8: set image src and init after 150ms
        // 150ms gives the browser time to: show modal + render image
        // Works even if image is cached (doesn't rely on onload firing)
        targetImage.src = e.target.result;
        setTimeout(initCropper, 150);
    };
    reader.readAsDataURL(file);
}




// Bind Cropper UI controls
function setupCropperControls() {
    const closeModal = () => {
        document.getElementById('cropper-modal').classList.add('hidden');
        if (activeCropper) {
            activeCropper.destroy();
            activeCropper = null;
        }
        // Reset file input so same file can be uploaded again if needed
        if (cropperTriggerInputId) {
            const inputEl = document.getElementById(cropperTriggerInputId);
            if (inputEl) inputEl.value = '';
        }
    };

    const closeBtn = document.getElementById('btn-close-cropper');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    
    const cancelBtn = document.getElementById('btn-cancel-cropper');
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    const zoomInBtn = document.getElementById('btn-crop-zoom-in');
    if (zoomInBtn) {
        zoomInBtn.addEventListener('click', () => {
            if (activeCropper) activeCropper.zoom(0.1);
        });
    }
    
    const zoomOutBtn = document.getElementById('btn-crop-zoom-out');
    if (zoomOutBtn) {
        zoomOutBtn.addEventListener('click', () => {
            if (activeCropper) activeCropper.zoom(-0.1);
        });
    }

    const rotateLeftBtn = document.getElementById('btn-crop-rotate-left');
    if (rotateLeftBtn) {
        rotateLeftBtn.addEventListener('click', () => {
            if (activeCropper) activeCropper.rotate(-90);
        });
    }

    const rotateRightBtn = document.getElementById('btn-crop-rotate-right');
    if (rotateRightBtn) {
        rotateRightBtn.addEventListener('click', () => {
            if (activeCropper) activeCropper.rotate(90);
        });
    }

    // Toggle Aspect Ratio click handler
    const aspectToggleBtn = document.getElementById('btn-crop-aspect-toggle');
    if (aspectToggleBtn) {
        aspectToggleBtn.addEventListener('click', () => {
            if (!activeCropper) return;
            isAspectLocked = !isAspectLocked;
            
            let targetRatio = 85 / 105;
            try {
                const idSelTpl = document.getElementById('id-select-template');
                if (idSelTpl && idSelTpl.value) {
                    const template = VSA_STATE.templates.find(t => t.id === idSelTpl.value);
                    if (template && template.photoWidth && template.photoHeight) {
                        targetRatio = template.photoWidth / template.photoHeight;
                    }
                } else if (VSA_STATE.templates && VSA_STATE.templates.length > 0) {
                    const template = VSA_STATE.templates[0];
                    if (template && template.photoWidth && template.photoHeight) {
                        targetRatio = template.photoWidth / template.photoHeight;
                    }
                }
            } catch (err) {
                console.error("Error determining aspect ratio for toggle:", err);
            }
            
            activeCropper.setAspectRatio(isAspectLocked ? targetRatio : NaN);
            
            const aspectText = document.getElementById('crop-aspect-text');
            const aspectIcon = document.querySelector('#btn-crop-aspect-toggle i');
            if (aspectText) {
                aspectText.textContent = isAspectLocked ? 'Card Ratio' : 'Free Crop';
            }
            if (aspectIcon) {
                aspectIcon.className = '';
                aspectIcon.setAttribute('data-lucide', isAspectLocked ? 'lock' : 'unlock');
                if (typeof lucide !== 'undefined') lucide.createIcons();
            }
        });
    }

    const saveBtn = document.getElementById('btn-save-cropped');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (!activeCropper) return;
            
            // Determine cropped canvas output dimensions based on crop box aspect ratio
            let canvasWidth = 300;
            let canvasHeight = 300;
            const data = activeCropper.getData();
            if (data && data.width && data.height) {
                const ratio = data.width / data.height;
                if (ratio < 1) {
                    canvasHeight = 350;
                    canvasWidth = Math.round(350 * ratio);
                } else if (ratio > 1) {
                    canvasWidth = 350;
                    canvasHeight = Math.round(350 / ratio);
                }
            }
            
            const canvas = activeCropper.getCroppedCanvas({
                width: canvasWidth,
                height: canvasHeight,
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high'
            });

            if (canvas) {
                // Compress automatically on client side to high quality JPEG
                const base64Str = canvas.toDataURL('image/jpeg', 0.85);
                
                const inputEl = document.getElementById(cropperTriggerInputId);
                const previewBox = document.getElementById(cropperPreviewBoxId);
                
                if (cropperPreviewBoxId === 'reg-photo-preview' || cropperPreviewBoxId === 'form-photo-preview-box') {
                    if (previewBox) {
                        previewBox.innerHTML = '<span class="preview-placeholder" style="color: var(--theme-accent); font-weight: 500;">✨ Auto-cleaning background...</span>';
                    }
                    
                    removePortraitBackground(base64Str, 55).then(processedBase64 => {
                        if (inputEl) {
                            inputEl.dataset.imageData = processedBase64;
                        }
                        if (previewBox) {
                            previewBox.innerHTML = `<img src="${processedBase64}" style="max-height: 100px;">`;
                        }
                        // Instantly update live card previews if visible
                        const selectedId = document.getElementById('id-select-employee')?.value;
                        if (selectedId) {
                            loadIdCardDetails(selectedId);
                        }
                        updateLivePreview();
                    }).catch(err => {
                        console.error("Auto background cleaning failed:", err);
                        if (inputEl) {
                            inputEl.dataset.imageData = base64Str;
                        }
                        if (previewBox) {
                            previewBox.innerHTML = `<img src="${base64Str}" style="max-height: 100px;">`;
                        }
                    });
                } else {
                    // Normal behavior for other uploads
                    if (inputEl) {
                        inputEl.dataset.imageData = base64Str;
                    }
                    if (previewBox) {
                        previewBox.innerHTML = `<img src="${base64Str}" style="max-height: 100px;">`;
                    }
                }
            }
            
            // Close modal
            closeModal();
        });
    }
}

// Accessibility (a11y) Modal Manager (Focus Trap & Escape key closer)
function setupModalA11y() {
    // Listen for Escape key to close any active modals
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay:not(.hidden)');
            if (activeModal) {
                activeModal.classList.add('hidden');
                // Execute cleanup or trigger close buttons if needed
                if (activeModal.id === 'cropper-modal') {
                    if (activeCropper) {
                        activeCropper.destroy();
                        activeCropper = null;
                    }
                    if (cropperTriggerInputId) {
                        const inputEl = document.getElementById(cropperTriggerInputId);
                        if (inputEl) inputEl.value = '';
                    }
                }
            }
        }
    });

    // Handle tab key to trap focus inside open modals
    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Tab') return;

        const activeModal = document.querySelector('.modal-overlay:not(.hidden)');
        if (!activeModal) return;

        const focusableSelectors = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex="0"]';
        const focusableElements = Array.from(activeModal.querySelectorAll(focusableSelectors));
        
        if (focusableElements.length === 0) {
            e.preventDefault();
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const activeElement = document.activeElement;

        if (e.shiftKey) {
            // Shift + Tab: if on first element, wrap to last
            if (activeElement === firstElement || !activeModal.contains(activeElement)) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            // Tab: if on last element, wrap to first
            if (activeElement === lastElement || !activeModal.contains(activeElement)) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    });
}

// Sidebar off-canvas toggle logic for Mobile/Tablet
function setupMobileSidebar() {
    const toggleBtn = document.getElementById('btn-sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (!toggleBtn || !sidebar) return;

    // Create sidebar overlay element if it doesn't exist
    let overlay = document.querySelector('.sidebar-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        document.body.appendChild(overlay);
    }

    const openSidebar = () => {
        sidebar.classList.add('open');
        overlay.classList.add('active');
    };

    const closeSidebar = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    };

    toggleBtn.addEventListener('click', openSidebar);
    overlay.addEventListener('click', closeSidebar);

    // Close sidebar when clicking any navigation link
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', closeSidebar);
    });
}

// Color Picker Helpers: Hex to HSL and Slider Updates
function hexToHsl(hex) {
    if (!hex) return { h: 0, s: 100, l: 50 };
    
    // Check if it's already an HSL string
    if (typeof hex === 'string' && hex.startsWith('hsl')) {
        const parts = hex.match(/[\d.]+/g);
        if (parts && parts.length >= 3) {
            return {
                h: parseFloat(parts[0]),
                s: parseFloat(parts[1]),
                l: parseFloat(parts[2])
            };
        }
    }
    
    // Normal Hex parse
    let shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function(m, r, g, b) {
        return r + r + g + g + b + b;
    });

    let result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
        return { h: 0, s: 100, l: 50 };
    }

    let r = parseInt(result[1], 16) / 255;
    let g = parseInt(result[2], 16) / 255;
    let b = parseInt(result[3], 16) / 255;

    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        let d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    };
}

function updateHslSlidersUI(h, s, l) {
    const hueInput = document.getElementById('val-hsl-hue');
    const satInput = document.getElementById('val-hsl-sat');
    const lightInput = document.getElementById('val-hsl-light');
    const swatch = document.getElementById('hsl-swatch');
    const currentLbl = document.getElementById('lbl-hsl-current');

    const lblHue = document.getElementById('lbl-hsl-hue');
    const lblSat = document.getElementById('lbl-hsl-sat');
    const lblLight = document.getElementById('lbl-hsl-light');

    if (hueInput) hueInput.value = h;
    if (satInput) satInput.value = s;
    if (lightInput) lightInput.value = l;

    if (lblHue) lblHue.textContent = h;
    if (lblSat) lblSat.textContent = s + '%';
    if (lblLight) lblLight.textContent = l + '%';

    // Update gradient for saturation slider
    if (satInput) {
        satInput.style.background = `linear-gradient(to right, hsl(${h}, 0%, ${l}%), hsl(${h}, 100%, ${l}%))`;
    }

    // Update gradient for lightness slider
    if (lightInput) {
        lightInput.style.background = `linear-gradient(to right, #000000, hsl(${h}, ${s}%, 50%), #ffffff)`;
    }

    const hslString = `hsl(${h}, ${s}%, ${l}%)`;
    if (swatch) swatch.style.background = hslString;
    if (currentLbl) currentLbl.textContent = hslString;

    const targetInput = document.getElementById('tpl-accent-color');
    if (targetInput) {
        targetInput.value = hslString;
        targetInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/* ==========================================================================
   10. ONBOARDING INBOX MODAL & LOGGING SYSTEM
   ========================================================================== */

function setupInboxModalHandlers() {
    const inboxModal = document.getElementById('inbox-modal');
    const btnOpenInbox = document.getElementById('btn-header-inbox');
    const btnCloseInbox = document.getElementById('btn-close-inbox-modal');
    
    if (btnOpenInbox && inboxModal) {
        btnOpenInbox.addEventListener('click', () => {
            renderInbox();
            inboxModal.classList.remove('hidden');
        });
    }
    
    if (btnCloseInbox && inboxModal) {
        btnCloseInbox.addEventListener('click', () => {
            inboxModal.classList.add('hidden');
        });
    }
    
    // Tab switching listeners
    const tabPending = document.getElementById('tab-inbox-pending');
    const tabRejected = document.getElementById('tab-inbox-rejected');
    const secPending = document.getElementById('inbox-pending-section');
    const secRejected = document.getElementById('inbox-rejected-section');
    
    if (tabPending && tabRejected) {
        tabPending.addEventListener('click', () => {
            tabPending.classList.add('active');
            tabRejected.classList.remove('active');
            tabPending.style.borderBottom = '2px solid var(--theme-accent, #cfa15c)';
            tabPending.style.color = 'var(--text-color, #fff)';
            tabRejected.style.borderBottom = 'none';
            tabRejected.style.color = 'var(--text-secondary)';
            secPending.classList.remove('hidden');
            secRejected.classList.add('hidden');
            renderInboxPendingList();
        });
        
        tabRejected.addEventListener('click', () => {
            tabRejected.classList.add('active');
            tabPending.classList.remove('active');
            tabRejected.style.borderBottom = '2px solid var(--theme-accent, #cfa15c)';
            tabRejected.style.color = 'var(--text-color, #fff)';
            tabPending.style.borderBottom = 'none';
            tabPending.style.color = 'var(--text-secondary)';
            secRejected.classList.remove('hidden');
            secPending.classList.add('hidden');
            renderInboxRejectedList();
        });
    }
    
    // Location filter change listener
    const filterLoc = document.getElementById('inbox-filter-location');
    if (filterLoc) {
        filterLoc.addEventListener('change', () => {
            renderInboxPendingList();
            renderInboxRejectedList();
        });
    }
}

// Render the entire Inbox (both tabs, update counter dot in header)
function renderInbox() {
    renderInboxPendingList();
    renderInboxRejectedList();
    updateInboxBadgeCounter();
}

// Update the red notification dot on the mail icon in the header
function updateInboxBadgeCounter() {
    const pendingCount = VSA_STATE.employees.filter(e => e.status === 'Pending').length;
    const badge = document.getElementById('inbox-notification-badge');
    if (badge) {
        if (pendingCount > 0) {
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

// Approve ALL currently visible pending submissions in one click
async function approveAllPending() {
    const filterLocVal = document.getElementById('inbox-filter-location')?.value || '';
    const pendingList = VSA_STATE.employees.filter(emp => {
        const matchesStatus = emp.status === 'Pending';
        const matchesLocation = !filterLocVal || emp.department === filterLocVal;
        return matchesStatus && matchesLocation;
    });

    if (pendingList.length === 0) {
        alert('No pending submissions to approve.');
        return;
    }

    const confirmed = confirm(`Approve all ${pendingList.length} pending submission${pendingList.length > 1 ? 's' : ''}? This will set all of them to Active status.`);
    if (!confirmed) return;

    const btn = document.getElementById('btn-approve-all');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width:15px;height:15px;animation:spin 1s linear infinite;"></i> Approving...';
        lucide.createIcons();
    }

    let successCount = 0;
    let failCount = 0;

    for (const emp of pendingList) {
        try {
            emp.status = 'Active';
            const response = await fetch(`/api/employees/${emp.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emp)
            });
            if (!response.ok) throw new Error(`Failed for ${emp.id}`);
            successCount++;
        } catch (err) {
            emp.status = 'Pending'; // revert on failure
            failCount++;
            console.error('Approve all error:', err);
        }
    }

    await fetchData();
    renderInbox();

    if (failCount === 0) {
        alert(`✅ All ${successCount} submission${successCount > 1 ? 's' : ''} approved successfully!`);
    } else {
        alert(`⚠️ ${successCount} approved, ${failCount} failed. Check console for details.`);
    }
}

// Render the pending submissions list
function renderInboxPendingList() {
    const tbody = document.getElementById('inbox-pending-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const filterLocVal = document.getElementById('inbox-filter-location')?.value || '';
    const pendingList = VSA_STATE.employees.filter(emp => {
        const matchesStatus = emp.status === 'Pending';
        const matchesLocation = !filterLocVal || emp.department === filterLocVal;
        return matchesStatus && matchesLocation;
    });
    
    if (pendingList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 30px; color: var(--text-secondary);">No pending submissions found.</td></tr>`;
        return;
    }
    
    pendingList.forEach(emp => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';
        
        // Fix: handle base64 data URIs correctly (same fix as onboarding preview)
        let avatarSrc = '';
        if (emp.documents?.photo) {
            const rawPhoto = emp.documents.photo;
            if (rawPhoto.startsWith('data:image/')) {
                avatarSrc = rawPhoto;
            } else if (rawPhoto.startsWith('http') || rawPhoto.startsWith('/')) {
                avatarSrc = rawPhoto.includes('token=') ? rawPhoto : `${rawPhoto}?token=${emp.secureToken || ''}`;
            } else {
                avatarSrc = rawPhoto;
            }
        }
        const avatarHtml = avatarSrc ? 
            `<img src="${avatarSrc}" style="width: 44px; height: 55px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" alt="photo">` : 
            `<div style="width: 44px; height: 55px; background: rgba(255,255,255,0.05); border-radius: 6px; display:flex; align-items:center; justify-content:center; color: var(--text-secondary);"><i data-lucide="user" style="width:18px;"></i></div>`;
            
        row.innerHTML = `
            <td style="padding: 10px; vertical-align: middle;">${avatarHtml}</td>
            <td style="padding: 10px; vertical-align: middle; font-weight:600; color: #fff;">${toTitleCase(emp.name)}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.mobile || '-'}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.dob || '-'}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.designation || '-'}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.department || '-'}</td>
            <td style="padding: 10px; vertical-align: middle; text-align: right;">
                <div style="display: inline-flex; gap: 6px;">
                    <button class="btn btn-xs btn-outline btn-inbox-view" data-id="${emp.id}" style="border-color: rgba(255,255,255,0.15); color: #fff; display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer; background: rgba(255,255,255,0.03);"><i data-lucide="eye" style="width:12px;"></i> View</button>
                    <button class="btn btn-xs btn-success btn-inbox-approve" data-id="${emp.id}" style="background: #10b981; border-color: #10b981; color: #fff; display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer;"><i data-lucide="check" style="width:12px;"></i> Approve</button>
                    <button class="btn btn-xs btn-danger btn-inbox-reject" data-id="${emp.id}" style="background: #ef4444; border-color: #ef4444; color: #fff; display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer;"><i data-lucide="x" style="width:12px;"></i> Reject</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });

    // Update the pending count label and show/hide Approve All bar
    const countLabel = document.getElementById('inbox-pending-count-label');
    const approveAllBar = document.getElementById('inbox-approve-all-bar');
    if (countLabel) {
        if (pendingList.length === 0) {
            countLabel.textContent = 'No pending submissions.';
            if (approveAllBar) approveAllBar.style.display = 'none';
        } else {
            countLabel.textContent = `${pendingList.length} pending submission${pendingList.length > 1 ? 's' : ''} awaiting review`;
            if (approveAllBar) approveAllBar.style.display = 'flex';
        }
    }
    
    // Wire up buttons
    tbody.querySelectorAll('.btn-inbox-view').forEach(btn => {
        btn.addEventListener('click', () => {
            const empId = btn.getAttribute('data-id');
            openOnboardingPreview(empId);
        });
    });

    tbody.querySelectorAll('.btn-inbox-approve').forEach(btn => {
        btn.addEventListener('click', async () => {
            const empId = btn.getAttribute('data-id');
            const emp = VSA_STATE.employees.find(e => e.id === empId);
            if (!emp) return;

            if (!confirm(`Are you sure you want to approve onboarding profile for ${emp.name}?`)) return;

            try {
                emp.status = 'Active';
                const response = await fetch(`/api/employees/${empId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emp)
                });
                
                if (!response.ok) throw new Error('Failed to approve registration');
                alert('Registration approved successfully!');
                await fetchData();
                renderInbox();
            } catch (err) {
                alert('Error approving: ' + err.message);
            }
        });
    });
    
    tbody.querySelectorAll('.btn-inbox-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
            const empId = btn.getAttribute('data-id');
            const reason = prompt("Enter the reason for rejecting this onboarding profile (this will be logged):");
            if (reason === null) return; // user cancelled prompt
            
            const cleanReason = reason.trim() || "Details or photo did not meet requirements.";
            
            // Reject & save as status 'Rejected'
            try {
                const emp = VSA_STATE.employees.find(e => e.id === empId);
                if (!emp) return;
                
                emp.status = 'Rejected';
                emp.rejectionReason = cleanReason;
                emp.rejectionDate = new Date().toISOString().substring(0, 10);
                
                const response = await fetch(`/api/employees/${empId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emp)
                });
                
                if (!response.ok) throw new Error('Failed to reject registration');
                alert('Registration successfully rejected and logged.');
                await fetchData();
                renderInbox();
            } catch (err) {
                alert('Error rejecting: ' + err.message);
            }
        });
    });
    lucide.createIcons();
}

// Open onboarding preview detailed modal
function openOnboardingPreview(empId) {
    const emp = VSA_STATE.employees.find(e => e.id === empId);
    if (!emp) return;
    
    document.getElementById('preview-onboard-name').textContent = toTitleCase(emp.name);
    document.getElementById('preview-onboard-designation').textContent = emp.designation || '-';
    document.getElementById('preview-onboard-mobile').textContent = emp.mobile || '-';
    document.getElementById('preview-onboard-dob').textContent = emp.dob || '-';
    document.getElementById('preview-onboard-gender').textContent = emp.gender || '-';
    document.getElementById('preview-onboard-blood').textContent = emp.bloodGroup || '-';
    document.getElementById('preview-onboard-guardian').textContent = `${emp.guardianName || '-'} (${emp.relationType || '-'})`;
    document.getElementById('preview-onboard-department').textContent = emp.department || '-';
    document.getElementById('preview-onboard-address').textContent = emp.currentAddress || '-';
    
    // Fix: handle both base64 data URIs and URL-based photos correctly
    const photoEl = document.getElementById('preview-onboard-photo');
    let photoSrc = '';
    if (emp.documents?.photo) {
        const rawPhoto = emp.documents.photo;
        if (rawPhoto.startsWith('data:image/')) {
            // It's a base64 data URI — set directly, no token needed
            photoSrc = rawPhoto;
        } else if (rawPhoto.startsWith('http') || rawPhoto.startsWith('/')) {
            // It's a URL — append the secure token
            photoSrc = rawPhoto.includes('token=') ? rawPhoto : `${rawPhoto}?token=${emp.secureToken || ''}`;
        } else {
            photoSrc = rawPhoto;
        }
    }
    photoEl.src = photoSrc;
    photoEl.onerror = () => {
        photoEl.style.display = 'none';
        const placeholder = document.createElement('div');
        placeholder.style.cssText = 'width:140px;height:175px;border-radius:12px;border:2px solid var(--border-color);display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.04);color:var(--text-muted);flex-direction:column;gap:8px;font-size:12px;';
        placeholder.innerHTML = '<i data-lucide="user" style="width:40px;height:40px;opacity:0.4;"></i><span>No Photo</span>';
        photoEl.parentNode.insertBefore(placeholder, photoEl);
        lucide.createIcons();
    };
    photoEl.style.display = '';
    
    // Wire modal actions
    const approveBtn = document.getElementById('btn-preview-approve');
    const rejectBtn = document.getElementById('btn-preview-reject');
    
    // Clone and replace button elements to clean up previous event listeners
    const newApproveBtn = approveBtn.cloneNode(true);
    const newRejectBtn = rejectBtn.cloneNode(true);
    approveBtn.parentNode.replaceChild(newApproveBtn, approveBtn);
    rejectBtn.parentNode.replaceChild(newRejectBtn, rejectBtn);
    
    newApproveBtn.addEventListener('click', async () => {
        document.getElementById('onboarding-preview-modal').classList.add('hidden');
        document.getElementById('inbox-modal').classList.add('hidden');
        
        try {
            emp.status = 'Active';
            const response = await fetch(`/api/employees/${empId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emp)
            });
            
            if (!response.ok) throw new Error('Failed to approve registration');
            alert('Registration approved successfully!');
            await fetchData();
            renderInbox();
        } catch (err) {
            alert('Error approving: ' + err.message);
        }
    });
    
    newRejectBtn.addEventListener('click', async () => {
        const reason = prompt("Enter the reason for rejecting this onboarding profile (this will be logged):");
        if (reason === null) return;
        const cleanReason = reason.trim() || "Details or photo did not meet requirements.";
        
        try {
            emp.status = 'Rejected';
            emp.rejectionReason = cleanReason;
            emp.rejectionDate = new Date().toISOString().substring(0, 10);
            
            const response = await fetch(`/api/employees/${empId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(emp)
            });
            
            if (!response.ok) throw new Error('Failed to reject registration');
            
            document.getElementById('onboarding-preview-modal').classList.add('hidden');
            await fetchData();
            renderInbox();
            alert('Registration successfully rejected and logged.');
        } catch (err) {
            alert('Error rejecting: ' + err.message);
        }
    });
    
    // Wire close triggers
    const closePreviewBtn = document.getElementById('btn-close-onboarding-preview');
    const cancelPreviewBtn = document.getElementById('btn-preview-close');
    
    const closeFn = () => {
        document.getElementById('onboarding-preview-modal').classList.add('hidden');
    };
    
    closePreviewBtn.onclick = closeFn;
    cancelPreviewBtn.onclick = closeFn;
    
    document.getElementById('onboarding-preview-modal').classList.remove('hidden');
    lucide.createIcons();
}

// Render the rejected submissions log
function renderInboxRejectedList() {
    const tbody = document.getElementById('inbox-rejected-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    const filterLocVal = document.getElementById('inbox-filter-location')?.value || '';
    const rejectedList = VSA_STATE.employees.filter(emp => {
        const matchesStatus = emp.status === 'Rejected';
        const matchesLocation = !filterLocVal || emp.department === filterLocVal;
        return matchesStatus && matchesLocation;
    });
    
    if (rejectedList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 30px; color: var(--text-secondary);">No rejected submissions found in log.</td></tr>`;
        return;
    }
    
    rejectedList.forEach(emp => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid var(--border-color)';
        
        row.innerHTML = `
            <td style="padding: 10px; vertical-align: middle; font-weight:600; color: #fff;">${toTitleCase(emp.name)}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.mobile || '-'}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.dob || '-'}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.designation || '-'}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.department || '-'}</td>
            <td style="padding: 10px; vertical-align: middle;">${emp.rejectionDate || '-'}</td>
            <td style="padding: 10px; vertical-align: middle; color: #f87171; font-style: italic;">${emp.rejectionReason || '-'}</td>
            <td style="padding: 10px; vertical-align: middle; text-align: right;">
                <div style="display: inline-flex; gap: 8px;">
                    <button class="btn btn-xs btn-outline btn-inbox-reopen" data-id="${emp.id}" style="display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer; color: var(--theme-accent); border-color: rgba(212, 175, 55, 0.15);"><i data-lucide="edit" style="width:12px;"></i> Re-review</button>
                    <button class="btn btn-xs btn-danger btn-inbox-delete-log" data-id="${emp.id}" style="background: #ef4444; border-color: #ef4444; color: #fff; display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer;"><i data-lucide="trash-2" style="width:12px;"></i> Clear</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
    
    // Wire up buttons
    tbody.querySelectorAll('.btn-inbox-reopen').forEach(btn => {
        btn.addEventListener('click', () => {
            const empId = btn.getAttribute('data-id');
            // Reopen in registration form
            document.getElementById('inbox-modal').classList.add('hidden');
            // Temporarily set its status to pending when re-reviewing so approval buttons display
            const emp = VSA_STATE.employees.find(e => e.id === empId);
            if (emp) emp.status = 'Pending';
            window.location.hash = `emp-registration?mode=edit&id=${empId}`;
        });
    });
    
    tbody.querySelectorAll('.btn-inbox-delete-log').forEach(btn => {
        btn.addEventListener('click', async () => {
            const empId = btn.getAttribute('data-id');
            if (!confirm(`Are you sure you want to permanently delete rejected log for guard ${empId}?`)) return;
            
            try {
                const response = await fetch(`/api/employees/${empId}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Deletion failed');
                alert('Rejected submission record deleted.');
                await fetchData();
                renderInbox();
            } catch (err) {
                alert('Error: ' + err.message);
            }
        });
    });
    
    lucide.createIcons();
}



// --- AI OCR SCANNER FRONTEND LOGIC ---
function setupOcrScanner() {
    const dropzone = document.getElementById('ocr-dropzone');
    const fileInput = document.getElementById('ocr-file-input');
    const overlay = document.getElementById('ocr-scanning-overlay');

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.style.borderColor = 'var(--theme-gold)';
            dropzone.style.background = 'rgba(207, 161, 92, 0.08)';
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.style.borderColor = 'rgba(212, 175, 55, 0.25)';
            dropzone.style.background = 'transparent';
        }, false);
    });

    dropzone.addEventListener('drop', e => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
            processOcrFile(files[0]);
        }
    });

    fileInput.addEventListener('change', function() {
        if (this.files && this.files.length > 0) {
            processOcrFile(this.files[0]);
            this.value = '';
        }
    });

    dropzone.addEventListener('click', e => {
        if (e.target !== fileInput && !e.target.closest('button')) {
            fileInput.click();
        }
    });

    async function processOcrFile(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file of the ID card.');
            return;
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async function() {
            const base64Image = reader.result;
            
            if (overlay) overlay.classList.remove('hidden');

            try {
                const response = await fetch('/api/employees/ocr', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: base64Image })
                });

                const result = await response.json();
                if (overlay) overlay.classList.add('hidden');

                if (!response.ok) {
                    throw new Error(result.error || 'Server processing failed');
                }

                if (result.success && result.data) {
                    populateFieldsFromOcr(result.data);
                    alert('AI Analysis Successful! Document fields auto-filled.');
                } else {
                    throw new Error('AI was unable to parse structured information.');
                }

            } catch (err) {
                if (overlay) overlay.classList.add('hidden');
                console.error('OCR processing error:', err);
                alert('AI Scanner Error: ' + err.message);
            }
        };
    }

    function parseDateToYmd(dateStr) {
        if (!dateStr) return '';
        dateStr = dateStr.trim();

        // Check if it's already YYYY-MM-DD
        const ymdMatch = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (ymdMatch) {
            const year = ymdMatch[1];
            const month = ymdMatch[2].padStart(2, '0');
            const day = ymdMatch[3].padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        // Check for DD-MM-YYYY or DD/MM/YYYY
        const dmyMatch = dateStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (dmyMatch) {
            const day = dmyMatch[1].padStart(2, '0');
            const month = dmyMatch[2].padStart(2, '0');
            const year = dmyMatch[3];
            return `${year}-${month}-${day}`;
        }

        // Fallback standard Date parser
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        } catch(e) {}

        return '';
    }

    function populateFieldsFromOcr(data) {
        if (data.name) document.getElementById('reg-name').value = toTitleCase(data.name);
        if (data.fatherName) document.getElementById('reg-father').value = toTitleCase(data.fatherName);
        if (data.dob) {
            const parsedDob = parseDateToYmd(data.dob);
            if (parsedDob) {
                document.getElementById('reg-dob').value = parsedDob;
                const event = new Event('change');
                document.getElementById('reg-dob').dispatchEvent(event);
            }
        }
        if (data.gender) {
            const genderVal = toTitleCase(data.gender);
            if (['Male', 'Female', 'Other'].includes(genderVal)) {
                document.getElementById('reg-gender').value = genderVal;
            }
        }
        if (data.bloodGroup) {
            const bloodVal = data.bloodGroup.toUpperCase().trim();
            const options = Array.from(document.getElementById('reg-blood').options).map(o => o.value);
            if (options.includes(bloodVal)) {
                document.getElementById('reg-blood').value = bloodVal;
            }
        }
        if (data.mobile) {
            const cleanMobile = data.mobile.replace(/\D/g, '').slice(-10);
            if (cleanMobile.length === 10) {
                document.getElementById('reg-mobile').value = cleanMobile;
            }
        }
        if (data.permanentAddress || data.address) {
            document.getElementById('reg-curr-address').value = toTitleCase(data.permanentAddress || data.address);
        }
        if (data.pincode) {
            document.getElementById('reg-pincode').value = data.pincode.replace(/\D/g, '');
        }
        if (data.documentNumber || data.aadhaar) {
            const cleanNum = (data.documentNumber || data.aadhaar).replace(/\s/g, '');
            if (cleanNum.length === 12 && /^\d+$/.test(cleanNum)) {
                document.getElementById('reg-aadhaar-no').value = cleanNum;
            }
        }
    }

    // --- ONE-SHOT FORM SCANNER FRONTEND LOGIC ---
    const formDropzone = document.getElementById('form-scan-dropzone');
    const formFileInput = document.getElementById('form-scan-file-input');
    const formOverlay = document.getElementById('form-scanning-overlay');

    if (formDropzone && formFileInput) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            formDropzone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            formDropzone.addEventListener(eventName, () => {
                formDropzone.style.borderColor = '#10b981';
                formDropzone.style.background = 'rgba(16, 185, 129, 0.08)';
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            formDropzone.addEventListener(eventName, () => {
                formDropzone.style.borderColor = 'rgba(16, 185, 129, 0.25)';
                formDropzone.style.background = 'transparent';
            }, false);
        });

        formDropzone.addEventListener('drop', e => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files && files.length > 0) {
                processFormFile(files[0]);
            }
        });

        formFileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                processFormFile(this.files[0]);
                this.value = '';
            }
        });

        formDropzone.addEventListener('click', e => {
            if (e.target !== formFileInput && !e.target.closest('button')) {
                formFileInput.click();
            }
        });

        async function processFormFile(file) {
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file of the completed registration form.');
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = async function() {
                const base64Image = reader.result;
                
                if (formOverlay) formOverlay.classList.remove('hidden');

                try {
                    const response = await fetch('/api/employees/scan-form', {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': 'Bearer ' + localStorage.getItem('vsa_token')
                        },
                        body: JSON.stringify({ image: base64Image })
                    });

                    const result = await response.json();
                    if (formOverlay) formOverlay.classList.add('hidden');

                    if (!response.ok) {
                        throw new Error(result.error || 'Form processing failed');
                    }

                    if (result.success && result.data) {
                        populateFieldsFromFormScan(result.data);
                        alert('AI Form Scanner Successful! Details extracted and photo cropped.');
                    } else {
                        throw new Error('AI was unable to parse the registration form.');
                    }

                } catch (err) {
                    if (formOverlay) formOverlay.classList.add('hidden');
                    console.error('Form scanner processing error:', err);
                    alert('AI Scanner Error: ' + err.message);
                }
            };
        }

        // Levenshtein Distance calculation for fuzzy matching
        function getLevenshteinDistance(a, b) {
            const matrix = [];
            for (let i = 0; i <= b.length; i++) matrix[i] = [i];
            for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
            for (let i = 1; i <= b.length; i++) {
                for (let j = 1; j <= a.length; j++) {
                    if (b.charAt(i - 1) === a.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1, // substitution
                            Math.min(
                                matrix[i][j - 1] + 1, // insertion
                                matrix[i - 1][j] + 1  // deletion
                            )
                        );
                    }
                }
            }
            return matrix[b.length][a.length];
        }

        // Fuzzy matching logic to match scanned names (with typos/variations) to existing dropdown options
        function findClosestMatch(scannedVal, optionsList, type) {
            if (!scannedVal) return null;
            
            let normalizedScanned = scannedVal.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');
            
            // 1. Common abbreviations explicit mapping
            if (type === 'designation') {
                if (normalizedScanned === 'MTS' || normalizedScanned.includes('MULTI TASKING') || normalizedScanned.includes('MULTITASKING')) {
                    normalizedScanned = 'MULTI TASKING STAFF';
                }
                if (normalizedScanned === 'DEO' || normalizedScanned.includes('DATA ENTRY')) {
                    normalizedScanned = 'DATA ENTRY OPERATOR';
                }
                if (normalizedScanned === 'SCD' || normalizedScanned.includes('STAFF CAR')) {
                    normalizedScanned = 'STAFF CAR DRIVER';
                }
            } else if (type === 'department') {
                if (normalizedScanned.includes('CHILDREN')) {
                    normalizedScanned = 'CHILDREN HOSPITAL';
                }
                if (normalizedScanned.includes('ACCOUNTANT GENERAL') || normalizedScanned.includes('AG OFFICE') || normalizedScanned === 'AG') {
                    normalizedScanned = 'PRINCIPAL ACCOUNTANT GENERAL (A&E)';
                }
            }

            let bestMatch = null;
            let highestSimilarity = 0;

            for (const option of optionsList) {
                if (!option) continue;
                const normalizedOpt = option.trim().toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, ' ');

                // A. Exact match check
                if (normalizedScanned === normalizedOpt) {
                    return option;
                }

                // B. Substring match check (e.g. "CHILDREN HOSPITAL BEMINA" contains "CHILDREN HOSPITAL")
                if (normalizedScanned.includes(normalizedOpt) || normalizedOpt.includes(normalizedScanned)) {
                    if (normalizedOpt.length > 5) {
                        return option;
                    }
                }

                // C. Fuzzy Levenshtein match check
                const maxLength = Math.max(normalizedScanned.length, normalizedOpt.length);
                if (maxLength > 0) {
                    const distance = getLevenshteinDistance(normalizedScanned, normalizedOpt);
                    const similarity = 1 - (distance / maxLength);
                    if (similarity > highestSimilarity) {
                        highestSimilarity = similarity;
                        bestMatch = option;
                    }
                }
            }

            if (highestSimilarity >= 0.7) {
                return bestMatch;
            }

            return null;
        }

        function populateFieldsFromFormScan(data) {
            // Get configured options from select elements to perform comparison
            const desigOptions = Array.from(document.getElementById('reg-designation').options).map(o => o.value).filter(val => val !== "");
            const deptOptions = Array.from(document.getElementById('reg-department').options).map(o => o.value).filter(val => val !== "");

            // Fuzzy match designation
            if (data.designation) {
                const matchedDesig = findClosestMatch(data.designation, desigOptions, 'designation');
                if (matchedDesig) {
                    data.designation = matchedDesig;
                } else {
                    console.log(`⚠️ OCR designation '${data.designation}' had no close match. Left blank.`);
                    data.designation = ''; 
                }
            }

            // Fuzzy match department
            if (data.department) {
                const matchedDept = findClosestMatch(data.department, deptOptions, 'department');
                if (matchedDept) {
                    data.department = matchedDept;
                } else {
                    console.log(`⚠️ OCR department '${data.department}' had no close match. Left blank.`);
                    data.department = '';
                }
            }

            // Fill standard text fields first
            populateFieldsFromOcr(data);

            // Fill designation and department dropdown selection
            if (data.designation) {
                document.getElementById('reg-designation').value = data.designation;
            } else {
                document.getElementById('reg-designation').value = '';
            }

            if (data.department) {
                document.getElementById('reg-department').value = data.department;
            } else {
                document.getElementById('reg-department').value = '';
            }
            if (data.esic) {
                document.getElementById('reg-esic-no').value = data.esic.replace(/\D/g, '');
            }
            if (data.uan) {
                document.getElementById('reg-uan-no').value = data.uan.replace(/\D/g, '');
            }
            if (data.bankAccount) {
                document.getElementById('reg-bank-account').value = data.bankAccount.replace(/\s/g, '');
            }
            if (data.ifsc) {
                document.getElementById('reg-ifsc').value = data.ifsc.toUpperCase().trim();
            }
            if (data.joiningDate) {
                const parsedJoining = parseDateToYmd(data.joiningDate);
                if (parsedJoining) {
                    document.getElementById('reg-joining-date').value = parsedJoining;
                }
            }
            if (data.salary) {
                document.getElementById('reg-salary').value = data.salary.replace(/\D/g, '');
            }

            // Fill cropped photo (Signature scan disabled as requested)
            if (data.photo) {
                const photoInput = document.getElementById('reg-photo');
                const photoPreview = document.getElementById('reg-photo-preview');
                if (photoInput) {
                    photoInput.dataset.imageData = data.photo;
                }
                if (photoPreview) {
                    photoPreview.innerHTML = `<img src="${data.photo}" style="max-height: 100px; border-radius: 8px;">`;
                }
            }
        }
    }
}


