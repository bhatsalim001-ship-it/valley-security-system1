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
                <div class="toast-message"></div>
            </div>
            <button type="button" class="toast-close">&times;</button>
        `;
        toast.querySelector('.toast-message').textContent = String(message ?? '');
        
        container.appendChild(toast);
        
        if (window.lucide) {
            window.lucide.createIcons();
        }
        
        setTimeout(() => toast.classList.add('active'), 20);
        
        const removeToast = () => {
            if (toast.classList.contains('remove')) return;
            toast.classList.add('remove');
            setTimeout(() => toast.remove(), 120);
        };
        
        toast.querySelector('.toast-close').addEventListener('click', removeToast);
        setTimeout(removeToast, 2200);
    };
    window.showToast = window.alert;
})();

const showToast = (msg) => window.alert(msg);


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
    deploymentProjects: [],
    activeDeploymentProjectId: null,
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
let serverStatusFailedAttempts = 0;
function startServerStatusHeartbeat() {
    setInterval(async () => {
        if (document.hidden) return; // Skip in background tabs to conserve rate limit
        try {
            const response = await fetch('/api/lan-ip');
            if (response.ok || response.status === 429) {
                serverStatusFailedAttempts = 0; // reset on success or rate-limit
            } else if (response.status >= 500) {
                serverStatusFailedAttempts++;
            }
        } catch (err) {
            serverStatusFailedAttempts++;
        }

        if (serverStatusFailedAttempts >= 5) {
            console.warn('⚠️ Server unreachable after multiple consecutive health checks.');
        }
    }, 60000); // Check every 60 seconds (calmed from 15s)
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

    // Set max DOB date constraint to today's date
    const dobInput = document.getElementById('form-dob');
    if (dobInput) {
        dobInput.max = new Date().toISOString().split('T')[0];
    }
    
    VSA_STATE.selectedEmployeeIds = [];
    initLuxuryInteractions();
    initTiltCards();
    initThemeSwitch();
    initEtherealShadowAnimation();
    initSpaRouter();
    fetchData();
    setupDmyDateInputs();
    setupEventHandlers();
    setupClassificationsManager();
    setupTemplatesManager();
    setupCropperControls();
    setupModalA11y();
    setupMobileSidebar();
    initPwaAndOfflineSentinel();

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
    
    // Start system update checking (run immediately on load, then every 2 minutes)
    checkForUpdates();
    setInterval(() => {
        if (!document.hidden) checkForUpdates();
    }, 120000);
    
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

    // Refresh UICE Studio Stage if entering templates view
    if (targetView === 'templates' && typeof renderUiceStage === 'function') {
        setTimeout(() => {
            renderUiceStage();
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons();
            }
        }, 50);
    }
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
    } else if (targetView === 'deployments') {
        if (typeof loadDeploymentsData === 'function') {
            loadDeploymentsData();
        }
    }
}

function updateHeaderTitles(view) {
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    
    const titles = {
        dashboard: { main: "Dashboard Overview", sub: "Valley Security operations control center." },
        employees: { main: "Employee Directory", sub: "Manage active and suspended security guards." },
        deployments: { main: "Tender Deployments & Candidate Onboarding", sub: "Generate onboarding links, track guard intake progress live, and bulk-approve personnel." },
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

// Fetch All Database details (Optimized: parallel lightweight endpoints with /api/db fallback)
async function fetchData() {
    try {
        let emps = [];
        let classifications = {};

        try {
            const [empRes, classRes] = await Promise.all([
                fetch('/api/employees'),
                fetch('/api/classifications')
            ]);
            if (empRes.status === 401) {
                sessionStorage.removeItem('currentUser');
                window.location.href = '/login.html';
                return;
            }
            if (empRes.ok) {
                emps = await empRes.json();
                if (classRes.ok) {
                    classifications = await classRes.json();
                }
            } else {
                // Graceful fallback to /api/db if /api/employees fails
                const dbRes = await fetch('/api/db');
                if (dbRes.status === 401) {
                    sessionStorage.removeItem('currentUser');
                    window.location.href = '/login.html';
                    return;
                }
                if (!dbRes.ok) throw new Error('API Sync failure');
                const db = await dbRes.json();
                emps = db.employees || [];
                classifications = {
                    departments: db.departments || [],
                    designations: db.designations || [],
                    manpowerTypes: db.manpowerTypes || []
                };
            }
        } catch (fetchErr) {
            try {
                const dbRes = await fetch('/api/db');
                if (dbRes.status === 401) {
                    sessionStorage.removeItem('currentUser');
                    window.location.href = '/login.html';
                    return;
                }
                if (dbRes.ok) {
                    const db = await dbRes.json();
                    emps = db.employees || [];
                    classifications = {
                        departments: db.departments || [],
                        designations: db.designations || [],
                        manpowerTypes: db.manpowerTypes || []
                    };
                }
            } catch (dbErr) {
                console.warn('⚡ Offline mode: Loading cached employee roster');
                try {
                    const cached = localStorage.getItem('vsa_last_employees_cache');
                    if (cached) emps = JSON.parse(cached) || [];
                } catch (e) {}
            }
        }
        
        VSA_STATE.employees = Array.isArray(emps) ? emps : (emps.employees || []);
        if (Array.isArray(VSA_STATE.employees) && VSA_STATE.employees.length > 0) {
            try {
                localStorage.setItem('vsa_last_employees_cache', JSON.stringify(VSA_STATE.employees));
            } catch (storageErr) {}
        }
        VSA_STATE.clients = [];
        VSA_STATE.departments = classifications.departments || [];
        VSA_STATE.designations = classifications.designations || [];
        VSA_STATE.manpowerTypes = classifications.manpowerTypes || [];
        


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
        
        // Fetch Deployment Projects
        try {
            const depResponse = await fetch('/api/deployment-projects');
            if (depResponse.ok) {
                VSA_STATE.deploymentProjects = await depResponse.json();
                if (typeof updateDeploymentsBadge === 'function') updateDeploymentsBadge();
            }
        } catch (e) {
            // Silently fallback if offline
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

    // Load AI Dashboard Insights
    fetchAiDashboardInsights();
}

// Global cached state to prevent duplicate AI queries within a session
let CACHED_AI_INSIGHTS = null;

async function fetchAiDashboardInsights() {
    const container = document.getElementById('ai-insights-container');
    const statusBadge = document.getElementById('ai-analysis-status');
    if (!container) return;

    if (CACHED_AI_INSIGHTS) {
        renderAiInsightsList(CACHED_AI_INSIGHTS);
        return;
    }

    // Render 3 skeleton loaders for glassmorphism layout
    container.innerHTML = `
        <div class="ai-insight-skeleton"></div>
        <div class="ai-insight-skeleton"></div>
        <div class="ai-insight-skeleton"></div>
    `;
    if (statusBadge) {
        statusBadge.textContent = "Analyzing Staff Database...";
        statusBadge.style.animation = "pulse 1.5s infinite";
    }

    try {
        const response = await fetch('/api/ai/dashboard-insights', {
            credentials: 'same-origin'
        });

        if (!response.ok) {
            throw new Error('AI insights service unavailable');
        }

        const data = await response.json();
        if (data.success && data.insights) {
            CACHED_AI_INSIGHTS = data.insights;
            renderAiInsightsList(data.insights);
        } else {
            throw new Error('Invalid AI insights data payload');
        }
    } catch (err) {
        console.warn('AI Insights failed to load:', err.message);
        if (statusBadge) {
            statusBadge.textContent = "Offline";
            statusBadge.style.animation = "none";
        }
        container.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 20px; color: var(--text-secondary); font-size: 12px; font-style: italic;">
                <i data-lucide="info" style="width: 14px; height: 14px;"></i>
                <span>AI Operations Advisor is temporarily offline. Check your server Gemini API Key.</span>
            </div>
        `;
        lucide.createIcons();
    }
}

function renderAiInsightsList(insights) {
    const container = document.getElementById('ai-insights-container');
    const statusBadge = document.getElementById('ai-analysis-status');
    if (!container) return;

    if (statusBadge) {
        statusBadge.textContent = "Active";
        statusBadge.style.animation = "none";
    }

    if (!insights || insights.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 20px; color: var(--text-secondary); font-size: 12px; font-style: italic;">
                <i data-lucide="check" style="width: 14px; height: 14px; color: var(--theme-green);"></i>
                <span>All operations and compliance parameters are optimal.</span>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    let html = '';
    insights.forEach(item => {
        const typeClass = item.type || 'info';
        let iconName = 'info';
        if (typeClass === 'critical') iconName = 'alert-triangle';
        else if (typeClass === 'warning') iconName = 'clock';
        else if (typeClass === 'success') iconName = 'check-circle';

        html += `
            <div class="ai-insight-card ${typeClass}">
                <div>
                    <div class="ai-insight-header">
                        <i data-lucide="${iconName}" style="width: 14px; height: 14px;"></i>
                        <span class="ai-insight-title">${item.title}</span>
                    </div>
                    <p class="ai-insight-message">${item.message}</p>
                </div>
                ${item.actionLabel && item.actionHash ? `
                <button class="ai-insight-action" data-hash="${item.actionHash}">
                    ${item.actionLabel}
                    <i data-lucide="arrow-right" style="width: 10px; height: 10px;"></i>
                </button>
                ` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
    lucide.createIcons();

    // Wire up action buttons
    container.querySelectorAll('.ai-insight-action').forEach(btn => {
        btn.addEventListener('click', function() {
            const hash = this.getAttribute('data-hash');
            if (hash) {
                window.location.hash = hash;
                if (hash.startsWith('#employees')) {
                    setTimeout(() => renderEmployeeDirectory(), 50);
                }
            }
        });
    });
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

    // Sort by count descending for absolute visual rhythm
    entries.sort((a, b) => b[1] - a[1]);

    // Find max count to normalize width scaling
    const maxCount = Math.max(...entries.map(e => e[1]));
    const maxBarContainerWidth = 400; // Leaving room for labels and numbers

    let svgHtml = `<svg width="100%" height="100%" viewBox="0 0 600 ${entries.length * 40 + 30}" xmlns="http://www.w3.org/2000/svg">`;
    
    // Draw vertical dotted guide lines
    for (let i = 0; i <= 4; i++) {
        const pct = i * 0.25;
        const x = 160 + pct * maxBarContainerWidth;
        const guideValue = Math.round(pct * maxCount);
        svgHtml += `
            <line x1="${x}" y1="10" x2="${x}" y2="${entries.length * 40 + 10}" stroke="var(--vs-border-subtle)" stroke-width="1" stroke-dasharray="3 3"/>
            <text x="${x}" y="${entries.length * 40 + 25}" fill="var(--vs-text-muted)" font-size="9" font-family="var(--vs-font-mono)" font-weight="600" text-anchor="middle">${guideValue}</text>
        `;
    }

    entries.forEach(([dept, count], idx) => {
        const y = 18 + idx * 40;
        // Normalize bar width relative to maxCount
        const barWidth = maxCount > 0 ? (count / maxCount) * maxBarContainerWidth : 0;
        const fullDeptName = toTitleCase(dept);
        const displayDeptName = fullDeptName.length > 20 ? fullDeptName.substring(0, 18) + '..' : fullDeptName;
        
        svgHtml += `
            <g class="chart-bar-group" data-dept="${dept}">
                <title>${fullDeptName} (${count} guards)</title>
                <!-- Department Label -->
                <text x="10" y="${y + 11}" fill="var(--vs-text-primary)" font-size="12px" font-family="inherit" font-weight="500">${displayDeptName}</text>
                
                <!-- Background Pill Track -->
                <rect x="160" y="${y}" width="${maxBarContainerWidth}" height="14" rx="7" fill="var(--vs-surface-3)" stroke="var(--vs-border-subtle)" stroke-width="0.5"/>
                
                <!-- Filled Gradient Pill -->
                <rect x="160" y="${y}" width="${barWidth}" height="14" rx="7" fill="url(#barGoldGradient)"/>
                
                <!-- Guard Count Label -->
                <text x="580" y="${y + 11}" fill="var(--vs-accent-emerald)" font-size="11px" font-family="var(--vs-font-mono)" font-weight="700" text-anchor="end">${count}</text>
            </g>
        `;
    });

    // Gradients def - precision emerald gradient
    svgHtml += `
        <defs>
            <linearGradient id="barGoldGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#059669"/>
                <stop offset="100%" stop-color="#10b981"/>
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
        const borderStyle = alert.type === 'critical' ? 'style="border-left-color: var(--vs-status-suspended);"' : 
                           alert.type === 'warning' ? 'style="border-left-color: var(--vs-status-pending);"' : 
                           'style="border-left-color: var(--vs-accent-emerald);"';

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
            <button class="alert-action-btn" data-id="${alert.empId}">
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
            const label = this.textContent.trim();
            if (label === 'Renew ID') {
                openCardRenewalModal(empId);
            } else {
                window.location.hash = `emp-registration?mode=edit&id=${empId}`;
            }
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
            `<img src="${photoSrc}" alt="${escapeHtml(emp.name || 'Employee')} Photo" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--glass-border);" onerror="this.onerror=null; this.src='/api/employees/default-avatar.svg';">` : 
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
                    <div style="display: flex; gap: 6px;">
                        <button class="btn-recent-edit" data-id="${emp.id}" title="Edit details"><i data-lucide="edit-3" style="width: 13px; height: 13px;"></i></button>
                        <button class="btn-recent-card" data-id="${emp.id}" title="Download ID"><i data-lucide="credit-card" style="width: 13px; height: 13px;"></i></button>
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

        const isExpired = getCardExpirationDate(emp) < new Date();
        const renewBtnHtml = isExpired ? `<button class="btn btn-xs btn-outline btn-renew-card-img" data-id="${escapeHtml(emp.id)}">Renew ID</button>` : '';

        const isChecked = VSA_STATE.selectedEmployeeIds.includes(emp.id) ? 'checked' : '';
        const photoSrc = (emp.documents && emp.documents.photo) ? emp.documents.photo : '';
        const showPhoto = photoSrc ? `<img src="${photoSrc}" alt="${escapeHtml(emp.name || 'Employee')} Photo" onerror="this.onerror=null; this.src='/api/employees/default-avatar.svg';">` : `<i data-lucide="user"></i>`;
        
        if (directoryViewMode === 'card') {
            const card = document.createElement('div');
            card.className = 'directory-card';
            
            card.innerHTML = `
                <div class="directory-card-select">
                    <input type="checkbox" class="directory-select-item" data-id="${escapeHtml(emp.id)}" ${isChecked}>
                </div>
                <div class="directory-card-photo">
                    ${showPhoto}
                </div>
                <div class="directory-card-info">
                    <div class="directory-card-name" title="${escapeHtml(toTitleCase(emp.name))}">${escapeHtml(toTitleCase(emp.name))}</div>
                    <div class="directory-card-empid">${escapeHtml(emp.id)}</div>
                    <div class="directory-card-subtext" title="${escapeHtml(toTitleCase(emp.designation))}">${escapeHtml(toTitleCase(emp.designation))}</div>
                    <div class="directory-card-client" title="${escapeHtml(toTitleCase(emp.department || '-'))}">${escapeHtml(toTitleCase(emp.department || '-'))}</div>
                    <div class="directory-card-chips">
                        <span class="directory-card-chip">${escapeHtml(emp.manpowerType || 'Security')}</span>
                        <select class="directory-status-select" data-id="${escapeHtml(emp.id)}" data-status="${escapeHtml(emp.status)}">
                            <option value="Active" ${emp.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="Suspended" ${emp.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                            <option value="Fired" ${emp.status === 'Fired' ? 'selected' : ''}>Fired</option>
                            <option value="Left" ${emp.status === 'Left' ? 'selected' : ''}>Left</option>
                        </select>
                    </div>
                    <div class="directory-card-actions">
                        ${renewBtnHtml}
                        <button class="btn btn-xs btn-outline btn-generate-card-img" data-id="${escapeHtml(emp.id)}">ID Card</button>
                        <button class="btn btn-xs btn-outline btn-edit-emp" data-id="${escapeHtml(emp.id)}">Edit</button>
                        <button class="btn btn-xs btn-outline btn-delete-emp" data-id="${escapeHtml(emp.id)}">Delete</button>
                    </div>
                </div>
            `;
            cardGrid.appendChild(card);
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="checkbox" class="directory-select-item" data-id="${escapeHtml(emp.id)}" ${isChecked}></td>
                <td><strong>${escapeHtml(emp.id)}</strong></td>
                <td>
                    <div class="d-flex align-items-center gap-2">
                        <div class="directory-list-avatar">
                            ${photoSrc ? `<img src="${photoSrc}" alt="${escapeHtml(emp.name || 'Employee')} Avatar" onerror="this.onerror=null; this.src='/api/employees/default-avatar.svg';">` : `<i data-lucide="user"></i>`}
                        </div>
                        <span class="directory-list-name">${escapeHtml(toTitleCase(emp.name))}</span>
                    </div>
                </td>
                <td>${escapeHtml(toTitleCase(emp.designation))}</td>
                <td>${escapeHtml(toTitleCase(emp.department || '-'))}</td>
                <td>${escapeHtml(emp.mobile)}</td>
                <td><span class="directory-list-docs">${escapeHtml(docsText)}</span></td>
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
                        ${renewBtnHtml}
                        <button class="btn btn-xs btn-outline btn-generate-card-img" data-id="${escapeHtml(emp.id)}">ID Card</button>
                        <button class="btn btn-xs btn-outline btn-edit-emp" data-id="${escapeHtml(emp.id)}">Edit</button>
                        <button class="btn btn-xs btn-outline btn-delete-emp" data-id="${escapeHtml(emp.id)}">Delete</button>
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

    document.querySelectorAll('.btn-renew-card-img').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Stop card click selection toggle
            const empId = btn.getAttribute('data-id');
            openCardRenewalModal(empId);
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

    // 4B. Populate templates select across both Classic and Advance visual designers
    const idTplSel = document.getElementById('id-select-template');
    const bulkTplSel = document.getElementById('bulk-select-template');
    const tplEditSel = document.getElementById('tpl-edit-select');
    const topTplSel = document.getElementById('uice-top-tpl-select');
    let tplHtml = '';
    (VSA_STATE.templates || []).forEach(t => {
        tplHtml += `<option value="${t.id}">${escapeHtml(t.name)} (${t.layout === 'vertical' ? 'Vertical' : 'Horizontal'})</option>`;
    });
    if (idTplSel) idTplSel.innerHTML = tplHtml;
    if (bulkTplSel) bulkTplSel.innerHTML = tplHtml;
    if (tplEditSel) {
        tplEditSel.innerHTML = '<option value="">-- Select Template to Edit/Delete --</option>' + tplHtml;
        const activeTplId = document.getElementById('tpl-id') ? document.getElementById('tpl-id').value : '';
        tplEditSel.value = activeTplId || '';
    }
    if (topTplSel) {
        topTplSel.innerHTML = tplHtml;
        const activeTplId = (document.getElementById('tpl-id') && document.getElementById('tpl-id').value) ||
            (typeof UICE_STATE !== 'undefined' && UICE_STATE.template && UICE_STATE.template.id);
        if (activeTplId) {
            topTplSel.value = activeTplId;
        }
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
            const avatarHtml = photoSrc ? `<img src="${photoSrc}" alt="${escapeHtml(emp.name || 'Employee')} Avatar" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.src='/api/employees/default-avatar.svg';">` : `<i data-lucide="user" style="width: 12px; height: 12px; color: var(--text-muted);"></i>`;

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
                        allowTaint: false,
                        backgroundColor: '#ffffff',
                        logging: false,
                        letterRendering: true
                    });
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
                        const base64Data = dataUrl.split(',')[1];
                        const filename = `VSA_ID_${emp.id}_${emp.name.replace(/\s+/g, '_')}_${sideName}.png`;
                        zip.file(filename, base64Data, {base64: true});
                        renderCount++;
                    } else {
                        console.error(`Invalid PNG data URL generated for visual card: ${emp.id}`);
                    }
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
                        allowTaint: false,
                        backgroundColor: '#ffffff',
                        logging: false,
                        letterRendering: true
                    });
                    
                    const dataUrl = canvas.toDataURL('image/png');
                    if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
                        const base64Data = dataUrl.split(',')[1];
                        const filename = `VSA_ID_${emp.id}_${emp.name.replace(/\s+/g, '_')}.png`;
                        zip.file(filename, base64Data, {base64: true});
                        renderCount++;
                    } else {
                        console.error(`Invalid PNG data URL generated for card: ${emp.id}`);
                    }
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
            document.getElementById('form-photo-preview-box').innerHTML = `<img src="${emp.documents.photo}" alt="Employee Photo Preview">`;
        } else {
            document.getElementById('form-photo-preview-box').innerHTML = `<span class="preview-placeholder">No image selected (Required for ID card)</span>`;
        }
        if (emp.documents?.signature) {
            document.getElementById('form-sig-preview-box').innerHTML = `<img src="${emp.documents.signature}" alt="Signature Preview">`;
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

// Open Card Renewal & Extension Modal
function openCardRenewalModal(empId) {
    console.log('openCardRenewalModal called for:', empId);
    try {
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (!emp) {
            alert('Guard not found in database.');
            return;
        }

        const elId = document.getElementById('renewal-emp-id');
        const elName = document.getElementById('renewal-guard-name');
        const elIdDisplay = document.getElementById('renewal-guard-id');
        const elDept = document.getElementById('renewal-guard-dept');
        const elExpiry = document.getElementById('renewal-current-expiry');
        const elPhoto = document.getElementById('renewal-guard-photo');
        const elTerm = document.getElementById('renewal-term');
        const elFee = document.getElementById('renewal-fee');
        const elNotes = document.getElementById('renewal-notes');
        const elBtnSubmit = document.getElementById('btn-submit-card-renewal');
        const modal = document.getElementById('modal-card-renewal');

        if (!elId || !elName || !elIdDisplay || !elDept || !elExpiry || !elPhoto || !elTerm || !elFee || !elNotes || !elBtnSubmit || !modal) {
            alert('Error: Some modal elements are missing from the page. Please hard-refresh.');
            return;
        }

        elId.value = empId;
        elName.textContent = toTitleCase(emp.name);
        elIdDisplay.textContent = `ID: ${emp.id}`;
        elDept.textContent = emp.department || 'Not Assigned';
        
        const expDate = getCardExpirationDate(emp);
        elExpiry.textContent = expDate.toLocaleDateString();

        const photoUrl = (emp.documents && emp.documents.photo) ? emp.documents.photo : '';
        if (photoUrl) {
            elPhoto.style.backgroundImage = `url('${photoUrl}')`;
        } else {
            elPhoto.style.backgroundImage = 'none';
        }

        // Reset form fields
        elTerm.value = '3';
        elFee.value = '50';
        elNotes.value = '';
        elBtnSubmit.textContent = 'Confirm & Renew (₹50)';

        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        alert('Runtime Error in Renewal Modal: ' + err.message + '\n' + err.stack);
    }
}

// Convert files to base64 utility helper
function handleImageCompression(fileInput, previewBoxId, callback) {
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        document.getElementById(previewBoxId).innerHTML = `<img src="${base64}" alt="Document Preview">`;
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

        if (!response.ok) {
            let errorMsg = 'Saving guard record failed';
            try {
                const errJson = await response.json();
                if (errJson && (errJson.error || errJson.message)) errorMsg = errJson.error || errJson.message;
            } catch (_) {}
            if (response.status === 401) {
                alert('Your session has expired. Please log in again.');
                sessionStorage.removeItem('currentUser');
                window.location.href = '/login.html';
                return;
            }
            throw new Error(errorMsg);
        }
        
        document.getElementById('employee-modal').classList.add('hidden');
        fetchData(); // Reload UI state
    } catch (err) {
        alert(err.message);
    }
}

async function deleteEmployeeRecord(empId) {
    if (!confirm(`Are you sure you want to delete employee record ${empId}?`)) return;

    // Optimistically remove card or row from DOM immediately in 0ms (no long animation)
    document.querySelectorAll(`.directory-card`).forEach(c => {
        if (c.querySelector(`[data-id="${empId}"]`)) {
            c.classList.add('row-optimistic-deleted');
            setTimeout(() => c.remove(), 80);
        }
    });
    document.querySelectorAll(`#employees-list-tbody tr, #employee-directory-body tr`).forEach(r => {
        if (r.querySelector(`[data-id="${empId}"]`)) {
            r.classList.add('row-optimistic-deleted');
            setTimeout(() => r.remove(), 80);
        }
    });

    VSA_STATE.employees = VSA_STATE.employees.filter(e => e.id !== empId);
    VSA_STATE.selectedEmployeeIds = VSA_STATE.selectedEmployeeIds.filter(id => id !== empId);
    updateBulkActionBanner();

    try {
        const response = await fetch(`/api/employees/${encodeURIComponent(empId)}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Deletion failed on server');
        showToast(`Employee ${empId} deleted successfully.`);
    } catch (err) {
        showToast(`Error deleting employee: ${err.message}`);
        fetchData(); // Rollback if error
    }
}

async function bulkDeleteEmployees() {
    const selectedIds = [...VSA_STATE.selectedEmployeeIds];
    if (selectedIds.length === 0) {
        showToast("Please select at least one employee to delete.");
        return;
    }

    if (!confirm(`Permanently delete ${selectedIds.length} selected employee record(s)? This action cannot be undone.`)) {
        return;
    }

    // Optimistically remove all selected rows/cards from DOM immediately in 0ms
    selectedIds.forEach(empId => {
        document.querySelectorAll(`.directory-card`).forEach(c => {
            if (c.querySelector(`[data-id="${empId}"]`)) {
                c.classList.add('row-optimistic-deleted');
                setTimeout(() => c.remove(), 80);
            }
        });
        document.querySelectorAll(`#employees-list-tbody tr, #employee-directory-body tr`).forEach(r => {
            if (r.querySelector(`[data-id="${empId}"]`)) {
                r.classList.add('row-optimistic-deleted');
                setTimeout(() => r.remove(), 80);
            }
        });
    });

    // Update global state and banner immediately
    VSA_STATE.employees = VSA_STATE.employees.filter(e => !selectedIds.includes(e.id));
    VSA_STATE.selectedEmployeeIds = [];
    updateBulkActionBanner();

    try {
        const response = await fetch('/api/employees/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeIds: selectedIds })
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error || 'Bulk delete failed');
        showToast(`Successfully deleted ${resData.count || selectedIds.length} employee(s).`);
    } catch (err) {
        console.error('Bulk delete error:', err);
        showToast(`Bulk delete error: ${err.message}`);
        fetchData();
    }
}

async function bulkUpdateEmployeeStatus(targetStatus) {
    const selectedIds = [...VSA_STATE.selectedEmployeeIds];
    if (selectedIds.length === 0) {
        showToast(`Please select at least one employee to set status to ${targetStatus}.`);
        return;
    }

    // Optimistically update status on screen immediately in 0ms
    selectedIds.forEach(empId => {
        const emp = VSA_STATE.employees.find(e => e.id === empId);
        if (emp) emp.status = targetStatus;

        document.querySelectorAll(`.directory-status-select[data-id="${empId}"]`).forEach(sel => {
            sel.value = targetStatus;
            sel.setAttribute('data-status', targetStatus);
        });
    });

    showToast(`Updated ${selectedIds.length} employee(s) to ${targetStatus}.`);

    try {
        const response = await fetch('/api/employees/bulk-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeIds: selectedIds, status: targetStatus })
        });
        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error || 'Bulk status update failed');
    } catch (err) {
        console.error('Bulk status update error:', err);
        showToast(`Status sync error: ${err.message}`);
        fetchData();
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
const VSA_FALLBACK_LOGO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPoAAAD6CAMAAAC/MqoPAAAAS1BMVEX+/v7t7u90dHR5eXkGJ1QAG0oAFUT///8CI1D6+vvCxs2vtLzS1Njg4eUwR2xLX39ra2saNF1FRUWapLQsLCxkdZGcnJx/jaWJiYmOuc4QAAAACXBIWXMAAA7DAAAOwwHHb6hkAAAdz0lEQVR42u1diYKjOq6FsBixhsew/P+XPi22MWBIUiFL9S1mbndXApSPtVqWpSBYXSrwXOroyzuvzTvU/j2vv1T4v+A/ev1B/4N+4nu/Dedz0NWvo+tpVFffMujXMLz6ycjUp6mpfjKIH8u6+m5u/tPwBxfcAR2cP+98659d/4P+exn+a/gXzh3Vd1BdfcKMvAW6+pP1D8BTn4Cu/rsa/j7oAN8E/dnBPPA8gFrfDj+ZYLj9HGz++RFZhxl5lyv4D6o5UNCnbfEp7B+Eju5Uk8ZZ1qmPOE3wOeig8jaJszhO+vBuwqvvp7q6Le6qyxA5Qs/SulTv1/Qfojrqt6pJM0ROV5zEXfB+iX8zdGOLVIHMrpET5dOmervE/xS6usnWu7tLCLxqkkSAJ0L6OI07eJbw6s1Uh8d5HbpWA0fEmfwTJb4p30v4FzM8eNRbXlspRz4v9DSgps/6t3L9W2Ud1bgqkdeNdktGZn6aCRR8JHzbhe8D/141p6o+0+oNOb3OlQrRpnex81kHbwL/PuOG9FVlH8+8no0IMo+mSs2GLmbwRHn4Z6iOwIN8Bi5ujAqHy+V6KVjx8Vfs3KXtGKo3kP4d0IngYdcYQyZCzSS/XqLL5cKEt5KQEfi+xGdeTPo1dDjZXSbNpqAc28QBHiNZg2q4XK9DWE7Xa1QgmUn/xZbts6Zj0sPrHPuXUp1xq6qrUbJjCzzrkdehQOBRHmiun3KSiDpNZplH0ueIHmkP72d49Rxswh1UXRMToJniDDyfmOSMSxHhL0NF84Hgza14b1L3yA/Bi7Teg1SHe2EjuVSYjwvcKMRM8YCwXifrvCFkkvpOwFvJ4AeStu8q4p3z4Z/N8JrYKN5dj/JtYZDNRhhE8XJgXgerxvCJsItQ1wv4JrHiwZyfxPVYMHwVnMn9J0EHEMx0QVV0TZsx7hlBmpLBNsCLpddGTh1+fokIYlD2bbp4lohf910Zym+Q33Y0CXelPpwAXdkLwrIbmxo9VIa9JDiSGWXcB1y/pRyI8kMJZArrhKR+Ro/w06xt+i6vwvk3fprqEFZVWXRj39QtEYhRW9hEs5gtlQoLknEG7p9CtneXgSepHAl95ryIZpAmBCdg7Iq8qsIQPgpdVXUbk0JKCTSjjpnSGjbhrti2DxEpt+JggUKGUG6qmEV6tIpJlrkxDaI//y78Z9v26olF/bPQQZW8EosdSutBEonahlQXiT8RnAl6YCXY7TN3sk1H2sdp6kpPJu5uLGte9UGqI/RsdcVCbYQ95mSVETcx8lV0GNwKZBj+iAZ+OqgKJH6ywc8e76ehm4iLJjyPstawVVgWE+Nm9eUHDh7Sy2QNOc0WTkbRN23Cb3b4673Qt0O30DMWwaxF1EUJYuXyQePOH1mLiRtYCO2nQtu0Ku8Qv1UqPujqEQz3rNfVLaqL+CHmHkGTgsJHQhzpRGO/TGiPaR4eXuwFYT7IGwaED9pnyNGU1G1LhP8Chuf44ijOKxn3Ki+E2tcJORbUzxbf7CGRvBB8pH5n8dPE1rRxk9SfhZ4L9A4xE+iOHBMe6yB8/4TzzeghzBG+fWdeVmjOVSPQgw9DZ97rVBHJAC88Qqa2OmOfhslckvzo10dR+Rh05f/nWVQv1EBSSWQJxZvXXrZSz4YZ9OoAJanMh2FCWSo/QnXlpzpDH7S8m/XF4rqx+JHcErDi4XmBdturyIH+RNrZqVTnLAEeu9peO7RU/lt3XkCRgNCBDt+g5ix0+qwaN1ehNhqMOTjP6b/lhZsw3fYNoPSIvwt65kLHayS/g7wPc7XVyvsgtz6ieKy5rubClWulcgxcz8/TcsDM3RK6ekVE9jGqJ0voqmB3M9ZXUi+Q410lKivEG3mv6xSqsrVP054Uhu2DBfT0Wegrbw5uOICwS/UVdPx4sY4rXW8OOApLGC30i/xPX9FlwF1J53liGjur4XTNn4MOOwwPZ1AdPx/Teeho9edBogMomC8CWP6QH80E4G6c+3zqpJidAH3N8PCUrK+h4zd1YgmfOFRDJXgRsJrfL5rqkSE5MjythZN5cdo7Lz4LOpyl4TfQieVj3+Bx6EzZSERd0z3SyGU+MLzBeWX6at2QloLTqf6zFI5d6Mzy8+gTZllFHw+GwNHOhe9R3cwyvD74Ouj0Avbm1sZNXt0mM3QeJU1VaUkczQZtcaF+D9tZRa7DUBZ69lnoC0d2CR1UkTosP8qXeJuR7istczwXRmZ6h2GW5mFF9Re7NPC4S6O/cwU2YwRolTWzX2gDxru20dNpiD6uwhw3qQ73Df4VjqwTqF7wLQ0D+V3b76jyL3PQt18YhzVl1QL6Q07IPdDhHOiY8+2yPGorvP0qZu26mxHt04970F+3aL1jCkyAqvNADySaYm0UGndVXLWSK7XK94S8HDlPe+WhuvXhVfBJu34E3UbpYwND5dqZuW6o6dMQSbvZpRLoHJv7ii2IPaovmJeMPzM8STp5bL4AxtIupB5GCr8HeuxA377fUVnIoCGbdXHWB96jCFYRHBXW8568D5uBLl/DR7cbY22COp/mMsbPGqpQvHVy2iIdqmYTpycAVO9oh7jyQ68Cgd5/Fjr7bDSKwqu0YeGeoHEfro4zx4FMCi/rGcC1TZva7LqlB+us1yto19DvYX11GnS1ht4pL1u0ibtBqB1ZofzFCV+XslsRFk2c6I1U/1xHlzBsP0t1NQsziV1+Hfy+mWvcSSfMTrxet+rwFE8AKYBSJ46WPmQIPQqtlJ0K/VGlaU1s6YdOdyysVWjXqG5gRibDbE0W7S4wFV4iKPcF4n72N9DVj1X8LegbH6XUy3ITmXBikywBEzr3VZ3WoZ+Jqss0Lxw+qeZEjcVJG5TX6Q7PlEx1GV3niJwPPWbNhrUfl0Av0nXc6iPQCVeMkZQKvZS9mxbrEVyOD9eLicYtcGv0V1zb7OQIIXTkLlEfSfkEdDgBug6oVBBNO5GDjXEHzhQ1obnLBj/+VKkj6JqNqk/68OR4MnRcYU3RTlrYyrhT7IEzZsiwz/HoxYWhmt31EvoP/DqPg/9mhrer1n3obP0d91RnzJSYgsBRqsvlskIfIWlhJyJ2zpr1DOjz+uWyC93whuOlQRDoneNiGFizLxiftlj8Iy7OceFPyJZ03bkD2VtGl0WS7Z5sEGLuQMGJoi7ZdybxWp3hzPmhqwdCFiacxO7cgcalYFXs3VOYt85DyiycCe/VdKhWL8ajGT9MdfFpMvZp8l2qK1iG1rdRDXLh8bbcWPmdEBbG8aM5AP5p6GxpkrgKr8djadyVO6wC13kW15xVWtkNKD/Hq2nSs5jkZ0FXzxl2HEh0CF1CWf4QMwUoMkr6HSlwaaLVPjdBQdTJmt7dyPsU1W362LS7nJAtp3ETll9yDm6lSzBD78aF3mKYUW5EDD5j3NQq2k76dpjU0fZcELrBqsbn7cXkoUkwI+JIvW/hVsIZtu2UAyAyEoxCFNGh1LBAezcRHR8f5cbsR0Y+hsZ1X1iesFo/5xSE5r8WyghuJNT2y7C8Uf6uJJQa+h7D55O4R/GTCv4c6KNeR8G059PoDSV389V6JO56nrl4kh13L3T0aMziJS6/APqs53ZGY88F4Woz2+4pOVYvzil4Jx795P1lQ3HGDvNZ0Gc95/o0ziSU+qogcINVPHjX16GtaB27i3ZcGoVnCtok299/gNOhH76R9Bz5c7kd7SK9IqelCSXEIQu7wSracwcJ5M/7TDb1YOMWg0ThwW51wceP+JnVOPpzjgM276FVkckUo1SRMVkad3ddg5qLMm1EwXsDHxjgMaol/wrosk1G69btcCVtyASf0V7VqaPUFuyOPKwKsWz4R+7d0ChR1JPs6TjFWQc7Nc/SunUzHuAMEpM1RKTMU4fluwW7V8ghJp/OH+1SeLqx1Qe94CvOtIpLUkNZbpPGr2arhXieWL53E+pqh91x92Yw+xIXv7FQOehl2wOirk6sFO637HGSh/OAlWZQnQNpckEp1jqv3LM5MRDLV5ici131TotaE+Yrd/bn30t1a9lHVXkFXfCICGP6q2vcF4m0dhvWv31H76vE6X127XJacRYdpMI44Tp6PthkUMP1qL6CRWbVvIzFfWphjWtxc5b7p0uVnQPdOuflOnPuOiM3QWfMCKy2yE3aAZ0divajPbNsvQ063BOMXy2mKAXazfx28kAXxl2g5yQc5MnQKW84Xiau0mZ/lvx1F3S4h+N13Gm1E77dVbrQWS13J8qsZYjdcZ85PypDpde9O/wOHynYIHp3yYe4x1BWpecKA3cnyniwaBklvQJuO44n8Pt50HMukbmixu6JplWaiay9bVINHHKXxAbU03V6zqpQoneWVu7l4gCb+0cQuMadIjzgFlGG4xDoGfr9POggmouzQe8quefuRJndGO0FVQfh/Cbx+jOfhV5qG7VTd8wT1jIsvwzTYVw66fyEN8mXSXNG/dHzSvJogmwVEC7Jy3Frr9C4J9aDdX0sKs/QhP6dF1GmTy/Vn4Gudk37hiL4E1aTa6pt/qwJRjqzRcixpkmctrmn5ppOT8yeXq+eTXUdZV9medhiue3WHIlxd/0gVIEoBmlOZxtHqqoL4PHkno1Cnw7dUHGhfaVyKtujpFPbzCodXrTlIxB501KiEfpsVFV3UfDAnCyIn9hwAg90eLoqvh1ZadS1JXlSIxsnPawPiNBk6TQoiVY3KVViodrhPRYx6rAKQugIgyb6sWWDD1Qesx6dGRq6HZ3kfCYt1hCMUzzZujjKTs6AvZt2mJt0RIZnA8nVtPFZLDtqDmLqqU3Kc+pLn1l0jbTQbHXdktikk/s0I+UVOFU7KKjXClkVjE1fJwXOns43wVK7CZecoxrqYD2HEyJTL4BubU9DGVJOfVgpmYSHVJNsLPByjHjPdoqq5NNB7ZxZWnaUpHI+e4iFYgsZG6KfU0X61FJ7huw0dpvja/01ZmGqTJb2qw4glBeatJgaLat+OqquWGhHqrQZi5lfi9Pny2V7lTwq7TF2KoaJg4uH2hM5zt7Aal1PC4DK+HcJzkEuWlIqSickKblnX/6ZApgnVw/WBzIJ6GJlJkIAZLO4ZB6FZMA0iqODvwkagdKs4WOsMlgDu7/E9NrrabLTFi6vqC1pc9/b0D3QyoHXis84kKj3WcvK3hTrKJjLG2ePnXUZltXtcmCmR8B6p6Kt1NeW1dQeWrNYmZEQjExnWpFTIC9tS1bjOB/dXFx37hIwYipZzSUFu54C/HKU4ixH7hXQ7XFU1HT9AjtuNrSjmHXWWElMhi6kYnKeuDRqOnJpuRwnTgllhprEq++tGW2EfMPyVBmy045bQNizrqR6q5n3KrXOI1VJG1oyjcmZ/XHOh161JiEyX+00oM6XA/xCdwKV6kqUq/gsBqBsjgmRWjItz9Rxr6gPbzQd+WRjuq6ISFoKSnJ40DVDz7aR0nmuByCxCPfchOaAsxarLyyXbWIWWbk4zGs3GlRTY0l4qUAylqTy87FdgW8XB6B17kxybjuoV0DXywy0zU4WvLHviD3HOtgFV2/h1RyZ78rpF5CtA/T53qHm06Cr01heDuXw4aZ4o7vRqtUZN30gq0ZTwanR1egDT1ZSp1Qndai+viuATTBBcS82m6ppnHck59gZYCRNJ9iBW2SswZOAmI2a9OzOby8pjW9iVWSMRs+mat9KBdKaAjiILpDuB4s2GWISkEX0NCbj2V2gTsml2ZTGsAvMuFw589IQIs6kmI34KVJrV3G9cARvV7psDGWR/uRR9Tc2RDDizukxK+ymAi5XvyaPhlc0WAOdKiwb8NqvLcyaID1b0F/X98UsX1mNmb2GeK52zTXksN4uXVICWupqk4dfjXyOm6M1hSF/eX7Ts5e1wTCOKCmqJtF1pGk9UkuN8xzteYe1BPumqeu6lfr/bVMS22NnAGqkYJBnRH74xm4/O8fRtGYmuuNKhEFTYXuQyqhYQZ+Kq3PvAGFucWxpsVpivWEkfcfreLvqO7vV2AsbHdGRfa2hQsCSynyqpyqoa4CUTkwy0+kkZinAdXkzYuAN9QQVV0fXp50rm7ygy9rroOuwE+9Fca30nFBryLGp855JqX8qLd7lUkK/59ryxO2J8Yx+W6MjLrKo5R3rZLap2xhjbhogoLlWA7VL4fY4GKPEdWpikklf0+/pld1+ZuwUj+rWpf2lq0kJJle+lL4heqq6VyN/bQNDh+4UUl2sZaiLk64iTj0Nmdy63wvFnsdkTiCGRUUtOKFttB86PPxiZyw6XwRc7Els3JNqzommTo2BdDCi/2MXKCMMaOF73HFL4zXyHc9xhxawvRsCJ5/lSarbF8OtFrws1yO1YNZKnSPxAHPx0bnJAe61VM2M3Hk5/K4ufqTntTNHfKy3H+X8w1yesk2NLFCLOysZaQ8fbGWnTjgZUxsaIqyyToWvi0WC3dhKCIr2FqVhMf0wquBXd/EzDbcJO1rrsJdMg6yfFyTU32pMhNnDPjX9PDv12xsYoriOaWxYOMR9tFR6EcOiYHqXJphHkeuVPgrGixuzv6VjJxqvzjThpY1DJjxizxeZJxU67TDG2Swc8ALltqW6en2vdc30nCpAWQOrJTgm+ZMiyGaVCO/p06reIvAaFuaIoF7rl8EHIJIbZkcD8G3NSuHnBZYlT0C77th8OQxWvexIyue5gX+p9Twlx6TGYeOW4+A28et1q1KdPBP83u68ylcqVPSbbcisEwIpLEPbL7pTZdu9qSnzO9tROw3IaUXO/daB41G1dXCT5sf5gOqrO3Ez4cWn5161lA8ZcHNW27D4X21CbgmvuT7uq9ztx/4mKf8IdDFibWoiVGlmGzEn6ZwYGcC/CJ2zKJ0G9LYfe2uVPvyTVFeG65t5f0n3qF6d8YJ/kOo6cZiaLxuaJ9SqOYA3D+Iz0ANt0hLZcmo+APyssOTP+hMCtR/GruT5DZMMv4jq8AD4plQK4BOcdz909Rq2D+7k9We6nHyVrDsRHHj3hH8J9E9ef9DV4z7Z46oPnlSO4Cnq9cSvPaT6QW977xf7tx+96uazR+fBzSPq0QEdQacDS3z1ngpDo3xVLVtu9fxh6a2ftPeqxffNfuXlotm5+GyAjKdfP84f1zt7OIdUr6X35CYgTu3mMR9gmdDFBdXo097XDKPi8z7tPvSMv9+H3qWccJXwX247y5K3ruSHVamMjvIYkr2SfAfQuS4E95z0ZUNuGhZw8gwnSXlOr/JZKGw+uQ+dE4kOoZselot9+piPvvORfhrqooViSUH9/VzDY1lvEk8hFN1ccFXWUga326ylig8PMch5oeQY+tzgXv+T8yn1qX9bX9U+E+omFXvrwSPotkNfs4Kut8VWRWjqRJ9f8dTQkOPXz0NPN1dSLRqRNGrdrWA31ndIdVtZYIFFupn4iJ7NRxlfAh2JUGyuUK1qQYHVPMdHRo6gUzOqbSb6XEVzLemUE8vnXbZkPwk6nXblfCMVrK2brQQgvxsFPbEzoX7S1MyQ3TFYuirogui6GDbOkYxwQ/azoJszU74O36apIYU2hRKLUhAPQy/13rAC3UjdcPaSspIGjsodWn//uS109UPoN3IUmUV1Rn5ymFp7w4c3ZJc+U8pytlfSuUDiKDKptsZtX8NTZ/EHqG6bs+8UwuqUPhx2XGT3ZkLJqgq9VWflmuhC7ECLw+qX3mB4XVv3Luj7Ld1NH5asquI7ugbcgm4Oc7Rmc2CP6Nqy6AP2K2nXLs2hrCf3GLe6d65mk3ECzKN4huye7uy3oZez0VC2eOha0q1i57oym4NZcJJLEzuGPdm6zLqYb8YbWcmtHPqb63UwfhKPCqv/btS7GZd8KC2411N+AzrcS/W5Jzu5rf221k2ROUU64cn9dX2OxRSQSLQG33Yg1rkxUohrWTHoHqpr6HAbuv7T553Pvc9vZ5Lfhm78VjpMD3yieCPpo1bv+pzymJhq1uoBHz65z5FNZo73otMnENLbZ57vgV7aknCm/NVa0g0nKEntrrNVDTI4BzpOLx4aMVfRlcqbncnDvZ2TckdsTi8E0tqUyvARHYc9j6nhAw41vNm4aR+hTu4rq3wXdC6YRGT1EH0ud+8o30wfWIItdPiphk+0dPt82G3dzXOga2knF63feuhzATGreT2ddU/w4RPpD3KTjTli8jPosOfSYUq70NezhF1YHRNHcch+B8O70DeVFu+HHljocEoxVePSxTvqfR1DkBwR5+yxA10tVpxqQ3W1uGHJ8CtZ5zv9Kv4khp+7SnvUu/hPSdMvLymkbMluoIebNadaQK921qR+WfcJvJyve0bNwU7Xkg3RZXVYL0lpeMGynS6VHNerq9WFO7Su3H4/B114AG29uTZtE56Bro76jbqOnDKQyGNf0lJ3xhiX0OUEr3OZG7RvsP4+mxuk6JI8yeYNKwOuTtXwi9P4DtGVsiZ/p/m4nXxbhm9Zi8T6ogb63ARFFOcaunVjtULdhr6fZ3ivtMfxqnaA7kCeeHrO6zXUqBm6an2lKGKX6rG/UsUMPV4ULNJlXbzQ4xOpLrY9Wde54/p5iW9hTGSnA5s6ME6VU32XnZqQKnBtLpfh08z/hi102nI5y7jJjTldy+pXUHo+XNyfh7ppde6/bJ+n8vB7nLudF+Qb8vKbSlAn7q/73OZdX1qtN1ePN0pvf79/w91j+jl0nxU9dKbnr5S90zHH6yfBd+18HRw48vLti7MqVPC5FKTgVySUqDc982roADZLEAx3LQ7OOuc6PGnOMN8GwTYnBFY5K3tdD2C9xAFbjvx1VQtEhVhVYv8yOxRawyhH37jbXs5j7u2BvoVDn7o7QLDUgoFuZazsa1yw+jc9JIUPQsf+gUOBvRywj/IwYB2dapjorxzLaVUDNVbHCwvMwFDKv/GHYqDvtJXKp6kA+3iFf2JRiqCgSrFdzo9h6HOgewJ9j27EPIRcl3OYOvzt9NyEtxc5brRw4IzfU+Hj/K7noXtaOJSXIsemNdgitxsQbhgNOBfocGDXxvIaUm/0ghpyh3hP2A34E3aswqa90wS64VNRYAMQbNqNQTZs9EK3T9Qehv6NsC/YGIXuoQYpdI/eQsbfgy/h1us5dq6l5zqapQmfwTah/Hk0BMEUyWuCHQN5N3QyHXaVGYbcfDG/cN1nNQxUeQN7dCJ8bNtRTNTkhSCX/B8QTVR45USXYiovlTKtpDmmPcnj2H0Tx1px79UB233SYwF+h+9Uco/JcZgQITBM+iq/8sIeoU80Epx5BILcEF5zGlgwDxvHHcLjGVRd3LpX1hMa7Nk04C8Zoiki4k+y7cDQEUd1GQrqRU5YQCYBkU66WZU83uFUDRd+PL8URHWaSYiI6ekx3eOX7zEr0qkIcfZoNgqUN/xVU4S8BtEQFdjGkuDTyp+7C1Gh4TFbjNxbgPVoC0JV3SJ9oZOjKVVBLDdMFbVvITIwdJx2ZvjLREwYaOiRVEwlfjY2qyquPFZ+vLwMEfEBzgGxUxAiw8NUCIfwPXoFgIJBsoDtmPMJbywv2CMG77kUZTTxaJSUaSWJIZXQeRIvHtl98fiUqIKABoDzHxCj4xhYjWH/8WBgqpcBkY8x0E+s3fOLzfoYAOjxwTwOFckmyTKxN6kI5N4wxLac5h6ZWVRr2BuKus4XSFecJ+TkgBgE9UnA7c+5CjezjUdJPbzxtPUqUaC5UVHAzYORTgX2cMLfCQO37GKwuWV4gsXzZTqu0uMXbOaq6PaoYhnpJqqyWfAM0MhRKLiRHXXulN7EzAg8LUCNwvCWUvpA0ueoaJHOJH8kJxp6cBjDOpT1g9bK2I6I1oNhhReXVtJMWfHHgJ9BFfJ/gfwpTdgWj9Mn/HjItwO/j0fMD8g9QaV/Bb2HvqxC82vwA7zwHvoorFgkzDBCda+H+LgjO/sU5h+g/166Ns4vU25pBmVcE3urMy5l7lmuFOeXuS6NLIsWnz/iAD8OHRaO6Oy33tXkx3k8gB3ndb7nZrwU9hrqPAP9K9daf0cB/qD/QX8a+itPmkHwgQN8r6b6jyvHwI0TYMF+lOIXlul4+WnJfxL6a6KDf2rul8WR363m1J9d/9HcOLHVt8f0/1yaI+g/tyGPdNV7wlLBqbc969I8WHsVHmNh+PPh/0Mujfq0hlf/trX70/B/0P9T/txpref/GP4P+r9o1+HPpflj+C+Ovf3J+h/0F/Zz+z18/mVqDj4xEwRd/Scvhv5//9Xrf/8P9Rs/aijmGsEAAAAASUVORK5CYII=";
const VSA_FALLBACK_SIG = "data:image/jpeg;base64,/9j/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCACmAPoDASIAAhEBAxEB/8QAHAABAQADAQEBAQAAAAAAAAAAAAECBQcGBAMI/8QAPRAAAQMDAgMFBgQDBwUAAAAAAQACAwQFEQYhEjFBBxNRYYEUIkJxkaEyYrHBFVPwJENScoKi0TM0kuHx/8QAGAEBAAMBAAAAAAAAAAAAAAAAAAECAwT/xAAtEQEAAgEDAgUDAgcAAAAAAAAAAQIRAxIhMUEEEyIycVFhgSPwM0KRobHR4f/aAAwDAQACEQMRAD8A7siIgJlREBERAUyiICIiCIhKiAUREEREQRFVEAqIVCgIimUBRUqICxKpUwgiiqIMSoqViUAqJ0UQbNRMogIhUKCqIiAiKICIogIioGUABYzSRU8RlmlZEwc3PcAB6laLVmq6fS9CwiM1FfUHgpqZpGXu/YdSegGVzyO1V2qJvbb7N7a5xy2N+fZ4/Jke3F/mfz6BaRSMbrIzziHQJdd6Vhn7l9/oePOMCTP6LeU9RBV07KimmjmheMtkjcHNI8iFzGfs/t9VTuYaOmOW4H9mY0D5YAwvx7L2VunNQXrT9TG6OkAY+BpcSOIZDnb+II5eCmYpNZmvVHqzy6uVOSZyiyWQoiICiqiCdFMqlRBEREEKiuViSghUKqhQYlRUrFBs0RRBSURRAREQEUyiAiKgIIFjNPHS00tRKcMjaXH0WfCfBafVgmOkboYGl0jYeMAcyAQT9gVakZtESieIcpo5ZtYaqqLpPl0bnOigb0bE042/zEfQALqFDbmwxt23wvCdkjKaqspeyRjpYnd29ud2gcifI811BjAAtNfPmTE9kU9vDBsLQOS/J1DE6oE/AO8AwHY3wvswmFisjcgYVyiICIq3chB4/Xeq59P01PSW5kb7nVu4IRIcNb1yfIAEn/2suz7U1VqTTxfcRGLjTzOhmLBgOxgg4+R+y8RXzt1B2nV9RIeKmttM4NGdgXA/sG/VbTssJNPXVA2ZUVDpGgf4c4H2AXVqVrXTxjnhSJmbZdOKhQHIQrlXTKiJsgxUVKiCFQqlYkIIeaYREGxTKmVEFyiKIKiiICIgQZALSaq1PS6WtftMrTLUyHgp6dn4pXnkAt2XNjY6R5w1oLnHwAXDrlcob9qkXi7VtPT290rqeh45Rs1pw52OmTtk9B5rbR092ZmMxCtpw/KvGrtQ0sl2/idVHUA8cUFNJwRsx8I2y4/myPILpPZ/ql2q9L8VZj2+nJp6tuMcRxs7H5gfrlbS22yKCJoaARgbjqvAaQc21dpuoaCEgQSYdwt5Ahzv2V5v5mnbPborjFow1eodAXCx3uS6abrKijLznEHTPQjqFW6z17aow6oioLixvMcJjkPz5D7rsMkbZW7gFayez08hOYm7+Sp59v5uflbZHZ57SPadbdR1TbdVwvt1zds2Gb8Mh8Gnx8jz6ZXusYK5Lr3QcRtr7tREw1FMQ/ibsQMjl4HO695o6+Pv+lLbXz/9xJA3vfN42J9SMqdWtJpGpTjtMIrM5xLelERYLovwrp/ZbdVVH8uJzh88bL6FpNX1Hs2k694GSWBv3GfsFekZtEImcQ4tR1ckVhus0BxW3uvfSw+Ijb7rnfIBpPouoaIt7KC0RMY0huBw58On2XL9C2youNLSVVTv7roqVnVkZcXPefNxOPkF3CggbBTsYBgAYWviLZvNYVpHD7m8lkViFkuddFCswwnkCV8lZcbfb2l1bX0tOB/Nla37KYiZnEGX7lReQuParo23EtN19pkHwU8Zdn12Xn6ntmbNltn0zXVJ6Pm9xv8AXqtY8Pqd4x88f5V31dOwVCuNVPaPr2py6C32yhb0D8OP3JXQtGXqvvVgjmuoiFc1zmyGJnCxwzsQFW+ns7xKYnL0KiIs0tgiIgIplMoKmVEQVAomUGi11XyW3Q11qoiRI2HhBHTJwv55qbcY2Wl1yaxlFU0oiZUBg4Yn7HJ8+Ib+IJX9JajtTb7pq4WtzuH2mEsDvB3MH6gLmGi30t4ss+jr3CyO5UOWCOQDMrRyc3xI6/VdmjqbaTj68/v7Mr1zPL79Ia7pNP6OqKW+Vcfttsf3MTWvDzKwjMfDj8WM49Avg0DBU1Ooqy61bCypqnd49h5sB/C0+YA38yV5Wr003TWvqWiZDG1lQ0iF5Zs0ncEeB90hdi05ZG26DO7nu3c49So15rHtj3cppE9+z0jPwhZcKrIzjktBqHWti0zCfbKxj6nkymiPE958MBc1aWtOKxleZiOr4u0a5x2nRtWSA6aoAiiZ1c4nYfXAXxdm9M+h05BSudxd3sT59fvleJlrLlrC+suNyiMfAcUVEDkRfnd+bHIdPmurWG3GjoY4gNwFrqYrWKR+UV5nLznaRrNmmqalo4q00tVUuaS+NvFI2PiwS1vU7HmvO0/bbFDQ3IV1AW18EoFPTYILmY34yMgEHry3Xu9VaesVzNPWXV1NDU0oPdTyOAc0eG/NeFu907MqF0jZ6plXNKzglZTx8XefNa6W2axXZlW3E5y9lYdf2PUVfNR0dQ0vihbNxF3uuHxAHxb1XgO0jWdRdrdXUVna59BA10dRVjZnHt7jT1dg+gPmvI3SSz3VzTp/Tl0j4WhjJe/7phb1B5Jeq7UDbDFZ5aW20FA90cccMDQ5zcu55HnuTnJwt9PS06Wi0dfpP/FJtaYw6voiziiskNZVuZEOAAOkIaA0DA5rb1+uNK2cEVd7peIfDE7jP2XI6LR9Zc2NNxr7hWtxjh7wsZ9l6G39ntPT4MNvp4z/AI3t43fUrj/SjrMz/b/bX1NvU9s1pcS2z2e5XFw2Dmx8LT67rUVXaPravy2itVBbGn4p38bh6br0dPpLDQJJDgfC3YLYwaYo4jnuwT4lPNrHtrH55RtnvLmk51heifb9T1ha7nFSM4G/16LGn7Pm1D+8qIKmqefiqpic+i7BFbIIx7sTR6L6G0zByAUTr6k8Zx8J2Q5xQaFFOAIqengH5Ixn6rcxaRiwO8e53qvYiIDoshGB0WUzM9Vnm4dM0cX9yCfMLdUdKylYGsaGt8Avq4fJMbKBkCmVhlVBssplREFRToiCqK4THkUETKcuaiC9FzvXWhm3aZl0oHPguUO7JY3cLtvPxXRgNs9PFae8alsNlhL7jc6eEDpxglX09+70dUTjHLgmpLtqiB9FU3nuaiooJA6GoLeGUgH8LuhG/PmvSQdp+tagCGksdFE87AnLvtuvz1xrjTWobNPSUdur6jG7aqKPDQcEbkjlutfa71qi4WmlFHLbrbTd0AJI4+OVwxjJxyPzK75z5cTeIj5Yx7pw21RBr2+sLrxfH0VL8QjIgb9Tv9lqvZdH2GQurrxHNVHmYcyyO/1Hf6L9GaTnuUnHcKq4XE+EshYz/wAW4/Vb626DZCQYaSnph+SMZ+qytr1xjOfjiF4rLVU+tXUo4dOaZmkPSprfdH3xslRfNd3p3BLd4bfGecdIzJ+uwXt6bSEQIMznPPmtzTWKlgA4IWj0WPn49tYhOz6y5QzQstxf3lfU19fITkmeY4PoML0lr0NBSgd1SQQebGAH6rokdJGwbNAXl9Ta8sulpxBUufNPjPdQjLgPH/6kW1dWcZynFasoNJ0zcd4C7y6LxOuqCCHVVmooYxkva92Pyh5/cLpen9Q2vUtCKu2VAlaDh7CMPjPg4dP3XgtRs9s7XKeAkAQU7nnJ5e6wZ+5U6dZra0T1iJRac4w9qCy16dnrBTvmNPAZO6jGXOwM4AWt0JqefU9JWS1dIKbu5sQjBDnRkbFw6HOV9Ng1fbLteamz0Yke+mZkz4HduOcFo8wt1T22ClqJJYWNY6Q5dgYys59MbZjlaOeX28AHROFZBCs0scJhZcwogxwipWKAoVViUDqorhY7INimUyplBmvju13orFbpK+vmbFCwHcnGTjP7L6wvKdo+nzqTSj6aORzJ4X97GRvk4III6ggq1Nu6N3RE5xw8hcu0jU10e1ljtsVFDIMxSVWTJI3o4Rj3seBOFqhbe0G5cU9Ve6iFh5HgbGP9xWqtM+sKGN1NT19BBk+9I+J5kH2/dfVNZ7jczm7agr6s/wAqACJv2yf0XX5la9JiI+0M8TPV+NXcb7p8uM+vYWTNHuxPBeHeWWn9ivooO1TWUdLK99sNZGB7k5h4M+YBwT9F99r0ZDDgUluiiJ5zPbxPP+o5K9NT6Pa5uZ3vc75qJ8VXptiflMU+7nQ1nd9UyujuV/nocuwKOmZ3bseJc7l8gFvbZo2jfIJmUHfTc+/qSZX/ADy7P2C3F27O6etiPFG2Q9C4YcPkeYXnaaTU2gpcU4fcLaDl1LP+ID8rv69VM6sasYrO37dv38oiNvXl6i5aTfJYqx75HcccLnsDfEDP7LW9ltDT1Ng9+NpdFNIzJ8nHC9rprU9o1jbJfYZCJeAtmppNpI8jG46jzXi+ymUxT3eidziqs4+YH/BWc1mNK1Z6xMLZjdEw6TFRxsGGsA9F9DYWjov0byWS5l2IYFkAqiDU6ovDNPaZrro9r3CCPIDBk5JwP1XO9IWl1wtstbVN4quvPeTOeNwDyb8gNl1eaJk8EkMjQ5j2lrmkZBC1lDaYLczu4G4ZnICvvxTbCMc5cmuemL3om6/xvTMpa3+8hO7XDwI5Ef1stBV3W56w1YZ6mIWqTuMVPszyXyhxwQD0zw+mF/QklKydnA9oc07EFcb01RRTdoV2a1o7uPhaABsN3H910U1r7Jmesd+6k1jMPW6QsLLe5kscLYmNbwRsHQefiSveN3C+SnhaxowML627LkaLyRVYlA6ISomUEKmVVEEKiFTKCqIVjlBsUUVQM7LGRoewtKyUKDzlXpqkmnMpiHEeeF+tPZaeADhjG3kt2RkqcOEHyx0zGDAav3EYHRfphVB+fAMcl8lZbYKuMsljDgfEL71MIOPaq0dXWGubqLT0j4KunPGeD4gOhHUeRXw9mt4hrta3SSKEwCpjZKYyc4dvxY8sldqnhbNE5jmggjBBXCqSJmlu2BlKwYhmlkh+Qd7zf1XbpW36N6T1iOP6srRi0S7uw5AX6L8YDxRgr9guJqFEUQFiRlUJ1QT8ILvDdce0A0zarvc5/nNH+0f8rr1U/u6Ook/wxPP0BXJOzEGStusx5uqTv8gB+y2r/Ct+FZ90OrxjYL9Fgz8IWaxWVQ4TooUDop1TOFEAqFCVjlAyhKFTCCZU3VKiDYqJlMoKoiZQFERAwiZRARREFC4f2qQmg7QLbXN2zJBJn14T+gXcAVx7tzj7qexVAH/UcY8jxDgR+pXT4afXj6xKmp0dRtsolpI3DqAV9wK0mnpu8tkBz8AW6BXMuuUURARQ8kQfNdi7+CV/dtc5/s0nC1oySeE7Bcu7JWSGgqJpY3Rulmc/hcMEZK60TzC1VPaoKOokkgYGd47icB1Ktv8ATtRjnLYM5LNYNGyyVUrlYlVTKCKZVyplBCpyVysSgIooUAqeidVM+aDYplTKmUGWVEymUDKZU6oUFyhKxRBcplREFyvP6u03Tamt0UM7R3kEneQvPwlb9Q77INTaKJ1DSRwHfgAC2o5LHhwsuSCpyUyhKCkqJlRAJUIyhOUQTkmVDsiASoiiAhTKiASsVSsUAooSoUEJ3TPyREH3oiICdURAREQOSeaIgiqIgiiIgFREQEREEREQROiIgiFEQQ7LHKIgiZREEKx6oiCFREQRREQf/9k=";

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
    const coreFonts = ['Plus Jakarta Sans', 'JetBrains Mono', 'Inter'];
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

function generateIdCardHtml(emp, template, validityYears = 3, issueDate = null, side = 'front') {
    if (template && template.font) {
        ensureFontLoaded(template.font);
    }

    if (!emp) return '';
    
    // Synchronize visual layout element properties to template root
    if (template && template.layouts && typeof syncVisualPropertiesToRoot === 'function') {
        syncVisualPropertiesToRoot(template);
    }

    // If template has modern UICE layout nodes, render with UICE canvas engine
    if (template && template.layouts && typeof generateUiceCardHtml === 'function') {
        const orient = template.layout || 'horizontal';
        if (template.layouts[orient] && Array.isArray(template.layouts[orient].elements) && template.layouts[orient].elements.length > 0) {
            return generateUiceCardHtml(emp, template.layouts[orient], template, validityYears, issueDate, side);
        }
    }

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
            font: "'Plus Jakarta Sans', sans-serif",
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
    const cardTheme = template.cardTheme || 'classic';
    const photoShape = template.photoShape || 'standard';
    const nameStyle = template.nameStyle || 'clean';
    const barcodePosition = template.barcodePosition || 'bottom-right';

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
    const showQrcode = showQrCode;
    const showSignature = fields.signature !== false;
    const showBarcode = fields.barcode !== false;
    const showValidity = fields.validity !== false;

    // Resolve Logo HTML
    let logoHtml = '';
    if (template.logo) {
        if (template.logo === 'preset-vsa-logo') {
            const vsaLogo = getVsaDefaultLogo();
            if (vsaLogo && vsaLogo.startsWith('data:image/')) {
                logoHtml = `<img src="${vsaLogo}" alt="Company Logo" crossorigin="anonymous" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
            } else {
                logoHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${template.accentColor || '#dfba5f'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block; max-width:100%; max-height:100%;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
            }
        } else if (template.logo === 'preset-shield') {
            logoHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${template.accentColor || '#dfba5f'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block; max-width:100%; max-height:100%;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
        } else if (template.logo === 'preset-star') {
            logoHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${template.accentColor || '#dfba5f'}" stroke-width="2" style="display:block; max-width:100%; max-height:100%;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
        } else if (template.logo === 'preset-eagle') {
            logoHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${template.accentColor || '#dfba5f'}" stroke-width="2" style="display:block; max-width:100%; max-height:100%;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`;
        } else {
            logoHtml = `<img src="${template.logo}" alt="Company Logo" crossorigin="anonymous" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
        }
    } else {
        logoHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="${template.accentColor || '#dfba5f'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block; max-width:100%; max-height:100%;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    }

    // Resolve Signature (permanent scan) HTML
    let sigHtml = '';
    if (template.signature) {
        if (template.signature === 'preset-vsa-sig') {
            const vsaSig = getVsaDefaultSig();
            if (vsaSig && vsaSig.startsWith('data:image/')) {
                sigHtml = `<img src="${vsaSig}" alt="Authorized Signature" crossorigin="anonymous" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
            } else {
                sigHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40" style="display:block; max-height:100%; max-width:100%;"><path d="M10,25 C30,10 50,35 70,15 C90,-5 110,30 130,20" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round"/></svg>`;
            }
        } else if (template.signature === 'preset-sig1') {
            sigHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40" style="display:block; max-height:100%; max-width:100%;"><path d="M10,25 C30,10 50,35 70,15 C90,-5 110,30 130,20" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round"/></svg>`;
        } else if (template.signature === 'preset-sig2') {
            sigHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40" style="display:block; max-height:100%; max-width:100%;"><path d="M15,20 Q40,5 65,25 T115,15" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round"/></svg>`;
        } else {
            let sigSrc = getProcessedSignature(template.signature);
            sigHtml = `<img src="${sigSrc}" alt="Authorized Signature" crossorigin="anonymous" style="max-height: 100%; max-width: 100%; object-fit: contain; mix-blend-mode: multiply; filter: blur(0.22px) contrast(1.4) brightness(1.02) drop-shadow(0 0 0.18px rgba(10, 25, 47, 0.45)); opacity: 0.93;">`;
        }
    } else {
        sigHtml = `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 150 40" style="display:block; max-height:100%; max-width:100%;"><path d="M10,25 C30,10 50,35 70,15 C90,-5 110,30 130,20" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round"/></svg>`;
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

    // Helper to calculate luminance / lightness of hex color
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

    const textColor = isBgDark ? '#ffffff' : '#0f172a';
    const subtextColor = isBgDark ? 'rgba(255, 255, 255, 0.7)' : '#475569';

    // User-overridable label/value colors and layout
    let labelColor = template.labelColor || subtextColor;
    let valueColor = template.valueColor || textColor;

    // Contrast enforcement: Ensure label and value text is always crisp and legible
    if (!isBgDark) {
        if (isColorLight(labelColor)) labelColor = '#475569';
        if (isColorLight(valueColor)) valueColor = '#0f172a';
    } else {
        if (!isColorLight(labelColor)) labelColor = '#94a3b8';
        if (!isColorLight(valueColor)) valueColor = '#ffffff';
    }
    const rowPadding = template.rowPadding !== undefined ? template.rowPadding : 3;
    const labelWidth = template.labelWidth !== undefined ? template.labelWidth : 45;
    const labelValueSpacing = template.labelValueSpacing !== undefined ? template.labelValueSpacing : 10;

    const isLightHeader = isColorLight(template.headerBgColor || '#0e3e2b');
    const headerTextColor = isLightHeader ? '#111111' : '#ffffff';
    const headerSubtextColor = isLightHeader ? '#555555' : 'rgba(255, 255, 255, 0.8)';

    // Resolve Photo HTML
    let photoHtml = '';
    if (emp.documents && emp.documents.photo) {
        let photoUrl = emp.documents.photo;
        if (photoUrl.startsWith('/api/employees/') && emp.secureToken) {
            photoUrl += (photoUrl.includes('?') ? '&' : '?') + `token=${emp.secureToken}`;
        }
        photoHtml = `<img src="${photoUrl}" alt="Employee Photo" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: cover;">`;
    } else {
        const initial = emp.name ? emp.name[0].toUpperCase() : '?';
        photoHtml = `
        <div style="width: 100%; height: 100%; background: linear-gradient(135deg, ${template.accentColor || '#c8102e'} 0%, #0f1218 100%); display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <span style="font-family: 'Plus Jakarta Sans', sans-serif; font-weight: bold; font-size: ${photoWidth * 0.35}px; color: #ffffff;">${initial}</span>
        </div>`;
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

    // Helper to generate clean aligned rows without harsh black cell borders (matches Hanover & Salford cards)
    const makeAlignedRow = (label, val, isImportant = false) => {
        if (!val || val === '-') return '';
        const isHoriz = template.layout === 'horizontal';
        let lblW;
        let maxLblW;
        if (typeof template.labelWidth === 'number') {
            if (template.labelWidth === 92) {
                lblW = isHoriz ? '88px' : '33%';
                maxLblW = isHoriz ? '88px' : '36%';
            } else if (template.labelWidth > 60) {
                lblW = isHoriz ? `${template.labelWidth}px` : `${Math.min(template.labelWidth, 50)}%`;
                maxLblW = lblW;
            } else {
                lblW = `${template.labelWidth}%`;
                if (isHoriz && template.labelWidth < 22) {
                    lblW = '22%';
                }
                maxLblW = lblW;
            }
        } else if (typeof template.labelWidth === 'string') {
            lblW = template.labelWidth;
            maxLblW = template.labelWidth;
        } else {
            lblW = isHoriz ? '24%' : '33%';
            maxLblW = isHoriz ? '26%' : '36%';
        }
        const valSpacing = template.labelValueSpacing !== undefined ? template.labelValueSpacing : 8;
        const borderBtm = isHoriz ? '0.5px solid rgba(128, 128, 128, 0.15)' : '1px dashed rgba(128, 128, 128, 0.2)';
        const rowPad = isHoriz ? Math.min(rowPadding !== undefined ? rowPadding : 3, 4.5) : (rowPadding !== undefined ? rowPadding : 3);
        
        // Auto-scale font size and format long multi-word values into clean two-line display in horizontal cards
        let valFontSize = detailsFontSize + (isImportant ? 0.5 : 0);
        let displayVal = val;
        const valStr = String(val);
        if (isHoriz && valStr.length > 25 && valStr.includes(' ')) {
            // Long values in horizontal layout: split at midpoint word boundary into clean 2-line display
            valFontSize = Math.max(8.5, detailsFontSize - 1.2);
            if (!valStr.includes('<br>') && !valStr.includes('<br/>')) {
                const words = valStr.split(' ');
                if (words.length >= 2) {
                    const midChar = valStr.length / 2;
                    let bestIdx = 0;
                    let bestDist = Infinity;
                    let runningLen = 0;
                    for (let w = 0; w < words.length - 1; w++) {
                        runningLen += words[w].length + (w > 0 ? 1 : 0);
                        const dist = Math.abs(runningLen - midChar);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestIdx = w;
                        }
                    }
                    const line1 = words.slice(0, bestIdx + 1).join(' ');
                    const line2 = words.slice(bestIdx + 1).join(' ');
                    displayVal = `${line1}<br>${line2}`;
                }
            }
        } else if (valStr.length > 36) {
            valFontSize = isHoriz ? Math.min(valFontSize, 7.5) : Math.max(7.5, valFontSize - 2);
        } else if (valStr.length > 28) {
            valFontSize = isHoriz ? Math.min(valFontSize, 8.0) : Math.max(8.0, valFontSize - 1.5);
        } else if (valStr.length > 20) {
            valFontSize = Math.max(8.5, valFontSize - 1.2);
        }

        const valueWrapStyle = (isHoriz && valStr.length > 22)
            ? 'line-height: 1.15; word-break: break-word; overflow-wrap: break-word; white-space: normal !important; text-overflow: clip !important;'
            : 'white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;';

        return `
        <tr style="border-bottom: ${borderBtm} !important;">
            <td style="font-size: ${detailsFontSize}px; font-weight: 600; color: ${labelColor}; width: ${lblW}; max-width: ${maxLblW}; text-align: left; padding: ${rowPad}px 0; white-space: nowrap; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; text-transform: uppercase; letter-spacing: 0.3px;">${label}</td>
            <td style="font-size: ${detailsFontSize}px; font-weight: 700; color: ${labelColor}; width: 12px; text-align: center; padding: ${rowPad}px 0;">:</td>
            <td class="id-table-value" style="font-size: ${valFontSize}px; font-weight: ${isImportant ? '800' : '700'}; color: ${valueColor}; padding: ${rowPad}px 0; padding-left: ${valSpacing}px; text-align: left; ${valueWrapStyle} font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; width: auto; letter-spacing: 0.3px;">${displayVal}</td>
        </tr>`;
    };

    let cleanDetailsRowsHtml = '';
    finalOrder.forEach(key => {
        if (key === 'empid' && showEmpId) {
            cleanDetailsRowsHtml += makeAlignedRow('Staff ID', cleanTextVal(emp.id, false), true);
        } else if (key === 'father' && showFather) {
            const relationLabel = emp.relationType ? emp.relationType : 'Father';
            cleanDetailsRowsHtml += makeAlignedRow(relationLabel, cleanTextVal(emp.fatherName || '-'));
        } else if (key === 'department' && showDepartment) {
            cleanDetailsRowsHtml += makeAlignedRow('Dept', cleanTextVal(emp.department || '-'));
        } else if (key === 'blood' && showBlood) {
            cleanDetailsRowsHtml += makeAlignedRow('Blood Group', cleanTextVal(emp.bloodGroup || '-'), true);
        } else if (key === 'validity' && showValidity) {
            cleanDetailsRowsHtml += makeAlignedRow('Validity', validityStr);
        } else if (key === 'address' && showAddress) {
            cleanDetailsRowsHtml += makeAlignedRow('Address', cleanTextVal(emp.currentAddress || emp.permanentAddress || '-'));
        } else if (key === 'phone' && showPhone) {
            cleanDetailsRowsHtml += makeAlignedRow('Contact', cleanTextVal(emp.mobile || '-'));
        } else if (key === 'email' && showEmail) {
            cleanDetailsRowsHtml += makeAlignedRow('Email', emp.email || '-');
        }
    });

    // Parse Card Title into lines for high-impact display (e.g. 'STUDENT ID CARD' -> 'STUDENT<br>ID CARD')
    const rawCardTitle = template.cardTitle || (template.name && template.name.toUpperCase().includes('STUDENT') ? 'STUDENT ID CARD' : 'SECURITY ID CARD');
    let titleLine1 = 'SECURITY';
    let titleLine2 = 'ID CARD';
    if (rawCardTitle.includes(' ')) {
        const parts = rawCardTitle.split(' ');
        titleLine1 = parts[0];
        titleLine2 = parts.slice(1).join(' ');
    } else {
        titleLine1 = rawCardTitle;
        titleLine2 = '';
    }

    // 1. Photo Container Style (Circle, Squircle, Standard)
    let photoContainerStyle = '';
    const isHorizLayout = template.layout === 'horizontal';
    if (photoShape === 'circle') {
        const dim = Math.min(photoWidth, photoHeight, isHorizLayout ? 135 : 98);
        photoContainerStyle = `width: ${dim}px; height: ${dim}px; border-radius: 50%; overflow: hidden; border: 3.5px solid #ffffff; outline: 3.5px solid ${template.accentColor || '#dfba5f'}; box-shadow: 0 4px 14px rgba(0,0,0,0.22); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eaeaea;`;
    } else if (photoShape === 'squircle') {
        const sqW = isHorizLayout ? photoWidth : Math.min(photoWidth, 95);
        const sqH = isHorizLayout ? photoHeight : Math.min(photoHeight, 105);
        photoContainerStyle = `width: ${sqW}px; height: ${sqH}px; border-radius: 18px; overflow: hidden; border: 3px solid ${template.accentColor || '#dfba5f'}; box-shadow: 0 4px 12px rgba(0,0,0,0.18); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eaeaea;`;
    } else {
        const stW = isHorizLayout ? photoWidth : Math.min(photoWidth, 90);
        const stH = isHorizLayout ? photoHeight : Math.min(photoHeight, 105);
        photoContainerStyle = `width: ${stW}px; height: ${stH}px; border-radius: 6px; overflow: hidden; border: 2px solid ${template.accentColor || '#dfba5f'}; box-shadow: 0 2px 6px rgba(0,0,0,0.15); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eaeaea;`;
    }

    // 2. Name Block Style (Banner, Boxed, Clean) with dynamic auto-fit for long names
    let nameBlockHtml = '';
    if (showName) {
        const empNameClean = cleanTextVal(emp.name);
        let dynNameFontSize = nameFontSize;
        if (empNameClean.length > 28) {
            dynNameFontSize = Math.min(nameFontSize, 11);
        } else if (empNameClean.length > 22) {
            dynNameFontSize = Math.min(nameFontSize, 12.5);
        } else if (empNameClean.length > 16) {
            dynNameFontSize = Math.min(nameFontSize, 14);
        } else if (empNameClean.length > 12) {
            dynNameFontSize = Math.min(nameFontSize, 15.5);
        }

        const nameWrapStyle = isHorizLayout 
            ? 'line-height: 1.15; letter-spacing: 0.3px; word-break: keep-all; overflow-wrap: break-word; white-space: normal;'
            : 'line-height: 1.2; letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;';

        if (nameStyle === 'banner') {
            const bannerLight = isColorLight(template.accentColor || '#0e3e2b');
            const bannerTextColor = bannerLight ? '#0f172a' : '#ffffff';
            nameBlockHtml = `
            <div style="background: ${template.accentColor || '#0e3e2b'}; color: ${bannerTextColor}; padding: 3px 14px; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.18); max-width: 98%; overflow: hidden; margin-bottom: 2px;">
                <h2 class="id-portrait-name" style="color: ${bannerTextColor}; font-size: ${dynNameFontSize}px; font-weight: 800; margin: 0; ${nameWrapStyle} text-transform: uppercase;">
                    ${empNameClean}
                </h2>
            </div>`;
        } else if (nameStyle === 'boxed') {
            nameBlockHtml = `
            <div style="border: 1.5px solid ${template.accentColor || '#0e3e2b'}; background: rgba(128,128,128,0.06); padding: 2px 10px; border-radius: 6px; display: inline-flex; align-items: center; max-width: 98%; overflow: hidden; margin-bottom: 2px;">
                <h2 class="id-portrait-name" style="color: ${textColor}; font-size: ${dynNameFontSize}px; font-weight: 800; margin: 0; ${nameWrapStyle}">
                    ${empNameClean}
                </h2>
            </div>`;
        } else {
            nameBlockHtml = `
            <h2 class="id-portrait-name" style="color: ${textColor}; font-size: ${dynNameFontSize}px; font-weight: 800; margin: 0; ${nameWrapStyle}">
                ${empNameClean}
            </h2>`;
        }
    }

    // 3. Reusable Component Helpers
    const getBarcodeHtml = (customWidth = '130px', customHeight = '18px') => {
        if (!showBarcode) return '';
        return `<canvas class="barcode-canvas-rendered" data-barcode-val="${emp.id}" data-barcode-type="CODE128" style="width: ${customWidth}; height: ${customHeight}; display: block;"></canvas>`;
    };

    const getQrHtml = (customSize = qrSize) => {
        if (!showQrCode) return '';
        const qrCanvasDim = Math.max(32, customSize - 6);
        return `
        <div class="id-portrait-qr" style="width: ${customSize}px; height: ${customSize}px; background: #ffffff; padding: 3px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-sizing: border-box;">
            <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${qrCanvasDim}" data-qr-level="M" style="width: ${qrCanvasDim}px; height: ${qrCanvasDim}px; display: block;"></canvas>
        </div>`;
    };

    const getSigHtml = (width = '100px', height = '28px') => {
        return `
        <div style="width: ${width}; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <div style="height: ${height}; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                ${sigHtml}
            </div>
            <span style="font-size: 6px; color: ${subtextColor}; text-transform: uppercase; font-weight: bold; margin-top: 1px; text-align: center; white-space: nowrap; width: 100%;">Authority Sig</span>
        </div>`;
    };

    const getNoticeHtml = (compact = false) => {
        if (compact) {
            return `<div style="font-size: ${Math.max(4.2, detailsFontSize * 0.58)}px; color: ${subtextColor}; line-height: 1.15; text-align: center; width: 100%; padding: 2px 4px; border-radius: 3px; background: rgba(128,128,128,0.06); border: 1px solid rgba(128,128,128,0.1);">VSA property.<br>Return: Shaheed Gunj Sgr.</div>`;
        }
        return `<div style="font-size: ${Math.max(4.5, detailsFontSize * 0.65)}px; color: ${subtextColor}; line-height: 1.2; padding: 3px 6px; border-radius: 4px; background: rgba(128,128,128,0.06); border: 1px solid rgba(128,128,128,0.1); word-break: break-word;">1. Card is VSA property, display on duty.<br>2. Return to Shaheed Gunj Srinagar 190001.</div>`;
    };

    // =========================================================================
    // HORIZONTAL LAYOUTS
    // =========================================================================
    if (template.layout === 'horizontal') {
        const col3QrSize = Math.max(84, Math.min(qrSize || 88, 92));
        const col3Width = Math.max(90, Math.min(94, col3QrSize + 6));
        if (cardTheme === 'organic-wave') {
            const pDim = Math.min(photoWidth, photoHeight);
            const pTopOffset = template.photoTopOffset !== undefined ? template.photoTopOffset : 10;
            let wavePhotoStyle = '';
            if (photoShape === 'circle') {
                wavePhotoStyle = `width: ${pDim}px; height: ${pDim}px; border-radius: 50%; overflow: hidden; border: 3.5px solid #ffffff; outline: 3.5px solid ${template.accentColor || '#009688'}; box-shadow: 0 4px 14px rgba(0,0,0,0.22); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eaeaea; margin-top: ${pTopOffset}px; margin-bottom: 8px;`;
            } else if (photoShape === 'squircle') {
                wavePhotoStyle = `width: ${photoWidth}px; height: ${photoHeight}px; border-radius: 18px; overflow: hidden; border: 3px solid ${template.accentColor || '#009688'}; box-shadow: 0 4px 12px rgba(0,0,0,0.18); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eaeaea; margin-top: ${pTopOffset}px; margin-bottom: 8px;`;
            } else {
                wavePhotoStyle = `width: ${photoWidth}px; height: ${photoHeight}px; border-radius: 8px; overflow: hidden; border: 2.5px solid ${template.accentColor || '#009688'}; box-shadow: 0 3px 8px rgba(0,0,0,0.16); flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #eaeaea; margin-top: ${pTopOffset}px; margin-bottom: 8px;`;
            }
            const leftColWidth = Math.max(130, Math.min(150, (photoShape === 'circle' ? pDim : photoWidth) + 12));
            const qrBoxDim = qrSize || 48;
            const qrCanvasDim = Math.max(24, qrBoxDim - 8);
            const isQrUnderPhoto = template.barcodePosition === 'bottom-center' || template.qrPosition === 'bottom-left' || (template.name && (template.name.toLowerCase().includes('office') || template.name.toLowerCase().includes('visual'))) || template.id === 'tpl-office' || (template.layouts && template.layouts.horizontal && template.layouts.horizontal.elements && template.layouts.horizontal.elements.some(e => e.type === 'qr-code' && e.y >= 160 && e.x < 150));

            return `
            <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
                <div class="id-card-horizontal visual-id-card-render theme-organic-wave" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#009688'}; border-radius: 14px; display: flex; flex-direction: column; justify-content: flex-start; height: 320px; width: 500px; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
                    <!-- SVG Fluid Waves Top: Deep photo cradle on the left (Y=106), stays high on the right (Y=50) -->
                    <svg viewBox="0 0 500 120" preserveAspectRatio="none" style="position: absolute; top: 0; left: 0; width: 100%; height: 120px; pointer-events: none; z-index: 1;">
                        <defs>
                            <linearGradient id="hanoverWaveGradH" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="${template.headerBgColor || '#0d7a6e'}" />
                                <stop offset="60%" stop-color="${template.accentColor || '#009688'}" />
                                <stop offset="100%" stop-color="${template.accentColor || '#009688'}" />
                            </linearGradient>
                        </defs>
                        <path d="M0,0 L500,0 L500,60 C420,54 330,50 205,58 C135,66 50,112 0,106 Z" fill="${template.accentColor || '#009688'}" opacity="0.32"/>
                        <path d="M0,0 L500,0 L500,50 C420,46 330,42 200,50 C130,58 45,106 0,100 Z" fill="url(#hanoverWaveGradH)"/>
                    </svg>

                    <!-- SVG Harmonic Guilloche Security Wave Lines across White Background -->
                    <svg viewBox="0 0 500 320" preserveAspectRatio="none" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.10;">
                        <path d="M-50,140 C50,110 120,230 220,160 C320,90 380,240 520,170" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                        <path d="M-50,165 C60,135 130,255 230,185 C330,115 390,265 520,195" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                        <path d="M-50,190 C70,160 140,280 240,210 C340,140 400,290 520,220" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                        <path d="M-50,215 C80,185 150,305 250,235 C350,165 410,315 520,245" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                        <path d="M-50,240 C90,210 160,330 260,260 C360,190 420,340 520,270" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                    </svg>

                    <!-- Bottom-Right Subtle Accent Wave (Stays X >= 330, Never touches signature) -->
                    <svg viewBox="0 0 500 42" preserveAspectRatio="none" style="position: absolute; bottom: 0; left: 0; width: 100%; height: 42px; pointer-events: none; z-index: 0;">
                        <path d="M330,42 C400,18 450,24 500,8 L500,42 Z" fill="${template.accentColor || '#009688'}" opacity="0.6"/>
                        <path d="M380,42 C430,22 470,24 500,14 L500,42 Z" fill="${template.headerBgColor || '#0d7a6e'}"/>
                    </svg>

                    <!-- Top Wave Header: Brand (Left) + Display Title (Right) -->
                    <div class="id-portrait-header" style="height: 52px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; box-sizing: border-box; z-index: 2; position: relative; flex-shrink: 0;">
                        <!-- Left: Brand Logo Badge + White Typography -->
                        <div style="display: flex; align-items: center; gap: 8px; max-width: 60%;">
                            <div class="id-portrait-logo" style="width: 36px; height: 36px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: 6px; padding: 2px; box-shadow: 0 2px 4px rgba(0,0,0,0.25);">
                                ${logoHtml}
                            </div>
                            <div class="id-portrait-brand" style="min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                                <h1 class="id-portrait-title" style="color: #ffffff; font-size: ${Math.min(headerFontSize, 11.5)}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.15; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,0.35);">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                                <p class="id-portrait-subtitle" style="color: rgba(255,255,255,0.92); font-size: ${Math.max(6, headerFontSize * 0.52)}px; margin: 1px 0 0 0; text-transform: uppercase; line-height: 1.15; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.4px;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR 7889311608'}</p>
                            </div>
                        </div>
                        <!-- Right: High-Impact Display Serif Card Title (SECURITY ID CARD / STUDENT ID CARD / ADMIN) -->
                        <div style="text-align: right; line-height: 1.05; padding-right: 2px;">
                            <div style="font-family: 'Playfair Display', Georgia, serif; font-size: ${rawCardTitle.length <= 6 ? '22px' : '18px'}; font-style: ${rawCardTitle.length <= 6 ? 'italic' : 'normal'}; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px; text-shadow: 0 1px 4px rgba(0,0,0,0.4);">
                                ${titleLine1}${titleLine2 ? `<br><span style="font-size: 15px; font-weight: 700; opacity: 0.95;">${titleLine2}</span>` : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Body Content Split: Left Pillar (Photo + Barcode/QR) vs Right Details & Security Lockup -->
                    <div style="display: flex; gap: 14px; flex-grow: 1; min-height: 0; align-items: stretch; padding: 0 16px 8px 16px; z-index: 2; position: relative;">
                        <!-- Column 1 (Left Pillar): Large Photo overlapping wave + Barcode or QR Directly Below -->
                        <div style="width: ${leftColWidth}px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; flex-shrink: 0; z-index: 3;">
                            ${showPhoto ? `<div class="id-portrait-photo-box" style="${wavePhotoStyle}">${photoHtml}</div>` : ''}
                            ${isQrUnderPhoto ? `
                            ${showQrcode ? `
                            <div style="width: 100%; display: flex; justify-content: center; align-items: center; margin-top: 4px;">
                                <div class="id-portrait-qr" style="width: ${qrBoxDim}px; height: ${qrBoxDim}px; background: #ffffff; padding: 2px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.12); border: 1.5px solid ${template.accentColor || '#009688'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                    <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${qrCanvasDim}" style="width: ${qrCanvasDim}px; height: ${qrCanvasDim}px; display: block;"></canvas>
                                </div>
                            </div>` : ''}
                            ` : `
                            <div style="width: 100%; display: flex; flex-direction: column; align-items: center;">
                                ${getBarcodeHtml(template.barcodeWidth ? template.barcodeWidth + 'px' : '120px', template.barcodeHeight ? template.barcodeHeight + 'px' : '25px')}
                                <span style="font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 800; color: #334155; letter-spacing: 0.8px; margin-top: 2px;">${cleanTextVal(emp.id, false)}</span>
                            </div>
                            `}
                        </div>

                        <!-- Column 2 (Right Area): 100% On Clean White Background, Zero Dark Wave Overlap -->
                        <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; padding-left: 4px; padding-top: 4px; z-index: 2;">
                            <div style="margin-bottom: 3px;">
                                <h2 class="id-portrait-name" style="font-family: ${template.nameFont || template.font || "'Playfair Display', Georgia, serif"}; color: #0f172a; font-size: ${cleanTextVal(emp.name).length > 24 ? Math.max(12, (nameFontSize || 17) - 3) : (nameFontSize || 17)}px; font-weight: 700; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15; letter-spacing: 0.6px; text-transform: uppercase;">
                                    ${cleanTextVal(emp.name)}
                                </h2>
                                ${showDesignation ? `
                                <h3 class="id-portrait-designation" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; color: ${template.accentColor || '#dc2626'}; font-size: ${cleanTextVal(emp.designation).length > 28 ? Math.max(8.5, (designationFontSize || 10.5) - 1.5) : (designationFontSize || 10.5)}px; font-weight: 800; margin: 1px 0 0 0; text-transform: uppercase; letter-spacing: 0.6px; line-height: 1.1;">
                                    ${cleanTextVal(emp.designation)}
                                </h3>` : ''}
                            </div>

                            <div style="background: #ffffff; border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 6px; padding: 2px 8px; width: 100%; box-sizing: border-box; box-shadow: 0 1px 3px rgba(0,0,0,0.03); margin-bottom: auto;">
                                <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                                    ${cleanDetailsRowsHtml}
                                </table>
                            </div>

                            ${isQrUnderPhoto ? `
                            <!-- Bottom Security Verification Lockup: Signature (Left) + Barcode (Right) -->
                            <div style="display: flex; align-items: flex-end; justify-content: space-between; width: 100%; margin-top: auto; padding-top: 4px; padding-bottom: 2px;">
                                ${showSignature ? `
                                <div style="display: flex; flex-direction: column; align-items: center; width: 100px; padding-left: 2px;">
                                    <div style="height: 26px; width: 90px; display: flex; align-items: center; justify-content: center;">${sigHtml}</div>
                                    <div style="font-size: 6px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; border-top: 1px solid #94a3b8; padding-top: 2px; width: 95px; text-align: center; white-space: nowrap;">AUTHORITY SIGNATURE</div>
                                </div>` : '<div></div>'}
                                ${showBarcode ? `
                                <div style="display: flex; flex-direction: column; align-items: center; padding-right: 2px;">
                                    ${getBarcodeHtml(template.barcodeWidth ? template.barcodeWidth + 'px' : '116px', template.barcodeHeight ? template.barcodeHeight + 'px' : '24px')}
                                    <span style="font-family: 'JetBrains Mono', monospace; font-size: 8.5px; font-weight: 800; color: #334155; letter-spacing: 0.8px; margin-top: 1px;">${cleanTextVal(emp.id, false)}</span>
                                </div>` : '<div></div>'}
                            </div>
                            ` : `
                            <!-- Bottom Security Verification Lockup: Signature (Left) + QR Code (Right) -->
                            <div style="display: flex; align-items: flex-end; justify-content: space-between; width: 100%; margin-top: auto; padding-top: 4px; padding-bottom: 2px;">
                                <!-- Authority Signature -->
                                <div style="display: flex; flex-direction: column; align-items: center; width: 100px;">
                                    <div style="height: 26px; width: 90px; display: flex; align-items: center; justify-content: center;">${sigHtml}</div>
                                    <div style="font-size: 6px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; border-top: 1px solid #94a3b8; padding-top: 2px; width: 95px; text-align: center; white-space: nowrap;">AUTHORITY SIGNATURE</div>
                                </div>
                                <!-- Official QR Verification -->
                                <div style="display: flex; align-items: center; gap: 6px;">
                                    <div style="text-align: right; line-height: 1.15;">
                                        <span style="font-size: 6px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; display: block;">OFFICIAL VSA</span>
                                        <span style="font-size: 5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block;">SCAN TO VERIFY</span>
                                    </div>
                                    <div class="id-portrait-qr" style="width: ${qrBoxDim}px; height: ${qrBoxDim}px; background: #ffffff; padding: 2px; border-radius: 5px; box-shadow: 0 2px 6px rgba(0,0,0,0.12); border: 1.5px solid ${template.accentColor || '#009688'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${qrCanvasDim}" style="width: ${qrCanvasDim}px; height: ${qrCanvasDim}px; display: block;"></canvas>
                                    </div>
                                </div>
                            </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>`;
        }

        if (cardTheme === 'geometric-tech') {
            return `
            <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
                <div class="id-card-horizontal visual-id-card-render theme-geometric-tech" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#2563eb'}; border-radius: 14px; display: flex; flex-direction: column; justify-content: flex-start; height: 320px; width: 500px; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
                    <!-- Geometric Angular Header -->
                    <div class="id-portrait-header" style="background: ${template.headerBgColor || '#0c2340'}; clip-path: polygon(0 0, 100% 0, 100% 75%, 70% 100%, 0 75%); border-bottom: 2px solid ${template.accentColor || '#2563eb'}; height: 68px; display: flex; align-items: center; gap: 12px; padding: 0 18px; box-sizing: border-box; flex-shrink: 0; z-index: 2;">
                        <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                            ${logoHtml}
                        </div>
                        <div class="id-portrait-brand" style="flex-grow: 1; min-width: 0;">
                            <h1 class="id-portrait-title" style="color: ${headerTextColor}; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.2; letter-spacing: 0.5px;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                            <p class="id-portrait-subtitle" style="color: ${headerSubtextColor}; font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                        </div>
                        <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 15px; font-weight: 800; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px; padding-right: 4px;">
                            ${rawCardTitle}
                        </div>
                    </div>

                    <!-- Body Content Split: Left Pillar (Photo + Barcode) vs Right Details & Security Lockup -->
                    <div style="display: flex; gap: 16px; flex-grow: 1; min-height: 0; align-items: stretch; padding: 6px 18px 10px 18px; z-index: 2;">
                        <!-- Column 1 (Left Pillar): Photo & Barcode -->
                        <div style="width: 135px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                            ${showPhoto ? `<div class="id-portrait-photo-box" style="${photoContainerStyle} margin-bottom: 6px;">${photoHtml}</div>` : ''}
                            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-top: auto; padding-bottom: 2px;">
                                ${getBarcodeHtml('125px', '24px')}
                                <span style="font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; color: #475569; letter-spacing: 0.8px; margin-top: 2px;">${cleanTextVal(emp.id, false)}</span>
                            </div>
                        </div>

                        <!-- Column 2 (Right Area): Name Banner, Designation, Clean Table & Lockup -->
                        <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; padding-left: 2px;">
                            <div style="margin-bottom: 2px; padding-bottom: 2px;">
                                ${nameBlockHtml}
                                ${showDesignation ? `<h3 class="id-portrait-designation" style="color: ${template.accentColor || '#2563eb'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 1px 0 3px 0; text-transform: uppercase; letter-spacing: 0.8px;">${cleanTextVal(emp.designation)}</h3>` : ''}
                            </div>

                            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: auto;">
                                ${cleanDetailsRowsHtml}
                            </table>

                            <!-- Bottom Security Verification Lockup: Signature (Left) + QR Code (Right) -->
                            <div style="display: flex; align-items: flex-end; justify-content: space-between; width: 100%; margin-top: auto; padding-top: 4px; padding-bottom: 2px;">
                                <div style="display: flex; flex-direction: column; align-items: center; width: 105px;">
                                    <div style="height: 30px; width: 100px; display: flex; align-items: center; justify-content: center;">${sigHtml}</div>
                                    <div style="font-size: 6.5px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; border-top: 1px solid #94a3b8; padding-top: 2px; width: 100px; text-align: center; white-space: nowrap;">AUTHORITY SIGNATURE</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="text-align: right; line-height: 1.15;">
                                        <span style="font-size: 6.5px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; display: block;">OFFICIAL VSA</span>
                                        <span style="font-size: 5.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block;">SCAN TO VERIFY</span>
                                    </div>
                                    <div class="id-portrait-qr" style="width: ${qrSize || 50}px; height: ${qrSize || 50}px; background: #ffffff; padding: 2px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.12); border: 1.5px solid ${template.accentColor || '#2563eb'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${Math.max(24, (qrSize || 50) - 6)}" style="width: ${Math.max(24, (qrSize || 50) - 6)}px; height: ${Math.max(24, (qrSize || 50) - 6)}px; display: block;"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Bottom Geometric Accent Bar -->
                    <div style="background: ${template.headerBgColor || '#0c2340'}; height: 8px; clip-path: polygon(0 0, 30% 100%, 100% 100%, 100% 0); margin: auto 0 0 0;"></div>
                </div>
            </div>`;
        }

        if (cardTheme === 'modern-pill') {
            return `
            <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
                <div class="id-card-horizontal visual-id-card-render theme-modern-pill" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#006039'}; border-radius: 16px; display: flex; flex-direction: column; justify-content: flex-start; height: 320px; width: 500px; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
                    <!-- Salford Top Bar: Floating Green Pill Badge (Left) + Agency Brand (Right) -->
                    <div class="id-portrait-header" style="padding: 10px 18px 4px 18px; display: flex; align-items: center; justify-content: space-between; z-index: 2; flex-shrink: 0;">
                        <!-- Solid Green Pill Container with Card Title -->
                        <div style="background: ${template.headerBgColor || '#006039'}; border-radius: 9999px; padding: 6px 18px; color: #ffffff; box-shadow: 0 3px 10px rgba(0,0,0,0.18); display: inline-flex; align-items: center; gap: 8px;">
                            <span style="font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.8px;">${rawCardTitle}</span>
                        </div>
                        <!-- Right: VSA Logo + Agency Brand -->
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="id-portrait-brand" style="text-align: right;">
                                <h1 class="id-portrait-title" style="color: #0f172a; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.1;">${template.headerText || 'VALLEY SECURITY SERVICES'}</h1>
                                <p class="id-portrait-subtitle" style="color: #64748b; font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 1px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">${template.subheaderText || 'OFFICIAL IDENTIFICATION PASS'}</p>
                            </div>
                            <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                ${logoHtml}
                            </div>
                        </div>
                    </div>

                    <!-- Body Content Split: Left Pillar (Squircle Photo + Barcode) vs Right Details & Lockup -->
                    <div style="display: flex; gap: 16px; flex-grow: 1; min-height: 0; align-items: stretch; padding: 6px 18px 6px 18px; z-index: 2;">
                        <!-- Column 1 (Left Pillar): Squircle Photo & Barcode Below -->
                        <div style="width: 135px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                            ${showPhoto ? `<div class="id-portrait-photo-box" style="${photoContainerStyle} margin-bottom: 6px;">${photoHtml}</div>` : ''}
                            <div style="width: 100%; display: flex; flex-direction: column; align-items: center; margin-top: auto; padding-bottom: 2px;">
                                ${getBarcodeHtml('125px', '24px')}
                                <span style="font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 700; color: #475569; letter-spacing: 0.8px; margin-top: 2px;">${cleanTextVal(emp.id, false)}</span>
                            </div>
                        </div>

                        <!-- Column 2 (Right Area): Name, Designation, Clean Table & Lockup -->
                        <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; padding-left: 2px;">
                            <div style="margin-bottom: 2px; padding-bottom: 2px;">
                                ${nameBlockHtml}
                                ${showDesignation ? `<h3 class="id-portrait-designation" style="color: ${template.accentColor || '#006039'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 1px 0 3px 0; text-transform: uppercase; letter-spacing: 0.8px;">${cleanTextVal(emp.designation)}</h3>` : ''}
                            </div>

                            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: auto;">
                                ${cleanDetailsRowsHtml}
                            </table>

                            <!-- Bottom Security Verification Lockup: Signature (Left) + QR Code (Right) -->
                            <div style="display: flex; align-items: flex-end; justify-content: space-between; width: 100%; margin-top: auto; padding-top: 4px; padding-bottom: 2px;">
                                <div style="display: flex; flex-direction: column; align-items: center; width: 105px;">
                                    <div style="height: 30px; width: 100px; display: flex; align-items: center; justify-content: center;">${sigHtml}</div>
                                    <div style="font-size: 6.5px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; border-top: 1px solid #94a3b8; padding-top: 2px; width: 100px; text-align: center; white-space: nowrap;">AUTHORITY SIGNATURE</div>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <div style="text-align: right; line-height: 1.15;">
                                        <span style="font-size: 6.5px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; display: block;">OFFICIAL VSA</span>
                                        <span style="font-size: 5.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block;">SCAN TO VERIFY</span>
                                    </div>
                                    <div class="id-portrait-qr" style="width: ${qrSize || 50}px; height: ${qrSize || 50}px; background: #ffffff; padding: 2px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.12); border: 1.5px solid ${template.accentColor || '#006039'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                                        <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${Math.max(24, (qrSize || 50) - 6)}" style="width: ${Math.max(24, (qrSize || 50) - 6)}px; height: ${Math.max(24, (qrSize || 50) - 6)}px; display: block;"></canvas>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Salford Striped Geometric Bottom Accent -->
                    <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px; padding: 2px 18px 6px 18px; margin-top: auto; z-index: 1;">
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${template.accentColor || '#006039'};"></span>
                        <span style="width: 8px; height: 8px; border-radius: 50%; background: ${template.accentColor || '#006039'}; opacity: 0.5;"></span>
                        <div style="height: 6px; width: 90px; border-radius: 3px; background: repeating-linear-gradient(45deg, ${template.accentColor || '#006039'}, ${template.accentColor || '#006039'} 4px, transparent 4px, transparent 8px);"></div>
                    </div>
                </div>
            </div>`;
        }

        if (cardTheme === 'creative-social') {
            return `
            <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
                <div class="id-card-horizontal visual-id-card-render theme-creative-social" style="font-family: ${template.font || "'Playfair Display', Georgia, serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#b45309'}; border-radius: 14px; display: flex; flex-direction: column; justify-content: flex-start; height: 320px; width: 500px; box-sizing: border-box; overflow: hidden; position: relative; background: #fffbf5;">
                    <!-- Seigaiha Concentric Japanese Waves Background -->
                    <svg viewBox="0 0 500 320" preserveAspectRatio="none" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.08;">
                        <defs>
                            <pattern id="seigaihaH" width="60" height="30" patternUnits="userSpaceOnUse">
                                <path d="M 0 30 A 30 30 0 0 1 60 30 M 10 30 A 20 20 0 0 1 50 30 M 20 30 A 10 10 0 0 1 40 30 M 30 0 A 30 30 0 0 1 90 0 M 40 0 A 20 20 0 0 1 80 0 M -30 0 A 30 30 0 0 1 30 0 M -20 0 A 20 20 0 0 1 20 0" fill="none" stroke="${template.accentColor || '#b45309'}" stroke-width="1.2"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#seigaihaH)" />
                    </svg>

                    <!-- Header -->
                    <div class="id-portrait-header" style="background: ${template.headerBgColor || '#78350f'}; border-bottom: 2px solid ${template.accentColor || '#b45309'}; color: #ffffff; height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 16px; z-index: 2; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                ${logoHtml}
                            </div>
                            <div>
                                <h1 class="id-portrait-title" style="color: #ffffff; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.15;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                                <p class="id-portrait-subtitle" style="color: rgba(255,255,255,0.85); font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 1px 0 0 0; text-transform: uppercase;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                            </div>
                        </div>
                        <div style="font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 700; color: #fde68a; text-transform: uppercase; letter-spacing: 0.8px;">
                            ${rawCardTitle}
                        </div>
                    </div>

                    <!-- Body Content Split -->
                    <div style="display: flex; gap: 14px; flex-grow: 1; min-height: 0; align-items: stretch; padding: 8px 16px 10px 16px; z-index: 2;">
                        <div style="width: ${photoWidth}px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                            ${showPhoto ? `<div class="id-portrait-photo-box" style="${photoContainerStyle} margin-bottom: 4px;">${photoHtml}</div>` : ''}
                            ${barcodePosition === 'bottom-left' ? getBarcodeHtml(`${photoWidth}px`, '20px') : getSigHtml(`${photoWidth}px`, '28px')}
                        </div>

                        <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; padding-left: 6px; padding-right: 10px;">
                            <div style="margin-bottom: 4px; padding-bottom: 2px;">
                                ${nameBlockHtml}
                                ${showDesignation ? `<h3 class="id-portrait-designation" style="color: ${template.accentColor || '#b45309'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">${cleanTextVal(emp.designation)}</h3>` : ''}
                            </div>
                            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: auto;">
                                ${cleanDetailsRowsHtml}
                            </table>
                            ${barcodePosition === 'bottom-center' ? `
                                <div style="width: 100%; display: flex; justify-content: center; align-items: center; margin-top: auto; padding-top: 3px;">
                                    ${getBarcodeHtml('140px', '18px')}
                                </div>
                            ` : ''}
                        </div>

                        <div style="width: ${col3Width}px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                            ${getQrHtml(col3QrSize)}
                            ${getNoticeHtml(true)}
                            ${barcodePosition === 'bottom-right' ? getBarcodeHtml(`${col3Width}px`, '18px') : getSigHtml(`${col3Width}px`, '28px')}
                        </div>
                    </div>
                </div>
            </div>`;
        }

        // Classic Fallback (Horizontal)
        return `
        <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
            <!-- SINGLE-SIDED HORIZONTAL ID CARD -->
            <div class="id-card-horizontal visual-id-card-render" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#dfba5f'}; display: flex; flex-direction: column; justify-content: flex-start; height: 320px; width: 500px; box-sizing: border-box; overflow: hidden; position: relative;">
                <!-- Header -->
                <div class="id-portrait-header" style="background: ${template.headerBgColor || '#0e3e2b'}; border-bottom: 2px solid ${template.accentColor || '#dfba5f'}; color: ${headerTextColor}; height: ${headerHeight}px; display: flex; align-items: center; gap: 12px; padding: 0 14px; margin: -15px -15px 8px -15px; border-radius: 10px 10px 0 0; box-sizing: border-box; overflow: hidden; flex-shrink: 0;">
                    <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        ${logoHtml}
                    </div>
                    <div class="id-portrait-brand" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                        <h1 class="id-portrait-title" style="color: ${headerTextColor}; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.2; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                        <p class="id-portrait-subtitle" style="color: ${headerSubtextColor}; font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 2px 0 0 0; text-transform: uppercase; line-height: 1.2; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.9;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                    </div>
                </div>

                <!-- Body Content Split -->
                <div class="id-horizontal-body" style="display: flex; gap: 15px; flex-grow: 1; min-height: 0; align-items: stretch; margin-top: 8px; padding: 0 4px;">
                    <!-- Column 1: Photo and Left Element -->
                    <div class="id-horizontal-left" style="width: ${photoWidth}px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        ${showPhoto ? `
                        <div class="id-portrait-photo-box" style="${photoContainerStyle} margin-bottom: 5px;">
                            ${photoHtml}
                        </div>
                        ` : ''}
                        ${barcodePosition === 'bottom-left' ? getBarcodeHtml(`${photoWidth}px`, '20px') : getSigHtml(`${photoWidth}px`, '28px')}
                    </div>
                    
                    <!-- Column 2: Name, Designation, and Details Table -->
                    <div class="id-horizontal-right" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; padding-left: 6px; padding-right: 10px;">
                        <div style="margin-bottom: 4px; padding-bottom: 2px;">
                            ${nameBlockHtml}
                            ${showDesignation ? `
                            <h3 class="id-portrait-designation" style="color: ${template.accentColor || '#dfba5f'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 1px 0 0 0; white-space: normal; line-height: 1.1; word-break: break-word; letter-spacing: 0.5px;">
                                ${cleanTextVal(emp.designation)}
                            </h3>
                            ` : ''}
                        </div>
                        
                        <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: auto;">
                            ${cleanDetailsRowsHtml}
                        </table>
                        ${barcodePosition === 'bottom-center' ? `
                            <div style="width: 100%; display: flex; justify-content: center; align-items: center; margin-top: auto; padding-top: 3px;">
                                ${getBarcodeHtml('140px', '18px')}
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Column 3: QR Code, Barcode, and terms -->
                    <div style="width: ${col3Width}px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        ${getQrHtml(col3QrSize)}
                        ${getNoticeHtml(true)}
                        ${barcodePosition === 'bottom-right' ? getBarcodeHtml(`${col3Width}px`, '18px') : getSigHtml(`${col3Width}px`, '28px')}
                    </div>
                </div>
            </div>
        </div>
        `;
    } else {
        // =====================================================================
        // VERTICAL LAYOUTS
        // =====================================================================
        if (cardTheme === 'organic-wave') {
            return `
            <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
                <div class="id-card-portrait visual-id-card-render theme-organic-wave" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#009688'}; border-radius: 12px; display: flex; flex-direction: column; justify-content: flex-start; height: 500px; width: 320px; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
                    <!-- SVG Fluid Waves Top with Gradient -->
                    <svg viewBox="0 0 320 145" preserveAspectRatio="none" style="position: absolute; top: 0; left: 0; width: 100%; height: 145px; pointer-events: none; z-index: 1;">
                        <defs>
                            <linearGradient id="hanoverWaveGradV" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="${template.headerBgColor || '#0d7a6e'}" />
                                <stop offset="60%" stop-color="${template.accentColor || '#009688'}" />
                                <stop offset="100%" stop-color="${template.accentColor || '#009688'}" />
                            </linearGradient>
                        </defs>
                        <path d="M0,0 L320,0 L320,85 C250,130 180,80 110,120 C50,145 15,115 0,130 Z" fill="${template.accentColor || '#009688'}" opacity="0.32"/>
                        <path d="M0,0 L320,0 L320,72 C230,118 150,72 90,108 C40,128 10,105 0,118 Z" fill="url(#hanoverWaveGradV)"/>
                    </svg>

                    <!-- SVG Harmonic Guilloche Security Wave Lines -->
                    <svg viewBox="0 0 320 500" preserveAspectRatio="none" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.12;">
                        <path d="M-30,220 C40,170 120,310 210,240 C260,200 290,290 350,260" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                        <path d="M-30,245 C50,195 130,335 220,265 C270,225 300,315 350,285" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                        <path d="M-30,270 C60,220 140,360 230,290 C280,250 310,340 350,310" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                        <path d="M-30,295 C70,245 150,385 240,315 C290,275 320,365 350,335" fill="none" stroke="${template.accentColor || '#009688'}" stroke-width="1.2"/>
                    </svg>

                    <!-- Bottom Curved Wave Accent -->
                    <svg viewBox="0 0 320 40" preserveAspectRatio="none" style="position: absolute; bottom: 0; left: 0; width: 100%; height: 40px; pointer-events: none; z-index: 1;">
                        <path d="M80,40 C160,10 240,35 320,8 L320,40 Z" fill="${template.accentColor || '#009688'}" opacity="0.75"/>
                        <path d="M120,40 C190,18 260,36 320,18 L320,40 Z" fill="${template.headerBgColor || '#0d7a6e'}"/>
                    </svg>

                    <!-- Top Wave Brand Header -->
                    <div class="id-portrait-header" style="height: 65px; display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; box-sizing: border-box; z-index: 2; position: relative; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; margin-right: 6px;">
                            <div class="id-portrait-logo" style="width: ${Math.min(logoSize, 38)}px; height: ${Math.min(logoSize, 38)}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));">
                                ${logoHtml}
                            </div>
                            <div class="id-portrait-brand" style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                                <h1 class="id-portrait-title" style="color: #ffffff; font-size: ${Math.min(headerFontSize, 12)}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.15; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-shadow: 0 1px 3px rgba(0,0,0,0.3);">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                                <p class="id-portrait-subtitle" style="color: rgba(255,255,255,0.92); font-size: ${Math.max(6, Math.min(headerFontSize * 0.55, 8))}px; margin: 2px 0 0 0; text-transform: uppercase; line-height: 1.15; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.95;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                            </div>
                        </div>
                        <div class="id-portrait-type-wrapper" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; line-height: 1.05;">
                            <span class="id-portrait-type-badge" style="background: rgba(255,255,255,0.22); backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.45); color: #ffffff; padding: 2px 7px; border-radius: 4px; font-size: 8px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.18); font-family: 'Playfair Display', Georgia, serif; display: inline-block;">
                                ${titleLine1}${titleLine2 ? ` ${titleLine2}` : ''}
                            </span>
                        </div>
                    </div>

                    <!-- Photo Cutout (overlapping the wave) -->
                    ${showPhoto ? `
                    <div style="display: flex; justify-content: center; width: 100%; z-index: 3; position: relative; margin-top: 4px; margin-bottom: 4px;">
                        <div class="id-portrait-photo-box" style="${photoContainerStyle}">
                            ${photoHtml}
                        </div>
                    </div>` : ''}

                    <!-- Name & Designation Centered -->
                    <div style="text-align: center; width: 100%; z-index: 2; position: relative; margin-bottom: 4px; padding: 0 10px; box-sizing: border-box;">
                        ${nameBlockHtml}
                        ${showDesignation ? `
                        <h3 class="id-portrait-designation" style="color: ${template.accentColor || '#009688'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${cleanTextVal(emp.designation)}
                        </h3>` : ''}
                    </div>

                    <!-- Details Table -->
                    <div style="padding: 0 14px; width: 100%; box-sizing: border-box; z-index: 2; position: relative; flex-grow: 1; display: flex; flex-direction: column;">
                        <div style="background: rgba(15, 23, 42, 0.025); border: 1px solid rgba(15, 23, 42, 0.07); border-radius: 8px; padding: 4px 10px; width: 100%; box-sizing: border-box; margin-bottom: auto;">
                            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                                ${cleanDetailsRowsHtml}
                            </table>
                        </div>
                    </div>

                    <!-- Bottom Section: QR, Signature, Barcode -->
                    <div style="padding: 2px 14px 6px 14px; width: 100%; box-sizing: border-box; z-index: 2; position: relative; margin-top: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; margin-bottom: 4px;">
                            ${getQrHtml(48)}
                            <div style="flex-grow: 1; padding: 0 6px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                ${getNoticeHtml(true)}
                            </div>
                            ${getSigHtml('80px', '25px')}
                        </div>
                        ${showBarcode ? `
                        <div style="width: 100%; display: flex; justify-content: ${barcodePosition === 'bottom-left' ? 'flex-start' : barcodePosition === 'bottom-right' ? 'flex-end' : 'center'}; align-items: center; margin: 3px 0 4px 0;">
                            <div style="background: #ffffff; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.08); display: inline-flex; align-items: center; justify-content: center;">
                                ${getBarcodeHtml('145px', '18px')}
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
        }

        if (cardTheme === 'geometric-tech') {
            return `
            <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
                <div class="id-card-portrait visual-id-card-render theme-geometric-tech" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#2563eb'}; border-radius: 12px; display: flex; flex-direction: column; justify-content: flex-start; height: 500px; width: 320px; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
                    <!-- Angular Geometric Chevron Header -->
                    <div class="id-portrait-header" style="background: ${template.headerBgColor || '#0c2340'}; clip-path: polygon(0 0, 100% 0, 100% 82%, 50% 100%, 0 82%); border-bottom: 2px solid ${template.accentColor || '#2563eb'}; height: ${headerHeight}px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 12px 14px 12px; margin: -15px -15px 4px -15px; box-sizing: border-box; z-index: 2; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                ${logoHtml}
                            </div>
                            <div>
                                <h1 class="id-portrait-title" style="color: ${headerTextColor}; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; letter-spacing: 0.5px;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                                <p class="id-portrait-subtitle" style="color: ${headerSubtextColor}; font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 1px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Centered Photo -->
                    ${showPhoto ? `
                    <div style="display: flex; justify-content: center; width: 100%; margin: 4px 0 2px 0; z-index: 2;">
                        <div class="id-portrait-photo-box" style="${photoContainerStyle}">
                            ${photoHtml}
                        </div>
                    </div>` : ''}

                    <!-- Name Banner & Designation -->
                    <div style="text-align: center; width: 100%; z-index: 2; margin-bottom: 4px; padding: 0 10px; box-sizing: border-box;">
                        ${nameBlockHtml}
                        ${showDesignation ? `
                        <h3 class="id-portrait-designation" style="color: ${template.accentColor || '#2563eb'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.8px;">
                            ${cleanTextVal(emp.designation)}
                        </h3>` : ''}
                    </div>

                    <!-- Details Table -->
                    <div style="padding: 0 14px; width: 100%; box-sizing: border-box; z-index: 2; flex-grow: 1; display: flex; flex-direction: column;">
                        <div style="background: rgba(12, 35, 64, 0.025); border: 1px solid rgba(12, 35, 64, 0.07); border-radius: 8px; padding: 4px 10px; width: 100%; box-sizing: border-box; margin-bottom: auto;">
                            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                                ${cleanDetailsRowsHtml}
                            </table>
                        </div>
                    </div>

                    <!-- Bottom Chevron Footer with Centered Barcode -->
                    <div style="background: ${template.headerBgColor || '#0c2340'}; clip-path: polygon(0 18%, 50% 0, 100% 18%, 100% 100%, 0 100%); padding: 12px 14px 6px 14px; margin: auto -15px -15px -15px; display: flex; flex-direction: column; align-items: center; z-index: 2;">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 4px;">
                            ${getQrHtml(48)}
                            ${getSigHtml('85px', '25px')}
                        </div>
                        ${showBarcode ? `
                        <div style="width: 100%; display: flex; justify-content: center; background: #ffffff; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); margin: 2px 0 4px 0;">
                            ${getBarcodeHtml('145px', '18px')}
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
        }

        if (cardTheme === 'modern-pill') {
            return `
            <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
                <div class="id-card-portrait visual-id-card-render theme-modern-pill" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#006039'}; border-radius: 16px; display: flex; flex-direction: column; justify-content: flex-start; height: 500px; width: 320px; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
                    <!-- Floating Pill Header -->
                    <div class="id-portrait-header" style="background: ${template.headerBgColor || '#006039'}; border-radius: 9999px; margin: 10px 14px 6px 14px; padding: 6px 16px; color: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.14); display: flex; align-items: center; gap: 10px; z-index: 2; flex-shrink: 0;">
                        <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                            ${logoHtml}
                        </div>
                        <div class="id-portrait-brand" style="flex-grow: 1; min-width: 0;">
                            <h1 class="id-portrait-title" style="color: #ffffff; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.1;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                            <p class="id-portrait-subtitle" style="color: rgba(255,255,255,0.88); font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 1px 0 0 0; text-transform: uppercase;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                        </div>
                    </div>

                    <!-- Squircle Photo -->
                    ${showPhoto ? `
                    <div style="display: flex; justify-content: center; width: 100%; margin: 4px 0 2px 0; z-index: 2;">
                        <div class="id-portrait-photo-box" style="${photoContainerStyle}">
                            ${photoHtml}
                        </div>
                    </div>` : ''}

                    <!-- Name & Designation -->
                    <div style="text-align: center; width: 100%; z-index: 2; margin-bottom: 4px; padding: 0 10px; box-sizing: border-box;">
                        ${nameBlockHtml}
                        ${showDesignation ? `
                        <h3 class="id-portrait-designation" style="color: ${template.accentColor || '#006039'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${cleanTextVal(emp.designation)}
                        </h3>` : ''}
                    </div>

                    <!-- Details Table -->
                    <div style="padding: 0 14px; width: 100%; box-sizing: border-box; z-index: 2; flex-grow: 1; display: flex; flex-direction: column;">
                        <div style="background: rgba(0, 96, 57, 0.025); border: 1px solid rgba(0, 96, 57, 0.07); border-radius: 8px; padding: 4px 10px; width: 100%; box-sizing: border-box; margin-bottom: auto;">
                            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                                ${cleanDetailsRowsHtml}
                            </table>
                        </div>
                    </div>

                    <!-- Bottom Section -->
                    <div style="padding: 2px 14px 6px 14px; width: 100%; box-sizing: border-box; z-index: 2; margin-top: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; margin-bottom: 4px;">
                            ${getQrHtml(48)}
                            <div style="flex-grow: 1; padding: 0 6px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                ${getNoticeHtml(true)}
                            </div>
                            ${getSigHtml('80px', '25px')}
                        </div>
                        ${showBarcode ? `
                        <div style="width: 100%; display: flex; justify-content: ${barcodePosition === 'bottom-left' ? 'flex-start' : barcodePosition === 'bottom-right' ? 'flex-end' : 'center'}; align-items: center; margin: 3px 0 4px 0;">
                            <div style="background: #ffffff; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.08); display: inline-flex; align-items: center; justify-content: center;">
                                ${getBarcodeHtml('145px', '18px')}
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
        }

        if (cardTheme === 'creative-social') {
            return `
            <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
                <div class="id-card-portrait visual-id-card-render theme-creative-social" style="font-family: ${template.font || "'Playfair Display', Georgia, serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#b45309'}; border-radius: 14px; display: flex; flex-direction: column; justify-content: flex-start; height: 500px; width: 320px; box-sizing: border-box; overflow: hidden; position: relative; background: #fffbf5;">
                    <!-- Seigaiha Concentric Japanese Waves Background -->
                    <svg viewBox="0 0 320 500" preserveAspectRatio="none" style="position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0.08;">
                        <defs>
                            <pattern id="seigaihaV" width="60" height="30" patternUnits="userSpaceOnUse">
                                <path d="M 0 30 A 30 30 0 0 1 60 30 M 10 30 A 20 20 0 0 1 50 30 M 20 30 A 10 10 0 0 1 40 30 M 30 0 A 30 30 0 0 1 90 0 M 40 0 A 20 20 0 0 1 80 0 M -30 0 A 30 30 0 0 1 30 0 M -20 0 A 20 20 0 0 1 20 0" fill="none" stroke="${template.accentColor || '#b45309'}" stroke-width="1.2"/>
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#seigaihaV)" />
                    </svg>

                    <!-- Header -->
                    <div class="id-portrait-header" style="background: ${template.headerBgColor || '#78350f'}; border-bottom: 2px solid ${template.accentColor || '#b45309'}; color: #ffffff; height: 65px; display: flex; align-items: center; justify-content: space-between; padding: 6px 14px; box-sizing: border-box; z-index: 2; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; margin-right: 6px;">
                            <div class="id-portrait-logo" style="width: ${Math.min(logoSize, 38)}px; height: ${Math.min(logoSize, 38)}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;">
                                ${logoHtml}
                            </div>
                            <div class="id-portrait-brand" style="flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                                <h1 class="id-portrait-title" style="color: #ffffff; font-size: ${Math.min(headerFontSize, 12)}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.15; font-family: ${template.font || "'Playfair Display', Georgia, serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                                <p class="id-portrait-subtitle" style="color: rgba(255,255,255,0.85); font-size: ${Math.max(6, Math.min(headerFontSize * 0.55, 8))}px; margin: 1px 0 0 0; text-transform: uppercase; line-height: 1.15; font-family: ${template.font || "'Playfair Display', Georgia, serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                            </div>
                        </div>
                        <div class="id-portrait-type-wrapper" style="flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; line-height: 1.05;">
                            <span class="id-portrait-type-badge" style="background: rgba(253, 230, 138, 0.15); border: 1px solid rgba(253, 230, 138, 0.4); font-family: 'Playfair Display', Georgia, serif; font-size: 8px; font-weight: 700; color: #fde68a; text-transform: uppercase; letter-spacing: 0.6px; padding: 2px 6px; border-radius: 4px; white-space: nowrap; display: inline-block;">
                                ${rawCardTitle}
                            </span>
                        </div>
                    </div>

                    <!-- Photo Cutout -->
                    ${showPhoto ? `
                    <div style="display: flex; justify-content: center; width: 100%; margin: 6px 0 2px 0; z-index: 2;">
                        <div class="id-portrait-photo-box" style="${photoContainerStyle}">
                            ${photoHtml}
                        </div>
                    </div>` : ''}

                    <!-- Name & Designation -->
                    <div style="text-align: center; width: 100%; z-index: 2; margin-bottom: 4px; padding: 0 10px; box-sizing: border-box;">
                        ${nameBlockHtml}
                        ${showDesignation ? `
                        <h3 class="id-portrait-designation" style="color: ${template.accentColor || '#b45309'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${cleanTextVal(emp.designation)}
                        </h3>` : ''}
                    </div>

                    <!-- Details Table -->
                    <div style="padding: 0 14px; width: 100%; box-sizing: border-box; z-index: 2; flex-grow: 1; display: flex; flex-direction: column;">
                        <div style="background: rgba(120, 53, 15, 0.03); border: 1px solid rgba(120, 53, 15, 0.08); border-radius: 8px; padding: 4px 10px; width: 100%; box-sizing: border-box; margin-bottom: auto;">
                            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                                ${cleanDetailsRowsHtml}
                            </table>
                        </div>
                    </div>

                    <!-- Bottom Section -->
                    <div style="padding: 2px 14px 6px 14px; width: 100%; box-sizing: border-box; z-index: 2; margin-top: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%; margin-bottom: 4px;">
                            ${getQrHtml(48)}
                            <div style="flex-grow: 1; padding: 0 6px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                                ${getNoticeHtml(true)}
                            </div>
                            ${getSigHtml('80px', '25px')}
                        </div>
                        ${showBarcode ? `
                        <div style="width: 100%; display: flex; justify-content: ${barcodePosition === 'bottom-left' ? 'flex-start' : barcodePosition === 'bottom-right' ? 'flex-end' : 'center'}; align-items: center; margin: 3px 0 4px 0;">
                            <div style="background: #ffffff; padding: 2px 8px; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.08); display: inline-flex; align-items: center; justify-content: center;">
                                ${getBarcodeHtml('145px', '18px')}
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            </div>`;
        }

        // Classic Fallback (Vertical)
        return `
        <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
            <!-- SINGLE-SIDED VERTICAL ID CARD -->
            <div class="id-card-portrait visual-id-card-render" style="font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; ${bgStyle} border: 2px solid ${template.accentColor || '#dfba5f'}; display: flex; flex-direction: column; justify-content: flex-start; height: 500px; width: 320px; box-sizing: border-box; overflow: hidden; position: relative; background: #ffffff;">
                <!-- Header -->
                <div class="id-portrait-header" style="background: ${template.headerBgColor || '#0e3e2b'}; border-bottom: 2px solid ${template.accentColor || '#dfba5f'}; color: ${headerTextColor}; height: ${headerHeight}px; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 0 10px; margin: -15px -15px 10px -15px; border-radius: 10px 10px 0 0; box-sizing: border-box; overflow: hidden; flex-shrink: 0;">
                    <div class="id-portrait-logo" style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                        ${logoHtml}
                    </div>
                    <div class="id-portrait-brand" style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;">
                        <h1 class="id-portrait-title" style="color: ${headerTextColor}; font-size: ${headerFontSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: 1.2; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${template.headerText || 'VALLEY SECURITY AGENCY'}</h1>
                        <p class="id-portrait-subtitle" style="color: ${headerSubtextColor}; font-size: ${Math.max(6, headerFontSize * 0.58)}px; margin: 2px 0 0 0; text-transform: uppercase; line-height: 1.2; font-family: ${template.font || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; opacity: 0.9;">${template.subheaderText || 'SHAHIDGUNJ SRINAGAR'}</p>
                    </div>
                </div>

                <!-- Body Content Split -->
                <div style="display: flex; gap: 10px; flex-grow: 1; min-height: 0; align-items: stretch; margin-top: 5px; padding: 0 4px;">
                    <!-- Left column: Photo, QR Code, Signature -->
                    <div style="width: ${Math.max(85, photoWidth, qrSize)}px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; flex-shrink: 0;">
                        ${showPhoto ? `
                        <div class="id-portrait-photo-box" style="${photoContainerStyle} margin-bottom: 5px;">
                            ${photoHtml}
                        </div>
                        ` : ''}
                        
                        ${showQrCode ? `
                        <div class="id-portrait-qr" style="width: ${qrSize}px; height: ${qrSize}px; background: #ffffff; padding: 3px; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); border: 1px solid rgba(128,128,128,0.2); display: flex; align-items: center; justify-content: center; margin-bottom: 5px; flex-shrink: 0;">
                            <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${qrSize - 6}" style="width: ${qrSize - 6}px; height: ${qrSize - 6}px; display: block;"></canvas>
                        </div>
                        ` : ''}
                        
                        <div style="width: ${Math.max(85, photoWidth)}px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: auto;">
                            <div style="height: 30px; width: 100%; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                                ${sigHtml}
                            </div>
                            <span style="font-size: 6px; color: ${subtextColor}; text-transform: uppercase; font-weight: bold; margin-top: 2px; text-align: center; white-space: nowrap; width: 100%;">Authority Sig</span>
                        </div>
                    </div>
                    
                    <!-- Right column: Name, Designation, Details Table -->
                    <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column; justify-content: flex-start; padding-left: 6px; padding-right: 4px;">
                        <div style="margin-bottom: 6px; padding-bottom: 4px;">
                            ${nameBlockHtml}
                            ${showDesignation ? `
                            <h3 class="id-portrait-designation" style="color: ${template.accentColor || '#dfba5f'}; font-size: ${designationFontSize}px; font-weight: 700; margin: 2px 0 0 0; white-space: normal; line-height: 1.1; word-break: break-word; letter-spacing: 0.5px;">
                                ${cleanTextVal(emp.designation)}
                            </h3>
                            ` : ''}
                        </div>
                        
                        <div style="background: rgba(15, 23, 42, 0.025); border: 1px solid rgba(15, 23, 42, 0.07); border-radius: 8px; padding: 4px 8px; width: 100%; box-sizing: border-box; margin-bottom: 5px;">
                            <table class="id-portrait-table" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                                ${cleanDetailsRowsHtml}
                            </table>
                        </div>
                        
                        <div style="font-size: ${Math.max(4.5, detailsFontSize * 0.65)}px; color: ${subtextColor}; line-height: 1.2; margin-top: auto; padding: 4px; border-radius: 4px; background: rgba(128,128,128,0.06); border: 1px solid rgba(128,128,128,0.1); word-break: break-word;">
                            1. Card is VSA property, display on duty.<br>2. Return to Shaheed Gunj Srinagar 190001.
                        </div>
                    </div>
                </div>
                
                <!-- Barcode at the bottom -->
                ${showBarcode ? `
                <div style="width: 100%; display: flex; justify-content: ${barcodePosition === 'bottom-left' ? 'flex-start' : barcodePosition === 'bottom-right' ? 'flex-end' : 'center'}; align-items: center; height: 26px; padding: 0 10px; margin-top: 3px; margin-bottom: 5px; flex-shrink: 0; box-sizing: border-box;">
                    <div style="background: #ffffff; padding: 2px 6px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.12); border: 1px solid rgba(0,0,0,0.06); display: inline-flex; align-items: center; justify-content: center;">
                        <canvas class="barcode-canvas-rendered" data-barcode-val="${emp.id}" data-barcode-type="CODE128" style="width: 130px; height: 18px;"></canvas>
                    </div>
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
        const brandParent = titleEl ? titleEl.closest('.id-portrait-brand') : null;
        if (titleEl) {
            let originalSize = parseFloat(window.getComputedStyle(titleEl).fontSize) || 14;
            if (!titleEl.dataset.originalSize) {
                titleEl.dataset.originalSize = originalSize;
            }
            let size = originalSize;
            const targetWidth = (brandParent && brandParent.clientWidth > 30) ? brandParent.clientWidth : (titleEl.clientWidth || (isHorizontal ? 400 : 160));
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
            const targetWidth = (brandParent && brandParent.clientWidth > 30) ? brandParent.clientWidth : (subtitleEl.clientWidth || (isHorizontal ? 400 : 160));
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

        // Fit Type Badge (SECURITY ID CARD / STAFF IDENTITY CARD)
        const typeBadgeEl = card.querySelector('.id-portrait-type-badge');
        if (typeBadgeEl) {
            let originalSize = parseFloat(window.getComputedStyle(typeBadgeEl).fontSize) || 8;
            if (!typeBadgeEl.dataset.originalSize) {
                typeBadgeEl.dataset.originalSize = originalSize;
            }
            let size = originalSize;
            const badgeWrapper = typeBadgeEl.parentElement;
            const maxBadgeWidth = (badgeWrapper && badgeWrapper.clientWidth > 20) ? badgeWrapper.clientWidth : 110;
            while (typeBadgeEl.scrollWidth > maxBadgeWidth + 2 && size > 6.0) {
                size -= 0.5;
                typeBadgeEl.style.fontSize = size + 'px';
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
            const parentWidth = nameEl.parentElement ? nameEl.parentElement.clientWidth : 0;
            const targetWidth = (parentWidth && parentWidth > 50) ? parentWidth : (nameEl.clientWidth || (isHorizontal ? 240 : 200));
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
            if (valEl.style.whiteSpace === 'normal' || valEl.style.overflowWrap === 'break-word') {
                return; // Skip wrapped / multi-line values so they are not forced to nowrap
            }
            const style = window.getComputedStyle(valEl);
            if (style.whiteSpace === 'nowrap' || valEl.style.whiteSpace === 'nowrap' || valEl.style.textOverflow === 'ellipsis') {
                let originalSize = parseFloat(style.fontSize) || 8;
                if (!valEl.dataset.originalSize) {
                    valEl.dataset.originalSize = originalSize;
                }
                let size = originalSize;
                const targetWidth = (valEl.clientWidth && valEl.clientWidth > 50) ? valEl.clientWidth : (isHorizontal ? 175 : 110);
                
                // Temporarily force nowrap for accurate measurement
                const origWhiteSpace = valEl.style.whiteSpace;
                valEl.style.whiteSpace = 'nowrap';
                
                while (valEl.scrollWidth > targetWidth + 2 && size > 7.0) {
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
        const level = canvas.getAttribute('data-qr-level') || 'M';
        // High-DPI support: render at 2x resolution for razor-sharp printing and canvas export
        const scale = 2;
        canvas.width = size * scale;
        canvas.height = size * scale;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        try {
            new QRious({
                element: canvas,
                value: val,
                size: size * scale,
                background: bg,
                foreground: fg,
                level: level,
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
    showToast(`Employee ${empId} status set to ${status}.`);
    try {
        const response = await fetch(`/api/employees/${encodeURIComponent(empId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emp)
        });
        if (!response.ok) throw new Error("Sync failure");
    } catch (err) {
        console.error("Error saving card status:", err);
        showToast("Error updating status on server.");
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

    const activeSurface = VSA_STATE.singleCardPreviewSurface || 'front';
    container.innerHTML = generateIdCardHtml(emp, template, validityYears, issueDateVal, activeSurface);
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
   6B. DD/MM/YYYY CUSTOM DATE INPUT & PICKER SYNCHRONIZATION CONTROLLER
   ========================================================================== */
function setupDmyDateInputs() {
    const dmyInputs = document.querySelectorAll('.dmy-date-input, input[data-date-format="dmy"]');
    dmyInputs.forEach(input => initDmyDateInput(input));
}

function initDmyDateInput(input) {
    if (!input || input.dataset.dmyInitialized === 'true') return;
    input.dataset.dmyInitialized = 'true';

    const wrapper = input.closest('.dmy-date-wrapper');
    const calendarBtn = wrapper ? wrapper.querySelector('.dmy-calendar-btn') : null;
    let hiddenPicker = wrapper ? wrapper.querySelector('.dmy-native-hidden') : null;

    if (!hiddenPicker) {
        hiddenPicker = document.createElement('input');
        hiddenPicker.type = 'date';
        hiddenPicker.className = 'dmy-native-hidden';
        hiddenPicker.tabIndex = -1;
        hiddenPicker.setAttribute('aria-hidden', 'true');
        if (wrapper) wrapper.appendChild(hiddenPicker);
        else input.parentNode.insertBefore(hiddenPicker, input.nextSibling);
    }

    const nativeDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');

    // Helper: format user-typed digits into DD/MM/YYYY
    function formatRawToDmy(raw, isDelete) {
        const clean = (raw || '').replace(/[^\d/]/g, '');
        let digits = clean.replace(/\D/g, '').slice(0, 8);
        if (isDelete && raw && raw.endsWith('/')) {
            digits = digits.slice(0, -1);
        }
        if (!digits) return '';
        if (digits.length <= 2) return digits;
        if (digits.length <= 4) return digits.slice(0, 2) + '/' + digits.slice(2);
        return digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4);
    }

    // Helper: Expand 2-digit year on blur (e.g., 20/08/95 -> 20/08/1995)
    function normalizeDmyString(str) {
        if (!str) return '';
        const match = str.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
        if (!match) return str;
        const d = match[1].padStart(2, '0');
        const m = match[2].padStart(2, '0');
        let y = match[3];
        if (y.length === 2) {
            const num = parseInt(y, 10);
            y = num > 30 ? `19${y}` : `20${y}`;
        }
        return `${d}/${m}/${y}`;
    }

    // Helper: Convert DD/MM/YYYY to ISO YYYY-MM-DD
    function dmyToIsoStr(dmyStr) {
        if (!dmyStr) return '';
        const normalized = normalizeDmyString(dmyStr);
        const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) return '';
        const d = match[1].padStart(2, '0');
        const m = match[2].padStart(2, '0');
        const y = match[3];
        const day = parseInt(d, 10);
        const month = parseInt(m, 10);
        const year = parseInt(y, 10);
        if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
            return '';
        }
        return `${y}-${m}-${d}`;
    }

    // Helper: Convert ISO YYYY-MM-DD to DD/MM/YYYY
    function isoToDmyStr(isoStr) {
        if (!isoStr) return '';
        const match = String(isoStr).trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (!match) return '';
        const [, y, m, d] = match;
        return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
    }

    // Intercept .value property so JS callers receive ISO YYYY-MM-DD while user sees DD/MM/YYYY
    Object.defineProperty(input, 'value', {
        get: function() {
            const currentDisplay = nativeDesc.get.call(this).trim();
            if (!currentDisplay) return '';
            
            // If already ISO format YYYY-MM-DD
            if (/^\d{4}-\d{2}-\d{2}$/.test(currentDisplay)) {
                return currentDisplay;
            }
            // Parse DD/MM/YYYY or DD-MM-YYYY to ISO
            const iso = dmyToIsoStr(currentDisplay);
            if (iso) return iso;

            // Fallback: return raw display value
            return currentDisplay;
        },
        set: function(val) {
            if (val === null || val === undefined) val = '';
            val = String(val).trim();

            if (!val) {
                nativeDesc.set.call(this, '');
                if (hiddenPicker) hiddenPicker.value = '';
                return;
            }

            // If passed YYYY-MM-DD (ISO)
            if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(val)) {
                const dmy = isoToDmyStr(val);
                nativeDesc.set.call(this, dmy);
                const iso = dmyToIsoStr(dmy);
                if (hiddenPicker && iso) hiddenPicker.value = iso;
                return;
            }

            // If passed DD/MM/YYYY or DD/MM/YY
            const normalized = normalizeDmyString(val);
            const iso = dmyToIsoStr(normalized);
            if (iso) {
                const dmy = isoToDmyStr(iso);
                nativeDesc.set.call(this, dmy);
                if (hiddenPicker) hiddenPicker.value = iso;
                return;
            }

            // Fallback
            nativeDesc.set.call(this, val);
        },
        configurable: true,
        enumerable: true
    });

    // Masking on typing ('input' event)
    input.addEventListener('input', function(e) {
        const isDelete = e.inputType === 'deleteContentBackward';
        const raw = nativeDesc.get.call(this);
        const formatted = formatRawToDmy(raw, isDelete);
        nativeDesc.set.call(this, formatted);

        if (formatted.length === 10) {
            const iso = dmyToIsoStr(formatted);
            if (iso) {
                this.setCustomValidity('');
                if (hiddenPicker) hiddenPicker.value = iso;
                this.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                this.setCustomValidity('Please enter a valid date in DD/MM/YYYY format');
            }
        } else {
            this.setCustomValidity('');
        }
    });

    // Expand 2-digit year and reformat on blur
    input.addEventListener('blur', function() {
        const raw = nativeDesc.get.call(this);
        if (!raw) {
            this.setCustomValidity('');
            return;
        }
        const normalized = normalizeDmyString(raw);
        if (normalized !== raw) {
            nativeDesc.set.call(this, normalized);
        }
        const iso = dmyToIsoStr(normalized);
        if (iso) {
            this.setCustomValidity('');
            if (hiddenPicker) hiddenPicker.value = iso;
            this.dispatchEvent(new Event('change', { bubbles: true }));
        } else if (normalized.length >= 8) {
            this.setCustomValidity('Please enter a valid date in DD/MM/YYYY format');
        }
    });

    // Calendar button trigger
    if (calendarBtn) {
        calendarBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            if (hiddenPicker) {
                const currentIso = input.value;
                if (currentIso && /^\d{4}-\d{2}-\d{2}$/.test(currentIso)) {
                    hiddenPicker.value = currentIso;
                }
                if (typeof hiddenPicker.showPicker === 'function') {
                    try {
                        hiddenPicker.showPicker();
                    } catch (err) {
                        hiddenPicker.focus();
                        hiddenPicker.click();
                    }
                } else {
                    hiddenPicker.focus();
                    hiddenPicker.click();
                }
            }
        });
    }

    // Sync from hidden native picker when date is chosen via calendar popup
    if (hiddenPicker) {
        hiddenPicker.addEventListener('change', function() {
            if (this.value) {
                input.value = this.value;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
}

/* ==========================================================================
   7. EVENT HANDLERS & BACKUPS
   ========================================================================== */
function setupEventHandlers() {
    setupDmyDateInputs();
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

    // Auto-calculate age listener when reg-dob changes or complete date is typed
    const regDobEl = document.getElementById('reg-dob');
    if (regDobEl) {
        const calculateAgeFromDob = function() {
            const dobVal = regDobEl.value;
            if (dobVal) {
                let dobDate;
                if (/^\d{4}-\d{2}-\d{2}$/.test(dobVal)) {
                    const [y, m, d] = dobVal.split('-').map(Number);
                    dobDate = new Date(y, m - 1, d);
                } else if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(dobVal)) {
                    const parts = dobVal.split('/').map(Number);
                    let y = parts[2];
                    if (y < 100) y += y > 30 ? 1900 : 2000;
                    dobDate = new Date(y, parts[1] - 1, parts[0]);
                } else {
                    dobDate = new Date(dobVal);
                }
                if (!isNaN(dobDate.getTime())) {
                    const today = new Date();
                    let age = today.getFullYear() - dobDate.getFullYear();
                    const m = today.getMonth() - dobDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) {
                        age--;
                    }
                    const ageEl = document.getElementById('reg-age');
                    if (ageEl) ageEl.value = age > 0 ? age : '';
                } else {
                    const ageEl = document.getElementById('reg-age');
                    if (ageEl) ageEl.value = '';
                }
            } else {
                const ageEl = document.getElementById('reg-age');
                if (ageEl) ageEl.value = '';
            }
        };
        regDobEl.addEventListener('change', calculateAgeFromDob);
        regDobEl.addEventListener('input', function() {
            if (this.value && (this.value.length === 10 || /^\d{4}-\d{2}-\d{2}$/.test(this.value))) {
                calculateAgeFromDob();
            }
        });
    }

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

    // ID Card Renewal Modal Handlers
    const modalRenewal = document.getElementById('modal-card-renewal');
    const btnCloseRenewal = document.getElementById('btn-close-card-renewal');
    const btnCancelRenewal = document.getElementById('btn-cancel-card-renewal');
    const inputRenewalFee = document.getElementById('renewal-fee');
    const btnSubmitRenewal = document.getElementById('btn-submit-card-renewal');

    const closeRenewalModal = () => {
        if (modalRenewal) modalRenewal.classList.add('hidden');
    };

    if (btnCloseRenewal) btnCloseRenewal.addEventListener('click', closeRenewalModal);
    if (btnCancelRenewal) btnCancelRenewal.addEventListener('click', closeRenewalModal);

    if (inputRenewalFee && btnSubmitRenewal) {
        inputRenewalFee.addEventListener('input', function() {
            const fee = parseInt(this.value) || 0;
            btnSubmitRenewal.textContent = `Confirm & Renew (₹${fee})`;
        });
    }

    if (btnSubmitRenewal) {
        btnSubmitRenewal.addEventListener('click', async () => {
            const empId = document.getElementById('renewal-emp-id').value;
            const termSelect = document.getElementById('renewal-term');
            const validityYears = parseInt(termSelect.value) || 3;
            const renewalFee = parseFloat(inputRenewalFee.value) || 0;
            const paymentMethod = document.getElementById('renewal-notes').value.trim();

            if (!empId) return;

            btnSubmitRenewal.disabled = true;
            btnSubmitRenewal.textContent = '⏳ Processing...';

            try {
                const response = await fetch(`/api/employees/${empId}/renew-card`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ validityYears, renewalFee, paymentMethod })
                });

                const result = await response.json();
                if (result.success) {
                    alert(result.message);
                    closeRenewalModal();
                    
                    // Trigger global fetchData to refresh stats, directories, alerts
                    await fetchData();
                } else {
                    alert(result.error || 'Failed to renew ID card.');
                    btnSubmitRenewal.disabled = false;
                    btnSubmitRenewal.textContent = `Confirm & Renew (₹${renewalFee})`;
                }
            } catch (err) {
                console.error(err);
                alert('Connection error occurred while renewing card.');
                btnSubmitRenewal.disabled = false;
                btnSubmitRenewal.textContent = `Confirm & Renew (₹${renewalFee})`;
            }
        });
    }

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
async function exportFullDatabase() {
    try {
        const response = await fetch('/api/db');
        const dbData = response.ok ? await response.json() : VSA_STATE;
        const blob = new Blob([JSON.stringify(dbData, null, 2)], { type: 'application/json' });
        const blobUrl = URL.createObjectURL(blob);
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", blobUrl);
        dlAnchorElem.setAttribute("download", `VSA_Database_Backup_${new Date().toISOString().substring(0, 10)}.json`);
        document.body.appendChild(dlAnchorElem);
        dlAnchorElem.click();
        document.body.removeChild(dlAnchorElem);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
    } catch (err) {
        console.error("Backup export failed:", err);
    }
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
    currentRegistrationMode = 'add';
    currentRegistrationEmpId = null;
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

    // Clear DMY date inputs, pickers, and age
    ['reg-dob', 'reg-joining-date', 'reg-card-issue-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.setCustomValidity('');
        }
    });
    const ageInput = document.getElementById('reg-age');
    if (ageInput) ageInput.value = '';
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
        document.getElementById('reg-photo-preview').innerHTML = `<img src="${emp.documents.photo}" alt="Registration Photo Preview" style="max-height: 100px;">`;
    } else {
        document.getElementById('reg-photo-preview').innerHTML = '<span class="preview-placeholder">Click to upload photo</span>';
    }
    if (emp.documents?.signature) {
        document.getElementById('reg-signature-preview').innerHTML = `<img src="${getProcessedSignature(emp.documents.signature)}" alt="Registration Signature Preview" style="max-height: 100px;">`;
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
        const isEdit = (currentRegistrationMode === 'edit' && !!empId);
        const method = isEdit ? 'PUT' : 'POST';
        const endpoint = isEdit ? `/api/employees/${empId}` : '/api/employees';
        
        const response = await fetch(endpoint, {
            method: method,
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(empData)
        });
        
        if (!response.ok) {
            let errorMsg = `Server error (${response.status})`;
            try {
                const errData = await response.json();
                if (errData && (errData.error || errData.message)) {
                    errorMsg = errData.error || errData.message;
                }
            } catch (parseErr) {
                try {
                    const textErr = await response.text();
                    if (textErr && textErr.length < 200) errorMsg = textErr;
                } catch (_) {}
            }

            if (response.status === 401) {
                alert('Your session has expired. Please log in again.');
                sessionStorage.removeItem('currentUser');
                window.location.href = '/login.html';
                return;
            }

            throw new Error(errorMsg);
        }

        let savedEmp = null;
        try {
            savedEmp = await response.json();
        } catch (_) {}
        const effectiveId = (savedEmp && savedEmp.id) ? savedEmp.id : (empId || empData.id);
        
        alert(`Employee ${isEdit ? 'updated' : 'registered'} successfully!`);
        await fetchData();
        
        // Show ID card generation for new employee
        if (!isEdit) {
            resetRegistrationForm();
            const selectEl = document.getElementById('id-select-employee');
            if (selectEl) {
                selectEl.value = effectiveId;
            }
            if (typeof loadIdCardDetails === 'function') {
                loadIdCardDetails(effectiveId);
            }
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
                allowTaint: false,
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
            allowTaint: false,
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
                    allowTaint: false,
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
            allowTaint: false,
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
            const avatarHtml = photoSrc ? `<img src="${photoSrc}" alt="${escapeHtml(emp.name || 'Employee')} Avatar" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.onerror=null; this.src='/api/employees/default-avatar.svg';">` : `<i data-lucide="user" style="width: 12px; height: 12px; color: var(--text-muted);"></i>`;

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
                    allowTaint: false,
                    backgroundColor: '#ffffff',
                    logging: false,
                    letterRendering: true
                });
                
                const dataUrl = canvas.toDataURL('image/png');
                if (dataUrl && dataUrl.startsWith('data:image/png;base64,')) {
                    const base64Data = dataUrl.split(',')[1];
                    const filename = `VSA_ID_${emp.id}_${emp.name.replace(/\s+/g, '_')}.png`;
                    zip.file(filename, base64Data, {base64: true});
                    renderCount++;
                } else {
                    console.error(`Invalid PNG data URL generated for employee ${emp.id}`);
                }
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
            fontFamily: "'Plus Jakarta Sans', sans-serif",
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
            fontFamily: "'Plus Jakarta Sans', sans-serif",
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
            fontFamily: "'Plus Jakarta Sans', sans-serif",
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
            fontFamily: "'Plus Jakarta Sans', sans-serif",
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
            fontFamily: "'Plus Jakarta Sans', sans-serif",
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
        tbody.innerHTML = '<tr><td colspan="4" class="text-center placeholder-message">No templates registered yet.</td></tr>';
        return;
    }

    VSA_STATE.templates.forEach(t => {
        const row = document.createElement('tr');
        const isDefault = t.id === 'tpl-default';
        row.innerHTML = `
            <td><strong>${escapeHtml(t.name)}</strong> ${isDefault ? '<span class="badge badge-active" style="padding: 2px 6px; font-size: 9px; margin-left: 5px;">Default</span>' : ''}</td>
            <td><span class="badge" style="background: rgba(255,255,255,0.05); color: #ffffff;">${t.layout === 'vertical' ? 'Vertical' : 'Horizontal'}</span></td>
            <td><span style="font-size: 11px; opacity: 0.85;">${escapeHtml(t.headerText || '-')}</span></td>
            <td>
                <div class="d-flex gap-2">
                    <button class="btn btn-xs btn-outline btn-edit-template" data-id="${escapeHtml(t.id)}">Edit</button>
                    ${!isDefault ? `<button class="btn btn-xs btn-outline btn-delete-template" data-id="${escapeHtml(t.id)}" style="color: var(--status-suspended); border-color: rgba(255, 46, 147, 0.15)">Delete</button>` : ''}
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

// ============================================================================
// PROJECT OMEGA — UNIVERSAL INTELLIGENT CANVAS ENGINE (UICE)
// Figma / Canva Grade Visual ID Card Studio & Manipulation Engine
// ============================================================================

const UICE_STATE = {
    template: null,
    orientation: 'horizontal', // 'horizontal' | 'vertical' | 'custom'
    surface: 'front', // 'front' | 'back'
    initialSnapshots: null,
    selectedId: null,
    hoveredId: null,
    zoom: 1.0,
    snapToGrid: true,
    gridSize: 10,
    showGuides: true,
    showGrid: false,
    showSafeMargins: false,
    showBleedArea: false,
    showElementOutlines: false,
    showPrintProofing: false,
    history: [],
    historyIndex: -1,
    previewEmp: null,
    pan: {
        isPanning: false,
        startX: 0,
        startY: 0,
        scrollLeft: 0,
        scrollTop: 0
    },
    drag: {
        isDragging: false,
        isResizing: false,
        isRotating: false,
        handle: null,
        startX: 0,
        startY: 0,
        origX: 0,
        origY: 0,
        origW: 0,
        origH: 0,
        origRot: 0,
        centerX: 0,
        centerY: 0,
        startAngle: 0,
        hasMoved: false
    }
};

/**
 * Returns default UICE element nodes for a given orientation.
 */
function getUiceDefaultElements(orientation, tpl = {}) {
    const isHoriz = orientation === 'horizontal';
    const cardTheme = tpl.cardTheme || 'classic';
    const headerBg = tpl.headerBgColor || (cardTheme === 'organic-wave' ? '#0d7a6e' : '#0e3e2b');
    const accent = tpl.accentColor || (cardTheme === 'organic-wave' ? '#009688' : '#009688');
    const brandTitle = tpl.headerText || 'VALLEY SECURITY AGENCY';
    const brandSubtitle = tpl.subheaderText || 'SHAHIDGUNJ SRINAGAR';
    const cardTitle = tpl.cardTitle || (tpl.name && tpl.name.toUpperCase().includes('STUDENT') ? 'STUDENT ID CARD' : 'SECURITY ID CARD');
    const photoDim = Math.min(tpl.photoWidth || 115, tpl.photoHeight || 115, isHoriz ? 125 : 100);
    const photoShape = tpl.photoShape || 'circle';

    if (isHoriz) {
        if (cardTheme === 'organic-wave') {
            const isQrUnderPhoto = tpl.barcodePosition === 'bottom-center' || tpl.qrPosition === 'bottom-left' || (tpl.name && tpl.name.toLowerCase().includes('office')) || tpl.id === 'tpl-office';
            return [
                // 1. Top Fluid Waves Header with Gradient
                {
                    id: 'uice-shape-wave-top',
                    type: 'svg-wave-top',
                    name: 'Fluid Wave Header',
                    x: 0,
                    y: 0,
                    width: 500,
                    height: 120,
                    rotation: 0,
                    zIndex: 1,
                    locked: true,
                    visible: true,
                    properties: {
                        headerBgColor: headerBg,
                        accentColor: accent,
                        opacity: 1
                    }
                },
                // 2. Harmonic Guilloche Security Wave Lines
                {
                    id: 'uice-shape-guilloche',
                    type: 'guilloche-waves',
                    name: 'Guilloche Security Waves',
                    x: 0,
                    y: 0,
                    width: 500,
                    height: 320,
                    rotation: 0,
                    zIndex: 0,
                    locked: true,
                    visible: true,
                    properties: {
                        color: accent,
                        opacity: 0.10
                    }
                },
                // 3. Bottom Accent Wave
                {
                    id: 'uice-shape-wave-bottom',
                    type: 'svg-wave-bottom',
                    name: 'Accent Wave (Bottom)',
                    x: 0,
                    y: 278,
                    width: 500,
                    height: 42,
                    rotation: 0,
                    zIndex: 0,
                    locked: true,
                    visible: true,
                    properties: {
                        headerBgColor: headerBg,
                        accentColor: accent,
                        opacity: 1
                    }
                },
                // 4. Agency Header (Brand Logo + Title + Subtitle)
                {
                    id: 'uice-elem-header',
                    type: 'agency-brand',
                    name: 'Agency Header',
                    x: 16,
                    y: 8,
                    width: 290,
                    height: 40,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        title: brandTitle,
                        subtitle: brandSubtitle,
                        titleFontSize: Math.min(tpl.headerFontSize || 11.5, 11.5),
                        subtitleFontSize: 6.2,
                        fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                        color: '#ffffff',
                        logoSize: 34,
                        logoPreset: tpl.logo || 'preset-vsa-logo'
                    }
                },
                // 5. Card Title Display (Serif typography, White, Text Shadow)
                {
                    id: 'uice-elem-badge',
                    type: 'badge-pill',
                    name: 'Card Title Display',
                    x: 316,
                    y: 10,
                    width: 168,
                    height: 36,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        text: cardTitle,
                        background: 'transparent',
                        color: '#ffffff',
                        fontSize: 18,
                        fontWeight: 800,
                        fontFamily: "'Playfair Display', Georgia, serif",
                        textAlign: 'right',
                        letterSpacing: 0.8
                    }
                },
                // 6. Employee Photo (Positioned comfortably down below top wave)
                {
                    id: 'uice-elem-photo',
                    type: 'employee-photo',
                    name: 'Employee Photo',
                    x: 18,
                    y: 72 + (tpl.photoTopOffset !== undefined ? tpl.photoTopOffset : (isQrUnderPhoto ? 12 : 0)),
                    width: photoDim,
                    height: photoDim,
                    rotation: 0,
                    zIndex: 3,
                    locked: false,
                    visible: true,
                    properties: {
                        shape: photoShape,
                        borderWidth: 3.5,
                        borderColor: '#ffffff',
                        outlineColor: accent,
                        objectFit: 'cover'
                    }
                },
                // 7. Barcode (under details table when isQrUnderPhoto, else under photo)
                {
                    id: 'uice-elem-barcode',
                    type: 'barcode',
                    name: 'Employee Barcode',
                    x: isQrUnderPhoto ? 160 : 14,
                    y: isQrUnderPhoto ? 248 : 202,
                    width: isQrUnderPhoto ? 140 : 124,
                    height: 28,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        format: 'CODE128',
                        lineColor: '#000000',
                        background: '#ffffff',
                        showText: true,
                        fontSize: 8.5
                    }
                },
                // 8. Employee Full Name
                {
                    id: 'uice-elem-name',
                    type: 'employee-name',
                    name: 'Employee Name',
                    x: 154,
                    y: 64,
                    width: 330,
                    height: 26,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        fontSize: tpl.nameFontSize || 17,
                        fontWeight: 800,
                        fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                        color: '#0f172a',
                        textAlign: 'left',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4
                    }
                },
                // 9. Employee Designation
                {
                    id: 'uice-elem-designation',
                    type: 'designation',
                    name: 'Designation',
                    x: 154,
                    y: 92,
                    width: 330,
                    height: 20,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        fontSize: tpl.designationFontSize || 10.5,
                        fontWeight: 700,
                        fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                        color: accent,
                        textAlign: 'left',
                        textTransform: 'uppercase',
                        letterSpacing: 0.6
                    }
                },
                // 10. Details Table (Emp ID, Father, Dept, Blood, Validity, Address, Mobile)
                {
                    id: 'uice-elem-details-table',
                    type: 'details-table',
                    name: 'Details Table',
                    x: 154,
                    y: 114,
                    width: 330,
                    height: 120,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        fontSize: tpl.detailsFontSize || 8.5,
                        labelColor: tpl.labelColor || '#475569',
                        valueColor: tpl.valueColor || (isQrUnderPhoto ? '#c8102e' : '#0f172a'),
                        rowPadding: tpl.rowPadding || 2.5,
                        labelWidth: tpl.labelWidth || 38,
                        fields: tpl.fieldOrder || ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone']
                    }
                },
                // 11. Authority Signature
                {
                    id: 'uice-elem-signature',
                    type: 'signature',
                    name: 'Authority Signature',
                    x: isQrUnderPhoto ? 345 : 165,
                    y: isQrUnderPhoto ? 246 : 258,
                    width: isQrUnderPhoto ? 120 : 100,
                    height: 46,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        preset: tpl.signature || 'preset-vsa-sig',
                        color: '#000000',
                        label: 'AUTHORITY SIGNATURE'
                    }
                },
                // 12. Official Verification QR Code
                {
                    id: 'uice-elem-qr',
                    type: 'qr-code',
                    name: 'Verification QR Code',
                    x: isQrUnderPhoto ? 44 : 432,
                    y: isQrUnderPhoto ? 195 : 250,
                    width: isQrUnderPhoto ? (tpl.qrSize || 62) : (tpl.qrSize || 48),
                    height: isQrUnderPhoto ? (tpl.qrSize || 62) : (tpl.qrSize || 48),
                    rotation: 0,
                    zIndex: 3,
                    locked: false,
                    visible: true,
                    properties: {
                        errorCorrection: 'H',
                        foreground: '#000000',
                        background: '#ffffff',
                        quietZone: 2,
                        borderColor: accent,
                        borderWidth: 1.5
                    }
                },
                // 13. Official VSA Scan Caption
                {
                    id: 'uice-elem-qr-caption',
                    type: 'custom-text',
                    name: 'QR Verify Caption',
                    x: 348,
                    y: 255,
                    width: 78,
                    height: 38,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: !isQrUnderPhoto,
                    properties: {
                        text: 'OFFICIAL VSA\nSCAN TO VERIFY',
                        fontSize: 6,
                        fontWeight: 800,
                        color: '#475569',
                        textAlign: 'right',
                        lineHeight: 1.2
                    }
                }
            ];
        }

        return [
            // 1. Top Decorative Accent Bar
            {
                id: 'uice-shape-top-bar',
                type: 'shape',
                name: 'Top Header Bar',
                x: 0,
                y: 0,
                width: 500,
                height: 52,
                rotation: 0,
                zIndex: 1,
                locked: true,
                visible: true,
                properties: {
                    fill: headerBg,
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 0,
                    opacity: 1
                }
            },
            // 2. Agency Header (Brand Logo + Title + Subtitle)
            {
                id: 'uice-elem-header',
                type: 'agency-brand',
                name: 'Agency Header',
                x: 14,
                y: 8,
                width: 290,
                height: 38,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    title: brandTitle,
                    subtitle: brandSubtitle,
                    titleFontSize: 12,
                    subtitleFontSize: 6.5,
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    color: '#ffffff',
                    logoSize: 32,
                    logoPreset: tpl.logo || 'preset-vsa-logo'
                }
            },
            // 3. Card Badge Title Pill
            {
                id: 'uice-elem-badge',
                type: 'badge-pill',
                name: 'Card Title Badge',
                x: 318,
                y: 12,
                width: 168,
                height: 28,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: cardTitle,
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#ffffff',
                    fontSize: 12,
                    fontWeight: 800,
                    borderRadius: 6
                }
            },
            // 4. Employee Photo
            {
                id: 'uice-elem-photo',
                type: 'employee-photo',
                name: 'Employee Photo',
                x: 18,
                y: 66,
                width: 114,
                height: 114,
                rotation: 0,
                zIndex: 3,
                locked: false,
                visible: true,
                properties: {
                    shape: 'circle',
                    borderWidth: 3.5,
                    borderColor: '#ffffff',
                    outlineColor: accent,
                    objectFit: 'cover'
                }
            },
            // 5. Barcode (under photo)
            {
                id: 'uice-elem-barcode',
                type: 'barcode',
                name: 'Employee Barcode',
                x: 14,
                y: 194,
                width: 122,
                height: 28,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    format: 'CODE128',
                    lineColor: '#000000',
                    background: '#ffffff',
                    showText: true,
                    fontSize: 8.5
                }
            },
            // 6. Employee Full Name
            {
                id: 'uice-elem-name',
                type: 'employee-name',
                name: 'Employee Name',
                x: 152,
                y: 66,
                width: 334,
                height: 30,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    fontSize: 16.5,
                    fontWeight: 800,
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    color: '#0f172a',
                    textAlign: 'left',
                    textTransform: 'uppercase',
                    letterSpacing: 0.3
                }
            },
            // 7. Employee Designation
            {
                id: 'uice-elem-designation',
                type: 'designation',
                name: 'Designation',
                x: 152,
                y: 96,
                width: 334,
                height: 20,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    color: accent,
                    textAlign: 'left',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                }
            },
            // 8. Details Table (Emp ID, Father, Dept, Blood, Validity, Address, Mobile)
            {
                id: 'uice-elem-details-table',
                type: 'details-table',
                name: 'Details Table',
                x: 152,
                y: 118,
                width: 334,
                height: 116,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    fontSize: 8,
                    labelColor: '#475569',
                    valueColor: '#0f172a',
                    rowPadding: 3,
                    labelWidth: 38,
                    fields: ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone']
                }
            },
            // 9. Authority Signature
            {
                id: 'uice-elem-signature',
                type: 'signature',
                name: 'Authority Signature',
                x: 240,
                y: 246,
                width: 115,
                height: 48,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    preset: tpl.signature || 'preset-vsa-sig',
                    color: '#000000',
                    label: 'AUTHORITY SIGNATURE'
                }
            },
            // 10. Official Verification QR Code
            {
                id: 'uice-elem-qr',
                type: 'qr-code',
                name: 'Verification QR Code',
                x: 424,
                y: 244,
                width: 54,
                height: 54,
                rotation: 0,
                zIndex: 3,
                locked: false,
                visible: true,
                properties: {
                    errorCorrection: 'H',
                    foreground: '#000000',
                    background: '#ffffff',
                    quietZone: 2,
                    borderColor: accent,
                    borderWidth: 1.5
                }
            }
        ];
    } else {
        // Vertical Orientation (320 x 500)
        if (cardTheme === 'organic-wave') {
            return [
                // 1. Top Fluid Waves Header with Gradient
                {
                    id: 'uice-shape-wave-top-v',
                    type: 'svg-wave-top',
                    name: 'Fluid Wave Header',
                    x: 0,
                    y: 0,
                    width: 320,
                    height: 130,
                    rotation: 0,
                    zIndex: 1,
                    locked: true,
                    visible: true,
                    properties: {
                        headerBgColor: headerBg,
                        accentColor: accent,
                        opacity: 1
                    }
                },
                // 2. Harmonic Guilloche Security Wave Lines
                {
                    id: 'uice-shape-guilloche-v',
                    type: 'guilloche-waves',
                    name: 'Guilloche Security Waves',
                    x: 0,
                    y: 0,
                    width: 320,
                    height: 500,
                    rotation: 0,
                    zIndex: 0,
                    locked: true,
                    visible: true,
                    properties: {
                        color: accent,
                        opacity: 0.10
                    }
                },
                // 3. Bottom Accent Wave
                {
                    id: 'uice-shape-wave-bottom-v',
                    type: 'svg-wave-bottom',
                    name: 'Accent Wave (Bottom)',
                    x: 0,
                    y: 460,
                    width: 320,
                    height: 40,
                    rotation: 0,
                    zIndex: 0,
                    locked: true,
                    visible: true,
                    properties: {
                        headerBgColor: headerBg,
                        accentColor: accent,
                        opacity: 1
                    }
                },
                // 4. Agency Header (Brand Logo + Title + Subtitle)
                {
                    id: 'uice-elem-header-v',
                    type: 'agency-brand',
                    name: 'Agency Header',
                    x: 10,
                    y: 8,
                    width: 300,
                    height: 46,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        title: brandTitle,
                        subtitle: brandSubtitle,
                        titleFontSize: 11.5,
                        subtitleFontSize: 6.5,
                        fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                        color: '#ffffff',
                        logoSize: 34,
                        logoPreset: tpl.logo || 'preset-vsa-logo'
                    }
                },
                // 5. Card Title Display
                {
                    id: 'uice-elem-badge-v',
                    type: 'badge-pill',
                    name: 'Card Title Display',
                    x: 60,
                    y: 56,
                    width: 200,
                    height: 26,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        text: cardTitle,
                        background: 'transparent',
                        color: '#ffffff',
                        fontSize: 13,
                        fontWeight: 800,
                        fontFamily: "'Playfair Display', Georgia, serif",
                        textAlign: 'center',
                        letterSpacing: 0.8
                    }
                },
                // 6. Employee Photo (Centered in Vertical)
                {
                    id: 'uice-elem-photo-v',
                    type: 'employee-photo',
                    name: 'Employee Photo',
                    x: 105,
                    y: 90,
                    width: 110,
                    height: 110,
                    rotation: 0,
                    zIndex: 3,
                    locked: false,
                    visible: true,
                    properties: {
                        shape: photoShape,
                        borderWidth: 3.5,
                        borderColor: '#ffffff',
                        outlineColor: accent,
                        objectFit: 'cover'
                    }
                },
                // 7. Employee Name
                {
                    id: 'uice-elem-name-v',
                    type: 'employee-name',
                    name: 'Employee Name',
                    x: 10,
                    y: 208,
                    width: 300,
                    height: 26,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        fontSize: tpl.nameFontSize || 15.5,
                        fontWeight: 800,
                        fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                        color: '#0f172a',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: 0.4
                    }
                },
                // 8. Designation
                {
                    id: 'uice-elem-designation-v',
                    type: 'designation',
                    name: 'Designation',
                    x: 10,
                    y: 234,
                    width: 300,
                    height: 20,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        fontSize: tpl.designationFontSize || 10,
                        fontWeight: 700,
                        fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                        color: accent,
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: 0.5
                    }
                },
                // 9. Details Table (Structured data card)
                {
                    id: 'uice-elem-details-table-v',
                    type: 'details-table',
                    name: 'Details Table',
                    x: 14,
                    y: 256,
                    width: 292,
                    height: 136,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        fontSize: tpl.detailsFontSize || 8,
                        labelColor: tpl.labelColor || '#475569',
                        valueColor: tpl.valueColor || '#0f172a',
                        rowPadding: tpl.rowPadding || 2.5,
                        labelWidth: 36,
                        fields: tpl.fieldOrder || ['empid', 'father', 'department', 'blood', 'validity', 'phone']
                    }
                },
                // 10. Authority Signature
                {
                    id: 'uice-elem-signature-v',
                    type: 'signature',
                    name: 'Authority Signature',
                    x: 18,
                    y: 396,
                    width: 110,
                    height: 46,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        preset: tpl.signature || 'preset-vsa-sig',
                        color: '#000000',
                        label: 'AUTHORITY SIGNATURE'
                    }
                },
                // 11. Official Verification QR Code
                {
                    id: 'uice-elem-qr-v',
                    type: 'qr-code',
                    name: 'Verification QR Code',
                    x: 236,
                    y: 394,
                    width: tpl.qrSize || 48,
                    height: tpl.qrSize || 48,
                    rotation: 0,
                    zIndex: 3,
                    locked: false,
                    visible: true,
                    properties: {
                        errorCorrection: 'H',
                        foreground: '#000000',
                        background: '#ffffff',
                        quietZone: 2,
                        borderColor: accent,
                        borderWidth: 1.5
                    }
                },
                // 12. Employee Barcode (Bottom Plate)
                {
                    id: 'uice-elem-barcode-v',
                    type: 'barcode',
                    name: 'Barcode Plate',
                    x: 20,
                    y: 446,
                    width: 280,
                    height: 32,
                    rotation: 0,
                    zIndex: 2,
                    locked: false,
                    visible: true,
                    properties: {
                        format: 'CODE128',
                        lineColor: '#000000',
                        background: '#ffffff',
                        showText: true,
                        fontSize: 8.5
                    }
                }
            ];
        }

        return [
            // 1. Top Decorative Header Bar
            {
                id: 'uice-shape-top-bar-v',
                type: 'shape',
                name: 'Top Header Bar',
                x: 0,
                y: 0,
                width: 320,
                height: 62,
                rotation: 0,
                zIndex: 1,
                locked: true,
                visible: true,
                properties: {
                    fill: headerBg,
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 0,
                    opacity: 1
                }
            },
            // 2. Agency Header
            {
                id: 'uice-elem-header-v',
                type: 'agency-brand',
                name: 'Agency Header',
                x: 10,
                y: 8,
                width: 300,
                height: 46,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    title: brandTitle,
                    subtitle: brandSubtitle,
                    titleFontSize: 11.5,
                    subtitleFontSize: 6.5,
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    color: '#ffffff',
                    logoSize: 34,
                    logoPreset: tpl.logo || 'preset-vsa-logo'
                }
            },
            // 3. Card Title Badge
            {
                id: 'uice-elem-badge-v',
                type: 'badge-pill',
                name: 'Card Title Badge',
                x: 60,
                y: 68,
                width: 200,
                height: 24,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: cardTitle,
                    background: accent,
                    color: '#ffffff',
                    fontSize: 10.5,
                    fontWeight: 800,
                    borderRadius: 4
                }
            },
            // 4. Employee Photo (Centered in Vertical)
            {
                id: 'uice-elem-photo-v',
                type: 'employee-photo',
                name: 'Employee Photo',
                x: 105,
                y: 98,
                width: 110,
                height: 110,
                rotation: 0,
                zIndex: 3,
                locked: false,
                visible: true,
                properties: {
                    shape: 'circle',
                    borderWidth: 3.5,
                    borderColor: '#ffffff',
                    outlineColor: accent,
                    objectFit: 'cover'
                }
            },
            // 5. Employee Name
            {
                id: 'uice-elem-name-v',
                type: 'employee-name',
                name: 'Employee Name',
                x: 10,
                y: 216,
                width: 300,
                height: 26,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    fontSize: 16,
                    fontWeight: 800,
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    color: '#0f172a',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: 0.4
                }
            },
            // 6. Designation
            {
                id: 'uice-elem-designation-v',
                type: 'designation',
                name: 'Designation',
                x: 10,
                y: 242,
                width: 300,
                height: 18,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    color: accent,
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: 0.6
                }
            },
            // 7. Details Table
            {
                id: 'uice-elem-details-table-v',
                type: 'details-table',
                name: 'Details Table',
                x: 16,
                y: 268,
                width: 288,
                height: 135,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    fontSize: 8,
                    labelColor: '#475569',
                    valueColor: '#0f172a',
                    rowPadding: 2.5,
                    labelWidth: 40,
                    fields: ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone']
                }
            },
            // 8. Barcode (Bottom Left)
            {
                id: 'uice-elem-barcode-v',
                type: 'barcode',
                name: 'Employee Barcode',
                x: 12,
                y: 418,
                width: 125,
                height: 26,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    format: 'CODE128',
                    lineColor: '#000000',
                    background: '#ffffff',
                    showText: true,
                    fontSize: 8
                }
            },
            // 9. Authority Signature (Bottom Center)
            {
                id: 'uice-elem-signature-v',
                type: 'signature',
                name: 'Authority Signature',
                x: 150,
                y: 412,
                width: 95,
                height: 44,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    preset: tpl.signature || 'preset-vsa-sig',
                    color: '#000000',
                    label: 'SIGNATURE'
                }
            },
            // 10. QR Code (Bottom Right)
            {
                id: 'uice-elem-qr-v',
                type: 'qr-code',
                name: 'Verification QR Code',
                x: 258,
                y: 410,
                width: 48,
                height: 48,
                rotation: 0,
                zIndex: 3,
                locked: false,
                visible: true,
                properties: {
                    errorCorrection: 'H',
                    foreground: '#000000',
                    background: '#ffffff',
                    quietZone: 2,
                    borderColor: accent,
                    borderWidth: 1.5
                }
            }
        ];
    }
}


/**
 * Returns default UICE back-of-card element nodes for horizontal or vertical orientation.
 */
function getUiceDefaultBackElements(orientation, tpl = {}) {
    const isHoriz = orientation === 'horizontal';
    const headerBg = tpl.headerBgColor || '#0e3e2b';
    const accent = tpl.accentColor || '#009688';

    if (isHoriz) {
        return [
            {
                id: 'uice-back-top-bar',
                type: 'shape',
                name: 'Back Top Bar',
                x: 0,
                y: 0,
                width: 500,
                height: 38,
                rotation: 0,
                zIndex: 1,
                locked: true,
                visible: true,
                properties: {
                    fill: headerBg,
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 0,
                    opacity: 1
                }
            },
            {
                id: 'uice-back-title',
                type: 'custom-text',
                name: 'Back Title',
                x: 16,
                y: 9,
                width: 468,
                height: 20,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: 'TERMS OF ISSUE & CARDHOLDER INSTRUCTIONS',
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#ffffff',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                }
            },
            {
                id: 'uice-back-terms',
                type: 'custom-text',
                name: 'Terms & Conditions',
                x: 16,
                y: 46,
                width: 468,
                height: 72,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: '1. This credential remains the property of issuing authority and is non-transferable.<br>2. Loss must be reported immediately to Security Control Room (+91-194-2452000).<br>3. Card must be visibly displayed at all times on assigned duty premises.<br>4. Unauthorized replication or alteration is strictly punishable under law.<br>5. Surrender card upon transfer, suspension, or termination of engagement.',
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    fontSize: 8.5,
                    fontWeight: 500,
                    color: '#334155',
                    textAlign: 'left',
                    lineHeight: 1.3
                }
            },
            {
                id: 'uice-back-return-box',
                type: 'shape',
                name: 'Return Notice Box',
                x: 16,
                y: 124,
                width: 468,
                height: 38,
                rotation: 0,
                zIndex: 1,
                locked: false,
                visible: true,
                properties: {
                    fill: '#f8fafc',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    borderRadius: 6,
                    opacity: 1
                }
            },
            {
                id: 'uice-back-return-text',
                type: 'custom-text',
                name: 'Return Address Text',
                x: 24,
                y: 128,
                width: 452,
                height: 30,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: 'IF FOUND, PLEASE DROP IN ANY POST BOX OR RETURN TO:<br><strong>VALLEY SECURITY AGENCY — HQ, SHAHIDGUNJ, SRINAGAR, J&K - 190001</strong>',
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    fontSize: 7.5,
                    fontWeight: 600,
                    color: '#1e293b',
                    textAlign: 'center',
                    lineHeight: 1.25
                }
            },
            {
                id: 'uice-back-emergency',
                type: 'badge-pill',
                name: 'Emergency Helpline',
                x: 16,
                y: 172,
                width: 230,
                height: 26,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: 'EMERGENCY: 112 / +91-194-2452000',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#dc2626',
                    fontSize: 9,
                    fontWeight: 800,
                    borderRadius: 4
                }
            },
            {
                id: 'uice-back-medical',
                type: 'badge-pill',
                name: 'Medical & Police Helpline',
                x: 254,
                y: 172,
                width: 230,
                height: 26,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: 'MEDICAL: 104 | POLICE: 100',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#2563eb',
                    fontSize: 9,
                    fontWeight: 800,
                    borderRadius: 4
                }
            },
            {
                id: 'uice-back-signature',
                type: 'signature',
                name: 'Issuing Authority Stamp & Signature',
                x: 24,
                y: 216,
                width: 190,
                height: 56,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    preset: tpl.signature || 'preset-vsa-sig',
                    color: '#000000',
                    label: 'ISSUING AUTHORITY STAMP & SIGNATURE'
                }
            },
            {
                id: 'uice-back-barcode',
                type: 'barcode',
                name: 'Card Serial Barcode',
                x: 260,
                y: 224,
                width: 215,
                height: 48,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    format: 'CODE128',
                    lineColor: '#000000',
                    background: '#ffffff',
                    showText: true,
                    fontSize: 8.5
                }
            },
            {
                id: 'uice-back-bottom-bar',
                type: 'shape',
                name: 'Bottom Accent Bar',
                x: 0,
                y: 312,
                width: 500,
                height: 8,
                rotation: 0,
                zIndex: 1,
                locked: true,
                visible: true,
                properties: {
                    fill: accent,
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 0,
                    opacity: 1
                }
            }
        ];
    } else {
        return [
            {
                id: 'uice-back-top-bar-v',
                type: 'shape',
                name: 'Back Top Bar',
                x: 0,
                y: 0,
                width: 320,
                height: 38,
                rotation: 0,
                zIndex: 1,
                locked: true,
                visible: true,
                properties: {
                    fill: headerBg,
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 0,
                    opacity: 1
                }
            },
            {
                id: 'uice-back-title-v',
                type: 'custom-text',
                name: 'Back Title',
                x: 10,
                y: 9,
                width: 300,
                height: 20,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: 'INSTRUCTIONS & CONDITIONS',
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#ffffff',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5
                }
            },
            {
                id: 'uice-back-terms-v',
                type: 'custom-text',
                name: 'Terms & Conditions',
                x: 12,
                y: 48,
                width: 296,
                height: 105,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: '1. This credential remains property of issuing authority.<br>2. Non-transferable; must be visibly worn on duty.<br>3. Loss must be reported immediately to Control (+91-194-2452000).<br>4. Replication or misuse is punishable by law.<br>5. Return upon cessation of engagement.',
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    fontSize: 8.5,
                    fontWeight: 500,
                    color: '#334155',
                    textAlign: 'left',
                    lineHeight: 1.3
                }
            },
            {
                id: 'uice-back-return-box-v',
                type: 'shape',
                name: 'Return Notice Box',
                x: 12,
                y: 162,
                width: 296,
                height: 48,
                rotation: 0,
                zIndex: 1,
                locked: false,
                visible: true,
                properties: {
                    fill: '#f8fafc',
                    borderWidth: 1,
                    borderColor: '#cbd5e1',
                    borderRadius: 6,
                    opacity: 1
                }
            },
            {
                id: 'uice-back-return-text-v',
                type: 'custom-text',
                name: 'Return Address Text',
                x: 16,
                y: 166,
                width: 288,
                height: 40,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: 'IF FOUND, PLEASE DROP IN ANY POST BOX OR RETURN TO:<br><strong>VALLEY SECURITY AGENCY — HQ, SHAHIDGUNJ, SRINAGAR, J&K - 190001</strong>',
                    fontFamily: tpl.font || "'Plus Jakarta Sans', sans-serif",
                    fontSize: 7.5,
                    fontWeight: 600,
                    color: '#1e293b',
                    textAlign: 'center',
                    lineHeight: 1.25
                }
            },
            {
                id: 'uice-back-emergency-v',
                type: 'badge-pill',
                name: 'Emergency Helpline',
                x: 12,
                y: 222,
                width: 296,
                height: 26,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: 'EMERGENCY: 112 / +91-194-2452000',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#dc2626',
                    fontSize: 9,
                    fontWeight: 800,
                    borderRadius: 4
                }
            },
            {
                id: 'uice-back-medical-v',
                type: 'badge-pill',
                name: 'Medical & Police Helpline',
                x: 12,
                y: 254,
                width: 296,
                height: 26,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    text: 'MEDICAL: 104 | J&K POLICE: 100',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#2563eb',
                    fontSize: 9,
                    fontWeight: 800,
                    borderRadius: 4
                }
            },
            {
                id: 'uice-back-signature-v',
                type: 'signature',
                name: 'Issuing Authority Stamp & Signature',
                x: 60,
                y: 296,
                width: 200,
                height: 60,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    preset: tpl.signature || 'preset-vsa-sig',
                    color: '#000000',
                    label: 'ISSUING AUTHORITY STAMP & SIGNATURE'
                }
            },
            {
                id: 'uice-back-barcode-v',
                type: 'barcode',
                name: 'Card Serial Barcode',
                x: 45,
                y: 380,
                width: 230,
                height: 50,
                rotation: 0,
                zIndex: 2,
                locked: false,
                visible: true,
                properties: {
                    format: 'CODE128',
                    lineColor: '#000000',
                    background: '#ffffff',
                    showText: true,
                    fontSize: 8.5
                }
            },
            {
                id: 'uice-back-bottom-bar-v',
                type: 'shape',
                name: 'Bottom Accent Bar',
                x: 0,
                y: 490,
                width: 320,
                height: 10,
                rotation: 0,
                zIndex: 1,
                locked: true,
                visible: true,
                properties: {
                    fill: accent,
                    borderWidth: 0,
                    borderColor: 'transparent',
                    borderRadius: 0,
                    opacity: 1
                }
            }
        ];
    }
}

/**
 * Returns the active element array for the currently selected surface ('front' or 'back').
 */
function getUiceActiveElements(layout = null) {
    if (!layout) {
        if (!UICE_STATE.template || !UICE_STATE.template.layouts) return [];
        layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
    }
    if (!layout) return [];
    if (UICE_STATE.surface === 'back') {
        if (!Array.isArray(layout.backElements) || layout.backElements.length === 0) {
            layout.backElements = getUiceDefaultBackElements(UICE_STATE.orientation, UICE_STATE.template);
        }
        return layout.backElements;
    }
    if (!Array.isArray(layout.elements) || layout.elements.length === 0) {
        layout.elements = getUiceDefaultElements(UICE_STATE.orientation, UICE_STATE.template);
    }
    return layout.elements;
}

/**
 * Generates dual-orientation and dual-surface layouts for an archetype preset.
 */
function createArchetypeLayouts(config) {
    const tplMock = {
        headerBgColor: config.primary,
        accentColor: config.accent,
        backgroundColor: config.bg || '#ffffff',
        font: config.font || "'Plus Jakarta Sans', sans-serif",
        headerText: config.headerText || 'VALLEY SECURITY AGENCY',
        cardTitle: config.cardTitle || 'OFFICIAL CREDENTIAL',
        subheaderText: config.subheaderText || 'COMMAND & CONTROL',
        logo: config.logo || 'preset-vsa-logo',
        signature: config.signature || 'preset-vsa-sig'
    };
    return {
        horizontal: {
            width: 500,
            height: 320,
            background: {
                color: tplMock.backgroundColor,
                headerBg: tplMock.headerBgColor,
                accent: tplMock.accentColor,
                borderWidth: config.borderWidth || 2,
                borderRadius: config.borderRadius !== undefined ? config.borderRadius : 14
            },
            elements: getUiceDefaultElements('horizontal', tplMock),
            backElements: getUiceDefaultBackElements('horizontal', tplMock)
        },
        vertical: {
            width: 320,
            height: 500,
            background: {
                color: tplMock.backgroundColor,
                headerBg: tplMock.headerBgColor,
                accent: tplMock.accentColor,
                borderWidth: config.borderWidth || 2,
                borderRadius: config.borderRadius !== undefined ? config.borderRadius : 14
            },
            elements: getUiceDefaultElements('vertical', tplMock),
            backElements: getUiceDefaultBackElements('vertical', tplMock)
        }
    };
}

/**
 * Master Archetype Preset Library Definitions (Phase 8)
 */
const UICE_ARCHETYPES = [
    {
        id: 'archetype-paramilitary-gold',
        name: 'Paramilitary & Defense Force',
        badge: 'MIL-SPEC DEFENSE',
        category: 'Defense & Armed Units',
        icon: 'shield-alert',
        cardTitle: 'ARMED SECURITY PASS',
        headerText: 'VALLEY TACTICAL RESPONSE',
        subheaderText: 'MIL-SPEC DEFENSE CORPS',
        description: 'High-durability gold and emerald command layout designed for armed security personnel, quick reaction forces, and perimeter control officers.',
        colors: {
            primary: '#0e3e2b',
            accent: '#d97706',
            bg: '#ffffff',
            previewGradient: 'linear-gradient(135deg, #0e3e2b 0%, #1e5a40 50%, #d97706 100%)'
        },
        getLayouts: function() {
            return createArchetypeLayouts({
                primary: '#0e3e2b',
                accent: '#d97706',
                bg: '#ffffff',
                cardTitle: 'ARMED SECURITY PASS',
                headerText: 'VALLEY TACTICAL RESPONSE',
                subheaderText: 'MIL-SPEC DEFENSE CORPS'
            });
        }
    },
    {
        id: 'archetype-cyber-obsidian',
        name: 'Modern Corporate & Cyber Tech',
        badge: 'CYBER / ENTERPRISE',
        category: 'Enterprise Tech',
        icon: 'cpu',
        cardTitle: 'CYBER ACCESS BADGE',
        headerText: 'VALLEY TECH MATRIX',
        subheaderText: 'CYBERSECURITY OPERATIONS',
        description: 'Obsidian dark-tone header with electric cyan accents, optimized for cybersecurity teams, server room access, and corporate executives.',
        colors: {
            primary: '#0f172a',
            accent: '#06b6d4',
            bg: '#ffffff',
            previewGradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #06b6d4 100%)'
        },
        getLayouts: function() {
            return createArchetypeLayouts({
                primary: '#0f172a',
                accent: '#06b6d4',
                bg: '#ffffff',
                cardTitle: 'CYBER ACCESS BADGE',
                headerText: 'VALLEY TECH MATRIX',
                subheaderText: 'CYBERSECURITY OPERATIONS'
            });
        }
    },
    {
        id: 'archetype-healthcare-teal',
        name: 'Healthcare & Hospital Manpower',
        badge: 'MEDICAL / CLINICAL',
        category: 'Healthcare & EMS',
        icon: 'activity',
        cardTitle: 'HOSPITAL MANPOWER PASS',
        headerText: 'VALLEY HEALTHCARE ALLIANCE',
        subheaderText: 'CLINICAL SUPPORT SERVICES',
        description: 'Clinical teal and pure white high-contrast visual hierarchy engineered for patient care attendants, hospital ward boys, and trauma center medics.',
        colors: {
            primary: '#0f766e',
            accent: '#14b8a6',
            bg: '#ffffff',
            previewGradient: 'linear-gradient(135deg, #0f766e 0%, #115e59 50%, #14b8a6 100%)'
        },
        getLayouts: function() {
            return createArchetypeLayouts({
                primary: '#0f766e',
                accent: '#14b8a6',
                bg: '#ffffff',
                cardTitle: 'HOSPITAL MANPOWER PASS',
                headerText: 'VALLEY HEALTHCARE ALLIANCE',
                subheaderText: 'CLINICAL SUPPORT SERVICES'
            });
        }
    },
    {
        id: 'archetype-executive-platinum',
        name: 'Executive VIP & Law Enforcement',
        badge: 'SPECIAL OPERATIONS',
        category: 'Executive VIP',
        icon: 'award',
        cardTitle: 'SPECIAL INVESTIGATOR',
        headerText: 'VALLEY INVESTIGATIONS',
        subheaderText: 'SPECIAL OPERATIONS DIVISION',
        description: 'Sleek deep onyx with platinum-slate borders and refined authority seal for VIP protection officers, investigators, and agency leadership.',
        colors: {
            primary: '#18181b',
            accent: '#94a3b8',
            bg: '#ffffff',
            previewGradient: 'linear-gradient(135deg, #18181b 0%, #27272a 60%, #94a3b8 100%)'
        },
        getLayouts: function() {
            return createArchetypeLayouts({
                primary: '#18181b',
                accent: '#94a3b8',
                bg: '#ffffff',
                cardTitle: 'SPECIAL INVESTIGATOR',
                headerText: 'VALLEY INVESTIGATIONS',
                subheaderText: 'SPECIAL OPERATIONS DIVISION'
            });
        }
    },
    {
        id: 'archetype-event-amber',
        name: 'Event & Rapid Access Pass',
        badge: 'RAPID ACCESS',
        category: 'Event & Temporary',
        icon: 'ticket',
        cardTitle: 'RAPID EVENT PASS',
        headerText: 'VALLEY EVENT MARSHALS',
        subheaderText: 'TEMPORARY ACCESS CONTROL',
        description: 'High-visibility amber and charcoal layout featuring jumbo QR scannability and bold shift expiry callouts for rapid event marshals and contractors.',
        colors: {
            primary: '#27272a',
            accent: '#f59e0b',
            bg: '#ffffff',
            previewGradient: 'linear-gradient(135deg, #27272a 0%, #3f3f46 50%, #f59e0b 100%)'
        },
        getLayouts: function() {
            return createArchetypeLayouts({
                primary: '#27272a',
                accent: '#f59e0b',
                bg: '#ffffff',
                cardTitle: 'RAPID EVENT PASS',
                headerText: 'VALLEY EVENT MARSHALS',
                subheaderText: 'TEMPORARY ACCESS CONTROL'
            });
        }
    },
    {
        id: 'archetype-govt-navy',
        name: 'Public Sector & Govt Standard',
        badge: 'GOVT / PSU STANDARD',
        category: 'Public Sector',
        icon: 'landmark',
        cardTitle: 'GOVERNMENT CONTRACTOR',
        headerText: 'VALLEY MANPOWER SERVICES',
        subheaderText: 'GOVERNMENT e-MARKETPLACE (GeM)',
        description: 'Institutional navy blue with tricolor accent bar matching central PSU and public department identification standards.',
        colors: {
            primary: '#1e3a8a',
            accent: '#f97316',
            bg: '#ffffff',
            previewGradient: 'linear-gradient(135deg, #1e3a8a 0%, #172554 60%, #f97316 100%)'
        },
        getLayouts: function() {
            return createArchetypeLayouts({
                primary: '#1e3a8a',
                accent: '#f97316',
                bg: '#ffffff',
                cardTitle: 'GOVERNMENT CONTRACTOR',
                headerText: 'VALLEY MANPOWER SERVICES',
                subheaderText: 'GOVERNMENT e-MARKETPLACE (GeM)'
            });
        }
    }
];

/**
 * Surface Switching & 3D Card Flip Functions (Phase 8)
 */
function setUiceSurface(surface) {
    if (surface !== 'front' && surface !== 'back') return;
    UICE_STATE.surface = surface;
    UICE_STATE.selectedId = null;

    const btnFront = document.getElementById('btn-uice-surface-front');
    const btnBack = document.getElementById('btn-uice-surface-back');
    if (btnFront) btnFront.classList.toggle('active', surface === 'front');
    if (btnBack) btnBack.classList.toggle('active', surface === 'back');

    renderUiceStage();
}

function flipUiceCard() {
    const artboard = document.getElementById('uice-artboard');
    if (artboard) {
        artboard.classList.remove('uice-flip-anim');
        void artboard.offsetWidth; // force reflow
        artboard.classList.add('uice-flip-anim');
        setTimeout(() => {
            if (artboard) artboard.classList.remove('uice-flip-anim');
        }, 500);
    }
    const newSurface = (UICE_STATE.surface === 'back') ? 'front' : 'back';
    setUiceSurface(newSurface);
}

/**
 * Master Archetype Modal Controls (Phase 8)
 */
function openUiceArchetypesModal() {
    const modal = document.getElementById('uice-archetypes-modal');
    const list = document.getElementById('uice-archetypes-list');
    if (!modal || !list) return;

    list.innerHTML = UICE_ARCHETYPES.map(a => `
        <div class="uice-archetype-card" onclick="loadUiceArchetype('${a.id}')">
            <div class="uice-archetype-thumb" style="background: ${a.colors.previewGradient};">
                <span class="uice-archetype-badge">${a.badge}</span>
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #ffffff; text-shadow: 0 2px 4px rgba(0,0,0,0.6);">
                    <i data-lucide="${a.icon || 'shield'}" style="width: 32px; height: 32px; margin-bottom: 4px;"></i>
                    <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">${a.category}</span>
                </div>
            </div>
            <h4 class="uice-archetype-title">${a.name}</h4>
            <p class="uice-archetype-desc">${a.description}</p>
            <button type="button" class="uice-archetype-load-btn" onclick="event.stopPropagation(); loadUiceArchetype('${a.id}');">
                <i data-lucide="check" style="width: 14px; height: 14px;"></i> Instantiate Layout
            </button>
        </div>
    `).join('');

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: list });
    }

    modal.classList.remove('hidden');
}

function closeUiceArchetypesModal() {
    const modal = document.getElementById('uice-archetypes-modal');
    if (modal) modal.classList.add('hidden');
}

function loadUiceArchetype(archetypeId) {
    const arch = UICE_ARCHETYPES.find(a => a.id === archetypeId);
    if (!arch) return;

    const layouts = arch.getLayouts ? arch.getLayouts() : arch.layouts;
    const newTpl = {
        id: 'tpl-' + Date.now(),
        name: arch.name,
        cardTitle: arch.cardTitle || 'SECURITY ID CARD',
        layout: UICE_STATE.orientation || 'horizontal',
        font: arch.font || "'Plus Jakarta Sans', sans-serif",
        headerBgColor: arch.colors.primary,
        accentColor: arch.colors.accent,
        backgroundColor: arch.colors.bg || '#ffffff',
        layouts: JSON.parse(JSON.stringify(layouts))
    };

    convertLegacyTemplateToUice(newTpl);

    if (typeof VSA_STATE !== 'undefined' && VSA_STATE.templates) {
        VSA_STATE.templates.push(newTpl);
        if (typeof renderTemplatesList === 'function') renderTemplatesList();
        if (typeof populateSelectors === 'function') populateSelectors();
    }

    initUiceWithTemplate(newTpl);
    closeUiceArchetypesModal();
}

/**
 * Portable Template Asset System (JSON Export / Import / Clone - Phase 8)
 */
function exportUiceTemplateJson() {
    if (!UICE_STATE.template) {
        alert('No active template to export.');
        return;
    }
    const tpl = JSON.parse(JSON.stringify(UICE_STATE.template));
    const exportData = {
        generator: "Valley Security Studio — Project Omega UICE 2.0",
        version: "2.0.0",
        exportedAt: new Date().toISOString(),
        template: tpl
    };
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (tpl.name || 'id_template').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    a.href = url;
    a.download = `${safeName}.uice.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function importUiceTemplateJson(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsed = JSON.parse(e.target.result);
            const tplData = parsed.template || parsed;
            if (!tplData || typeof tplData !== 'object') {
                throw new Error('Invalid template JSON structure.');
            }
            if (!tplData.id) {
                tplData.id = 'tpl-imported-' + Date.now();
            }
            if (!tplData.name) {
                tplData.name = file.name.replace(/\.(uice\.)?json$/i, '');
            }
            convertLegacyTemplateToUice(tplData);

            if (typeof VSA_STATE !== 'undefined' && VSA_STATE.templates) {
                const idx = VSA_STATE.templates.findIndex(t => t.id === tplData.id);
                if (idx !== -1) {
                    VSA_STATE.templates[idx] = tplData;
                } else {
                    VSA_STATE.templates.push(tplData);
                }
                if (typeof renderTemplatesList === 'function') renderTemplatesList();
                if (typeof populateSelectors === 'function') populateSelectors();
            }

            initUiceWithTemplate(tplData);
            alert(`Template "${tplData.name}" imported successfully!`);
        } catch (err) {
            console.error('Import template JSON error:', err);
            alert('Failed to import template JSON: ' + err.message);
        }
    };
    reader.readAsText(file);
}

async function cloneUiceTemplate() {
    if (!UICE_STATE.template) {
        alert('No active template to clone.');
        return;
    }
    const defaultCopyName = `${UICE_STATE.template.name || 'Template'} (Copy)`;
    const chosenName = prompt('What would you like to name this cloned template?', defaultCopyName);
    if (!chosenName || !chosenName.trim()) {
        return;
    }
    const clone = JSON.parse(JSON.stringify(UICE_STATE.template));
    clone.id = 'tpl-' + Date.now();
    clone.name = chosenName.trim();
    clone.isVisualTemplate = true;

    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clone)
        });
        if (!response.ok) throw new Error('API save error');
        const savedClone = await response.json();

        if (typeof VSA_STATE !== 'undefined' && VSA_STATE.templates) {
            VSA_STATE.templates.push(savedClone);
            if (typeof renderTemplatesList === 'function') renderTemplatesList();
            if (typeof populateSelectors === 'function') populateSelectors();
        }
        initUiceWithTemplate(savedClone);
        if (typeof loadTemplateInStudio === 'function') {
            loadTemplateInStudio(savedClone.id);
        }
        alert(`Template "${savedClone.name}" cloned and saved! Visible in both Classic and Advance makers.`);
    } catch (err) {
        console.error('Clone template error:', err);
        alert('Failed to save cloned template: ' + err.message);
    }
}

/**
 * Ensures a template object has modern UICE dual-orientation layout nodes.
 */
function convertLegacyTemplateToUice(tpl) {
    if (!tpl.layouts) {
        tpl.layouts = {};
    }
    if (!tpl.layouts.horizontal) {
        tpl.layouts.horizontal = {
            width: 500,
            height: 320,
            background: {
                color: tpl.backgroundColor || '#ffffff',
                headerBg: tpl.headerBgColor || '#0e3e2b',
                accent: tpl.accentColor || '#009688',
                borderRadius: 14
            },
            elements: getUiceDefaultElements('horizontal', tpl),
            backElements: (typeof getUiceDefaultBackElements === 'function') ? getUiceDefaultBackElements('horizontal', tpl) : []
        };
    } else {
        if (!Array.isArray(tpl.layouts.horizontal.elements) || tpl.layouts.horizontal.elements.length === 0 ||
            (tpl.cardTheme === 'organic-wave' && !tpl.layouts.horizontal.elements.some(e => e.type === 'svg-wave-top'))) {
            tpl.layouts.horizontal.elements = getUiceDefaultElements('horizontal', tpl);
        }
        if (!Array.isArray(tpl.layouts.horizontal.backElements) || tpl.layouts.horizontal.backElements.length === 0) {
            tpl.layouts.horizontal.backElements = (typeof getUiceDefaultBackElements === 'function') ? getUiceDefaultBackElements('horizontal', tpl) : [];
        }
    }
    if (!tpl.layouts.vertical) {
        tpl.layouts.vertical = {
            width: 320,
            height: 500,
            background: {
                color: tpl.backgroundColor || '#ffffff',
                headerBg: tpl.headerBgColor || '#0e3e2b',
                accent: tpl.accentColor || '#009688',
                borderRadius: 14
            },
            elements: getUiceDefaultElements('vertical', tpl),
            backElements: (typeof getUiceDefaultBackElements === 'function') ? getUiceDefaultBackElements('vertical', tpl) : []
        };
    } else {
        if (!Array.isArray(tpl.layouts.vertical.elements) || tpl.layouts.vertical.elements.length === 0 ||
            (tpl.cardTheme === 'organic-wave' && !tpl.layouts.vertical.elements.some(e => e.type === 'svg-wave-top'))) {
            tpl.layouts.vertical.elements = getUiceDefaultElements('vertical', tpl);
        }
        if (!Array.isArray(tpl.layouts.vertical.backElements) || tpl.layouts.vertical.backElements.length === 0) {
            tpl.layouts.vertical.backElements = (typeof getUiceDefaultBackElements === 'function') ? getUiceDefaultBackElements('vertical', tpl) : [];
        }
    }

    // Synchronize current template colors to theme shapes if present
    ['horizontal', 'vertical'].forEach(orient => {
        if (tpl.layouts && tpl.layouts[orient] && Array.isArray(tpl.layouts[orient].elements)) {
            tpl.layouts[orient].elements.forEach(e => {
                if (e.type === 'svg-wave-top' || e.type === 'svg-wave-bottom') {
                    e.properties = e.properties || {};
                    if (tpl.headerBgColor) e.properties.headerBgColor = tpl.headerBgColor;
                    if (tpl.accentColor) e.properties.accentColor = tpl.accentColor;
                } else if (e.type === 'guilloche-waves') {
                    e.properties = e.properties || {};
                    if (tpl.accentColor) e.properties.color = tpl.accentColor;
                }
            });
        }
    });

    return tpl;
}

/**
 * Synchronizes element properties from UICE visual layouts back to top-level template properties.
 * Ensures Classic Studio form controls and Classic ID Card renderer match the visual designer 1:1.
 */
function syncVisualPropertiesToRoot(tpl) {
    if (!tpl || !tpl.layouts) return tpl;
    const orient = tpl.layout === 'vertical' ? 'vertical' : 'horizontal';
    const layout = tpl.layouts[orient] || tpl.layouts.horizontal || tpl.layouts.vertical;
    if (!layout || !Array.isArray(layout.elements) || layout.elements.length === 0) return tpl;

    const elements = layout.elements;
    
    // 1. Badge / Card Title
    const badgeEl = elements.find(e => e.type === 'badge-pill' && e.visible !== false);
    if (badgeEl && badgeEl.properties && badgeEl.properties.text) {
        tpl.cardTitle = badgeEl.properties.text;
    }

    // 2. Agency Header & Subheader
    const brandEl = elements.find(e => e.type === 'agency-brand' && e.visible !== false);
    if (brandEl && brandEl.properties) {
        if (brandEl.properties.title) tpl.headerText = brandEl.properties.title;
        if (brandEl.properties.subtitle) tpl.subheaderText = brandEl.properties.subtitle;
        if (brandEl.properties.titleFontSize) tpl.headerFontSize = brandEl.properties.titleFontSize;
        if (brandEl.properties.logoSize) tpl.logoSize = brandEl.properties.logoSize;
    }

    // 3. Header Background & Accent Colors (from waves or background)
    const waveTopEl = elements.find(e => e.type === 'svg-wave-top');
    if (waveTopEl && waveTopEl.properties) {
        if (waveTopEl.properties.headerBgColor) tpl.headerBgColor = waveTopEl.properties.headerBgColor;
        if (waveTopEl.properties.accentColor) tpl.accentColor = waveTopEl.properties.accentColor;
    }
    if (layout.background) {
        if (layout.background.headerBg && !tpl.headerBgColor) tpl.headerBgColor = layout.background.headerBg;
        if (layout.background.accent && !tpl.accentColor) tpl.accentColor = layout.background.accent;
        if (layout.background.color) tpl.backgroundColor = layout.background.color;
    }

    // 4. Employee Photo (shape, outline, width, height, offset)
    const photoEl = elements.find(e => e.type === 'employee-photo');
    if (photoEl) {
        const pp = photoEl.properties || {};
        if (pp.shape) tpl.photoShape = pp.shape;
        if (photoEl.width) tpl.photoWidth = photoEl.width;
        if (photoEl.height) tpl.photoHeight = photoEl.height;
        if (photoEl.y !== undefined) tpl.photoTopOffset = Math.max(0, photoEl.y - 95);
    }

    // 5. Details Table (valueColor, labelColor, fontSize, rowPadding, labelWidth, labelValueSpacing)
    const detailsEl = elements.find(e => e.type === 'details-table');
    if (detailsEl && detailsEl.properties) {
        const dp = detailsEl.properties;
        if (dp.valueColor) tpl.valueColor = dp.valueColor;
        if (dp.labelColor) tpl.labelColor = dp.labelColor;
        if (dp.fontSize) tpl.detailsFontSize = dp.fontSize;
        if (dp.rowPadding !== undefined) tpl.rowPadding = dp.rowPadding;
        if (dp.labelWidth !== undefined) tpl.labelWidth = dp.labelWidth;
        if (dp.labelValueSpacing !== undefined) tpl.labelValueSpacing = dp.labelValueSpacing;
    }

    // 6. Employee Name & Designation
    const nameEl = elements.find(e => e.type === 'employee-name');
    if (nameEl && nameEl.properties) {
        if (nameEl.properties.fontSize) tpl.nameFontSize = nameEl.properties.fontSize;
        if (nameEl.properties.fontFamily) tpl.nameFont = nameEl.properties.fontFamily;
    }
    const desigEl = elements.find(e => e.type === 'designation');
    if (desigEl && desigEl.properties) {
        if (desigEl.properties.fontSize) tpl.designationFontSize = desigEl.properties.fontSize;
        if (desigEl.properties.color) tpl.designationColor = desigEl.properties.color;
    }

    // 7. Spatial Lockup: Detect if QR is placed under the photo
    const qrEl = elements.find(e => e.type === 'qr-code');
    if (qrEl && photoEl) {
        if (qrEl.x < 150 && qrEl.y > photoEl.y) {
            tpl.barcodePosition = 'bottom-center';
            tpl.qrPosition = 'bottom-left';
        }
    }

    return tpl;
}

/**
 * Initializes UICE state with a selected template.
 */
function initUiceWithTemplate(tplSource) {
    if (!tplSource) return;
    const tpl = JSON.parse(JSON.stringify(tplSource));
    convertLegacyTemplateToUice(tpl);
    syncVisualPropertiesToRoot(tpl);

    UICE_STATE.template = tpl;
    UICE_STATE.orientation = tpl.layout === 'vertical' ? 'vertical' : 'horizontal';
    UICE_STATE.surface = 'front';
    UICE_STATE.selectedId = null;
    const btnSurfFront = document.getElementById('btn-uice-surface-front');
    const btnSurfBack = document.getElementById('btn-uice-surface-back');
    if (btnSurfFront) btnSurfFront.classList.add('active');
    if (btnSurfBack) btnSurfBack.classList.remove('active');
    UICE_STATE.history = [];
    UICE_STATE.historyIndex = -1;
    UICE_STATE.initialSnapshots = JSON.parse(JSON.stringify(tpl.layouts));

    // Set preview employee
    if (VSA_STATE.employees && VSA_STATE.employees.length > 0) {
        UICE_STATE.previewEmp = VSA_STATE.employees[0];
    } else {
        UICE_STATE.previewEmp = MOCK_GUARD;
    }

    // Populate top template select
    const topTplSel = document.getElementById('uice-top-tpl-select');
    if (topTplSel) {
        topTplSel.innerHTML = (VSA_STATE.templates || []).map(t => 
            `<option value="${t.id}" ${t.id === tpl.id ? 'selected' : ''}>${t.name || t.id}</option>`
        ).join('');
    }

    // Populate preview guard select with all database employees
    populateUicePreviewEmpSelect();
    setupSingleCardSurfaceToggle();

    // Sync orientation dropdown
    const orientSel = document.getElementById('uice-orientation-sel');
    if (orientSel) {
        orientSel.value = UICE_STATE.orientation;
    }

    // Render Canvas Stage & Push Initial History Snapshot
    renderUiceStage();
    pushUiceHistory('Initial Template Load');

    // Attach listeners once
    if (!UICE_STATE._listenersAttached) {
        setupUiceListeners();
        UICE_STATE._listenersAttached = true;
    }
}

/**
 * Pushes a snapshot of current layouts to the 50-step undo stack.
 */
function pushUiceHistory(actionName = 'Edit') {
    if (!UICE_STATE.template || !UICE_STATE.template.layouts) return;

    // Truncate any redo steps
    if (UICE_STATE.historyIndex < UICE_STATE.history.length - 1) {
        UICE_STATE.history = UICE_STATE.history.slice(0, UICE_STATE.historyIndex + 1);
    }

    // Clone layouts
    const snapshot = JSON.parse(JSON.stringify(UICE_STATE.template.layouts));
    UICE_STATE.history.push({
        action: actionName,
        layouts: snapshot,
        orientation: UICE_STATE.orientation
    });

    // Cap at 50 levels
    if (UICE_STATE.history.length > 50) {
        UICE_STATE.history.shift();
    }
    UICE_STATE.historyIndex = UICE_STATE.history.length - 1;

    updateUiceUndoRedoButtons();
}

function updateUiceUndoRedoButtons() {
    const btnUndo = document.getElementById('btn-uice-undo');
    const btnRedo = document.getElementById('btn-uice-redo');
    if (btnUndo) btnUndo.disabled = UICE_STATE.historyIndex <= 0;
    if (btnRedo) btnRedo.disabled = UICE_STATE.historyIndex >= UICE_STATE.history.length - 1;
}

function undoUice() {
    if (UICE_STATE.historyIndex > 0) {
        UICE_STATE.historyIndex--;
        const item = UICE_STATE.history[UICE_STATE.historyIndex];
        UICE_STATE.template.layouts = JSON.parse(JSON.stringify(item.layouts));
        renderUiceStage();
        updateUiceUndoRedoButtons();
    }
}

function redoUice() {
    if (UICE_STATE.historyIndex < UICE_STATE.history.length - 1) {
        UICE_STATE.historyIndex++;
        const item = UICE_STATE.history[UICE_STATE.historyIndex];
        UICE_STATE.template.layouts = JSON.parse(JSON.stringify(item.layouts));
        renderUiceStage();
        updateUiceUndoRedoButtons();
    }
}

/**
 * Renders the interactive artboard stage, all element nodes, handles, and guides.
 */
function renderUiceStage() {
    if (!UICE_STATE.template || !UICE_STATE.template.layouts) return;

    const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
    if (!layout) return;

    const artboard = document.getElementById('uice-artboard');
    const container = document.getElementById('uice-elements-container');
    const bgLayer = document.getElementById('uice-card-background');
    if (!artboard || !container) return;

    // Set dimensions
    artboard.style.width = layout.width + 'px';
    artboard.style.height = layout.height + 'px';
    artboard.style.transform = `scale(${UICE_STATE.zoom})`;
    artboard.style.borderRadius = (layout.background && layout.background.borderRadius !== undefined ? layout.background.borderRadius : 14) + 'px';

    // Set background
    if (bgLayer) {
        const bg = layout.background || {};
        bgLayer.style.background = bg.color || '#ffffff';
        bgLayer.style.borderRadius = (bg.borderRadius !== undefined ? bg.borderRadius : 14) + 'px';
        bgLayer.style.border = `${bg.borderWidth || 2}px solid ${bg.accent || '#009688'}`;
        bgLayer.style.boxSizing = 'border-box';
    }

    // Grid Overlay toggle
    const gridEl = document.getElementById('uice-grid-overlay');
    if (gridEl) {
        if (UICE_STATE.showGrid) {
            gridEl.classList.add('visible');
        } else {
            gridEl.classList.remove('visible');
        }
    }

    // Safe Margins Guide Overlay toggle (ISO/IEC CR80 5mm / ~14px boundary)
    const safeMarginsEl = document.getElementById('uice-safe-margins-overlay');
    if (safeMarginsEl) {
        safeMarginsEl.style.display = UICE_STATE.showSafeMargins ? 'block' : 'none';
    }

    // Bleed Area Guide Overlay toggle (3mm / ~10px outer cut boundary)
    const bleedAreaEl = document.getElementById('uice-bleed-area-overlay');
    if (bleedAreaEl) {
        bleedAreaEl.style.display = UICE_STATE.showBleedArea ? 'block' : 'none';
    }

    // Element Boundaries Outlines toggle
    container.classList.toggle('uice-show-element-outlines', !!UICE_STATE.showElementOutlines);

    // Dye-Sublimation / CMYK Print Proofing Gamut Simulation
    artboard.classList.toggle('uice-soft-proofing', !!UICE_STATE.showPrintProofing);

    // Clear and re-populate elements
    container.innerHTML = '';
    const emp = UICE_STATE.previewEmp || MOCK_GUARD;

    // Sort elements by zIndex
    const activeElements = getUiceActiveElements(layout);
    const sorted = [...activeElements].sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));

    sorted.forEach(el => {
        if (el.visible === false) return;

        const isSelected = el.id === UICE_STATE.selectedId;
        const node = document.createElement('div');
        node.className = `uice-node ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}`;
        node.setAttribute('data-id', el.id);
        node.style.left = el.x + 'px';
        node.style.top = el.y + 'px';
        node.style.width = el.width + 'px';
        node.style.height = el.height + 'px';
        node.style.transform = `rotate(${el.rotation || 0}deg)`;
        node.style.zIndex = el.zIndex || 1;

        // Apply Opacity & Shadow effects
        if (el.properties) {
            if (el.properties.opacity !== undefined) {
                node.style.opacity = el.properties.opacity;
            }
            if (el.properties.shadow && el.properties.shadow !== 'none') {
                node.classList.add(`uice-shadow-${el.properties.shadow}`);
            }
        }

        // Render inner HTML based on element type
        node.innerHTML = renderUiceElementHtml(el, emp);

        // Append 8 resize handles and rotation stalk if selected and not locked
        if (isSelected && !el.locked) {
            node.insertAdjacentHTML('beforeend', `
                <div class="uice-handle handle-nw" data-handle="nw"></div>
                <div class="uice-handle handle-n" data-handle="n"></div>
                <div class="uice-handle handle-ne" data-handle="ne"></div>
                <div class="uice-handle handle-e" data-handle="e"></div>
                <div class="uice-handle handle-se" data-handle="se"></div>
                <div class="uice-handle handle-s" data-handle="s"></div>
                <div class="uice-handle handle-sw" data-handle="sw"></div>
                <div class="uice-handle handle-w" data-handle="w"></div>
                <div class="uice-handle-rot-stalk"></div>
                <div class="uice-handle handle-rot" data-handle="rot" title="Rotate (360°)"></div>
            `);
        } else if (isSelected && el.locked) {
            // Lock badge indicator
            node.insertAdjacentHTML('beforeend', `
                <div style="position: absolute; top: 2px; right: 2px; background: #ef4444; color: #fff; border-radius: 4px; padding: 2px 4px; font-size: 9px; font-weight: bold; pointer-events: none; z-index: 1000; display: flex; align-items: center; gap: 2px;">
                    <i data-lucide="lock" style="width: 10px; height: 10px;"></i>
                </div>
            `);
        }

        container.appendChild(node);
    });

    // Render live QRs and Barcodes inside artboard
    renderQrsInContainer(artboard);

    // Refresh Lucide icons inside artboard
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: artboard });
    }

    // Render Layer Manager list
    renderUiceLayersList();

    // Update Property Inspector
    const selectedEl = getUiceActiveElements(layout).find(e => e.id === UICE_STATE.selectedId);
    updateUicePropertyInspector(selectedEl);

    // Draw pixel rulers
    drawUiceRulers();
}

/**
 * ==========================================================================
 * PHASE 9: DYNAMIC TOKEN BINDING & SECURITY OVERLAY ENGINES
 * ==========================================================================
 */

/**
 * Resolves dynamic curly variable tokens against live employee records.
 * Supports: {{name}}, {{empId}}, {{id}}, {{designation}}, {{role}}, {{department}},
 * {{fatherName}}, {{father}}, {{bloodGroup}}, {{phone}}, {{mobile}}, {{address}},
 * {{policeStation}}, {{aadhaarLast4}}, {{joiningDate}}, {{validUntil}}, {{issueDate}},
 * {{dob}}, {{site}}, {{rank}}, {{zone}}, etc.
 */
function resolveUiceTokens(text, emp = {}, validityYears = 3, issueDate = null) {
    if (!emp || typeof emp !== 'object') emp = {};
    if (!text || typeof text !== 'string') return text || '';

    const now = new Date();
    const issue = issueDate ? new Date(issueDate) : (emp.cardIssueDate ? new Date(emp.cardIssueDate) : now);
    const validIssue = isNaN(issue.getTime()) ? now : issue;
    const validUntil = new Date(validIssue);
    const years = parseInt(validityYears) || (parseInt(emp.cardValidity) || 3);
    validUntil.setFullYear(validUntil.getFullYear() + years);

    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => {
        if (!d || isNaN(d.getTime())) return '-';
        return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
    };

    const formatAnyDate = (val) => {
        if (!val) return '-';
        if (typeof val === 'string' && val.includes('-') && val.length === 10) return val;
        const d = new Date(val);
        if (isNaN(d.getTime())) return String(val);
        return formatDate(d);
    };

    const aadhaarVal = () => {
        if (emp.aadhaarLast4) return `XXXX-XXXX-${emp.aadhaarLast4}`;
        if (emp.aadhaar) {
            const clean = String(emp.aadhaar).replace(/\D/g, '');
            if (clean.length >= 4) return `XXXX-XXXX-${clean.slice(-4)}`;
            return String(emp.aadhaar);
        }
        return 'XXXX-XXXX-1234';
    };

    const tokenMap = {
        '{{name}}': emp.name || emp.fullName || 'Rajesh Kumar',
        '{{empName}}': emp.name || emp.fullName || 'Rajesh Kumar',
        '{{id}}': emp.id || emp.employeeId || 'VSA-0042',
        '{{empId}}': emp.id || emp.employeeId || 'VSA-0042',
        '{{designation}}': emp.designation || emp.role || 'Armed Security Officer',
        '{{role}}': emp.designation || emp.role || 'Armed Security Officer',
        '{{department}}': emp.department || emp.dept || 'Security Operations',
        '{{dept}}': emp.department || emp.dept || 'Security Operations',
        '{{fatherName}}': emp.fatherName || emp.father || '-',
        '{{father}}': emp.fatherName || emp.father || '-',
        '{{bloodGroup}}': emp.bloodGroup || emp.blood || 'O+',
        '{{blood}}': emp.bloodGroup || emp.blood || 'O+',
        '{{phone}}': emp.phone || emp.mobile || '-',
        '{{mobile}}': emp.phone || emp.mobile || '-',
        '{{address}}': emp.currentAddress || emp.address || emp.permanentAddress || 'Srinagar, J&K',
        '{{policeStation}}': emp.policeStation || emp.ps || 'Shahidgunj',
        '{{ps}}': emp.policeStation || emp.ps || 'Shahidgunj',
        '{{aadhaarLast4}}': aadhaarVal(),
        '{{aadhaar}}': aadhaarVal(),
        '{{joiningDate}}': formatAnyDate(emp.joiningDate || emp.doj || '2024-01-01'),
        '{{doj}}': formatAnyDate(emp.joiningDate || emp.doj || '2024-01-01'),
        '{{dob}}': formatAnyDate(emp.dob || emp.dateOfBirth),
        '{{site}}': emp.deployedSite || emp.site || 'Main Headquarters',
        '{{deployedSite}}': emp.deployedSite || emp.site || 'Main Headquarters',
        '{{issueDate}}': formatDate(validIssue),
        '{{validUntil}}': formatDate(validUntil),
        '{{validity}}': formatDate(validUntil),
        '{{rank}}': emp.rank || emp.designation || 'Officer',
        '{{zone}}': emp.zone || 'North Zone',
        '{{status}}': emp.status || 'Active',
        '{{secureToken}}': emp.secureToken || '',
        '{{qrVerificationUrl}}': typeof getUiceVerificationUrl === 'function' ? getUiceVerificationUrl(emp) : `/verification.html?id=${emp.id || 'VSA-0042'}`
    };

    let result = text;
    for (const [token, value] of Object.entries(tokenMap)) {
        const escapedToken = token.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
        result = result.replace(new RegExp(escapedToken, 'gi'), value);
    }
    return result;
}

function getVsaSecurityCrestSvg(color = '#009688', opacity = 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style="opacity: ${opacity};">
        <path d="M50 5 L88 20 C88 55 68 85 50 95 C32 85 12 55 12 20 Z" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M50 12 L81 24 C81 53 64 78 50 87 C36 78 19 53 19 24 Z" fill="none" stroke="${color}" stroke-width="1.2" stroke-dasharray="2,2"/>
        <path d="M35 34 L50 68 L65 34" fill="none" stroke="${color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M42 48 C42 42 58 42 58 48 C58 55 42 55 42 62 C42 68 58 68 58 62" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round"/>
        <polygon points="50,17 52,22 57,22 53,25 55,30 50,27 45,30 47,25 43,22 48,22" fill="${color}"/>
        <polygon points="32,23 33.5,27 38,27 34.5,29.5 36,34 32,31.5 28,34 29.5,29.5 26,27 30.5,27" fill="${color}" opacity="0.85"/>
        <polygon points="68,23 69.5,27 74,27 70.5,29.5 72,34 68,31.5 64,34 65.5,29.5 62,27 66.5,27" fill="${color}" opacity="0.85"/>
    </svg>`;
}

function getSecurityEagleSvg(color = '#009688', opacity = 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style="opacity: ${opacity};">
        <path d="M50 10 L58 26 L76 28 L62 40 L66 58 L50 48 L34 58 L38 40 L24 28 L42 26 Z" fill="none" stroke="${color}" stroke-width="2.5"/>
        <path d="M15 45 Q50 30 85 45 Q50 65 15 45 Z" fill="none" stroke="${color}" stroke-width="2"/>
        <circle cx="50" cy="50" r="38" fill="none" stroke="${color}" stroke-width="1.5" stroke-dasharray="3,3"/>
        <circle cx="50" cy="50" r="44" fill="none" stroke="${color}" stroke-width="1"/>
    </svg>`;
}

function getShieldVerifiedSvg(color = '#009688', opacity = 1) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%" style="opacity: ${opacity};">
        <path d="M50 6 L88 22 C88 60 65 88 50 96 C35 88 12 60 12 22 Z" fill="none" stroke="${color}" stroke-width="3"/>
        <path d="M30 48 L44 62 L70 34" fill="none" stroke="${color}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
}

/**
 * Generates mathematical vector spirograph anti-copy harmonic curves in SVG.
 */
function generateGuillocheSvg(width, height, properties = {}) {
    const w = Math.max(40, width);
    const h = Math.max(20, height);
    const stroke = properties.strokeColor || '#009688';
    const strokeWidth = properties.strokeWidth || 0.75;
    const waveCount = Math.max(2, Math.min(24, properties.waveCount || 8));
    const freq = properties.frequency || 4;
    const amp = Math.min(h / 2, properties.amplitude || 12);
    const style = properties.style || 'harmonic';
    const opacity = properties.opacity !== undefined ? properties.opacity : 0.25;

    let paths = '';
    const midY = h / 2;
    const step = 4;

    for (let i = 0; i < waveCount; i++) {
        const phase = (i / waveCount) * Math.PI * 2;
        const currentAmp = amp * (0.6 + 0.4 * Math.sin(phase));
        let d = '';

        for (let x = 0; x <= w; x += step) {
            let y;
            if (style === 'spirograph') {
                const t = (x / w) * Math.PI * freq * 2;
                y = midY + Math.sin(t + phase) * currentAmp * Math.cos(t * 0.5 + phase * 0.5);
            } else if (style === 'sinusoidal') {
                const t = (x / w) * Math.PI * freq * 2;
                y = midY + Math.sin(t + phase) * currentAmp;
            } else {
                const t = (x / w) * Math.PI * freq * 2;
                y = midY + (Math.sin(t + phase) * 0.7 + Math.cos(t * 2 + phase) * 0.3) * currentAmp;
            }
            d += (x === 0 ? `M ${x.toFixed(1)} ${y.toFixed(1)}` : ` L ${x.toFixed(1)} ${y.toFixed(1)}`);
        }
        paths += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" opacity="${(0.5 + 0.5 * Math.sin(phase)).toFixed(2)}" />`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="opacity: ${opacity}; display: block; pointer-events: none;">${paths}</svg>`;
}

/**
 * Generates an iridescent diffraction holographic foil badge with 3D reflection.
 */
function generateHologramFoilHtml(el, properties = {}) {
    const p = properties || {};
    const foil = p.foilStyle || 'silver';
    const shape = p.badgeShape || 'circle';
    const crest = p.crest || 'vsa-crest';
    const label = p.label || 'SECURE';

    let borderRadius = '50%';
    let clipPath = 'none';
    if (shape === 'shield') {
        clipPath = 'polygon(50% 0%, 100% 18%, 100% 68%, 50% 100%, 0% 68%, 0% 18%)';
        borderRadius = '0px';
    } else if (shape === 'rectangle') {
        borderRadius = '8px';
    }

    let foilGrad = '';
    let accentBorder = '';
    let crestColor = '#ffffff';

    if (foil === 'gold') {
        foilGrad = 'linear-gradient(135deg, #fef08a 0%, #eab308 25%, #fef9c3 48%, #ca8a04 72%, #fde047 100%)';
        accentBorder = '#a16207';
        crestColor = '#78350f';
    } else if (foil === 'prismatic') {
        foilGrad = 'linear-gradient(135deg, #f43f5e 0%, #fb923c 18%, #facc15 36%, #4ade80 54%, #38bdf8 72%, #a855f7 100%)';
        accentBorder = 'rgba(255,255,255,0.7)';
        crestColor = '#ffffff';
    } else if (foil === 'emerald') {
        foilGrad = 'linear-gradient(135deg, #a7f3d0 0%, #10b981 28%, #ecfdf5 50%, #047857 75%, #34d399 100%)';
        accentBorder = '#065f46';
        crestColor = '#064e3b';
    } else {
        foilGrad = 'linear-gradient(135deg, #f8fafc 0%, #cbd5e1 24%, #ffffff 48%, #94a3b8 72%, #f1f5f9 100%)';
        accentBorder = '#64748b';
        crestColor = '#1e293b';
    }

    let iconSvg = '';
    if (crest === 'eagle') {
        iconSvg = getSecurityEagleSvg(crestColor, 0.9);
    } else if (crest === 'star') {
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="60%" height="60%" fill="${crestColor}"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    } else {
        iconSvg = getVsaSecurityCrestSvg(crestColor, 0.9);
    }

    return `
        <div class="uice-hologram-badge uice-hologram-${foil} uice-hologram-${shape}" style="width: 100%; height: 100%; background: ${foilGrad}; border-radius: ${borderRadius}; clip-path: ${clipPath}; position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.3), inset 0 0 0 1px ${accentBorder}; pointer-events: none;">
            <div style="position: absolute; inset: 2px; border-radius: inherit; border: 1px dashed rgba(255,255,255,0.7); pointer-events: none; opacity: 0.7;"></div>
            <div class="uice-hologram-shimmer" style="position: absolute; inset: -50%; background: linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.85) 48%, rgba(255,255,255,0.95) 52%, transparent 65%); transform: rotate(25deg); pointer-events: none;"></div>
            <div style="width: 58%; height: 58%; display: flex; align-items: center; justify-content: center; position: relative; z-index: 2; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.25));">
                ${iconSvg}
            </div>
            <div style="font-family: 'JetBrains Mono', monospace; font-size: 5px; font-weight: 800; color: ${crestColor}; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 1px; position: relative; z-index: 2; opacity: 0.9; text-shadow: 0 0 2px rgba(255,255,255,0.8);">
                ${escapeHtml(label)}
            </div>
        </div>`;
}

/**
 * Generates sub-millimeter anti-copy microtext line rule with token resolution.
 */
function generateMicrotextLineHtml(el, properties = {}, emp = {}, validityYears = 3, issueDate = null) {
    const p = properties || {};
    const rawText = p.text || 'VALLEY SECURITY AGENCY • OFFICIAL CREDENTIAL • AUTHENTIC IDENTIFICATION • PSARA COMPLIANT • SECURE ACCESS • ';
    const resolvedText = resolveUiceTokens(rawText, emp, validityYears, issueDate);
    const fontSize = p.fontSize || 4.5;
    const color = p.color || '#475569';
    const letterSpacing = p.letterSpacing !== undefined ? p.letterSpacing : 1.2;
    const repeatCount = p.repeatCount || 6;
    const opacity = p.opacity !== undefined ? p.opacity : 0.85;

    let fullLine = '';
    for (let i = 0; i < repeatCount; i++) {
        fullLine += resolvedText + ' ';
    }

    return `
        <div class="uice-microtext-rule" style="width: 100%; height: 100%; display: flex; align-items: center; overflow: hidden; pointer-events: none; opacity: ${opacity};">
            <span style="font-family: 'JetBrains Mono', monospace; font-size: ${fontSize}px; font-weight: 800; color: ${color}; text-transform: uppercase; letter-spacing: ${letterSpacing}px; white-space: nowrap; line-height: 1; user-select: none; -webkit-font-smoothing: antialiased;">
                ${escapeHtml(fullLine)}
            </span>
        </div>`;
}

/**
 * Generates security watermark crest overlay in background.
 */
function generateSecurityWatermarkHtml(el, properties = {}) {
    const p = properties || {};
    const preset = p.preset || 'vsa-crest';
    const opacity = p.opacity !== undefined ? p.opacity : 0.10;
    const rotation = p.rotation || 0;
    const grayscale = p.grayscale !== false;

    let svg = '';
    if (preset === 'emblem-eagle') {
        svg = getSecurityEagleSvg('#0f172a', 1);
    } else if (preset === 'shield-verified') {
        svg = getShieldVerifiedSvg('#0f172a', 1);
    } else {
        svg = getVsaSecurityCrestSvg('#0f172a', 1);
    }

    const filter = grayscale ? 'grayscale(100%)' : 'none';

    return `
        <div class="uice-watermark-overlay" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; opacity: ${opacity}; transform: rotate(${rotation}deg); filter: ${filter}; pointer-events: none;">
            ${svg}
        </div>`;
}

/**
 * Builds the inner HTML for an element node inside the artboard.
 */
function renderUiceElementHtml(el, emp, validityYears = 3, issueDate = null, template = null) {
    if (!emp || typeof emp !== 'object') emp = {};
    if (!template && typeof UICE_STATE !== 'undefined' && UICE_STATE && UICE_STATE.template) template = UICE_STATE.template;
    const p = el.properties || {};

    switch (el.type) {
        case 'agency-brand': {
            const logoSrc = resolveUiceLogoSrc(p.logoPreset);
            const logoSize = p.logoSize || 32;
            const availW = Math.max(20, el.width - logoSize - 12);
            const allowWrap = !!p.wrap;
            const autoFit = p.autoFit !== false;
            const rawTitle = p.title || 'VALLEY SECURITY AGENCY';
            const rawSub = p.subtitle || 'SHAHIDGUNJ SRINAGAR';
            const title = resolveUiceTokens(rawTitle, emp, validityYears, issueDate);
            const subtitle = resolveUiceTokens(rawSub, emp, validityYears, issueDate);
            const lineHeight = p.lineHeight || 1.15;
            const letterSpacing = p.letterSpacing !== undefined ? p.letterSpacing : 0.4;

            let titleSize = p.titleFontSize || 12;
            let subSize = p.subtitleFontSize || 6.5;

            if (autoFit && typeof calculateAutoFitFontSize === 'function') {
                const fitT = calculateAutoFitFontSize({
                    text: title,
                    width: availW,
                    height: el.height * 0.65,
                    preferredSize: titleSize,
                    minSize: 7.5,
                    lineHeight,
                    letterSpacing,
                    allowWrap,
                    maxLines: allowWrap ? 2 : 1,
                    fontWeight: '800'
                });
                titleSize = fitT.fontSize;

                const fitS = calculateAutoFitFontSize({
                    text: subtitle,
                    width: availW,
                    height: el.height * 0.35,
                    preferredSize: subSize,
                    minSize: 5.5,
                    lineHeight: 1.1,
                    letterSpacing,
                    allowWrap: false,
                    fontWeight: '600'
                });
                subSize = fitS.fontSize;
            }

            const whiteSpaceTitle = allowWrap ? 'normal' : 'nowrap';
            const wordBreakTitle = allowWrap ? 'break-word' : 'normal';

            return `
                <div style="display: flex; align-items: center; gap: 8px; width: 100%; height: 100%; pointer-events: none;">
                    <div style="width: ${logoSize}px; height: ${logoSize}px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #ffffff; border-radius: 6px; padding: 2px; box-shadow: 0 1px 4px rgba(0,0,0,0.25);">
                        ${logoSrc}
                    </div>
                    <div style="min-width: 0; flex-grow: 1; display: flex; flex-direction: column; justify-content: center;">
                        <h1 class="uice-brand-title" style="color: ${p.color || '#ffffff'}; font-size: ${titleSize}px; font-weight: 800; text-transform: uppercase; margin: 0; line-height: ${lineHeight}; font-family: ${p.fontFamily || "'Plus Jakarta Sans', sans-serif"}; letter-spacing: ${letterSpacing}px; overflow: hidden; text-overflow: ellipsis; white-space: ${whiteSpaceTitle}; word-break: ${wordBreakTitle};">${escapeHtml(title)}</h1>
                        <p class="uice-brand-subtitle" style="color: ${p.color || '#ffffff'}; opacity: 0.9; font-size: ${subSize}px; margin: 1px 0 0 0; text-transform: uppercase; line-height: 1.15; font-family: ${p.fontFamily || "'Plus Jakarta Sans', sans-serif"}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: 0.4px;">${escapeHtml(subtitle)}</p>
                    </div>
                </div>`;
        }

        case 'agency-logo': {
            const logoSrc = resolveUiceLogoSrc(p.logoPreset);
            return `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; pointer-events: none;">${logoSrc}</div>`;
        }

        case 'employee-photo': {
            let photoUrl = (emp.documents && emp.documents.photo) ? emp.documents.photo : (emp.photo || '');
            if (photoUrl.startsWith('/api/employees/') && emp.secureToken) {
                photoUrl += (photoUrl.includes('?') ? '&' : '?') + `token=${emp.secureToken}`;
            }

            const shape = p.shape || 'circle';
            const borderRadius = shape === 'circle' ? '50%' : (shape === 'rounded' ? '12px' : '0px');
            const outline = p.outlineColor ? `0 0 0 2px ${p.outlineColor}` : 'none';

            if (photoUrl) {
                return `
                    <div style="width: 100%; height: 100%; border-radius: ${borderRadius}; border: ${p.borderWidth || 3}px solid ${p.borderColor || '#ffffff'}; box-shadow: ${outline}; overflow: hidden; box-sizing: border-box; pointer-events: none;">
                        <img src="${photoUrl}" alt="Photo" crossorigin="anonymous" style="width: 100%; height: 100%; object-fit: ${p.objectFit || 'cover'}; display: block;">
                    </div>`;
            } else {
                const initial = emp.name ? emp.name[0].toUpperCase() : '?';
                return `
                    <div style="width: 100%; height: 100%; border-radius: ${borderRadius}; border: ${p.borderWidth || 3}px solid ${p.borderColor || '#ffffff'}; box-shadow: ${outline}; overflow: hidden; box-sizing: border-box; background: linear-gradient(135deg, #0e3e2b 0%, #009688 100%); display: flex; align-items: center; justify-content: center; pointer-events: none;">
                        <span style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 32px; font-weight: 800; color: #ffffff;">${initial}</span>
                    </div>`;
            }
        }

        case 'employee-name': {
            const name = emp.name || 'MOHD SALIM';
            const allowWrap = !!p.wrap;
            const autoFit = p.autoFit !== false;
            let fontSize = p.fontSize || 16;
            const lineHeight = p.lineHeight || 1.15;
            const letterSpacing = p.letterSpacing !== undefined ? p.letterSpacing : 0.3;

            if (autoFit && typeof calculateAutoFitFontSize === 'function') {
                const fit = calculateAutoFitFontSize({
                    text: name,
                    width: el.width,
                    height: el.height,
                    preferredSize: fontSize,
                    minSize: 7.5,
                    lineHeight,
                    letterSpacing,
                    allowWrap,
                    maxLines: allowWrap ? 2 : 1,
                    fontWeight: p.fontWeight || '800'
                });
                fontSize = fit.fontSize;
            }

            const whiteSpace = allowWrap ? 'normal' : 'nowrap';
            const wordBreak = allowWrap ? 'break-word' : 'normal';

            return `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; pointer-events: none;">
                    <h2 class="uice-emp-name" style="font-family: ${p.fontFamily || "'Plus Jakarta Sans', sans-serif"}; font-size: ${fontSize}px; font-weight: ${p.fontWeight || 800}; color: ${p.color || '#0f172a'}; text-align: ${p.textAlign || 'left'}; text-transform: ${p.textTransform || 'uppercase'}; letter-spacing: ${letterSpacing}px; margin: 0; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: ${whiteSpace}; word-break: ${wordBreak}; line-height: ${lineHeight};">
                        ${escapeHtml(name)}
                    </h2>
                </div>`;
        }

        case 'designation': {
            const desig = emp.designation || 'SECURITY GUARD';
            const allowWrap = !!p.wrap;
            const autoFit = p.autoFit !== false;
            let fontSize = p.fontSize || 10;
            const lineHeight = p.lineHeight || 1.1;
            const letterSpacing = p.letterSpacing !== undefined ? p.letterSpacing : 0.5;

            if (autoFit && typeof calculateAutoFitFontSize === 'function') {
                const fit = calculateAutoFitFontSize({
                    text: desig,
                    width: el.width,
                    height: el.height,
                    preferredSize: fontSize,
                    minSize: 6.5,
                    lineHeight,
                    letterSpacing,
                    allowWrap,
                    maxLines: allowWrap ? 2 : 1,
                    fontWeight: p.fontWeight || '700'
                });
                fontSize = fit.fontSize;
            }

            const whiteSpace = allowWrap ? 'normal' : 'nowrap';
            const wordBreak = allowWrap ? 'break-word' : 'normal';

            return `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; pointer-events: none;">
                    <h3 class="uice-emp-designation" style="font-family: ${p.fontFamily || "'Plus Jakarta Sans', sans-serif"}; font-size: ${fontSize}px; font-weight: ${p.fontWeight || 700}; color: ${p.color || '#009688'}; text-align: ${p.textAlign || 'left'}; text-transform: ${p.textTransform || 'uppercase'}; letter-spacing: ${letterSpacing}px; margin: 0; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: ${whiteSpace}; word-break: ${wordBreak}; line-height: ${lineHeight};">
                        ${escapeHtml(desig)}
                    </h3>
                </div>`;
        }

        case 'badge-pill': {
            const rawText = p.text || 'SECURITY ID CARD';
            const resolvedText = resolveUiceTokens(rawText, emp, validityYears, issueDate);
            const isTransparent = p.background === 'transparent' || !p.background;
            const bgStyle = isTransparent ? 'background: transparent;' : `background: ${p.background}; box-shadow: 0 2px 6px rgba(0,0,0,0.2);`;
            const textShadow = isTransparent ? 'text-shadow: 0 2px 5px rgba(0,0,0,0.45);' : '';
            const justify = p.textAlign === 'right' ? 'flex-end' : (p.textAlign === 'left' ? 'flex-start' : 'center');
            const fontFamily = p.fontFamily || "'Plus Jakarta Sans', sans-serif";
            const fontStyle = p.fontStyle || (fontFamily.includes('Playfair') ? 'italic' : 'normal');

            return `
                <div style="width: 100%; height: 100%; ${bgStyle} color: ${p.color || '#ffffff'}; border-radius: ${p.borderRadius !== undefined ? p.borderRadius : 6}px; display: flex; align-items: center; justify-content: ${justify}; font-family: ${fontFamily}; font-style: ${fontStyle}; font-size: ${p.fontSize || 11}px; font-weight: ${p.fontWeight || 800}; text-transform: uppercase; letter-spacing: ${p.letterSpacing !== undefined ? p.letterSpacing : 0.8}px; text-align: ${p.textAlign || 'center'}; ${textShadow} pointer-events: none; line-height: 1.15; padding: ${isTransparent ? '0 4px' : '2px 8px'}; box-sizing: border-box;">
                    ${escapeHtml(resolvedText)}
                </div>`;
        }

        case 'details-table': {
            let rowPad = p.rowPadding !== undefined ? p.rowPadding : 3;
            const labelW = p.labelWidth || (template && template.labelWidth ? template.labelWidth : 38);
            const valSpacing = p.labelValueSpacing !== undefined ? p.labelValueSpacing : (template && template.labelValueSpacing !== undefined ? template.labelValueSpacing : 8);
            const labelColor = p.labelColor || '#475569';
            const valueColor = p.valueColor || '#0f172a';
            let fontSize = p.fontSize || 8;
            const addressWrap = p.addressWrap !== false;
            const autoFit = p.autoFit !== false;

            const validityCalculated = resolveUiceTokens('{{validUntil}}', emp, validityYears, issueDate);

            const rows = [
                { label: 'Staff ID:', value: emp.id || 'VSA-0042' },
                { label: 'Father:', value: emp.fatherName || 'Ghulam Ahmad' },
                { label: 'Dept:', value: emp.department || 'Operations' },
                { label: 'Blood Group:', value: emp.bloodGroup || 'O+' },
                { label: 'Validity:', value: validityCalculated || '31-12-2028' },
                { label: 'Address:', value: emp.currentAddress || emp.permanentAddress || 'Srinagar, Kashmir', isAddress: true },
                { label: 'Mobile:', value: emp.mobile || '+91 9419000000' }
            ];

            rows.forEach(r => {
                if (typeof r.value === 'string' && r.value.includes('{{')) {
                    r.value = resolveUiceTokens(r.value, emp, validityYears, issueDate);
                }
            });

            if (autoFit && el.height) {
                const rowCount = rows.length;
                let estH = (rowCount * (fontSize * 1.25 + rowPad * 2)) + (addressWrap ? (fontSize * 1.2) : 0);
                if (estH > el.height) {
                    if (rowPad > 1.5) rowPad = Math.max(1, rowPad - 1.5);
                    estH = (rowCount * (fontSize * 1.25 + rowPad * 2)) + (addressWrap ? (fontSize * 1.2) : 0);
                }
                if (estH > el.height && fontSize > 6.5) {
                    fontSize = Math.max(6.5, Math.floor((el.height - (rowCount * rowPad * 2)) / (rowCount * 1.25)));
                }
            }

            const rowsHtml = rows.map(r => {
                const whiteSpace = (r.isAddress && addressWrap) ? 'normal' : 'nowrap';
                const wordBreak = (r.isAddress && addressWrap) ? 'break-word' : 'normal';
                const lineH = (r.isAddress && addressWrap) ? '1.15' : '1.2';
                return `
                <tr style="border-bottom: 0.5px solid rgba(128,128,128,0.15);">
                    <td style="font-size: ${fontSize}px; font-weight: 600; color: ${labelColor}; padding: ${rowPad}px 0; width: ${labelW}%; text-transform: uppercase; white-space: nowrap; letter-spacing: 0.5px; vertical-align: top;">${escapeHtml(r.label)}</td>
                    <td style="font-size: ${fontSize}px; font-weight: 700; color: ${valueColor}; padding: ${rowPad}px 0; width: ${100 - labelW}%; padding-left: ${valSpacing}px; white-space: ${whiteSpace}; word-break: ${wordBreak}; line-height: ${lineH}; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.5px; vertical-align: top;">${escapeHtml(r.value)}</td>
                </tr>`;
            }).join('');

            return `
                <div style="width: 100%; height: 100%; overflow: hidden; pointer-events: none;">
                    <table style="width: 100%; border-collapse: collapse; table-layout: fixed;">
                        ${rowsHtml}
                    </table>
                </div>`;
        }

        case 'qr-code': {
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const qrHost = (isLocalhost && VSA_STATE.lanIp && !VSA_STATE.lanIp.startsWith('localhost'))
                ? VSA_STATE.lanIp
                : window.location.host;
            const secureTokenParam = emp.secureToken ? `&token=${emp.secureToken}` : '';
            const verificationUrl = `${window.location.protocol}//${qrHost}/verification.html?id=${emp.id || 'VSA-0042'}${secureTokenParam}`;
            const qrSize = Math.min(el.width, el.height) - (p.quietZone || 2) * 2;

            return `
                <div style="width: 100%; height: 100%; background: ${p.background || '#ffffff'}; padding: ${p.quietZone || 2}px; border-radius: 6px; box-shadow: 0 2px 6px rgba(0,0,0,0.15); border: ${p.borderWidth || 1.5}px solid ${p.borderColor || '#009688'}; display: flex; align-items: center; justify-content: center; box-sizing: border-box; pointer-events: none;">
                    <canvas class="qr-canvas qr-canvas-rendered" data-qr-val="${verificationUrl}" data-qr-size="${qrSize}" data-qr-bg="${p.background || '#ffffff'}" data-qr-fg="${p.foreground || '#000000'}" data-qr-level="${p.errorCorrection || 'H'}" style="width: ${qrSize}px; height: ${qrSize}px; display: block;"></canvas>
                </div>`;
        }

        case 'barcode': {
            return `
                <div style="width: 100%; height: 100%; background: ${p.background || '#ffffff'}; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; pointer-events: none;">
                    <canvas class="barcode-canvas-rendered" data-barcode-val="${emp.id || 'VSA-0042'}" data-barcode-type="${p.format || 'CODE128'}" data-barcode-bg="${p.background || '#ffffff'}" data-barcode-fg="${p.lineColor || '#000000'}" style="width: ${el.width - 4}px; height: ${p.showText ? el.height - 12 : el.height}px; display: block;"></canvas>
                    ${p.showText ? `<span style="font-family: 'JetBrains Mono', monospace; font-size: ${p.fontSize || 8.5}px; font-weight: 800; color: #334155; letter-spacing: 0.8px; margin-top: 1px;">${emp.id || 'VSA-0042'}</span>` : ''}
                </div>`;
        }

        case 'signature': {
            const sigSrc = resolveUiceSigSrc(p.preset);
            return `
                <div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; box-sizing: border-box; pointer-events: none;">
                    <div style="flex-grow: 1; width: 100%; display: flex; align-items: center; justify-content: center;">
                        ${sigSrc}
                    </div>
                    <div style="font-size: 6px; font-weight: 800; color: #475569; text-transform: uppercase; letter-spacing: 0.8px; border-top: 1px solid #94a3b8; padding-top: 2px; width: 100%; text-align: center; white-space: nowrap;">
                        ${p.label || 'AUTHORITY SIGNATURE'}
                    </div>
                </div>`;
        }

        case 'shape': {
            return `
                <div style="width: 100%; height: 100%; background: ${p.fill || '#0e3e2b'}; border: ${p.borderWidth || 0}px solid ${p.borderColor || 'transparent'}; border-radius: ${p.borderRadius || 0}px; opacity: ${p.opacity !== undefined ? p.opacity : 1}; pointer-events: none;"></div>`;
        }

        case 'custom-text': {
            const rawText = p.text || 'Custom Text';
            const resolvedText = resolveUiceTokens(rawText, emp, validityYears, issueDate);
            return `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; pointer-events: none;">
                    <div style="font-family: ${p.fontFamily || "'Plus Jakarta Sans', sans-serif"}; font-size: ${p.fontSize || 12}px; font-weight: ${p.fontWeight || 600}; color: ${p.color || '#0f172a'}; text-align: ${p.textAlign || 'left'}; text-transform: ${p.textTransform || 'none'}; line-height: 1.2; width: 100%;">
                        ${resolvedText}
                    </div>
                </div>`;
        }

        case 'guilloche-pattern': {
            const svg = generateGuillocheSvg(el.width, el.height, p);
            return `<div class="uice-guilloche-container" style="width: 100%; height: 100%; pointer-events: none;">${svg}</div>`;
        }

        case 'hologram-overlay': {
            return generateHologramFoilHtml(el, p);
        }

        case 'microtext-line': {
            return generateMicrotextLineHtml(el, p, emp, validityYears, issueDate);
        }

        case 'security-watermark': {
            return generateSecurityWatermarkHtml(el, p);
        }

        case 'svg-wave-top': {
            const headerBg = p.headerBgColor || '#0d7a6e';
            const accent = p.accentColor || '#009688';
            const gradId = `uiceWaveGrad_${(el.id || 'wave').replace(/[^a-zA-Z0-9_]/g, '')}`;
            const isHoriz = el.width >= 400;

            if (isHoriz) {
                return `
                    <div style="width: 100%; height: 100%; pointer-events: none; overflow: hidden;">
                        <svg viewBox="0 0 500 120" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <defs>
                                <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="${headerBg}" />
                                    <stop offset="60%" stop-color="${accent}" />
                                    <stop offset="100%" stop-color="#00b4d8" />
                                </linearGradient>
                            </defs>
                            <path d="M0,0 L500,0 L500,60 C420,54 330,50 205,58 C135,66 50,112 0,106 Z" fill="${accent}" opacity="0.32"/>
                            <path d="M0,0 L500,0 L500,50 C420,46 330,42 200,50 C130,58 45,106 0,100 Z" fill="url(#${gradId})"/>
                        </svg>
                    </div>`;
            } else {
                return `
                    <div style="width: 100%; height: 100%; pointer-events: none; overflow: hidden;">
                        <svg viewBox="0 0 320 145" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <defs>
                                <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stop-color="${headerBg}" />
                                    <stop offset="60%" stop-color="${accent}" />
                                    <stop offset="100%" stop-color="#00b4d8" />
                                </linearGradient>
                            </defs>
                            <path d="M0,0 L320,0 L320,85 C250,130 180,80 110,120 C50,145 15,115 0,130 Z" fill="${accent}" opacity="0.32"/>
                            <path d="M0,0 L320,0 L320,72 C230,118 150,72 90,108 C40,128 10,105 0,118 Z" fill="url(#${gradId})"/>
                        </svg>
                    </div>`;
            }
        }

        case 'svg-wave-bottom': {
            const headerBg = p.headerBgColor || '#0d7a6e';
            const accent = p.accentColor || '#009688';
            const isHoriz = el.width >= 400;

            if (isHoriz) {
                return `
                    <div style="width: 100%; height: 100%; pointer-events: none; overflow: hidden;">
                        <svg viewBox="0 0 500 42" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <path d="M330,42 C400,18 450,24 500,8 L500,42 Z" fill="${accent}" opacity="0.6"/>
                            <path d="M380,42 C430,22 470,24 500,14 L500,42 Z" fill="${headerBg}"/>
                        </svg>
                    </div>`;
            } else {
                return `
                    <div style="width: 100%; height: 100%; pointer-events: none; overflow: hidden;">
                        <svg viewBox="0 0 320 40" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <path d="M80,40 C160,10 240,35 320,8 L320,40 Z" fill="${accent}" opacity="0.75"/>
                            <path d="M120,40 C190,18 260,36 320,18 L320,40 Z" fill="${headerBg}"/>
                        </svg>
                    </div>`;
            }
        }

        case 'guilloche-waves': {
            const accent = p.color || '#009688';
            const opacity = p.opacity !== undefined ? p.opacity : 0.10;
            const isHoriz = el.width >= 400;

            if (isHoriz) {
                return `
                    <div style="width: 100%; height: 100%; pointer-events: none; opacity: ${opacity}; overflow: hidden;">
                        <svg viewBox="0 0 500 320" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <path d="M-50,140 C50,110 120,230 220,160 C320,90 380,240 520,170" fill="none" stroke="${accent}" stroke-width="1.2"/>
                            <path d="M-50,165 C60,135 130,255 230,185 C330,115 390,265 520,195" fill="none" stroke="${accent}" stroke-width="1.2"/>
                            <path d="M-50,190 C70,160 140,280 240,210 C340,140 400,290 520,220" fill="none" stroke="${accent}" stroke-width="1.2"/>
                            <path d="M-50,215 C80,185 150,305 250,235 C350,165 410,315 520,245" fill="none" stroke="${accent}" stroke-width="1.2"/>
                            <path d="M-50,240 C90,210 160,330 260,260 C360,190 420,340 520,270" fill="none" stroke="${accent}" stroke-width="1.2"/>
                        </svg>
                    </div>`;
            } else {
                return `
                    <div style="width: 100%; height: 100%; pointer-events: none; opacity: ${opacity}; overflow: hidden;">
                        <svg viewBox="0 0 320 500" preserveAspectRatio="none" style="width: 100%; height: 100%; display: block;">
                            <path d="M-30,220 C40,170 120,310 210,240 C260,200 290,290 350,260" fill="none" stroke="${accent}" stroke-width="1.2"/>
                            <path d="M-30,245 C50,195 130,335 220,265 C270,225 300,315 350,285" fill="none" stroke="${accent}" stroke-width="1.2"/>
                            <path d="M-30,270 C60,220 140,360 230,290 C280,250 310,340 350,310" fill="none" stroke="${accent}" stroke-width="1.2"/>
                            <path d="M-30,295 C70,245 150,385 240,315 C290,275 320,365 350,335" fill="none" stroke="${accent}" stroke-width="1.2"/>
                        </svg>
                    </div>`;
            }
        }

        default:
            return `<div style="width: 100%; height: 100%; border: 1px dashed #64748b;"></div>`;
    }
}

function resolveUiceLogoSrc(preset) {
    if (preset === 'preset-vsa-logo') {
        const vsaLogo = getVsaDefaultLogo();
        if (vsaLogo && vsaLogo.startsWith('data:image/')) {
            return `<img src="${vsaLogo}" alt="Logo" crossorigin="anonymous" style="max-width: 100%; max-height: 100%; object-fit: contain;">`;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="#009688" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
}

function resolveUiceSigSrc(preset) {
    if (preset === 'preset-vsa-sig') {
        const vsaSig = getVsaDefaultSig();
        if (vsaSig && vsaSig.startsWith('data:image/')) {
            return `<img src="${vsaSig}" alt="Signature" crossorigin="anonymous" style="max-height: 100%; max-width: 100%; object-fit: contain;">`;
        }
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="30" viewBox="0 0 150 40"><path d="M10,25 C30,10 50,35 70,15 C90,-5 110,30 130,20" fill="none" stroke="#000000" stroke-width="2" stroke-linecap="round"/></svg>`;
}

/**
 * Renders the Layers Manager list in the left panel.
 */
function renderUiceLayersList() {
    const listContainer = document.getElementById('uice-layers-container');
    const countBadge = document.getElementById('lbl-uice-layer-count');
    if (!listContainer) return;

    const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
    if (!layout) return;

    const elements = getUiceActiveElements(layout);
    if (countBadge) countBadge.textContent = elements.length;

    // Sort reversed so highest Z-index is at top
    const sorted = [...elements].sort((a, b) => (b.zIndex || 1) - (a.zIndex || 1));

    listContainer.innerHTML = sorted.map(el => {
        const isSelected = el.id === UICE_STATE.selectedId;
        return `
            <div class="uice-layer-item ${isSelected ? 'selected' : ''} ${el.locked ? 'locked' : ''}" data-id="${el.id}">
                <div class="uice-layer-drag-handle">
                    <i data-lucide="grip-vertical" style="width: 12px; height: 12px;"></i>
                </div>
                <div class="uice-layer-name" title="${el.name || el.type}">
                    ${el.name || el.type}
                </div>
                <div class="uice-layer-actions">
                    <button type="button" class="uice-layer-btn btn-layer-up" data-id="${el.id}" title="Bring Forward">
                        <i data-lucide="chevron-up" style="width: 12px; height: 12px;"></i>
                    </button>
                    <button type="button" class="uice-layer-btn btn-layer-down" data-id="${el.id}" title="Send Backward">
                        <i data-lucide="chevron-down" style="width: 12px; height: 12px;"></i>
                    </button>
                    <button type="button" class="uice-layer-btn btn-layer-dup" data-id="${el.id}" title="Duplicate Layer">
                        <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                    </button>
                    <button type="button" class="uice-layer-btn btn-layer-lock ${el.locked ? 'active' : ''}" data-id="${el.id}" title="${el.locked ? 'Unlock' : 'Lock'}">
                        <i data-lucide="${el.locked ? 'lock' : 'unlock'}" style="width: 12px; height: 12px;"></i>
                    </button>
                    <button type="button" class="uice-layer-btn btn-layer-vis ${el.visible === false ? 'active' : ''}" data-id="${el.id}" title="${el.visible === false ? 'Show' : 'Hide'}">
                        <i data-lucide="${el.visible === false ? 'eye-off' : 'eye'}" style="width: 12px; height: 12px;"></i>
                    </button>
                    <button type="button" class="uice-layer-btn btn-layer-del" data-id="${el.id}" title="Delete" style="color: #ef4444;">
                        <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                    </button>
                </div>
            </div>`;
    }).join('');

    // Attach click listeners to layer rows
    listContainer.querySelectorAll('.uice-layer-item').forEach(row => {
        row.addEventListener('click', function(e) {
            if (e.target.closest('.uice-layer-actions')) return;
            const id = this.getAttribute('data-id');
            selectUiceElement(id);
        });
    });

    // Layer action buttons: Reorder Up
    listContainer.querySelectorAll('.btn-layer-up').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            const el = elements.find(x => x.id === id);
            if (el) {
                el.zIndex = (el.zIndex || 1) + 1;
                renderUiceStage();
                pushUiceHistory(`Bring Forward ${el.name || el.type}`);
            }
        });
    });

    // Layer action buttons: Reorder Down
    listContainer.querySelectorAll('.btn-layer-down').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            const el = elements.find(x => x.id === id);
            if (el) {
                el.zIndex = Math.max(0, (el.zIndex || 1) - 1);
                renderUiceStage();
                pushUiceHistory(`Send Backward ${el.name || el.type}`);
            }
        });
    });

    // Layer action buttons: Duplicate
    listContainer.querySelectorAll('.btn-layer-dup').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            duplicateUiceElement(id);
        });
    });

    // Layer action buttons: Lock
    listContainer.querySelectorAll('.btn-layer-lock').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            const el = elements.find(x => x.id === id);
            if (el) {
                el.locked = !el.locked;
                renderUiceStage();
                pushUiceHistory(`${el.locked ? 'Lock' : 'Unlock'} ${el.name}`);
            }
        });
    });

    listContainer.querySelectorAll('.btn-layer-vis').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            const el = elements.find(x => x.id === id);
            if (el) {
                el.visible = el.visible === false ? true : false;
                renderUiceStage();
                pushUiceHistory(`${el.visible ? 'Show' : 'Hide'} ${el.name}`);
            }
        });
    });

    listContainer.querySelectorAll('.btn-layer-del').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            deleteUiceElement(id);
        });
    });

    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: listContainer });
    }
}

/**
 * Selects an element by ID and updates the Property Inspector.
 */
function selectUiceElement(id) {
    UICE_STATE.selectedId = id;
    renderUiceStage();
}

/**
 * Deletes an element from the active layout.
 */
function deleteUiceElement(id) {
    const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
    if (!layout) return;

    const elements = getUiceActiveElements(layout);
    const idx = elements.findIndex(x => x.id === id);
    if (idx !== -1) {
        const removed = elements.splice(idx, 1)[0];
        if (UICE_STATE.selectedId === id) {
            UICE_STATE.selectedId = null;
        }
        renderUiceStage();
        pushUiceHistory(`Delete ${removed.name || removed.type}`);
    }
}

/**
 * Duplicates an element with a 12px offset.
 */
function duplicateUiceElement(id) {
    const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
    if (!layout) return;

    const elements = getUiceActiveElements(layout);
    const source = elements.find(x => x.id === id);
    if (!source) return;

    const clone = JSON.parse(JSON.stringify(source));
    clone.id = 'uice-elem-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    clone.name = `${source.name || source.type} (Copy)`;
    clone.x = Math.min(layout.width - clone.width, clone.x + 12);
    clone.y = Math.min(layout.height - clone.height, clone.y + 12);
    clone.zIndex = (source.zIndex || 1) + 1;
    clone.locked = false;

    elements.push(clone);
    UICE_STATE.selectedId = clone.id;
    renderUiceStage();
    pushUiceHistory(`Duplicate ${source.name || source.type}`);
}

/**
 * Adds a new element of the specified type to the center of the canvas.
 */
function addUiceElement(type) {
    const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
    if (!layout) return;

    const elements = getUiceActiveElements(layout);
    const id = 'uice-elem-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);
    const centerX = Math.round((layout.width - 120) / 2);
    const centerY = Math.round((layout.height - 40) / 2);

    let newEl = null;

    switch (type) {
        case 'agency-brand':
            newEl = {
                id,
                type: 'agency-brand',
                name: 'Agency Header',
                x: 16,
                y: 12,
                width: 280,
                height: 42,
                zIndex: elements.length + 1,
                properties: {
                    title: 'VALLEY SECURITY AGENCY',
                    subtitle: 'SHAHIDGUNJ SRINAGAR',
                    titleFontSize: 12,
                    subtitleFontSize: 6.5,
                    color: '#ffffff',
                    logoSize: 32,
                    logoPreset: 'preset-vsa-logo'
                }
            };
            break;

        case 'agency-logo':
            newEl = {
                id,
                type: 'agency-logo',
                name: 'Agency Logo',
                x: centerX,
                y: centerY,
                width: 48,
                height: 48,
                zIndex: elements.length + 1,
                properties: { logoPreset: 'preset-vsa-logo' }
            };
            break;

        case 'employee-photo':
            newEl = {
                id,
                type: 'employee-photo',
                name: 'Employee Photo',
                x: centerX,
                y: centerY,
                width: 100,
                height: 100,
                zIndex: elements.length + 1,
                properties: { shape: 'circle', borderWidth: 3, borderColor: '#ffffff', outlineColor: '#009688' }
            };
            break;

        case 'employee-name':
            newEl = {
                id,
                type: 'employee-name',
                name: 'Employee Name',
                x: centerX - 40,
                y: centerY,
                width: 200,
                height: 28,
                zIndex: elements.length + 1,
                properties: { fontSize: 16, fontWeight: 800, color: '#0f172a', textAlign: 'center', textTransform: 'uppercase' }
            };
            break;

        case 'designation':
            newEl = {
                id,
                type: 'designation',
                name: 'Designation',
                x: centerX - 40,
                y: centerY,
                width: 200,
                height: 20,
                zIndex: elements.length + 1,
                properties: { fontSize: 10.5, fontWeight: 700, color: '#009688', textAlign: 'center', textTransform: 'uppercase' }
            };
            break;

        case 'details-table':
            newEl = {
                id,
                type: 'details-table',
                name: 'Details Table',
                x: 20,
                y: centerY,
                width: layout.width - 40,
                height: 100,
                zIndex: elements.length + 1,
                properties: { fontSize: 8, labelColor: '#475569', valueColor: '#0f172a', rowPadding: 3, labelWidth: 38 }
            };
            break;

        case 'qr-code':
            newEl = {
                id,
                type: 'qr-code',
                name: 'QR Code',
                x: centerX,
                y: centerY,
                width: 54,
                height: 54,
                zIndex: elements.length + 1,
                properties: { errorCorrection: 'H', foreground: '#000000', background: '#ffffff', quietZone: 2, borderColor: '#009688', borderWidth: 1.5 }
            };
            break;

        case 'barcode':
            newEl = {
                id,
                type: 'barcode',
                name: 'Barcode',
                x: centerX - 20,
                y: centerY,
                width: 120,
                height: 28,
                zIndex: elements.length + 1,
                properties: { format: 'CODE128', lineColor: '#000000', background: '#ffffff', showText: true, fontSize: 8.5 }
            };
            break;

        case 'signature':
            newEl = {
                id,
                type: 'signature',
                name: 'Signature',
                x: centerX,
                y: centerY,
                width: 100,
                height: 44,
                zIndex: elements.length + 1,
                properties: { preset: 'preset-vsa-sig', label: 'AUTHORITY SIGNATURE' }
            };
            break;

        case 'badge-pill':
            newEl = {
                id,
                type: 'badge-pill',
                name: 'Title Badge',
                x: centerX - 30,
                y: 14,
                width: 160,
                height: 26,
                zIndex: elements.length + 1,
                properties: { text: 'SECURITY ID CARD', background: '#009688', color: '#ffffff', fontSize: 11, fontWeight: 800, borderRadius: 6 }
            };
            break;

        case 'custom-text':
            newEl = {
                id,
                type: 'custom-text',
                name: 'Custom Text',
                x: centerX,
                y: centerY,
                width: 140,
                height: 24,
                zIndex: elements.length + 1,
                properties: { text: 'Custom Text Label', fontSize: 12, fontWeight: 600, color: '#0f172a' }
            };
            break;

        case 'shape':
            newEl = {
                id,
                type: 'shape',
                name: 'Accent Shape',
                x: centerX - 40,
                y: centerY - 20,
                width: 120,
                height: 40,
                zIndex: 1,
                properties: { fill: '#009688', borderWidth: 0, borderRadius: 8, opacity: 1 }
            };
            break;

        case 'guilloche-pattern':
            newEl = {
                id,
                type: 'guilloche-pattern',
                name: 'Guilloche Wave Pattern',
                x: 10,
                y: 10,
                width: layout.width - 20,
                height: Math.min(80, Math.round(layout.height * 0.3)),
                zIndex: 1,
                properties: {
                    style: 'harmonic',
                    strokeColor: '#009688',
                    frequency: 4,
                    waveCount: 8,
                    amplitude: 12,
                    strokeWidth: 0.75,
                    opacity: 0.25
                }
            };
            break;

        case 'hologram-overlay':
            newEl = {
                id,
                type: 'hologram-overlay',
                name: 'Holographic Foil Badge',
                x: layout.width - 64,
                y: layout.height - 64,
                width: 48,
                height: 48,
                zIndex: elements.length + 1,
                properties: {
                    foilStyle: 'silver',
                    badgeShape: 'circle',
                    crest: 'vsa-crest',
                    label: 'SECURE'
                }
            };
            break;

        case 'microtext-line':
            newEl = {
                id,
                type: 'microtext-line',
                name: 'Microtext Security Line',
                x: 15,
                y: centerY,
                width: layout.width - 30,
                height: 8,
                zIndex: elements.length + 1,
                properties: {
                    text: 'VALLEY SECURITY AGENCY • OFFICIAL CREDENTIAL • AUTHENTIC IDENTIFICATION • PSARA COMPLIANT • SECURE ACCESS • ',
                    fontSize: 4.5,
                    letterSpacing: 1.2,
                    color: '#475569',
                    repeatCount: 6,
                    opacity: 0.85
                }
            };
            break;

        case 'security-watermark':
            newEl = {
                id,
                type: 'security-watermark',
                name: 'Security Watermark',
                x: Math.round((layout.width - 120) / 2),
                y: Math.round((layout.height - 120) / 2),
                width: 120,
                height: 120,
                zIndex: 1,
                properties: {
                    preset: 'vsa-crest',
                    rotation: 0,
                    opacity: 0.10,
                    grayscale: true
                }
            };
            break;
    }

    if (newEl) {
        elements.push(newEl);
        UICE_STATE.selectedId = newEl.id;
        renderUiceStage();
        pushUiceHistory(`Add ${newEl.name}`);
    }
}

/**
 * Calculates WCAG 2.1 relative luminance and contrast ratio between two hex/rgb colors.
 * Contrast Ratio formula: (L1 + 0.05) / (L2 + 0.05) where L1 is lighter and L2 is darker.
 * @param {string} fgHex - Foreground color (hex or rgb)
 * @param {string} bgHex - Background color (hex or rgb)
 * @returns {number} Contrast ratio rounded to 1 decimal place (e.g. 21.0 for pure black on pure white)
 */
function calculateColorContrast(fgHex, bgHex) {
    function parseRgb(colorStr) {
        if (!colorStr) return [0, 0, 0];
        colorStr = String(colorStr).trim();
        if (colorStr.startsWith('#')) {
            let hex = colorStr.slice(1);
            if (hex.length === 3) {
                hex = hex.split('').map(c => c + c).join('');
            }
            const intVal = parseInt(hex, 16);
            if (isNaN(intVal)) return [0, 0, 0];
            return [(intVal >> 16) & 255, (intVal >> 8) & 255, intVal & 255];
        } else if (colorStr.startsWith('rgb')) {
            const parts = colorStr.match(/\d+/g);
            if (parts && parts.length >= 3) {
                return [parseInt(parts[0], 10), parseInt(parts[1], 10), parseInt(parts[2], 10)];
            }
        }
        return [0, 0, 0];
    }

    function getLuminance([r, g, b]) {
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    const rgb1 = parseRgb(fgHex || '#000000');
    const rgb2 = parseRgb(bgHex || '#ffffff');
    const lum1 = getLuminance(rgb1);
    const lum2 = getLuminance(rgb2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    const ratio = (brightest + 0.05) / (darkest + 0.05);
    return Math.round(ratio * 10) / 10;
}

/**
 * Builds the canonical security verification URL for an employee ID card.
 * @param {Object} emp - Employee data record
 * @returns {string} Fully qualified verification URL
 */
function getUiceVerificationUrl(emp) {
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const qrHost = (isLocalhost && typeof VSA_STATE !== 'undefined' && VSA_STATE.lanIp && !VSA_STATE.lanIp.startsWith('localhost'))
        ? VSA_STATE.lanIp
        : ((typeof window !== 'undefined' && window.location.host) ? window.location.host : 'valleysolutions.in');
    const empId = emp ? (emp.id || 'VSA-0042') : 'VSA-0042';
    const secureTokenParam = (emp && emp.secureToken) ? `&token=${emp.secureToken}` : '';
    const protocol = (typeof window !== 'undefined' && window.location.protocol && window.location.protocol.startsWith('http')) 
        ? window.location.protocol 
        : 'https:';
    return `${protocol}//${qrHost}/verification.html?id=${empId}${secureTokenParam}`;
}

/**
 * Evaluates the optical scannability of a QR element against industrial standards:
 * - Size: Recommended >= 48px, Minimum critical >= 40px
 * - Aspect Ratio Distortion: Absolute difference between width and height <= 5%
 * - Contrast Ratio: >= 7.0:1 (Optimal), 4.5:1 - 6.9:1 (Warning), < 4.5:1 (Critical failure)
 * - Quiet Zone: >= 2px
 * - Error Correction Level: H (30%) or Q (25%) recommended; L (7%) triggers warning
 * 
 * @param {Object} el - QR element node from layout
 * @param {Object} emp - Employee data record
 * @returns {Object} Comprehensive diagnostic report
 */
function validateQrScannability(el, emp) {
    const p = (el && el.properties) || {};
    const w = el ? (el.width || 54) : 54;
    const h = el ? (el.height || 54) : 54;
    const minDim = Math.min(w, h);
    const maxDim = Math.max(w, h);
    const fg = p.foreground || '#000000';
    const bg = p.background || '#ffffff';
    const ecc = p.errorCorrection || 'H';
    const quiet = p.quietZone !== undefined ? p.quietZone : 2;

    const contrast = calculateColorContrast(fg, bg);
    const ratioDiff = maxDim > 0 ? Math.abs(w - h) / maxDim : 0;

    const passes = [];
    const warnings = [];
    const issues = []; // critical

    // 1. Minimum Dimensions Check
    if (minDim < 40) {
        issues.push(`Critical size issue: ${Math.round(minDim)}px is below 40px critical scanning limit.`);
    } else if (minDim < 48) {
        warnings.push(`Recommended size is >= 48px (currently ${Math.round(minDim)}px). Low-resolution cameras may experience scanning lag.`);
    } else {
        passes.push(`Size ${Math.round(w)}×${Math.round(h)}px meets high-reliability print standards.`);
    }

    // 2. Aspect Ratio Distortion Check
    if (ratioDiff > 0.05) {
        issues.push(`Distortion detected: QR code aspect ratio is not 1:1 (${Math.round(w)}×${Math.round(h)}px). Optical sensors cannot decode non-square matrices.`);
    } else {
        passes.push(`Proportion is square 1:1 (distortion: 0%).`);
    }

    // 3. Contrast Check
    if (contrast < 4.5) {
        issues.push(`Critical contrast failure: Contrast ratio is ${contrast}:1 (minimum 4.5:1 required). Modules blend into background.`);
    } else if (contrast < 7.0) {
        warnings.push(`Contrast is ${contrast}:1. Sunlight glare or dim lighting may cause scan failures (recommended >= 7.0:1).`);
    } else {
        passes.push(`Contrast ratio is ${contrast}:1 (exceeds 7.0:1 ISO/IEC 18004 standard).`);
    }

    // 4. Quiet Zone
    if (quiet < 1) {
        warnings.push(`Quiet zone is ${quiet}px. Surrounding borders may cause timing pattern detection failure.`);
    } else {
        passes.push(`Quiet zone is ${quiet}px.`);
    }

    // 5. Error Correction
    if (ecc === 'L') {
        warnings.push(`Error Correction Level 'L' (7%) has low resistance to badge scratches or lamination glare. Consider 'H' (30%) or 'Q' (25%).`);
    } else {
        passes.push(`Error Correction Level '${ecc}' enabled.`);
    }

    let level = 'valid';
    if (issues.length > 0) {
        level = 'critical';
    } else if (warnings.length > 0) {
        level = 'warning';
    }

    return {
        valid: issues.length === 0,
        level,
        minDim,
        contrast,
        ratioDiff,
        issues,
        warnings,
        passes,
        url: getUiceVerificationUrl(emp)
    };
}

/**
 * Evaluates the optical scannability of a Barcode element against GS1/ISO standards:
 * - Dimensions: Standard width >= 110px, height >= 22px; Critical width < 90px, height < 16px
 * - Content / Format: CODE128 (supports all alphanumeric), CODE39 (uppercase alphanumeric), EAN13 (strictly 12 or 13 digits)
 * - Proportions: Aspect ratio (width / height) >= 2.5:1 to maintain readable bar-space ratio
 * - Contrast: Ratio between line color and background >= 7.0:1 (optimal), < 4.5:1 (critical failure)
 * 
 * @param {Object} el - Barcode element node from layout
 * @param {Object} emp - Employee data record
 * @returns {Object} Comprehensive diagnostic report
 */
function validateBarcodeScannability(el, emp) {
    const p = (el && el.properties) || {};
    const w = el ? (el.width || 120) : 120;
    const h = el ? (el.height || 26) : 26;
    const format = (p.format || 'CODE128').toUpperCase();
    const fg = p.lineColor || '#000000';
    const bg = p.background || '#ffffff';
    const val = (emp && emp.id) ? String(emp.id) : 'VSA-0042';

    const contrast = calculateColorContrast(fg, bg);
    const passes = [];
    const warnings = [];
    const issues = []; // critical

    // 1. Dimensions Check
    if (w < 90 || h < 16) {
        issues.push(`Critical size issue: ${Math.round(w)}×${Math.round(h)}px is too small for standard 1D laser/CCD bar scanners (min 90×16px).`);
    } else if (w < 110 || h < 22) {
        warnings.push(`Barcode dimensions (${Math.round(w)}×${Math.round(h)}px) are compact. Recommended standard is >= 110×22px.`);
    } else {
        passes.push(`Dimensions ${Math.round(w)}×${Math.round(h)}px meet standard 1D optical scanning specifications.`);
    }

    // 2. Format & Value Compatibility
    if (format === 'EAN13') {
        const digitsOnly = /^\d{12,13}$/.test(val);
        if (!digitsOnly) {
            issues.push(`Format Error: EAN-13 strictly requires 12 or 13 digits, but payload is "${val}". Laser scanners will reject this barcode.`);
        } else {
            passes.push(`Payload "${val}" is valid for EAN-13.`);
        }
    } else if (format === 'CODE39') {
        const code39Valid = /^[0-9A-Z\-\.\ \$\/\+\%]+$/i.test(val);
        if (!code39Valid) {
            issues.push(`Format Error: CODE39 cannot encode non-standard characters in "${val}".`);
        } else {
            passes.push(`Payload "${val}" is valid for CODE39.`);
        }
    } else {
        // CODE128
        passes.push(`Format CODE128 supports full ASCII set for "${val}".`);
    }

    // 3. Aspect Ratio / Proportions
    const aspect = w / (h || 1);
    if (aspect < 2.5) {
        warnings.push(`Barcode is overly tall or narrow (aspect ratio ${aspect.toFixed(1)}:1). Standard aspect ratio is >= 3.0:1.`);
    } else {
        passes.push(`Aspect ratio ${aspect.toFixed(1)}:1 provides proper bar density.`);
    }

    // 4. Contrast Check
    if (contrast < 4.5) {
        issues.push(`Critical contrast failure: Contrast ratio is ${contrast}:1 (minimum 4.5:1 required). Laser barcode readers cannot detect bar edges.`);
    } else if (contrast < 7.0) {
        warnings.push(`Contrast is ${contrast}:1. Recommended contrast for laser readers is >= 7.0:1.`);
    } else {
        passes.push(`Contrast ratio is ${contrast}:1 (verified against white base).`);
    }

    let level = 'valid';
    if (issues.length > 0) {
        level = 'critical';
    } else if (warnings.length > 0) {
        level = 'warning';
    }

    return {
        valid: issues.length === 0,
        level,
        contrast,
        issues,
        warnings,
        passes,
        val,
        format
    };
}

/**
 * Scans an entire card layout for scannable optical elements (QR codes and barcodes)
 * and returns aggregate validation results with any critical blockers or warnings.
 * 
 * @param {Object} layout - Layout object with elements array
 * @param {Object} emp - Employee data record
 * @returns {Object} Comprehensive inspection report for export gatekeeper
 */
function checkLayoutScannability(layout, emp) {
    if (!layout || !Array.isArray(layout.elements)) {
        return { hasCritical: false, hasWarning: false, criticalCount: 0, warningCount: 0, messages: [], qrResults: [], barcodeResults: [] };
    }

    const messages = [];
    let criticalCount = 0;
    let warningCount = 0;
    const qrResults = [];
    const barcodeResults = [];

    layout.elements.forEach(el => {
        if (el.visible === false) return;

        if (el.type === 'qr-code') {
            const res = validateQrScannability(el, emp);
            qrResults.push({ el, res });
            if (res.level === 'critical') {
                criticalCount += res.issues.length;
                res.issues.forEach(msg => messages.push(`[QR Code "${el.name || el.id}"]: ${msg}`));
            } else if (res.level === 'warning') {
                warningCount += res.warnings.length;
                res.warnings.forEach(msg => messages.push(`[QR Code "${el.name || el.id}"]: ${msg}`));
            }
        }

        if (el.type === 'barcode') {
            const res = validateBarcodeScannability(el, emp);
            barcodeResults.push({ el, res });
            if (res.level === 'critical') {
                criticalCount += res.issues.length;
                res.issues.forEach(msg => messages.push(`[Barcode "${el.name || el.id}"]: ${msg}`));
            } else if (res.level === 'warning') {
                warningCount += res.warnings.length;
                res.warnings.forEach(msg => messages.push(`[Barcode "${el.name || el.id}"]: ${msg}`));
            }
        }
    });

    return {
        hasCritical: criticalCount > 0,
        hasWarning: warningCount > 0,
        criticalCount,
        warningCount,
        messages,
        qrResults,
        barcodeResults
    };
}

/**
 * Calculates optimal font size and line wrapping for text inside a bounding box.
 * 
 * Works deterministically in both Browser (using canvas measureText where possible)
 * and Node.js testing environments (using calibrated typographical metrics).
 *
 * @param {Object} options
 * @param {string} options.text - Raw text string to fit
 * @param {number} options.width - Available width in pixels
 * @param {number} options.height - Available height in pixels
 * @param {number} options.preferredSize - Desired font size (px)
 * @param {number} [options.minSize=6.5] - Minimum legible font size threshold
 * @param {number} [options.lineHeight=1.15] - Line height multiplier
 * @param {number} [options.letterSpacing=0] - Letter spacing in pixels
 * @param {boolean} [options.allowWrap=false] - Whether multi-line wrapping is permitted
 * @param {number} [options.maxLines=3] - Maximum lines if wrapping
 * @param {string} [options.fontFamily="'Plus Jakarta Sans', sans-serif"] - Font family
 * @param {string|number} [options.fontWeight='700'] - Font weight
 * @returns {Object} { fontSize, lines, isOverflowing, wrappedText, requiredWidth, requiredHeight }
 */
function calculateAutoFitFontSize(options) {
    const text = (options.text || '').trim();
    const width = Math.max(10, options.width || 100);
    const height = Math.max(10, options.height || 30);
    const preferredSize = options.preferredSize || 14;
    const minSize = options.minSize || 6.5;
    const lineHeight = options.lineHeight || 1.15;
    const letterSpacing = options.letterSpacing || 0;
    const allowWrap = !!options.allowWrap;
    const maxLines = options.maxLines || (allowWrap ? 3 : 1);
    const fontWeight = options.fontWeight || '700';

    if (!text) {
        return {
            fontSize: preferredSize,
            lines: 1,
            isOverflowing: false,
            wrappedText: [''],
            requiredWidth: 0,
            requiredHeight: preferredSize * lineHeight
        };
    }

    // Helper: measure width of a single line of text at given fontSize
    function measureLineWidth(lineStr, size) {
        if (typeof document !== 'undefined' && document.createElement) {
            try {
                if (!calculateAutoFitFontSize._canvas) {
                    calculateAutoFitFontSize._canvas = document.createElement('canvas');
                }
                const ctx = calculateAutoFitFontSize._canvas.getContext('2d');
                if (ctx) {
                    ctx.font = `${fontWeight} ${size}px ${options.fontFamily || "'Plus Jakarta Sans', sans-serif"}`;
                    const metrics = ctx.measureText(lineStr);
                    const spacing = lineStr.length > 1 ? (lineStr.length - 1) * letterSpacing : 0;
                    return metrics.width + spacing;
                }
            } catch (e) {
                // fallback to math heuristic below
            }
        }
        // Deterministic typographical factor for headless / Node / fallback
        // Uppercase letters average ~0.65em; mixed case ~0.54em
        const isUpper = lineStr === lineStr.toUpperCase();
        const factor = isUpper ? 0.65 : 0.54;
        const spacing = lineStr.length > 1 ? (lineStr.length - 1) * letterSpacing : 0;
        return (lineStr.length * size * factor) + spacing;
    }

    // Helper: break text into lines at given fontSize
    function wrapTextToLines(str, size, maxW) {
        const words = str.split(/\s+/);
        if (words.length <= 1) return [str];

        const lines = [];
        let curLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const testLine = curLine + ' ' + words[i];
            const testW = measureLineWidth(testLine, size);
            if (testW <= maxW) {
                curLine = testLine;
            } else {
                lines.push(curLine);
                curLine = words[i];
            }
        }
        lines.push(curLine);
        return lines;
    }

    // Iterative fit: Start at preferredSize and step down by 0.5px to minSize
    let bestSize = minSize;
    let bestLines = [text];
    let fits = false;

    for (let testSize = preferredSize; testSize >= minSize; testSize -= 0.5) {
        let lines;
        if (allowWrap) {
            lines = wrapTextToLines(text, testSize, width);
        } else {
            lines = [text];
        }

        const lineCount = lines.length;
        if (lineCount > maxLines) {
            continue; // Exceeds line budget
        }

        const maxLineW = Math.max(...lines.map(l => measureLineWidth(l, testSize)));
        const totalH = lineCount * testSize * lineHeight;

        if (maxLineW <= width && totalH <= height) {
            bestSize = testSize;
            bestLines = lines;
            fits = true;
            break;
        }
    }

    if (!fits) {
        // At minSize, does it still exceed bounds?
        let lines = allowWrap ? wrapTextToLines(text, minSize, width) : [text];
        const maxLineW = Math.max(...lines.map(l => measureLineWidth(l, minSize)));
        const totalH = lines.length * minSize * lineHeight;
        const isOverflowing = maxLineW > width || totalH > height;

        return {
            fontSize: minSize,
            lines: lines.length,
            isOverflowing,
            wrappedText: lines,
            requiredWidth: Math.round(maxLineW),
            requiredHeight: Math.round(totalH)
        };
    }

    const finalW = Math.max(...bestLines.map(l => measureLineWidth(l, bestSize)));
    const finalH = bestLines.length * bestSize * lineHeight;

    return {
        fontSize: Math.round(bestSize * 10) / 10,
        lines: bestLines.length,
        isOverflowing: false,
        wrappedText: bestLines,
        requiredWidth: Math.round(finalW),
        requiredHeight: Math.round(finalH)
    };
}

/**
 * Validates the typographical fit of an element against its bounding geometry,
 * detecting text truncation, clipping, overflow risks, and legibility threshold.
 *
 * @param {Object} el - Element node from layout
 * @param {Object} [emp] - Employee data record
 * @returns {Object} Diagnostic report { valid, level, issues, warnings, passes, recommendedFontSize }
 */
function validateTypographyFit(el, emp) {
    if (!el) {
        return { valid: true, level: 'valid', issues: [], warnings: [], passes: ['Element exists'], recommendedFontSize: 12 };
    }

    const p = el.properties || {};
    const empData = emp || (typeof VSA_STATE !== 'undefined' && VSA_STATE.employees && VSA_STATE.employees[0]) || {
        id: 'VSA-0042',
        name: 'MOHD SALIM',
        designation: 'SECURITY GUARD',
        department: 'Operations',
        fatherName: 'Ghulam Ahmad',
        currentAddress: 'Srinagar, Kashmir',
        bloodGroup: 'O+'
    };

    const issues = [];
    const warnings = [];
    const passes = [];
    let recommendedFontSize = p.fontSize || 12;

    const w = el.width || 100;
    const h = el.height || 30;

    switch (el.type) {
        case 'agency-brand': {
            const title = p.title || 'VALLEY SECURITY AGENCY';
            const subtitle = p.subtitle || 'SHAHIDGUNJ SRINAGAR';
            const logoSize = p.logoSize || 32;
            const titleSize = p.titleFontSize || 12;
            const subSize = p.subtitleFontSize || 6.5;
            const letterSpacing = p.letterSpacing !== undefined ? p.letterSpacing : 0.4;
            const allowWrap = !!p.wrap;

            const textAvailW = Math.max(20, w - logoSize - 12);
            const fitTitle = calculateAutoFitFontSize({
                text: title,
                width: textAvailW,
                height: h * 0.65,
                preferredSize: titleSize,
                minSize: 7.5,
                lineHeight: p.lineHeight || 1.15,
                letterSpacing,
                allowWrap,
                maxLines: allowWrap ? 2 : 1,
                fontWeight: '800'
            });

            const fitSub = calculateAutoFitFontSize({
                text: subtitle,
                width: textAvailW,
                height: h * 0.35,
                preferredSize: subSize,
                minSize: 5.5,
                lineHeight: 1.1,
                letterSpacing,
                allowWrap: false,
                fontWeight: '600'
            });

            recommendedFontSize = fitTitle.fontSize;

            if (fitTitle.isOverflowing) {
                issues.push(`Agency title exceeds width bounds (${fitTitle.requiredWidth}px > ${Math.round(textAvailW)}px) even at minimum 7.5px font size.`);
            } else if (fitTitle.fontSize <= titleSize * 0.75 || fitTitle.fontSize <= 8.0) {
                warnings.push(`Agency title significantly reduced from ${titleSize}px to ${fitTitle.fontSize}px to fit header width.`);
            } else if (fitTitle.fontSize < titleSize) {
                passes.push(`Agency title auto-balanced to ${fitTitle.fontSize}px to fit artboard boundaries.`);
            } else {
                passes.push(`Agency title (${title.length} chars) fits comfortably at ${titleSize}px.`);
            }

            if (fitSub.isOverflowing) {
                warnings.push(`Agency subtitle exceeds width bounds (${fitSub.requiredWidth}px > ${Math.round(textAvailW)}px).`);
            } else if (fitSub.fontSize < subSize) {
                passes.push(`Agency subtitle auto-balanced to ${fitSub.fontSize}px.`);
            } else {
                passes.push(`Agency subtitle fits within header.`);
            }

            if (logoSize > h) {
                warnings.push(`Logo icon (${logoSize}px) is taller than header container (${h}px).`);
            } else {
                passes.push(`Logo proportion is balanced with header height.`);
            }
            break;
        }

        case 'employee-name': {
            const name = empData.name || 'MOHD SALIM';
            const fontSize = p.fontSize || 16;
            const allowWrap = !!p.wrap;
            const letterSpacing = p.letterSpacing !== undefined ? p.letterSpacing : 0.3;

            const fit = calculateAutoFitFontSize({
                text: name,
                width: w,
                height: h,
                preferredSize: fontSize,
                minSize: 7.5,
                lineHeight: p.lineHeight || 1.15,
                letterSpacing,
                allowWrap,
                maxLines: allowWrap ? 2 : 1,
                fontWeight: p.fontWeight || '800'
            });

            recommendedFontSize = fit.fontSize;

            if (fit.isOverflowing) {
                issues.push(`Employee name "${name}" exceeds bounds (${fit.requiredWidth}×${fit.requiredHeight}px > ${Math.round(w)}×${Math.round(h)}px). Text will clip.`);
            } else if (fit.fontSize <= fontSize * 0.75 || fit.fontSize <= 8.5) {
                warnings.push(`Font reduced from ${fontSize}px to ${fit.fontSize}px to fit long name without truncation.`);
            } else if (fit.fontSize < fontSize) {
                passes.push(`Employee name auto-fitted to ${fit.fontSize}px to prevent truncation.`);
            } else {
                passes.push(`Employee name fits safely at ${fontSize}px with zero overflow.`);
            }

            if (fit.lines > 1) {
                warnings.push(`Name is wrapped across ${fit.lines} lines.`);
            }
            break;
        }

        case 'designation': {
            const desig = empData.designation || 'SECURITY GUARD';
            const fontSize = p.fontSize || 10;
            const allowWrap = !!p.wrap;
            const letterSpacing = p.letterSpacing !== undefined ? p.letterSpacing : 0.5;

            const fit = calculateAutoFitFontSize({
                text: desig,
                width: w,
                height: h,
                preferredSize: fontSize,
                minSize: 6.5,
                lineHeight: p.lineHeight || 1.1,
                letterSpacing,
                allowWrap,
                maxLines: allowWrap ? 2 : 1,
                fontWeight: p.fontWeight || '700'
            });

            recommendedFontSize = fit.fontSize;

            if (fit.isOverflowing) {
                issues.push(`Designation "${desig}" exceeds bounds (${fit.requiredWidth}px > ${Math.round(w)}px).`);
            } else if (fit.fontSize < fontSize) {
                warnings.push(`Designation font reduced from ${fontSize}px to ${fit.fontSize}px.`);
            } else {
                passes.push(`Designation fits cleanly at ${fontSize}px.`);
            }
            break;
        }

        case 'details-table': {
            const rowPad = p.rowPadding !== undefined ? p.rowPadding : 3;
            const fontSize = p.fontSize || 8;
            const rowCount = 7;
            const addressWrap = p.addressWrap !== false;
            
            const singleRowH = (fontSize * 1.25) + (rowPad * 2);
            const totalTableH = (rowCount * singleRowH) + (addressWrap ? (fontSize * 1.2) : 0);

            recommendedFontSize = fontSize;

            if (totalTableH > h) {
                const overflowPx = Math.round(totalTableH - h);
                issues.push(`Table content height (${Math.round(totalTableH)}px) exceeds box height (${Math.round(h)}px) by ${overflowPx}px. Rows will spill over or clip.`);
                
                const availRowH = h / (rowCount + (addressWrap ? 1 : 0));
                const recPad = Math.max(1, Math.floor((availRowH - 9) / 2));
                const recFont = Math.max(6.5, Math.min(fontSize, Math.floor(availRowH - (recPad * 2))));
                recommendedFontSize = recFont;
            } else if (h - totalTableH < 5) {
                warnings.push(`Table fits tightly with less than 5px vertical clearance.`);
                passes.push(`All ${rowCount} employee information rows contained within table.`);
            } else {
                passes.push(`All ${rowCount} employee information rows fit within table area with safe margins.`);
            }
            break;
        }

        default: {
            const text = p.text || el.name || 'TEXT';
            const fontSize = p.fontSize || 12;
            const allowWrap = !!p.wrap;

            const fit = calculateAutoFitFontSize({
                text,
                width: w,
                height: h,
                preferredSize: fontSize,
                minSize: 6.5,
                lineHeight: p.lineHeight || 1.15,
                allowWrap,
                maxLines: allowWrap ? 3 : 1
            });

            recommendedFontSize = fit.fontSize;

            if (fit.isOverflowing) {
                issues.push(`Text exceeds container bounds (${fit.requiredWidth}×${fit.requiredHeight}px > ${Math.round(w)}×${Math.round(h)}px).`);
            } else if (fit.fontSize < fontSize) {
                warnings.push(`Text auto-fit scaled font from ${fontSize}px to ${fit.fontSize}px.`);
            } else {
                passes.push(`Text fits container dimensions.`);
            }
            break;
        }
    }

    let level = 'valid';
    if (issues.length > 0) {
        level = 'critical';
    } else if (warnings.length > 0) {
        level = 'warning';
    }

    return {
        valid: issues.length === 0,
        level,
        issues,
        warnings,
        passes,
        recommendedFontSize
    };
}

/**
 * Scans an entire card layout for typography overflow, clipping, or minimum size issues
 * across agency headers, employee name, designation, and details table.
 * 
 * @param {Object} layout - Layout object with elements array
 * @param {Object} emp - Employee data record
 * @returns {Object} Comprehensive inspection report for export gatekeeper
 */
function checkLayoutTypography(layout, emp) {
    if (!layout || !Array.isArray(layout.elements)) {
        return { hasCritical: false, hasWarning: false, criticalCount: 0, warningCount: 0, messages: [], results: [] };
    }

    const messages = [];
    let criticalCount = 0;
    let warningCount = 0;
    const results = [];

    layout.elements.forEach(el => {
        if (el.visible === false) return;

        if (['agency-brand', 'employee-name', 'designation', 'details-table', 'custom-text'].includes(el.type)) {
            const res = validateTypographyFit(el, emp);
            results.push({ el, res });
            if (res.level === 'critical') {
                criticalCount += res.issues.length;
                res.issues.forEach(msg => messages.push(`[${el.name || el.type}]: ${msg}`));
            } else if (res.level === 'warning') {
                warningCount += res.warnings.length;
                res.warnings.forEach(msg => messages.push(`[${el.name || el.type}]: ${msg}`));
            }
        }
    });

    return {
        hasCritical: criticalCount > 0,
        hasWarning: warningCount > 0,
        criticalCount,
        warningCount,
        messages,
        results
    };
}

/**
 * Updates the Right Property Inspector with the active element's properties.
 */
function updateUicePropertyInspector(el) {
    const emptyState = document.getElementById('uice-inspector-empty');
    const activeState = document.getElementById('uice-inspector-active');
    const typeBadge = document.getElementById('lbl-uice-selected-type');
    const idBadge = document.getElementById('lbl-uice-elem-id');

    if (!el) {
        if (emptyState) emptyState.style.display = 'flex';
        if (activeState) activeState.style.display = 'none';
        if (typeBadge) typeBadge.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (activeState) activeState.style.display = 'flex';
    if (typeBadge) {
        typeBadge.style.display = 'inline-block';
        typeBadge.textContent = el.type;
    }
    if (idBadge) {
        idBadge.textContent = el.name || el.id;
    }

    // Geometry fields
    const propX = document.getElementById('prop-uice-x');
    const propY = document.getElementById('prop-uice-y');
    const propW = document.getElementById('prop-uice-w');
    const propH = document.getElementById('prop-uice-h');
    const propRot = document.getElementById('prop-uice-rot');
    const propZ = document.getElementById('prop-uice-z');

    if (propX) propX.value = Math.round(el.x);
    if (propY) propY.value = Math.round(el.y);
    if (propW) propW.value = Math.round(el.width);
    if (propH) propH.value = Math.round(el.height);
    if (propRot) propRot.value = Math.round(el.rotation || 0);
    if (propZ) propZ.value = el.zIndex || 1;

    // Advanced Progressive Disclosure fields
    const propName = document.getElementById('prop-uice-name');
    const propOpacity = document.getElementById('prop-uice-opacity');
    const lblOpacity = document.getElementById('lbl-uice-opacity-val');
    const propShadow = document.getElementById('prop-uice-shadow');
    const propLock = document.getElementById('prop-uice-lock');

    if (propName) propName.value = el.name || el.type;
    const curOpacity = (el.properties && el.properties.opacity !== undefined) ? el.properties.opacity : 1;
    if (propOpacity) propOpacity.value = curOpacity;
    if (lblOpacity) lblOpacity.textContent = Math.round(curOpacity * 100) + '%';
    if (propShadow) propShadow.value = (el.properties && el.properties.shadow) || 'none';
    if (propLock) propLock.checked = !!el.locked;

    // Toggle specific sub-sections
    const secTypo = document.getElementById('prop-sec-typography');
    const secAgency = document.getElementById('prop-sec-agency');
    const secPhoto = document.getElementById('prop-sec-photo');
    const secQr = document.getElementById('prop-sec-qr');
    const secBarcode = document.getElementById('prop-sec-barcode');
    const secTable = document.getElementById('prop-sec-table');
    const secSig = document.getElementById('prop-sec-signature');
    const secShape = document.getElementById('prop-sec-shape');
    const secGuilloche = document.getElementById('prop-sec-guilloche');
    const secHologram = document.getElementById('prop-sec-hologram');
    const secMicrotext = document.getElementById('prop-sec-microtext');
    const secWatermark = document.getElementById('prop-sec-watermark');
    const groupTextContent = document.getElementById('group-uice-text-content');

    const isAgency = el.type === 'agency-brand';
    const hasTypo = ['employee-name', 'designation', 'custom-text', 'badge-pill'].includes(el.type);
    if (secAgency) secAgency.style.display = isAgency ? 'flex' : 'none';
    if (secTypo) secTypo.style.display = hasTypo ? 'flex' : 'none';
    if (secPhoto) secPhoto.style.display = el.type === 'employee-photo' ? 'flex' : 'none';
    if (secQr) secQr.style.display = el.type === 'qr-code' ? 'flex' : 'none';
    if (secBarcode) secBarcode.style.display = el.type === 'barcode' ? 'flex' : 'none';
    if (secTable) secTable.style.display = el.type === 'details-table' ? 'flex' : 'none';
    if (secSig) secSig.style.display = el.type === 'signature' ? 'flex' : 'none';
    if (secShape) secShape.style.display = el.type === 'shape' ? 'flex' : 'none';
    if (secGuilloche) secGuilloche.style.display = el.type === 'guilloche-pattern' ? 'flex' : 'none';
    if (secHologram) secHologram.style.display = el.type === 'hologram-overlay' ? 'flex' : 'none';
    if (secMicrotext) secMicrotext.style.display = el.type === 'microtext-line' ? 'flex' : 'none';
    if (secWatermark) secWatermark.style.display = el.type === 'security-watermark' ? 'flex' : 'none';
    if (groupTextContent) groupTextContent.style.display = ['custom-text', 'badge-pill'].includes(el.type) ? 'block' : 'none';

    const p = el.properties || {};
    const emp = UICE_STATE.previewEmp || (typeof VSA_STATE !== 'undefined' && VSA_STATE.employees && VSA_STATE.employees[0]) || { id: 'VSA-0042' };

    // Typography bindings & Sentinel
    if (hasTypo) {
        const fontSel = document.getElementById('prop-uice-font');
        const fontSizeInp = document.getElementById('prop-uice-font-size');
        const fontWeightSel = document.getElementById('prop-uice-font-weight');
        const colorInp = document.getElementById('prop-uice-color');
        const letterSpacingInp = document.getElementById('prop-uice-letter-spacing');
        const lineHeightInp = document.getElementById('prop-uice-line-height');
        const textAlignSel = document.getElementById('prop-uice-text-align');
        const textTransformSel = document.getElementById('prop-uice-text-transform');
        const autofitCb = document.getElementById('prop-uice-text-autofit');
        const wrapCb = document.getElementById('prop-uice-text-wrap');

        if (fontSel) fontSel.value = p.fontFamily || "'Plus Jakarta Sans', sans-serif";
        if (fontSizeInp) fontSizeInp.value = p.fontSize || p.titleFontSize || 14;
        if (fontWeightSel) fontWeightSel.value = p.fontWeight || '700';
        if (colorInp) colorInp.value = p.color || '#0f172a';
        if (letterSpacingInp) letterSpacingInp.value = p.letterSpacing || 0;
        if (lineHeightInp) lineHeightInp.value = p.lineHeight || 1.15;
        if (textAlignSel) textAlignSel.value = p.textAlign || 'left';
        if (textTransformSel) textTransformSel.value = p.textTransform || 'none';
        if (autofitCb) autofitCb.checked = p.autoFit !== false;
        if (wrapCb) wrapCb.checked = p.wrap === true;

        const textContentInp = document.getElementById('prop-uice-text-content');
        if (textContentInp && ['custom-text', 'badge-pill'].includes(el.type)) {
            textContentInp.value = p.text || '';
        }

        const typoDiag = validateTypographyFit(el, emp);
        const typoSentinelBadge = document.getElementById('uice-typo-sentinel');
        if (typoSentinelBadge) {
            if (typoDiag.level === 'critical') {
                typoSentinelBadge.className = 'uice-sentinel-badge error';
                typoSentinelBadge.innerHTML = `<i data-lucide="x-circle" style="width: 14px; height: 14px;"></i><span>Critical: Text Overflow / Clipping</span>`;
            } else if (typoDiag.level === 'warning') {
                typoSentinelBadge.className = 'uice-sentinel-badge warning';
                typoSentinelBadge.innerHTML = `<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i><span>Caution: Auto-Scaled / Wrapped</span>`;
            } else {
                typoSentinelBadge.className = 'uice-sentinel-badge valid';
                typoSentinelBadge.innerHTML = `<i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i><span>Text Fits Within Bounds</span>`;
            }
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons({ root: typoSentinelBadge });
            }
        }

        const typoDetailsEl = document.getElementById('uice-typo-sentinel-details');
        if (typoDetailsEl) {
            let html = '';
            typoDiag.issues.forEach(i => html += `<div style="color: #ef4444; margin-bottom: 2px;">• ✕ ${escapeHtml(i)}</div>`);
            typoDiag.warnings.forEach(w => html += `<div style="color: #f59e0b; margin-bottom: 2px;">• ⚠ ${escapeHtml(w)}</div>`);
            typoDiag.passes.forEach(pass => html += `<div style="color: #10b981; margin-bottom: 2px;">• ✓ ${escapeHtml(pass)}</div>`);
            typoDetailsEl.innerHTML = html;
        }
    }

    // Agency Header bindings & Sentinel
    if (isAgency) {
        const agencyTitleInp = document.getElementById('prop-uice-agency-title');
        const agencySubInp = document.getElementById('prop-uice-agency-subtitle');
        const agencyTitleSizeInp = document.getElementById('prop-uice-agency-title-size');
        const agencySubSizeInp = document.getElementById('prop-uice-agency-sub-size');
        const agencyLogoSizeInp = document.getElementById('prop-uice-agency-logo-size');
        const agencyLetterSpacingInp = document.getElementById('prop-uice-agency-letter-spacing');
        const agencyLineHeightInp = document.getElementById('prop-uice-agency-line-height');
        const agencyColorInp = document.getElementById('prop-uice-agency-color');
        const agencyAutofitCb = document.getElementById('prop-uice-agency-autofit');
        const agencyWrapCb = document.getElementById('prop-uice-agency-wrap');

        if (agencyTitleInp) agencyTitleInp.value = p.title || 'VALLEY SECURITY AGENCY';
        if (agencySubInp) agencySubInp.value = p.subtitle || 'SHAHIDGUNJ SRINAGAR';
        if (agencyTitleSizeInp) agencyTitleSizeInp.value = p.titleFontSize || 12;
        if (agencySubSizeInp) agencySubSizeInp.value = p.subtitleFontSize || 6.5;
        if (agencyLogoSizeInp) agencyLogoSizeInp.value = p.logoSize || 32;
        if (agencyLetterSpacingInp) agencyLetterSpacingInp.value = p.letterSpacing !== undefined ? p.letterSpacing : 0.4;
        if (agencyLineHeightInp) agencyLineHeightInp.value = p.lineHeight || 1.15;
        if (agencyColorInp) agencyColorInp.value = p.color || '#ffffff';
        if (agencyAutofitCb) agencyAutofitCb.checked = p.autoFit !== false;
        if (agencyWrapCb) agencyWrapCb.checked = p.wrap === true;

        const agencyDiag = validateTypographyFit(el, emp);
        const agencyStatusBadge = document.getElementById('lbl-uice-agency-status');
        if (agencyStatusBadge) {
            if (agencyDiag.level === 'valid') {
                agencyStatusBadge.className = 'badge badge-success';
                agencyStatusBadge.textContent = 'Optimal';
            } else if (agencyDiag.level === 'warning') {
                agencyStatusBadge.className = 'badge badge-warning';
                agencyStatusBadge.textContent = 'Caution';
            } else {
                agencyStatusBadge.className = 'badge badge-danger';
                agencyStatusBadge.textContent = 'Clipping';
            }
        }

        const agencySentinelBadge = document.getElementById('uice-agency-sentinel');
        if (agencySentinelBadge) {
            if (agencyDiag.level === 'critical') {
                agencySentinelBadge.className = 'uice-sentinel-badge error';
                agencySentinelBadge.innerHTML = `<i data-lucide="x-circle" style="width: 14px; height: 14px;"></i><span>Critical: Header Text Overflow</span>`;
            } else if (agencyDiag.level === 'warning') {
                agencySentinelBadge.className = 'uice-sentinel-badge warning';
                agencySentinelBadge.innerHTML = `<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i><span>Sub-Optimal Header Space</span>`;
            } else {
                agencySentinelBadge.className = 'uice-sentinel-badge valid';
                agencySentinelBadge.innerHTML = `<i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i><span>Header Fits Cleanly</span>`;
            }
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons({ root: agencySentinelBadge });
            }
        }

        const agencyDetailsEl = document.getElementById('uice-agency-sentinel-details');
        if (agencyDetailsEl) {
            let html = '';
            agencyDiag.issues.forEach(i => html += `<div style="color: #ef4444; margin-bottom: 2px;">• ✕ ${escapeHtml(i)}</div>`);
            agencyDiag.warnings.forEach(w => html += `<div style="color: #f59e0b; margin-bottom: 2px;">• ⚠ ${escapeHtml(w)}</div>`);
            agencyDiag.passes.forEach(pass => html += `<div style="color: #10b981; margin-bottom: 2px;">• ✓ ${escapeHtml(pass)}</div>`);
            agencyDetailsEl.innerHTML = html;
        }
    }

    // Photo bindings
    if (el.type === 'employee-photo') {
        const shapeSel = document.getElementById('prop-uice-photo-shape');
        const borderWInp = document.getElementById('prop-uice-photo-border');
        const borderCInp = document.getElementById('prop-uice-photo-border-color');
        const outlineCInp = document.getElementById('prop-uice-photo-outline-color');

        if (shapeSel) shapeSel.value = p.shape || 'circle';
        if (borderWInp) borderWInp.value = p.borderWidth !== undefined ? p.borderWidth : 3.5;
        if (borderCInp) borderCInp.value = p.borderColor || '#ffffff';
        if (outlineCInp) outlineCInp.value = p.outlineColor || '#009688';
    }

    // QR bindings & Sentinel check
    if (el.type === 'qr-code') {
        const fgInp = document.getElementById('prop-uice-qr-fg');
        const bgInp = document.getElementById('prop-uice-qr-bg');
        const eccSel = document.getElementById('prop-uice-qr-ecc');
        const quietInp = document.getElementById('prop-uice-qr-quiet');

        if (fgInp) fgInp.value = p.foreground || '#000000';
        if (bgInp) bgInp.value = p.background || '#ffffff';
        if (eccSel) eccSel.value = p.errorCorrection || 'H';
        if (quietInp) quietInp.value = p.quietZone !== undefined ? p.quietZone : 2;

        const qrDiag = validateQrScannability(el, emp);

        // Status Badge
        const statusBadge = document.getElementById('lbl-uice-qr-status');
        if (statusBadge) {
            if (qrDiag.level === 'valid') {
                statusBadge.className = 'badge badge-success';
                statusBadge.textContent = 'Scannable';
            } else if (qrDiag.level === 'warning') {
                statusBadge.className = 'badge badge-warning';
                statusBadge.textContent = 'Caution';
            } else {
                statusBadge.className = 'badge badge-danger';
                statusBadge.textContent = 'Unreadable';
            }
        }

        // Decoded URL and metrics
        const previewUrlEl = document.getElementById('uice-qr-preview-url');
        if (previewUrlEl) {
            previewUrlEl.textContent = qrDiag.url;
            previewUrlEl.title = qrDiag.url;
        }
        const previewMetricsEl = document.getElementById('uice-qr-preview-metrics');
        if (previewMetricsEl) {
            previewMetricsEl.textContent = `${Math.round(el.width)}×${Math.round(el.height)}px • Contrast ${qrDiag.contrast}:1 • ECC ${p.errorCorrection || 'H'}`;
        }

        // Render Live Preview Canvas with QRious and test with jsQR
        const qrCanvas = document.getElementById('uice-qr-preview-canvas');
        if (qrCanvas && typeof QRious !== 'undefined') {
            try {
                qrCanvas.width = 68;
                qrCanvas.height = 68;
                new QRious({
                    element: qrCanvas,
                    value: qrDiag.url,
                    size: 68,
                    background: p.background || '#ffffff',
                    foreground: p.foreground || '#000000',
                    level: p.errorCorrection || 'H',
                    padding: 0
                });

                // Test live decode using jsQR
                if (typeof jsQR !== 'undefined') {
                    const ctx = qrCanvas.getContext('2d');
                    if (ctx) {
                        const imgData = ctx.getImageData(0, 0, 68, 68);
                        const decoded = jsQR(imgData.data, 68, 68);
                        if (decoded && decoded.data) {
                            qrDiag.passes.unshift(`Optical Decoding Verified: Decodes payload without loss`);
                        }
                    }
                }
            } catch (e) {
                console.warn('Live QR preview render error:', e);
            }
        }

        // Update Sentinel Badge & Details
        const sentinelBadge = document.getElementById('uice-qr-sentinel');
        if (sentinelBadge) {
            if (qrDiag.level === 'critical') {
                sentinelBadge.className = 'uice-sentinel-badge error';
                sentinelBadge.innerHTML = `<i data-lucide="x-circle" style="width: 14px; height: 14px;"></i><span>Critical: Unscannable QR Parameters</span>`;
            } else if (qrDiag.level === 'warning') {
                sentinelBadge.className = 'uice-sentinel-badge warning';
                sentinelBadge.innerHTML = `<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i><span>Sub-Optimal Optical Parameters</span>`;
            } else {
                sentinelBadge.className = 'uice-sentinel-badge valid';
                sentinelBadge.innerHTML = `<i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i><span>QR Scannable & Optical Standards Verified</span>`;
            }
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons({ root: sentinelBadge });
            }
        }

        const detailsEl = document.getElementById('uice-qr-sentinel-details');
        if (detailsEl) {
            let html = '';
            qrDiag.issues.forEach(i => html += `<div style="color: #ef4444; margin-bottom: 2px;">• ✕ ${escapeHtml(i)}</div>`);
            qrDiag.warnings.forEach(w => html += `<div style="color: #f59e0b; margin-bottom: 2px;">• ⚠ ${escapeHtml(w)}</div>`);
            qrDiag.passes.slice(0, 2).forEach(pass => html += `<div style="color: #10b981; margin-bottom: 2px;">• ✓ ${escapeHtml(pass)}</div>`);
            detailsEl.innerHTML = html;
        }
    }

    // Barcode bindings
    if (el.type === 'barcode') {
        const fmtSel = document.getElementById('prop-uice-barcode-format');
        const lineCInp = document.getElementById('prop-uice-barcode-color');
        const bgInp = document.getElementById('prop-uice-barcode-bg');
        const fontSizeInp = document.getElementById('prop-uice-barcode-font-size');
        const showTextCb = document.getElementById('prop-uice-barcode-text');

        if (fmtSel) fmtSel.value = p.format || 'CODE128';
        if (lineCInp) lineCInp.value = p.lineColor || '#000000';
        if (bgInp) bgInp.value = p.background || '#ffffff';
        if (fontSizeInp) fontSizeInp.value = p.fontSize || 8;
        if (showTextCb) showTextCb.checked = p.showText !== false;

        const barcodeDiag = validateBarcodeScannability(el, emp);

        // Status Badge
        const barcodeStatusBadge = document.getElementById('lbl-uice-barcode-status');
        if (barcodeStatusBadge) {
            if (barcodeDiag.level === 'valid') {
                barcodeStatusBadge.className = 'badge badge-success';
                barcodeStatusBadge.textContent = 'Valid';
            } else if (barcodeDiag.level === 'warning') {
                barcodeStatusBadge.className = 'badge badge-warning';
                barcodeStatusBadge.textContent = 'Caution';
            } else {
                barcodeStatusBadge.className = 'badge badge-danger';
                barcodeStatusBadge.textContent = 'Invalid';
            }
        }

        // Preview values and metrics
        const previewValEl = document.getElementById('uice-barcode-preview-val');
        if (previewValEl) {
            previewValEl.textContent = barcodeDiag.val;
        }
        const previewMetricsEl = document.getElementById('uice-barcode-preview-metrics');
        if (previewMetricsEl) {
            previewMetricsEl.textContent = `${barcodeDiag.format} • ${Math.round(el.width)}×${Math.round(el.height)}px • Contrast ${barcodeDiag.contrast}:1`;
        }

        // Render Live Preview Canvas with JsBarcode
        const barcodeCanvas = document.getElementById('uice-barcode-preview-canvas');
        if (barcodeCanvas && typeof JsBarcode !== 'undefined') {
            try {
                JsBarcode(barcodeCanvas, barcodeDiag.val, {
                    format: barcodeDiag.format,
                    background: p.background || '#ffffff',
                    lineColor: p.lineColor || '#000000',
                    displayValue: false,
                    margin: 0,
                    width: 1.5,
                    height: 32
                });
            } catch (e) {
                console.warn('Live barcode preview error:', e);
                const ctx = barcodeCanvas.getContext('2d');
                if (ctx) {
                    ctx.fillStyle = '#fee2e2';
                    ctx.fillRect(0, 0, barcodeCanvas.width || 120, barcodeCanvas.height || 32);
                    ctx.fillStyle = '#ef4444';
                    ctx.font = '9px monospace';
                    ctx.fillText('Format Incompatible', 5, 18);
                }
            }
        }

        // Update Sentinel Badge & Details
        const barcodeSentinelBadge = document.getElementById('uice-barcode-sentinel');
        if (barcodeSentinelBadge) {
            if (barcodeDiag.level === 'critical') {
                barcodeSentinelBadge.className = 'uice-sentinel-badge error';
                barcodeSentinelBadge.innerHTML = `<i data-lucide="x-circle" style="width: 14px; height: 14px;"></i><span>Critical: Unscannable Barcode Standards</span>`;
            } else if (barcodeDiag.level === 'warning') {
                barcodeSentinelBadge.className = 'uice-sentinel-badge warning';
                barcodeSentinelBadge.innerHTML = `<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i><span>Sub-Optimal Barcode Proportions</span>`;
            } else {
                barcodeSentinelBadge.className = 'uice-sentinel-badge valid';
                barcodeSentinelBadge.innerHTML = `<i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i><span>Barcode Proportion & Contrast Verified</span>`;
            }
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons({ root: barcodeSentinelBadge });
            }
        }

        const barcodeDetails = document.getElementById('uice-barcode-sentinel-details');
        if (barcodeDetails) {
            let bHtml = '';
            barcodeDiag.issues.forEach(i => bHtml += `<div style="color: #ef4444; margin-bottom: 2px;">• ✕ ${escapeHtml(i)}</div>`);
            barcodeDiag.warnings.forEach(w => bHtml += `<div style="color: #f59e0b; margin-bottom: 2px;">• ⚠ ${escapeHtml(w)}</div>`);
            barcodeDiag.passes.slice(0, 2).forEach(pass => bHtml += `<div style="color: #10b981; margin-bottom: 2px;">• ✓ ${escapeHtml(pass)}</div>`);
            barcodeDetails.innerHTML = bHtml;
        }
    }

    // Details Table bindings & Sentinel
    if (el.type === 'details-table') {
        const rowPadInp = document.getElementById('prop-uice-table-row-pad');
        const fontSizeInp = document.getElementById('prop-uice-table-font-size');
        const labelWInp = document.getElementById('prop-uice-table-label-w');
        const valSpacingInp = document.getElementById('prop-uice-table-val-spacing');
        const labelCInp = document.getElementById('prop-uice-table-label-c');
        const valueCInp = document.getElementById('prop-uice-table-value-c');
        const autofitCb = document.getElementById('prop-uice-table-autofit');
        const addressWrapCb = document.getElementById('prop-uice-table-address-wrap');

        if (rowPadInp) rowPadInp.value = p.rowPadding !== undefined ? p.rowPadding : 3;
        if (fontSizeInp) fontSizeInp.value = p.fontSize || 8;
        if (labelWInp) labelWInp.value = p.labelWidth || 38;
        if (valSpacingInp) valSpacingInp.value = p.labelValueSpacing !== undefined ? p.labelValueSpacing : 8;
        if (labelCInp) labelCInp.value = p.labelColor || '#475569';
        if (valueCInp) valueCInp.value = p.valueColor || '#0f172a';
        if (autofitCb) autofitCb.checked = p.autoFit !== false;
        if (addressWrapCb) addressWrapCb.checked = p.addressWrap !== false;

        const tableDiag = validateTypographyFit(el, emp);
        const tableStatusBadge = document.getElementById('lbl-uice-table-status');
        if (tableStatusBadge) {
            if (tableDiag.level === 'valid') {
                tableStatusBadge.className = 'badge badge-success';
                tableStatusBadge.textContent = 'Fits Bounds';
            } else if (tableDiag.level === 'warning') {
                tableStatusBadge.className = 'badge badge-warning';
                tableStatusBadge.textContent = 'Tight Fit';
            } else {
                tableStatusBadge.className = 'badge badge-danger';
                tableStatusBadge.textContent = 'Overflowing';
            }
        }

        const tableSentinelBadge = document.getElementById('uice-table-sentinel');
        if (tableSentinelBadge) {
            if (tableDiag.level === 'critical') {
                tableSentinelBadge.className = 'uice-sentinel-badge error';
                tableSentinelBadge.innerHTML = `<i data-lucide="x-circle" style="width: 14px; height: 14px;"></i><span>Critical: Table Height Exceeded</span>`;
            } else if (tableDiag.level === 'warning') {
                tableSentinelBadge.className = 'uice-sentinel-badge warning';
                tableSentinelBadge.innerHTML = `<i data-lucide="alert-triangle" style="width: 14px; height: 14px;"></i><span>Tight Vertical Clearance</span>`;
            } else {
                tableSentinelBadge.className = 'uice-sentinel-badge valid';
                tableSentinelBadge.innerHTML = `<i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i><span>Table Fits Cleanly</span>`;
            }
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
                lucide.createIcons({ root: tableSentinelBadge });
            }
        }

        const tableDetailsEl = document.getElementById('uice-table-sentinel-details');
        if (tableDetailsEl) {
            let html = '';
            tableDiag.issues.forEach(i => html += `<div style="color: #ef4444; margin-bottom: 2px;">• ✕ ${escapeHtml(i)}</div>`);
            tableDiag.warnings.forEach(w => html += `<div style="color: #f59e0b; margin-bottom: 2px;">• ⚠ ${escapeHtml(w)}</div>`);
            tableDiag.passes.forEach(pass => html += `<div style="color: #10b981; margin-bottom: 2px;">• ✓ ${escapeHtml(pass)}</div>`);
            tableDetailsEl.innerHTML = html;
        }
    }

    // Signature bindings
    if (el.type === 'signature') {
        const sigPresetSel = document.getElementById('prop-uice-sig-preset');
        const sigLabelInp = document.getElementById('prop-uice-sig-label');

        if (sigPresetSel) sigPresetSel.value = p.preset || 'preset-vsa-sig';
        if (sigLabelInp) sigLabelInp.value = p.label || 'AUTHORITY SIGNATURE';
    }

    // Shape bindings
    if (el.type === 'shape') {
        const fillInp = document.getElementById('prop-uice-shape-fill');
        const borderCInp = document.getElementById('prop-uice-shape-border');
        const borderWInp = document.getElementById('prop-uice-shape-border-w');
        const radiusInp = document.getElementById('prop-uice-shape-radius');

        if (fillInp) fillInp.value = p.fill || '#009688';
        if (borderCInp) borderCInp.value = p.borderColor || '#000000';
        if (borderWInp) borderWInp.value = p.borderWidth || 0;
        if (radiusInp) radiusInp.value = p.borderRadius || 0;
    }

    // Guilloche bindings
    if (el.type === 'guilloche-pattern') {
        const styleSel = document.getElementById('prop-uice-guilloche-style');
        const strokeInp = document.getElementById('prop-uice-guilloche-stroke');
        const freqInp = document.getElementById('prop-uice-guilloche-freq');
        const countInp = document.getElementById('prop-uice-guilloche-count');
        const ampInp = document.getElementById('prop-uice-guilloche-amp');
        const widthInp = document.getElementById('prop-uice-guilloche-width');

        if (styleSel) styleSel.value = p.style || 'harmonic';
        if (strokeInp) strokeInp.value = p.strokeColor || '#009688';
        if (freqInp) freqInp.value = p.frequency || 4;
        if (countInp) countInp.value = p.waveCount || 8;
        if (ampInp) ampInp.value = p.amplitude || 12;
        if (widthInp) widthInp.value = p.strokeWidth || 0.75;
    }

    // Hologram bindings
    if (el.type === 'hologram-overlay') {
        const foilSel = document.getElementById('prop-uice-hologram-foil');
        const shapeSel = document.getElementById('prop-uice-hologram-shape');
        const crestSel = document.getElementById('prop-uice-hologram-crest');
        const labelInp = document.getElementById('prop-uice-hologram-label');

        if (foilSel) foilSel.value = p.foilStyle || 'silver';
        if (shapeSel) shapeSel.value = p.badgeShape || 'circle';
        if (crestSel) crestSel.value = p.crest || 'vsa-crest';
        if (labelInp) labelInp.value = p.label || 'SECURE';
    }

    // Microtext bindings
    if (el.type === 'microtext-line') {
        const textInp = document.getElementById('prop-uice-microtext-text');
        const sizeInp = document.getElementById('prop-uice-microtext-size');
        const spacingInp = document.getElementById('prop-uice-microtext-spacing');
        const colorInp = document.getElementById('prop-uice-microtext-color');
        const repeatInp = document.getElementById('prop-uice-microtext-repeat');

        if (textInp) textInp.value = p.text || '';
        if (sizeInp) sizeInp.value = p.fontSize || 4.5;
        if (spacingInp) spacingInp.value = p.letterSpacing || 1.2;
        if (colorInp) colorInp.value = p.color || '#475569';
        if (repeatInp) repeatInp.value = p.repeatCount || 6;
    }

    // Watermark bindings
    if (el.type === 'security-watermark') {
        const presetSel = document.getElementById('prop-uice-watermark-preset');
        const rotInp = document.getElementById('prop-uice-watermark-rot');
        const grayCb = document.getElementById('prop-uice-watermark-gray');

        if (presetSel) presetSel.value = p.preset || 'vsa-crest';
        if (rotInp) rotInp.value = p.rotation || 0;
        if (grayCb) grayCb.checked = p.grayscale !== false;
    }
}

/**
 * Draws pixel markings and numbers on top and left rulers.
 */
function drawUiceRulers() {
    const layout = UICE_STATE.template && UICE_STATE.template.layouts
        ? UICE_STATE.template.layouts[UICE_STATE.orientation]
        : null;
    if (!layout) return;

    const topCanvas = document.getElementById('uice-ruler-top-canvas');
    const leftCanvas = document.getElementById('uice-ruler-left-canvas');
    if (!topCanvas || !leftCanvas) return;

    const w = layout.width + 120;
    const h = layout.height + 120;

    topCanvas.width = w;
    leftCanvas.height = h;

    const ctxTop = topCanvas.getContext('2d');
    const ctxLeft = leftCanvas.getContext('2d');

    // Draw Top Horizontal Ruler
    ctxTop.fillStyle = '#0f172a';
    ctxTop.fillRect(0, 0, w, 24);
    ctxTop.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctxTop.fillStyle = '#64748b';
    ctxTop.font = '8px monospace';

    for (let x = 0; x <= w; x += 10) {
        const isMajor = x % 50 === 0;
        const tickH = isMajor ? 12 : 5;
        ctxTop.beginPath();
        ctxTop.moveTo(x + 60, 24);
        ctxTop.lineTo(x + 60, 24 - tickH);
        ctxTop.stroke();

        if (isMajor && x <= layout.width) {
            ctxTop.fillText(x.toString(), x + 62, 10);
        }
    }

    // Draw Left Vertical Ruler
    ctxLeft.fillStyle = '#0f172a';
    ctxLeft.fillRect(0, 0, 24, h);
    ctxLeft.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctxLeft.fillStyle = '#64748b';
    ctxLeft.font = '8px monospace';

    for (let y = 0; y <= h; y += 10) {
        const isMajor = y % 50 === 0;
        const tickW = isMajor ? 12 : 5;
        ctxLeft.beginPath();
        ctxLeft.moveTo(24, y + 60);
        ctxLeft.lineTo(24 - tickW, y + 60);
        ctxLeft.stroke();

        if (isMajor && y <= layout.height) {
            ctxLeft.save();
            ctxLeft.translate(10, y + 62);
            ctxLeft.rotate(-Math.PI / 2);
            ctxLeft.fillText(y.toString(), 0, 0);
            ctxLeft.restore();
        }
    }
}

/**
 * Sets the UICE canvas zoom level and updates the zoom percentage indicator.
 * @param {number} zoomVal - Scale multiplier (e.g. 1.0 for 100%)
 */
function setUiceZoom(zoomVal) {
    UICE_STATE.zoom = Math.max(0.35, Math.min(2.5, Math.round(zoomVal * 100) / 100));
    const lblZoom = document.getElementById('lbl-uice-zoom');
    if (lblZoom) lblZoom.textContent = Math.round(UICE_STATE.zoom * 100) + '%';
    renderUiceStage();
}

/**
 * Calculates optimal proportional viewport scaling for the current artboard card.
 * Centers card within available viewport dimensions with standard margins.
 * @returns {number} Clamped zoom scale
 */
function fitUiceToScreen() {
    const viewport = document.getElementById('uice-viewport');
    const layout = UICE_STATE.template && UICE_STATE.template.layouts && UICE_STATE.template.layouts[UICE_STATE.orientation];
    if (!viewport || !layout) {
        setUiceZoom(1.0);
        return 1.0;
    }

    const padding = 120; // 60px padding on each side
    const vpW = Math.max(200, (viewport.clientWidth || 800) - padding);
    const vpH = Math.max(200, (viewport.clientHeight || 600) - padding);

    const scaleX = vpW / layout.width;
    const scaleY = vpH / layout.height;
    const targetScale = Math.min(scaleX, scaleY);

    const clamped = Math.max(0.4, Math.min(2.0, Math.round(targetScale * 100) / 100));
    setUiceZoom(clamped);
    return clamped;
}

/**
 * Sets up global keyboard shortcuts for the UICE visual editor.
 * Hotkeys:
 * - Ctrl+Z / Cmd+Z: Undo
 * - Ctrl+Y / Cmd+Y or Ctrl+Shift+Z: Redo
 * - Ctrl+D / Cmd+D: Duplicate active element
 * - Delete / Backspace: Delete active element
 * - Escape: Deselect active element
 * - Ctrl+0: Fit to screen
 * - Ctrl+1: Actual size 100%
 * - Arrow keys: Nudge 1px (or 10px with Shift)
 */
function setupUiceKeyboardShortcuts() {
    if (typeof window === 'undefined') return;
    if (window._uiceKeyShortcutsAttached) return;
    window._uiceKeyShortcutsAttached = true;

    window.addEventListener('keydown', function(e) {
        // Only trigger if UICE visual workspace is currently visible
        const visualWs = document.getElementById('uice-visual-workspace');
        if (!visualWs || visualWs.offsetParent === null) return;

        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);

        // Escape key: blur input or deselect
        if (e.key === 'Escape') {
            if (isInput) {
                e.target.blur();
                return;
            }
            if (UICE_STATE.selectedId) {
                e.preventDefault();
                selectUiceElement(null);
            }
            return;
        }

        // Do not intercept hotkeys if typing in text inputs
        if (isInput) return;

        const isMac = (typeof navigator !== 'undefined' && navigator.platform && navigator.platform.toUpperCase().indexOf('MAC') >= 0);
        const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

        // Undo: Ctrl+Z / Cmd+Z (without Shift)
        if (cmdOrCtrl && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
            e.preventDefault();
            undoUice();
            return;
        }

        // Redo: Ctrl+Y / Cmd+Y or Ctrl+Shift+Z
        if ((cmdOrCtrl && (e.key === 'y' || e.key === 'Y')) || (cmdOrCtrl && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
            e.preventDefault();
            redoUice();
            return;
        }

        // Duplicate: Ctrl+D / Cmd+D
        if (cmdOrCtrl && (e.key === 'd' || e.key === 'D')) {
            e.preventDefault();
            if (UICE_STATE.selectedId) {
                duplicateUiceElement(UICE_STATE.selectedId);
            }
            return;
        }

        // Fit to Screen: Ctrl+0 / Cmd+0
        if (cmdOrCtrl && e.key === '0') {
            e.preventDefault();
            fitUiceToScreen();
            return;
        }

        // Actual Size 100%: Ctrl+1 / Cmd+1
        if (cmdOrCtrl && e.key === '1') {
            e.preventDefault();
            setUiceZoom(1.0);
            return;
        }

        // Delete: Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (UICE_STATE.selectedId) {
                e.preventDefault();
                deleteUiceElement(UICE_STATE.selectedId);
            }
            return;
        }

        // Arrow nudges
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template ? UICE_STATE.template.layouts[UICE_STATE.orientation] : null;
            if (!layout) return;
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.locked) return;

            e.preventDefault();
            const step = e.shiftKey ? 10 : 1;
            if (e.key === 'ArrowLeft') el.x = Math.max(0, el.x - step);
            if (e.key === 'ArrowRight') el.x = Math.min(layout.width - el.width, el.x + step);
            if (e.key === 'ArrowUp') el.y = Math.max(0, el.y - step);
            if (e.key === 'ArrowDown') el.y = Math.min(layout.height - el.height, el.y + step);

            renderUiceStage();
            pushUiceHistory(`Nudge ${el.name || el.type}`);
        }
    });
}

/**
 * Attaches pointer, mouse, keyboard, and toolbar listeners for UICE.
 */
function setupUiceListeners() {
    const artboard = document.getElementById('uice-artboard');
    const elementsContainer = document.getElementById('uice-elements-container');
    const guidesContainer = document.getElementById('uice-guides-container');

    // 1. Pointer Down on Elements Container (Delegation)
    if (elementsContainer) {
        elementsContainer.addEventListener('pointerdown', function(e) {
            const handle = e.target.closest('.uice-handle');
            const node = e.target.closest('.uice-node');

            if (handle) {
                // Resize or Rotate Handle
                e.preventDefault();
                e.stopPropagation();
                const handleType = handle.getAttribute('data-handle');
                const parentNode = handle.closest('.uice-node');
                const id = parentNode.getAttribute('data-id');
                const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
                const el = getUiceActiveElements(layout).find(x => x.id === id);
                if (!el || el.locked) return;

                if (handleType === 'rot') {
                    // Start Rotation
                    const rect = parentNode.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;
                    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

                    UICE_STATE.drag = {
                        isDragging: false,
                        isResizing: false,
                        isRotating: true,
                        handle: 'rot',
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: el.x,
                        origY: el.y,
                        origW: el.width,
                        origH: el.height,
                        origRot: el.rotation || 0,
                        centerX,
                        centerY,
                        startAngle,
                        hasMoved: false
                    };
                } else {
                    // Start Resize
                    UICE_STATE.drag = {
                        isDragging: false,
                        isResizing: true,
                        isRotating: false,
                        handle: handleType,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: el.x,
                        origY: el.y,
                        origW: el.width,
                        origH: el.height,
                        origRot: el.rotation || 0,
                        hasMoved: false
                    };
                }
            } else if (node) {
                // Element Node Click / Drag Start
                e.preventDefault();
                const id = node.getAttribute('data-id');
                const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
                const el = getUiceActiveElements(layout).find(x => x.id === id);
                if (!el) return;

                if (UICE_STATE.selectedId !== id) {
                    selectUiceElement(id);
                }

                if (!el.locked) {
                    UICE_STATE.drag = {
                        isDragging: true,
                        isResizing: false,
                        isRotating: false,
                        handle: null,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: el.x,
                        origY: el.y,
                        origW: el.width,
                        origH: el.height,
                        origRot: el.rotation || 0,
                        hasMoved: false
                    };
                }
            } else {
                // Clicked blank area on artboard -> deselect
                UICE_STATE.selectedId = null;
                renderUiceStage();
            }
        });
    }

    // 2. Global Window Pointer Move (60fps Drag / Resize / Rotate)
    window.addEventListener('pointermove', function(e) {
        if (!UICE_STATE.drag.isDragging && !UICE_STATE.drag.isResizing && !UICE_STATE.drag.isRotating) return;

        const layout = UICE_STATE.template ? UICE_STATE.template.layouts[UICE_STATE.orientation] : null;
        if (!layout) return;

        const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
        if (!el || el.locked) return;

        const d = UICE_STATE.drag;
        const zoom = UICE_STATE.zoom || 1.0;
        const deltaX = (e.clientX - d.startX) / zoom;
        const deltaY = (e.clientY - d.startY) / zoom;

        if (Math.hypot(deltaX, deltaY) > 2) {
            d.hasMoved = true;
        }

        // Clear previous guide lines
        if (guidesContainer) guidesContainer.innerHTML = '';

        if (d.isDragging) {
            let newX = Math.round(d.origX + deltaX);
            let newY = Math.round(d.origY + deltaY);

            // Snap-to-Grid
            if (UICE_STATE.snapToGrid) {
                const g = UICE_STATE.gridSize || 10;
                newX = Math.round(newX / g) * g;
                newY = Math.round(newY / g) * g;
            }

            // Smart Alignment Guidelines
            if (UICE_STATE.showGuides) {
                const guides = computeUiceAlignmentGuides(el, newX, newY, layout);
                newX = guides.x;
                newY = guides.y;
                drawUiceGuides(guides.lines);
            }

            // Boundary clamping
            newX = Math.max(-el.width + 20, Math.min(layout.width - 20, newX));
            newY = Math.max(-el.height + 20, Math.min(layout.height - 20, newY));

            el.x = newX;
            el.y = newY;

            // Direct DOM update for 60fps responsiveness
            const node = elementsContainer.querySelector(`[data-id="${el.id}"]`);
            if (node) {
                node.style.left = newX + 'px';
                node.style.top = newY + 'px';
            }

            // Live sync inspector
            const propX = document.getElementById('prop-uice-x');
            const propY = document.getElementById('prop-uice-y');
            if (propX) propX.value = newX;
            if (propY) propY.value = newY;
        } else if (d.isResizing) {
            let newX = d.origX;
            let newY = d.origY;
            let newW = d.origW;
            let newH = d.origH;
            const h = d.handle;

            if (h.includes('e')) newW = Math.max(15, Math.round(d.origW + deltaX));
            if (h.includes('s')) newH = Math.max(15, Math.round(d.origH + deltaY));
            if (h.includes('w')) {
                const rawW = Math.round(d.origW - deltaX);
                if (rawW >= 15) {
                    newW = rawW;
                    newX = Math.round(d.origX + deltaX);
                }
            }
            if (h.includes('n')) {
                const rawH = Math.round(d.origH - deltaY);
                if (rawH >= 15) {
                    newH = rawH;
                    newY = Math.round(d.origY + deltaY);
                }
            }

            // Snap-to-Grid for dimensions
            if (UICE_STATE.snapToGrid) {
                const g = UICE_STATE.gridSize || 10;
                newW = Math.round(newW / g) * g;
                newH = Math.round(newH / g) * g;
            }

            el.x = newX;
            el.y = newY;
            el.width = Math.max(15, newW);
            el.height = Math.max(15, newH);

            const node = elementsContainer.querySelector(`[data-id="${el.id}"]`);
            if (node) {
                node.style.left = el.x + 'px';
                node.style.top = el.y + 'px';
                node.style.width = el.width + 'px';
                node.style.height = el.height + 'px';
            }

            const propX = document.getElementById('prop-uice-x');
            const propY = document.getElementById('prop-uice-y');
            const propW = document.getElementById('prop-uice-w');
            const propH = document.getElementById('prop-uice-h');
            if (propX) propX.value = el.x;
            if (propY) propY.value = el.y;
            if (propW) propW.value = el.width;
            if (propH) propH.value = el.height;
        } else if (d.isRotating) {
            const currentAngle = Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX) * (180 / Math.PI);
            let rot = Math.round(d.origRot + (currentAngle - d.startAngle));

            // Normalize between -180 and 180
            while (rot > 180) rot -= 360;
            while (rot < -180) rot += 360;

            // Snap to 0, 90, -90, 180 within 4 degrees
            [0, 90, -90, 180, -180].forEach(snap => {
                if (Math.abs(rot - snap) <= 4) rot = snap;
            });

            el.rotation = rot;
            const node = elementsContainer.querySelector(`[data-id="${el.id}"]`);
            if (node) {
                node.style.transform = `rotate(${rot}deg)`;
            }

            const propRot = document.getElementById('prop-uice-rot');
            if (propRot) propRot.value = rot;
        }
    });

    // 3. Global Window Pointer Up
    window.addEventListener('pointerup', function() {
        if (UICE_STATE.drag.isDragging || UICE_STATE.drag.isResizing || UICE_STATE.drag.isRotating) {
            const hasMoved = UICE_STATE.drag.hasMoved;
            const wasResizing = UICE_STATE.drag.isResizing;

            UICE_STATE.drag.isDragging = false;
            UICE_STATE.drag.isResizing = false;
            UICE_STATE.drag.isRotating = false;

            if (guidesContainer) guidesContainer.innerHTML = '';

            if (hasMoved) {
                // If resized QR code or barcode, full re-render ensures clean canvases
                if (wasResizing) {
                    renderUiceStage();
                }
                pushUiceHistory('Transform Element');
            }
        }
    });

    // 4. Keyboard Shortcuts: Undo (Ctrl+Z), Redo (Ctrl+Y), Duplicate (Ctrl+D), Delete, Nudge
    window.addEventListener('keydown', function(e) {
        // Only active when Visual Workspace is visible and not typing inside input/textarea
        const visualWs = document.getElementById('uice-visual-workspace');
        if (!visualWs || visualWs.offsetParent === null) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

        const layout = UICE_STATE.template ? UICE_STATE.template.layouts[UICE_STATE.orientation] : null;
        if (!layout) return;

        // Undo: Ctrl+Z
        if (e.ctrlKey && e.key.toLowerCase() === 'z' && !e.shiftKey) {
            e.preventDefault();
            undoUice();
            return;
        }

        // Redo: Ctrl+Y or Ctrl+Shift+Z
        if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault();
            redoUice();
            return;
        }

        // Duplicate: Ctrl+D
        if (e.ctrlKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            if (UICE_STATE.selectedId) {
                duplicateUiceElement(UICE_STATE.selectedId);
            }
            return;
        }

        // Delete: Delete or Backspace
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (UICE_STATE.selectedId) {
                e.preventDefault();
                deleteUiceElement(UICE_STATE.selectedId);
            }
            return;
        }

        // Escape: Deselect
        if (e.key === 'Escape') {
            UICE_STATE.selectedId = null;
            renderUiceStage();
            return;
        }

        // Arrow Keys: Nudge 1px (or 10px with Shift)
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && UICE_STATE.selectedId) {
            e.preventDefault();
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.locked) return;

            const step = e.shiftKey ? 10 : 1;
            if (e.key === 'ArrowLeft') el.x -= step;
            if (e.key === 'ArrowRight') el.x += step;
            if (e.key === 'ArrowUp') el.y -= step;
            if (e.key === 'ArrowDown') el.y += step;

            renderUiceStage();
            pushUiceHistory(`Nudge ${el.name || el.type}`);
        }
    });

    // 5. Studio Mode Tabs (Visual vs Classic)
    const tabVisual = document.getElementById('tab-uice-visual');
    const tabClassic = document.getElementById('tab-uice-classic');
    const viewVisual = document.getElementById('uice-visual-workspace');
    const viewClassic = document.getElementById('uice-classic-workspace');

    if (tabVisual && tabClassic) {
        tabVisual.addEventListener('click', function() {
            tabVisual.classList.add('active');
            tabClassic.classList.remove('active');
            if (viewVisual) viewVisual.style.display = 'block';
            if (viewClassic) viewClassic.style.display = 'none';
            if (typeof getActiveTemplateFromForm === 'function' && typeof initUiceWithTemplate === 'function') {
                const currentFormTpl = getActiveTemplateFromForm();
                if (currentFormTpl) {
                    initUiceWithTemplate(currentFormTpl);
                }
            }
            renderUiceStage();
        });

        tabClassic.addEventListener('click', function() {
            tabClassic.classList.add('active');
            tabVisual.classList.remove('active');
            if (viewVisual) viewVisual.style.display = 'none';
            if (viewClassic) viewClassic.style.display = 'block';
            updateLivePreview();
        });
    }

    // 6. Left Panel Palette Tabs (Add Items vs Layers)
    const tabElem = document.getElementById('uice-tab-elements');
    const tabLayer = document.getElementById('uice-tab-layers');
    const viewElem = document.getElementById('uice-view-elements');
    const viewLayer = document.getElementById('uice-view-layers');

    if (tabElem && tabLayer) {
        tabElem.addEventListener('click', function() {
            tabElem.classList.add('active');
            tabLayer.classList.remove('active');
            if (viewElem) viewElem.style.display = 'flex';
            if (viewLayer) viewLayer.style.display = 'none';
        });

        tabLayer.addEventListener('click', function() {
            tabLayer.classList.add('active');
            tabElem.classList.remove('active');
            if (viewElem) viewElem.style.display = 'none';
            if (viewLayer) viewLayer.style.display = 'block';
            renderUiceLayersList();
        });
    }

    // 7. Add Element Buttons
    document.querySelectorAll('.uice-element-add-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const addType = this.getAttribute('data-add-type');
            if (addType) addUiceElement(addType);
        });
    });

    // 8. Command Bar Actions
    const btnUndo = document.getElementById('btn-uice-undo');
    if (btnUndo) btnUndo.addEventListener('click', undoUice);

    const btnRedo = document.getElementById('btn-uice-redo');
    if (btnRedo) btnRedo.addEventListener('click', redoUice);

    // Orientation selector
    const orientSel = document.getElementById('uice-orientation-sel');
    if (orientSel) {
        orientSel.addEventListener('change', function() {
            if (this.value === 'custom') {
                openUiceCustomDimModal();
            } else {
                switchUiceOrientation(this.value);
            }
        });
    }

    // Convert Layout (Intelligent Adaptation)
    const btnConvertOrient = document.getElementById('btn-uice-convert-orient');
    if (btnConvertOrient) {
        btnConvertOrient.addEventListener('click', function() {
            convertUiceOrientation();
        });
    }

    // Auto-Arrange (Intelligent Ergonomic Reflow)
    const btnAutoArrange = document.getElementById('btn-uice-auto-arrange');
    if (btnAutoArrange) {
        btnAutoArrange.addEventListener('click', autoArrangeUiceLayout);
    }

    // Revert Changes
    const btnRevertLayout = document.getElementById('btn-uice-revert-layout');
    if (btnRevertLayout) {
        btnRevertLayout.addEventListener('click', revertUiceLayout);
    }

    // Reset Layout
    const btnResetLayout = document.getElementById('btn-uice-reset-layout');
    if (btnResetLayout) {
        btnResetLayout.addEventListener('click', resetUiceLayout);
    }

    // Phase 8: Surface Switcher & 3D Card Flip
    const btnSurfFront = document.getElementById('btn-uice-surface-front');
    if (btnSurfFront) {
        btnSurfFront.addEventListener('click', () => setUiceSurface('front'));
    }

    const btnSurfBack = document.getElementById('btn-uice-surface-back');
    if (btnSurfBack) {
        btnSurfBack.addEventListener('click', () => setUiceSurface('back'));
    }

    const btnFlipCard = document.getElementById('btn-uice-flip-card');
    if (btnFlipCard) {
        btnFlipCard.addEventListener('click', flipUiceCard);
    }

    // Phase 8: Archetype Preset Library Modal
    const btnArchetypeLib = document.getElementById('btn-uice-archetype-library');
    if (btnArchetypeLib) {
        btnArchetypeLib.addEventListener('click', openUiceArchetypesModal);
    }

    // Phase 8: Portable Template Asset Management
    const btnExportJson = document.getElementById('btn-uice-export-tpl-json');
    if (btnExportJson) {
        btnExportJson.addEventListener('click', exportUiceTemplateJson);
    }

    const btnImportJson = document.getElementById('btn-uice-import-tpl-json');
    const fileInput = document.getElementById('uice-tpl-file-input');
    if (btnImportJson && fileInput) {
        btnImportJson.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', function() {
            if (this.files && this.files[0]) {
                importUiceTemplateJson(this.files[0]);
                this.value = '';
            }
        });
    }

    const btnCloneTpl = document.getElementById('btn-uice-clone-tpl');
    if (btnCloneTpl) {
        btnCloneTpl.addEventListener('click', cloneUiceTemplate);
    }

    // Custom Dimension Preset Buttons
    document.querySelectorAll('.uice-preset-dim-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const w = this.getAttribute('data-w');
            const h = this.getAttribute('data-h');
            const inpW = document.getElementById('uice-custom-width');
            const inpH = document.getElementById('uice-custom-height');
            if (inpW && w) inpW.value = w;
            if (inpH && h) inpH.value = h;
            document.querySelectorAll('.uice-preset-dim-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Grid, Snap, Guides Toggles
    const btnGridToggle = document.getElementById('btn-uice-grid-toggle');
    if (btnGridToggle) {
        btnGridToggle.addEventListener('click', function() {
            UICE_STATE.showGrid = !UICE_STATE.showGrid;
            this.classList.toggle('active', UICE_STATE.showGrid);
            renderUiceStage();
        });
    }

    const btnSnapToggle = document.getElementById('btn-uice-snap-toggle');
    if (btnSnapToggle) {
        btnSnapToggle.addEventListener('click', function() {
            UICE_STATE.snapToGrid = !UICE_STATE.snapToGrid;
            this.classList.toggle('active', UICE_STATE.snapToGrid);
        });
    }

    const btnGuidesToggle = document.getElementById('btn-uice-guides-toggle');
    if (btnGuidesToggle) {
        btnGuidesToggle.addEventListener('click', function() {
            UICE_STATE.showGuides = !UICE_STATE.showGuides;
            this.classList.toggle('active', UICE_STATE.showGuides);
        });
    }

    // Phase 6 Viewport Overlays: Safe Margins, Bleed Area, Outlines
    const btnSafeMargins = document.getElementById('btn-uice-safe-margins');
    if (btnSafeMargins) {
        btnSafeMargins.addEventListener('click', function() {
            UICE_STATE.showSafeMargins = !UICE_STATE.showSafeMargins;
            this.classList.toggle('active', UICE_STATE.showSafeMargins);
            renderUiceStage();
        });
    }

    const btnBleedArea = document.getElementById('btn-uice-bleed-area');
    if (btnBleedArea) {
        btnBleedArea.addEventListener('click', function() {
            UICE_STATE.showBleedArea = !UICE_STATE.showBleedArea;
            this.classList.toggle('active', UICE_STATE.showBleedArea);
            renderUiceStage();
        });
    }

    const btnShowOutlines = document.getElementById('btn-uice-show-outlines');
    if (btnShowOutlines) {
        btnShowOutlines.addEventListener('click', function() {
            UICE_STATE.showElementOutlines = !UICE_STATE.showElementOutlines;
            this.classList.toggle('active', UICE_STATE.showElementOutlines);
            renderUiceStage();
        });
    }

    // Phase 7: Print Proofing (CMYK / Dye-Sub Gamut Simulation)
    const btnPrintProof = document.getElementById('btn-uice-print-proof');
    if (btnPrintProof) {
        btnPrintProof.addEventListener('click', function() {
            toggleUicePrintProofing();
        });
    }

    // Zoom Controls
    const btnZoomIn = document.getElementById('btn-uice-zoom-in');
    const btnZoomOut = document.getElementById('btn-uice-zoom-out');
    const btnZoomFit = document.getElementById('btn-uice-zoom-fit');
    const btnZoomActual = document.getElementById('btn-uice-zoom-actual');

    if (btnZoomIn) {
        btnZoomIn.addEventListener('click', function() {
            setUiceZoom(UICE_STATE.zoom + 0.15);
        });
    }

    if (btnZoomOut) {
        btnZoomOut.addEventListener('click', function() {
            setUiceZoom(UICE_STATE.zoom - 0.15);
        });
    }

    if (btnZoomActual) {
        btnZoomActual.addEventListener('click', function() {
            setUiceZoom(1.0);
        });
    }

    if (btnZoomFit) {
        btnZoomFit.addEventListener('click', function() {
            fitUiceToScreen();
        });
    }

    // Smooth Canvas Pan / Hand Drag Controls
    const viewport = document.getElementById('uice-viewport');
    let isSpacePressed = false;

    window.addEventListener('keydown', function(e) {
        if (e.code === 'Space') {
            const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
            const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
            if (!isInput && !isSpacePressed) {
                isSpacePressed = true;
                if (viewport) viewport.classList.add('uice-panning-active');
            }
        }
    });

    window.addEventListener('keyup', function(e) {
        if (e.code === 'Space') {
            isSpacePressed = false;
            if (viewport) {
                viewport.classList.remove('uice-panning-active');
                viewport.classList.remove('uice-is-panning');
            }
            if (UICE_STATE.pan) UICE_STATE.pan.isPanning = false;
        }
    });

    if (viewport) {
        viewport.addEventListener('mousedown', function(e) {
            if (e.button === 1 || (isSpacePressed && e.button === 0)) {
                e.preventDefault();
                UICE_STATE.pan = {
                    isPanning: true,
                    startX: e.clientX,
                    startY: e.clientY,
                    scrollLeft: viewport.scrollLeft,
                    scrollTop: viewport.scrollTop
                };
                viewport.classList.add('uice-is-panning');
            }
        });

        window.addEventListener('mousemove', function(e) {
            if (UICE_STATE.pan && UICE_STATE.pan.isPanning) {
                e.preventDefault();
                const dx = e.clientX - UICE_STATE.pan.startX;
                const dy = e.clientY - UICE_STATE.pan.startY;
                viewport.scrollLeft = UICE_STATE.pan.scrollLeft - dx;
                viewport.scrollTop = UICE_STATE.pan.scrollTop - dy;
            }
        });

        window.addEventListener('mouseup', function(e) {
            if (UICE_STATE.pan && UICE_STATE.pan.isPanning) {
                UICE_STATE.pan.isPanning = false;
                if (viewport) viewport.classList.remove('uice-is-panning');
            }
        });
    }

    // Global Canvas Keyboard Shortcuts
    setupUiceKeyboardShortcuts();

    // Preview guard select
    const previewEmpSel = document.getElementById('uice-preview-emp-select');
    if (previewEmpSel) {
        previewEmpSel.addEventListener('change', function() {
            const found = (VSA_STATE.employees || []).find(e => e.id == this.value);
            if (found) {
                UICE_STATE.previewEmp = found;
                renderUiceStage();
            }
        });
    }

    // Top template selector
    const topTplSel = document.getElementById('uice-top-tpl-select');
    if (topTplSel) {
        topTplSel.addEventListener('change', function() {
            loadTemplateInStudio(this.value);
        });
    }

    const btnNewTpl = document.getElementById('btn-uice-new-template');
    if (btnNewTpl) {
        btnNewTpl.addEventListener('click', function() {
            promptAndCreateNewTemplate('visual');
        });
    }

    const btnDelTpl = document.getElementById('btn-uice-delete-template');
    if (btnDelTpl) {
        btnDelTpl.addEventListener('click', function() {
            if (UICE_STATE.template && UICE_STATE.template.id) {
                if (UICE_STATE.template.id === 'tpl-default') {
                    alert('Default template cannot be deleted.');
                    return;
                }
                if (confirm(`Delete template "${UICE_STATE.template.name}"?`)) {
                    deleteTemplate(UICE_STATE.template.id);
                }
            }
        });
    }

    // Export PNG / High-DPI Exporter
    const btnExportPng = document.getElementById('btn-uice-export-png');
    if (btnExportPng) {
        btnExportPng.addEventListener('click', openUiceExportModal);
    }

    // Phase 7: A4 Multi-Up Print Sheet
    const btnPrintSheet = document.getElementById('btn-uice-print-sheet');
    if (btnPrintSheet) {
        btnPrintSheet.addEventListener('click', openUiceSheetModal);
    }

    // Phase 7: Industrial Batch Export Pipeline
    const btnBatchExport = document.getElementById('btn-uice-batch-export');
    if (btnBatchExport) {
        btnBatchExport.addEventListener('click', openUiceBatchModal);
    }

    // Save Layout
    const btnSaveTpl = document.getElementById('btn-uice-save-template');
    if (btnSaveTpl) {
        btnSaveTpl.addEventListener('click', saveUiceTemplate);
    }

    // Quick Inspector Actions
    const btnElemLock = document.getElementById('btn-uice-elem-lock');
    if (btnElemLock) {
        btnElemLock.addEventListener('click', function() {
            if (UICE_STATE.selectedId) {
                const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
                const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
                if (el) {
                    el.locked = !el.locked;
                    renderUiceStage();
                    pushUiceHistory(`${el.locked ? 'Lock' : 'Unlock'} ${el.name}`);
                }
            }
        });
    }

    const btnElemDup = document.getElementById('btn-uice-elem-dup');
    if (btnElemDup) {
        btnElemDup.addEventListener('click', function() {
            if (UICE_STATE.selectedId) duplicateUiceElement(UICE_STATE.selectedId);
        });
    }

    const btnElemDel = document.getElementById('btn-uice-elem-del');
    if (btnElemDel) {
        btnElemDel.addEventListener('click', function() {
            if (UICE_STATE.selectedId) deleteUiceElement(UICE_STATE.selectedId);
        });
    }

    const btnElemFront = document.getElementById('btn-uice-elem-front');
    if (btnElemFront) {
        btnElemFront.addEventListener('click', function() {
            if (UICE_STATE.selectedId) {
                const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
                const elements = getUiceActiveElements(layout);
                const el = elements.find(x => x.id === UICE_STATE.selectedId);
                if (el) {
                    const maxZ = Math.max(...elements.map(x => x.zIndex || 1));
                    el.zIndex = maxZ + 1;
                    renderUiceStage();
                    pushUiceHistory(`Bring to Front: ${el.name}`);
                }
            }
        });
    }

    const btnElemBack = document.getElementById('btn-uice-elem-back');
    if (btnElemBack) {
        btnElemBack.addEventListener('click', function() {
            if (UICE_STATE.selectedId) {
                const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
                const elements = getUiceActiveElements(layout);
                const el = elements.find(x => x.id === UICE_STATE.selectedId);
                if (el) {
                    const minZ = Math.min(...elements.map(x => x.zIndex || 1));
                    el.zIndex = Math.max(0, minZ - 1);
                    renderUiceStage();
                    pushUiceHistory(`Send to Back: ${el.name}`);
                }
            }
        });
    }

    // Quick Align Buttons
    const alignMap = {
        'btn-align-left': 'left',
        'btn-align-center-x': 'center-x',
        'btn-align-right': 'right',
        'btn-align-top': 'top',
        'btn-align-center-y': 'center-y',
        'btn-align-bottom': 'bottom'
    };

    Object.entries(alignMap).forEach(([btnId, alignType]) => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', function() {
                alignSelectedUiceElement(alignType);
            });
        }
    });

    // Inspector Two-Way Data Binding
    bindUiceInspectorInputs();
}

/**
 * Binds input and change events to the Property Inspector fields.
 */
function bindUiceInspectorInputs() {
    const bindNum = (id, propKey, isProp = false, nestedKey = null) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el) return;

            const val = parseFloat(this.value) || 0;
            if (isProp) {
                if (!el.properties) el.properties = {};
                if (nestedKey) {
                    el.properties[nestedKey] = val;
                } else {
                    el.properties[propKey] = val;
                }
            } else {
                el[propKey] = val;
            }
            renderUiceStage();
        });
        input.addEventListener('change', () => pushUiceHistory('Change Property'));
    };

    const bindVal = (id, propKey, isProp = false) => {
        const input = document.getElementById(id);
        if (!input) return;
        input.addEventListener('input', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el) return;

            const val = this.type === 'checkbox' ? this.checked : this.value;
            if (isProp) {
                if (!el.properties) el.properties = {};
                el.properties[propKey] = val;
            } else {
                el[propKey] = val;
            }
            renderUiceStage();
        });
        input.addEventListener('change', () => pushUiceHistory('Change Property'));
    };

    // Geometry
    bindNum('prop-uice-x', 'x');
    bindNum('prop-uice-y', 'y');
    bindNum('prop-uice-w', 'width');
    bindNum('prop-uice-h', 'height');
    bindNum('prop-uice-rot', 'rotation');
    bindNum('prop-uice-z', 'zIndex');

    // Typography
    bindVal('prop-uice-font', 'fontFamily', true);
    bindNum('prop-uice-font-size', 'fontSize', true);
    bindVal('prop-uice-font-weight', 'fontWeight', true);
    bindVal('prop-uice-color', 'color', true);
    bindNum('prop-uice-letter-spacing', 'letterSpacing', true);
    bindNum('prop-uice-line-height', 'lineHeight', true);
    bindVal('prop-uice-text-align', 'textAlign', true);
    bindVal('prop-uice-text-transform', 'textTransform', true);
    bindVal('prop-uice-text-autofit', 'autoFit', true);
    bindVal('prop-uice-text-wrap', 'wrap', true);

    // Agency Header
    bindVal('prop-uice-agency-title', 'title', true);
    bindVal('prop-uice-agency-subtitle', 'subtitle', true);
    bindNum('prop-uice-agency-title-size', 'titleFontSize', true);
    bindNum('prop-uice-agency-sub-size', 'subtitleFontSize', true);
    bindNum('prop-uice-agency-logo-size', 'logoSize', true);
    bindNum('prop-uice-agency-letter-spacing', 'letterSpacing', true);
    bindNum('prop-uice-agency-line-height', 'lineHeight', true);
    bindVal('prop-uice-agency-color', 'color', true);
    bindVal('prop-uice-agency-autofit', 'autoFit', true);
    bindVal('prop-uice-agency-wrap', 'wrap', true);

    // Photo
    bindVal('prop-uice-photo-shape', 'shape', true);
    bindNum('prop-uice-photo-border', 'borderWidth', true);
    bindVal('prop-uice-photo-border-color', 'borderColor', true);
    bindVal('prop-uice-photo-outline-color', 'outlineColor', true);

    // QR
    bindVal('prop-uice-qr-fg', 'foreground', true);
    bindVal('prop-uice-qr-bg', 'background', true);
    bindVal('prop-uice-qr-ecc', 'errorCorrection', true);
    bindNum('prop-uice-qr-quiet', 'quietZone', true);

    // Barcode
    bindVal('prop-uice-barcode-format', 'format', true);
    bindVal('prop-uice-barcode-color', 'lineColor', true);
    bindVal('prop-uice-barcode-bg', 'background', true);
    bindNum('prop-uice-barcode-font-size', 'fontSize', true);
    bindVal('prop-uice-barcode-text', 'showText', true);

    // Details Table
    bindNum('prop-uice-table-row-pad', 'rowPadding', true);
    bindNum('prop-uice-table-font-size', 'fontSize', true);
    bindNum('prop-uice-table-label-w', 'labelWidth', true);
    bindNum('prop-uice-table-val-spacing', 'labelValueSpacing', true);
    bindVal('prop-uice-table-label-c', 'labelColor', true);
    bindVal('prop-uice-table-value-c', 'valueColor', true);
    bindVal('prop-uice-table-autofit', 'autoFit', true);
    bindVal('prop-uice-table-address-wrap', 'addressWrap', true);

    // Signature
    bindVal('prop-uice-sig-preset', 'preset', true);
    bindVal('prop-uice-sig-label', 'label', true);

    // Shape
    bindVal('prop-uice-shape-fill', 'fill', true);
    bindVal('prop-uice-shape-border', 'borderColor', true);
    bindNum('prop-uice-shape-border-w', 'borderWidth', true);
    bindNum('prop-uice-shape-radius', 'borderRadius', true);

    // Text Content (for custom-text and badge-pill)
    bindVal('prop-uice-text-content', 'text', true);

    // Guilloche
    bindVal('prop-uice-guilloche-style', 'style', true);
    bindVal('prop-uice-guilloche-stroke', 'strokeColor', true);
    bindNum('prop-uice-guilloche-freq', 'frequency', true);
    bindNum('prop-uice-guilloche-count', 'waveCount', true);
    bindNum('prop-uice-guilloche-amp', 'amplitude', true);
    bindNum('prop-uice-guilloche-width', 'strokeWidth', true);

    // Hologram
    bindVal('prop-uice-hologram-foil', 'foilStyle', true);
    bindVal('prop-uice-hologram-shape', 'badgeShape', true);
    bindVal('prop-uice-hologram-crest', 'crest', true);
    bindVal('prop-uice-hologram-label', 'label', true);

    // Microtext
    bindVal('prop-uice-microtext-text', 'text', true);
    bindNum('prop-uice-microtext-size', 'fontSize', true);
    bindNum('prop-uice-microtext-spacing', 'letterSpacing', true);
    bindVal('prop-uice-microtext-color', 'color', true);
    bindNum('prop-uice-microtext-repeat', 'repeatCount', true);

    // Watermark
    bindVal('prop-uice-watermark-preset', 'preset', true);
    bindNum('prop-uice-watermark-rot', 'rotation', true);
    bindVal('prop-uice-watermark-gray', 'grayscale', true);

    // Advanced Progressive Disclosure Bindings
    const propNameInp = document.getElementById('prop-uice-name');
    if (propNameInp) {
        propNameInp.addEventListener('input', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el) return;
            el.name = this.value;
            const idBadge = document.getElementById('lbl-uice-elem-id');
            if (idBadge) idBadge.textContent = el.name;
            renderUiceLayersList();
        });
        propNameInp.addEventListener('change', () => pushUiceHistory('Rename Element'));
    }

    const propOpacityInp = document.getElementById('prop-uice-opacity');
    if (propOpacityInp) {
        propOpacityInp.addEventListener('input', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el) return;
            if (!el.properties) el.properties = {};
            const val = parseFloat(this.value) || 1;
            el.properties.opacity = val;
            const lbl = document.getElementById('lbl-uice-opacity-val');
            if (lbl) lbl.textContent = Math.round(val * 100) + '%';
            const node = document.querySelector(`.uice-node[data-id="${el.id}"]`);
            if (node) node.style.opacity = val;
        });
        propOpacityInp.addEventListener('change', () => pushUiceHistory('Change Opacity'));
    }

    bindVal('prop-uice-shadow', 'shadow', true);

    const propLockCb = document.getElementById('prop-uice-lock');
    if (propLockCb) {
        propLockCb.addEventListener('change', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el) return;
            el.locked = this.checked;
            renderUiceStage();
            pushUiceHistory(`${el.locked ? 'Lock' : 'Unlock'} ${el.name || el.type}`);
        });
    }

    // Phase 4 Quick Fix Actions
    const btnQrFixRatio = document.getElementById('btn-uice-qr-fix-ratio');
    if (btnQrFixRatio) {
        btnQrFixRatio.addEventListener('click', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.type !== 'qr-code') return;
            const maxDim = Math.max(el.width, el.height, 48);
            el.width = maxDim;
            el.height = maxDim;
            renderUiceStage();
            pushUiceHistory('Fix QR 1:1 Aspect Ratio');
        });
    }

    const btnQrFixContrast = document.getElementById('btn-uice-qr-fix-contrast');
    if (btnQrFixContrast) {
        btnQrFixContrast.addEventListener('click', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.type !== 'qr-code') return;
            if (!el.properties) el.properties = {};
            el.properties.foreground = '#000000';
            el.properties.background = '#ffffff';
            renderUiceStage();
            pushUiceHistory('Boost QR B/W Contrast');
        });
    }

    const btnQrFixSize = document.getElementById('btn-uice-qr-fix-size');
    if (btnQrFixSize) {
        btnQrFixSize.addEventListener('click', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.type !== 'qr-code') return;
            if (el.width < 48) el.width = 48;
            if (el.height < 48) el.height = 48;
            renderUiceStage();
            pushUiceHistory('Enforce QR 48px Minimum Size');
        });
    }

    const btnBarcodeFixSize = document.getElementById('btn-uice-barcode-fix-size');
    if (btnBarcodeFixSize) {
        btnBarcodeFixSize.addEventListener('click', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.type !== 'barcode') return;
            el.width = 120;
            el.height = 26;
            renderUiceStage();
            pushUiceHistory('Set Standard Barcode Size (120×26)');
        });
    }

    const btnBarcodeFixContrast = document.getElementById('btn-uice-barcode-fix-contrast');
    if (btnBarcodeFixContrast) {
        btnBarcodeFixContrast.addEventListener('click', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.type !== 'barcode') return;
            if (!el.properties) el.properties = {};
            el.properties.lineColor = '#000000';
            el.properties.background = '#ffffff';
            renderUiceStage();
            pushUiceHistory('Boost Barcode B/W Contrast');
        });
    }

    // Phase 5 Quick Action Buttons
    const btnTypoFixAutoFit = document.getElementById('btn-uice-typo-autofit');
    if (btnTypoFixAutoFit) {
        btnTypoFixAutoFit.addEventListener('click', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el) return;
            if (!el.properties) el.properties = {};
            const diag = validateTypographyFit(el, UICE_STATE.previewEmp);
            if (diag.recommendedFontSize) {
                el.properties.fontSize = diag.recommendedFontSize;
                renderUiceStage();
                pushUiceHistory(`Auto-Fit Font Size: ${el.name || el.type}`);
            }
        });
    }

    const btnAgencyFixAutoFit = document.getElementById('btn-uice-agency-autofit');
    if (btnAgencyFixAutoFit) {
        btnAgencyFixAutoFit.addEventListener('click', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.type !== 'agency-brand') return;
            if (!el.properties) el.properties = {};
            const availW = Math.max(20, el.width - (el.properties.logoSize || 32) - 12);
            const fitT = calculateAutoFitFontSize({
                text: el.properties.title || 'VALLEY SECURITY AGENCY',
                width: availW,
                height: el.height * 0.65,
                preferredSize: 12,
                minSize: 7.5,
                lineHeight: el.properties.lineHeight || 1.15,
                letterSpacing: el.properties.letterSpacing !== undefined ? el.properties.letterSpacing : 0.4,
                allowWrap: !!el.properties.wrap,
                fontWeight: '800'
            });
            const fitS = calculateAutoFitFontSize({
                text: el.properties.subtitle || 'SHAHIDGUNJ SRINAGAR',
                width: availW,
                height: el.height * 0.35,
                preferredSize: 6.5,
                minSize: 5.5,
                lineHeight: 1.1,
                letterSpacing: 0.4,
                allowWrap: false,
                fontWeight: '600'
            });
            el.properties.titleFontSize = fitT.fontSize;
            el.properties.subtitleFontSize = fitS.fontSize;
            renderUiceStage();
            pushUiceHistory('Auto-Fit Agency Header to Artboard');
        });
    }

    const btnTableFixAutoFit = document.getElementById('btn-uice-table-autofit');
    if (btnTableFixAutoFit) {
        btnTableFixAutoFit.addEventListener('click', function() {
            if (!UICE_STATE.selectedId) return;
            const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
            const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
            if (!el || el.type !== 'details-table') return;
            if (!el.properties) el.properties = {};
            const diag = validateTypographyFit(el, UICE_STATE.previewEmp);
            if (diag.recommendedFontSize) {
                el.properties.fontSize = diag.recommendedFontSize;
                if (el.properties.rowPadding > 2) el.properties.rowPadding = 2;
                renderUiceStage();
                pushUiceHistory('Auto-Balance Table Rows');
            }
        });
    }
}

/**
 * Aligns selected element relative to artboard boundaries.
 */
function alignSelectedUiceElement(alignType) {
    if (!UICE_STATE.selectedId) return;
    const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
    const el = getUiceActiveElements(layout).find(x => x.id === UICE_STATE.selectedId);
    if (!el || el.locked) return;

    switch (alignType) {
        case 'left': el.x = 0; break;
        case 'center-x': el.x = Math.round((layout.width - el.width) / 2); break;
        case 'right': el.x = layout.width - el.width; break;
        case 'top': el.y = 0; break;
        case 'center-y': el.y = Math.round((layout.height - el.height) / 2); break;
        case 'bottom': el.y = layout.height - el.height; break;
    }

    renderUiceStage();
    pushUiceHistory(`Align ${alignType}: ${el.name}`);
}

/**
 * Computes magnetic alignment guidelines against artboard and peer elements.
 */
function computeUiceAlignmentGuides(activeEl, targetX, targetY, layout) {
    const threshold = 5;
    let resX = targetX;
    let resY = targetY;
    const lines = [];

    const activeW = activeEl.width;
    const activeH = activeEl.height;

    const testX = [
        { val: 0, guide: 0 },
        { val: Math.round(layout.width / 2 - activeW / 2), guide: Math.round(layout.width / 2) },
        { val: layout.width - activeW, guide: layout.width }
    ];

    const testY = [
        { val: 0, guide: 0 },
        { val: Math.round(layout.height / 2 - activeH / 2), guide: Math.round(layout.height / 2) },
        { val: layout.height - activeH, guide: layout.height }
    ];

    // Check peers
    const peerList = (typeof getUiceActiveElements === 'function') ? getUiceActiveElements(layout) : (layout.elements || []);
    peerList.forEach(other => {
        if (other.id === activeEl.id || other.visible === false) return;
        testX.push({ val: other.x, guide: other.x });
        testX.push({ val: other.x + other.width - activeW, guide: other.x + other.width });
        testX.push({ val: Math.round(other.x + other.width / 2 - activeW / 2), guide: Math.round(other.x + other.width / 2) });

        testY.push({ val: other.y, guide: other.y });
        testY.push({ val: other.y + other.height - activeH, guide: other.y + other.height });
        testY.push({ val: Math.round(other.y + other.height / 2 - activeH / 2), guide: Math.round(other.y + other.height / 2) });
    });

    // Match X
    for (const item of testX) {
        if (Math.abs(targetX - item.val) <= threshold) {
            resX = item.val;
            lines.push({ type: 'vertical', pos: item.guide });
            break;
        }
    }

    // Match Y
    for (const item of testY) {
        if (Math.abs(targetY - item.val) <= threshold) {
            resY = item.val;
            lines.push({ type: 'horizontal', pos: item.guide });
            break;
        }
    }

    return { x: resX, y: resY, lines };
}

function drawUiceGuides(lines) {
    const container = document.getElementById('uice-guides-container');
    if (!container) return;
    container.innerHTML = lines.map(l => `
        <div class="uice-guide-line ${l.type}" style="${l.type === 'vertical' ? `left: ${l.pos}px;` : `top: ${l.pos}px;`}"></div>
    `).join('');
}

/**
 * Intelligently transforms an ID card layout from one orientation/aspect-ratio to another.
 * Semantic Role Detection -> Spatial Ergonomics -> Proportion Refactor -> Collision Avoidance -> Scannability Sentinel.
 * 
 * @param {Object} sourceLayout - The source layout object ({ width, height, background, elements })
 * @param {number} targetW - Target width in pixels (e.g. 320 for vertical, 500 for horizontal, or custom)
 * @param {number} targetH - Target height in pixels (e.g. 500 for vertical, 320 for horizontal, or custom)
 * @param {string} targetOrient - 'horizontal' | 'vertical' | 'custom'
 * @returns {Object} A brand new independent layout object tailored for the target dimensions.
 */
function transformLayoutBetweenOrientations(sourceLayout, targetW, targetH, targetOrient) {
    if (!sourceLayout || !Array.isArray(sourceLayout.elements)) {
        return {
            width: targetW,
            height: targetH,
            background: { color: '#ffffff', headerBg: '#0e3e2b', accent: '#009688', borderRadius: 14 },
            elements: getUiceDefaultElements(targetOrient || (targetW >= targetH ? 'horizontal' : 'vertical'))
        };
    }

    const sourceW = sourceLayout.width || 500;
    const sourceH = sourceLayout.height || 320;
    const isTargetVertical = targetH >= targetW;

    // Deep clone background and preserve custom palette
    const targetBg = JSON.parse(JSON.stringify(sourceLayout.background || {
        color: '#ffffff',
        headerBg: '#0e3e2b',
        accent: '#009688',
        borderRadius: 14
    }));

    // Clone elements array
    const sourceElements = JSON.parse(JSON.stringify(sourceLayout.elements));

    // Categorize elements by semantic roles
    const headerBars = [];
    const brands = [];
    const badges = [];
    const photos = [];
    const names = [];
    const designations = [];
    const tables = [];
    const barcodes = [];
    const signatures = [];
    const qrs = [];
    const others = [];

    sourceElements.forEach(el => {
        if (!el || el.visible === false) return;
        const type = el.type;
        const nameLower = (el.name || '').toLowerCase();
        if (type === 'shape' && (el.y <= 20 || nameLower.includes('header') || nameLower.includes('bar')) && el.width >= sourceW * 0.65) {
            headerBars.push(el);
        } else if (type === 'agency-brand' || type === 'agency-logo') {
            brands.push(el);
        } else if (type === 'badge-pill') {
            badges.push(el);
        } else if (type === 'employee-photo') {
            photos.push(el);
        } else if (type === 'employee-name') {
            names.push(el);
        } else if (type === 'designation') {
            designations.push(el);
        } else if (type === 'details-table') {
            tables.push(el);
        } else if (type === 'barcode') {
            barcodes.push(el);
        } else if (type === 'signature') {
            signatures.push(el);
        } else if (type === 'qr-code') {
            qrs.push(el);
        } else {
            others.push(el);
        }
    });

    const transformedElements = [];

    if (isTargetVertical) {
        // =========================================================================
        // TARGET: VERTICAL / PORTRAIT COMPOSITION (e.g. 320 x 500)
        // Hierarchy: Top Banner -> Brand -> Badge -> Hero Photo -> Name -> Designation -> Table -> Footer Lockup (Barcode | Sig | QR)
        // =========================================================================

        const headerHeight = Math.max(54, Math.min(74, Math.round(targetH * 0.124)));

        // 1. Top Header Accent Shape
        headerBars.forEach(el => {
            el.x = 0;
            el.y = 0;
            el.width = targetW;
            el.height = headerHeight;
            el.zIndex = el.zIndex || 1;
            transformedElements.push(el);
        });

        // 2. Agency Brand / Logo
        brands.forEach(el => {
            el.x = 10;
            el.y = 8;
            el.width = Math.max(200, targetW - 20);
            el.height = headerHeight - 16;
            el.zIndex = Math.max(2, el.zIndex || 2);
            if (el.properties) {
                if (el.properties.titleFontSize) el.properties.titleFontSize = Math.min(12, Math.max(10, el.properties.titleFontSize * 0.95));
                if (el.properties.logoSize) el.properties.logoSize = Math.min(36, Math.max(28, el.properties.logoSize));
            }
            transformedElements.push(el);
        });

        // 3. Card Title Badge Pill
        let badgeY = headerHeight + 6;
        badges.forEach(el => {
            const badgeW = Math.min(220, targetW - 40);
            el.width = badgeW;
            el.height = 24;
            el.x = Math.round((targetW - badgeW) / 2);
            el.y = badgeY;
            if (el.properties && el.properties.fontSize) {
                el.properties.fontSize = Math.min(11, el.properties.fontSize);
            }
            transformedElements.push(el);
            badgeY += 28;
        });

        // 4. Employee Photo (Centered Hero Anchor)
        const photoSize = Math.max(90, Math.min(120, Math.round(targetW * 0.35))); // e.g. 110px for 320w
        let photoY = badges.length > 0 ? (badgeY + 4) : (headerHeight + 10);
        photos.forEach(el => {
            el.width = photoSize;
            el.height = photoSize;
            el.x = Math.round((targetW - photoSize) / 2);
            el.y = photoY;
            el.zIndex = Math.max(3, el.zIndex || 3);
            transformedElements.push(el);
        });

        // 5. Employee Name (Centered Under Photo)
        let nameY = photos.length > 0 ? (photoY + photoSize + 8) : (headerHeight + 20);
        names.forEach(el => {
            el.x = 10;
            el.y = nameY;
            el.width = targetW - 20;
            el.height = 26;
            if (el.properties) {
                el.properties.textAlign = 'center';
                el.properties.fontSize = Math.min(16.5, Math.max(13, el.properties.fontSize || 16));
            }
            transformedElements.push(el);
            nameY += 26;
        });

        // 6. Designation (Centered Under Name)
        let desigY = nameY;
        designations.forEach(el => {
            el.x = 10;
            el.y = desigY;
            el.width = targetW - 20;
            el.height = 18;
            if (el.properties) {
                el.properties.textAlign = 'center';
                el.properties.fontSize = Math.min(11, Math.max(9, el.properties.fontSize || 10.5));
            }
            transformedElements.push(el);
            desigY += 22;
        });

        // 7. Details Table (Full Width Below Designation)
        let tableY = desigY + 4;
        const footerY = targetH - 92;
        const availableTableH = Math.max(90, footerY - tableY - 6);
        tables.forEach(el => {
            el.x = 16;
            el.y = tableY;
            el.width = targetW - 32;
            el.height = availableTableH;
            if (el.properties) {
                el.properties.rowPadding = 2.5;
                el.properties.labelWidth = Math.min(44, Math.round(targetW * 0.13));
                el.properties.fontSize = Math.min(8.5, Math.max(7.5, el.properties.fontSize || 8));
            }
            transformedElements.push(el);
        });

        // 8. Footer Security Lockup: Barcode (Left), Signature (Center), QR (Right)
        const footerActualY = targetH - 90;
        barcodes.forEach(el => {
            el.x = 12;
            el.y = footerActualY + 8;
            el.width = Math.min(130, Math.max(100, Math.round(targetW * 0.39)));
            el.height = 26;
            if (el.properties) {
                el.properties.fontSize = 8;
            }
            transformedElements.push(el);
        });

        signatures.forEach(el => {
            el.x = Math.round(targetW * 0.46);
            el.y = footerActualY + 2;
            el.width = Math.min(100, Math.max(85, Math.round(targetW * 0.30)));
            el.height = 44;
            transformedElements.push(el);
        });

        qrs.forEach(el => {
            const qrSize = Math.max(46, Math.min(54, Math.round(targetW * 0.16)));
            el.x = targetW - qrSize - 14;
            el.y = footerActualY;
            el.width = qrSize;
            el.height = qrSize;
            transformedElements.push(el);
        });

    } else {
        // =========================================================================
        // TARGET: HORIZONTAL / LANDSCAPE COMPOSITION (e.g. 500 x 320)
        // Hierarchy: Top Banner -> Left Pillar (Photo + Barcode) -> Right Column (Name, Desig, Table, Sig, QR)
        // =========================================================================

        const headerHeight = Math.max(48, Math.min(58, Math.round(targetH * 0.165)));

        // 1. Top Header Accent Shape
        headerBars.forEach(el => {
            el.x = 0;
            el.y = 0;
            el.width = targetW;
            el.height = headerHeight;
            el.zIndex = el.zIndex || 1;
            transformedElements.push(el);
        });

        // 2. Agency Brand (Top Left)
        brands.forEach(el => {
            el.x = 14;
            el.y = 8;
            el.width = Math.max(220, Math.round(targetW * 0.58));
            el.height = headerHeight - 14;
            el.zIndex = Math.max(2, el.zIndex || 2);
            if (el.properties) {
                if (el.properties.titleFontSize) el.properties.titleFontSize = 12;
                if (el.properties.logoSize) el.properties.logoSize = 32;
            }
            transformedElements.push(el);
        });

        // 3. Card Title Badge Pill (Top Right)
        badges.forEach(el => {
            const badgeW = Math.min(180, Math.round(targetW * 0.34));
            el.width = badgeW;
            el.height = 28;
            el.x = targetW - badgeW - 14;
            el.y = 12;
            if (el.properties && el.properties.fontSize) {
                el.properties.fontSize = 12;
            }
            transformedElements.push(el);
        });

        // Left Pillar Layout (Photo & Barcode)
        const leftPillarX = 18;
        const photoSize = Math.max(90, Math.min(125, Math.round(targetH * 0.36))); // e.g. 114px
        const photoY = headerHeight + 14;
        photos.forEach(el => {
            el.width = photoSize;
            el.height = photoSize;
            el.x = leftPillarX;
            el.y = photoY;
            el.zIndex = Math.max(3, el.zIndex || 3);
            transformedElements.push(el);
        });

        // Barcode (Under Photo in left pillar)
        const barcodeY = photoY + photoSize + 14;
        barcodes.forEach(el => {
            el.x = Math.max(12, leftPillarX - 4);
            el.y = Math.min(targetH - 36, barcodeY);
            el.width = Math.max(110, photoSize + 10);
            el.height = 28;
            transformedElements.push(el);
        });

        // Right Column Layout
        const rightColX = Math.round(leftPillarX + photoSize + 20); // e.g. 152px
        const rightColW = targetW - rightColX - 16; // e.g. 332px

        // 4. Employee Name
        const nameY = headerHeight + 14;
        names.forEach(el => {
            el.x = rightColX;
            el.y = nameY;
            el.width = rightColW;
            el.height = 30;
            if (el.properties) {
                el.properties.textAlign = 'left';
                el.properties.fontSize = 16.5;
            }
            transformedElements.push(el);
        });

        // 5. Designation
        const desigY = nameY + 30;
        designations.forEach(el => {
            el.x = rightColX;
            el.y = desigY;
            el.width = rightColW;
            el.height = 20;
            if (el.properties) {
                el.properties.textAlign = 'left';
                el.properties.fontSize = 10;
            }
            transformedElements.push(el);
        });

        // 6. Details Table
        const tableY = desigY + 22;
        const tableH = Math.max(90, Math.min(126, targetH - tableY - 76));
        tables.forEach(el => {
            el.x = rightColX;
            el.y = tableY;
            el.width = rightColW;
            el.height = tableH;
            if (el.properties) {
                el.properties.rowPadding = 3;
                el.properties.labelWidth = 38;
                el.properties.fontSize = 8;
            }
            transformedElements.push(el);
        });

        // 7. Signature and QR Code (Bottom Right Validation cluster)
        const footerY = targetH - 74;
        signatures.forEach(el => {
            el.x = Math.round(rightColX + (rightColW * 0.25));
            el.y = footerY + 2;
            el.width = 115;
            el.height = 48;
            transformedElements.push(el);
        });

        qrs.forEach(el => {
            const qrSize = Math.max(48, Math.min(58, Math.round(targetH * 0.17)));
            el.x = targetW - qrSize - 22;
            el.y = footerY;
            el.width = qrSize;
            el.height = qrSize;
            transformedElements.push(el);
        });
    }

    // Proportional placement for any auxiliary / custom elements
    const scaleX = targetW / sourceW;
    const scaleY = targetH / sourceH;
    others.forEach(el => {
        el.x = Math.max(6, Math.min(targetW - el.width - 6, Math.round(el.x * scaleX)));
        el.y = Math.max(6, Math.min(targetH - el.height - 6, Math.round(el.y * scaleY)));
        el.width = Math.min(targetW - 12, Math.max(16, Math.round(el.width * scaleX)));
        el.height = Math.min(targetH - 12, Math.max(16, Math.round(el.height * scaleY)));
        transformedElements.push(el);
    });

    // Scannability Sentinel Safeguard Pass:
    transformedElements.forEach(el => {
        if (el.type === 'qr-code') {
            if (el.width < 44) el.width = 44;
            if (el.height < 44) el.height = 44;
        }
        if (el.type === 'barcode') {
            if (el.width < 100) el.width = 100;
            if (el.height < 22) el.height = 22;
        }
    });

    // Boundary clamping pass to prevent overflow
    transformedElements.forEach(el => {
        if (el.x < 0) el.x = 0;
        if (el.y < 0) el.y = 0;
        if (el.x + el.width > targetW) {
            el.x = Math.max(0, targetW - el.width);
        }
        if (el.y + el.height > targetH) {
            el.y = Math.max(0, targetH - el.height);
        }
    });

    return {
        width: targetW,
        height: targetH,
        background: targetBg,
        elements: transformedElements
    };
}

/**
 * Intelligently reflows and optimizes an existing layout for custom dimensions.
 */
function reflowLayoutForDimensions(layout, targetW, targetH) {
    if (!layout) return layout;
    const targetOrient = targetW >= targetH ? 'horizontal' : 'vertical';
    const transformed = transformLayoutBetweenOrientations(layout, targetW, targetH, targetOrient);
    layout.width = targetW;
    layout.height = targetH;
    layout.background = transformed.background;
    layout.elements = transformed.elements;
    return layout;
}

/**
 * Switches between Horizontal and Vertical orientations.
 * Preserves the independent layout configurations of both orientations.
 */
function switchUiceOrientation(newOrientation) {
    if (!UICE_STATE.template) return;
    if (!UICE_STATE.template.layouts) {
        UICE_STATE.template.layouts = {};
    }

    const prevOrient = UICE_STATE.orientation;
    UICE_STATE.orientation = newOrientation;
    UICE_STATE.template.layout = newOrientation;
    UICE_STATE.selectedId = null;

    // If target layout doesn't exist or is empty, intelligently derive from previous layout!
    if (!UICE_STATE.template.layouts[newOrientation] || 
        !Array.isArray(UICE_STATE.template.layouts[newOrientation].elements) || 
        UICE_STATE.template.layouts[newOrientation].elements.length === 0) {
        
        const sourceLayout = UICE_STATE.template.layouts[prevOrient];
        const targetDims = newOrientation === 'vertical' ? { w: 320, h: 500 } : { w: 500, h: 320 };
        if (sourceLayout && Array.isArray(sourceLayout.elements) && sourceLayout.elements.length > 0) {
            UICE_STATE.template.layouts[newOrientation] = transformLayoutBetweenOrientations(
                sourceLayout, targetDims.w, targetDims.h, newOrientation
            );
        } else {
            convertLegacyTemplateToUice(UICE_STATE.template);
        }
    }

    // Sync orientation dropdown
    const orientSel = document.getElementById('uice-orientation-sel');
    if (orientSel) orientSel.value = newOrientation;

    renderUiceStage();
    pushUiceHistory(`Switch to ${newOrientation}`);
}

/**
 * Converts the active design to the target orientation using intelligent spatial reflow.
 * Preserves the source orientation layout completely intact.
 */
function convertUiceOrientation(targetOrient) {
    if (!UICE_STATE.template || !UICE_STATE.template.layouts) return;

    const sourceOrient = UICE_STATE.orientation;
    if (!targetOrient) {
        targetOrient = sourceOrient === 'vertical' ? 'horizontal' : 'vertical';
    }

    if (sourceOrient === targetOrient) {
        alert(`Already in ${sourceOrient.toUpperCase()} orientation.`);
        return;
    }

    const confirmMsg = `Intelligently adapt current ${sourceOrient.toUpperCase()} design into ${targetOrient.toUpperCase()} orientation?\n\nThis will generate an ergonomically optimized ${targetOrient} layout without altering your saved ${sourceOrient} layout.`;
    if (!confirm(confirmMsg)) return;

    const sourceLayout = UICE_STATE.template.layouts[sourceOrient];
    const targetDims = targetOrient === 'vertical' ? { w: 320, h: 500 } : { w: 500, h: 320 };

    // Run intelligent transformation
    const newLayout = transformLayoutBetweenOrientations(sourceLayout, targetDims.w, targetDims.h, targetOrient);
    UICE_STATE.template.layouts[targetOrient] = newLayout;
    UICE_STATE.orientation = targetOrient;
    UICE_STATE.template.layout = targetOrient;
    UICE_STATE.selectedId = null;

    // Update orientation dropdown
    const orientSel = document.getElementById('uice-orientation-sel');
    if (orientSel) orientSel.value = targetOrient;

    renderUiceStage();
    pushUiceHistory(`Intelligent Convert to ${targetOrient}`);
    alert(`Successfully converted card layout to ${targetOrient} orientation with intelligent spatial reflow!`);
}

/**
 * Reverts active orientation layout back to initial or last saved snapshot.
 */
function revertUiceLayout() {
    if (!UICE_STATE.template || !UICE_STATE.template.layouts) return;
    const orient = UICE_STATE.orientation;

    if (!UICE_STATE.initialSnapshots || !UICE_STATE.initialSnapshots[orient]) {
        alert('No previous snapshot available to revert to.');
        return;
    }

    if (!confirm(`Revert ${orient.toUpperCase()} layout to the initial loaded state? Any unsaved edits will be discarded.`)) return;

    UICE_STATE.template.layouts[orient] = JSON.parse(JSON.stringify(UICE_STATE.initialSnapshots[orient]));
    UICE_STATE.selectedId = null;

    renderUiceStage();
    pushUiceHistory(`Revert Changes (${orient})`);
    alert(`${orient.toUpperCase()} layout reverted successfully!`);
}

/**
 * Auto-arranges elements using the intelligent spatial layout algorithm.
 * Intelligently balances active elements, resolves collisions, and ensures scannability.
 */
function autoArrangeUiceLayout() {
    const layout = UICE_STATE.template ? UICE_STATE.template.layouts[UICE_STATE.orientation] : null;
    if (!layout) return;

    reflowLayoutForDimensions(
        layout,
        layout.width || (UICE_STATE.orientation === 'vertical' ? 320 : 500),
        layout.height || (UICE_STATE.orientation === 'vertical' ? 500 : 320)
    );

    renderUiceStage();
    pushUiceHistory('Auto-Arrange Layout');
    alert('Layout automatically arranged with intelligent spatial reflow & scannability sentinel checks!');
}

/**
 * Resets layout to factory archetype defaults.
 */
function resetUiceLayout() {
    const surfaceName = UICE_STATE.surface === 'back' ? 'Back' : 'Front';
    if (!confirm(`Reset current ${surfaceName} layout to factory defaults?`)) return;
    const layout = UICE_STATE.template ? UICE_STATE.template.layouts[UICE_STATE.orientation] : null;
    if (!layout) return;

    if (UICE_STATE.surface === 'back') {
        layout.backElements = getUiceDefaultBackElements(UICE_STATE.orientation, UICE_STATE.template);
    } else {
        layout.elements = getUiceDefaultElements(UICE_STATE.orientation, UICE_STATE.template);
    }
    renderUiceStage();
    pushUiceHistory(`Reset ${surfaceName} Layout Defaults`);
    alert(`Reset ${surfaceName} layout to factory defaults.`);
}

/**
 * Opens Custom Dimensions modal.
 */
function openUiceCustomDimModal() {
    const modal = document.getElementById('uice-custom-dim-modal');
    if (!modal) return;
    const layout = UICE_STATE.template && UICE_STATE.template.layouts
        ? UICE_STATE.template.layouts[UICE_STATE.orientation]
        : null;

    const curW = layout ? layout.width : (UICE_STATE.orientation === 'vertical' ? 320 : 500);
    const curH = layout ? layout.height : (UICE_STATE.orientation === 'vertical' ? 500 : 320);

    const inpW = document.getElementById('uice-custom-width');
    const inpH = document.getElementById('uice-custom-height');
    if (inpW) inpW.value = curW;
    if (inpH) inpH.value = curH;

    modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons({ root: modal });
    }
}

/**
 * Closes Custom Dimensions modal.
 */
function closeUiceCustomDimModal() {
    const modal = document.getElementById('uice-custom-dim-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Handles submission of Custom Dimensions modal.
 */
function handleUiceCustomDimSubmit(e) {
    if (e) e.preventDefault();
    const inpW = document.getElementById('uice-custom-width');
    const inpH = document.getElementById('uice-custom-height');
    const chkReflow = document.getElementById('uice-custom-reflow');

    const w = parseInt(inpW ? inpW.value : 500) || 500;
    const h = parseInt(inpH ? inpH.value : 320) || 320;
    const reflow = chkReflow ? chkReflow.checked : true;

    applyUiceCustomDimensions(w, h, reflow);
    closeUiceCustomDimModal();
}

/**
 * Applies custom dimensions to active layout and optionally runs reflow.
 */
function applyUiceCustomDimensions(w, h, shouldReflow = true) {
    if (!UICE_STATE.template || !UICE_STATE.template.layouts) return;
    const layout = UICE_STATE.template.layouts[UICE_STATE.orientation];
    if (!layout) return;

    layout.width = w;
    layout.height = h;

    if (shouldReflow) {
        reflowLayoutForDimensions(layout, w, h);
    }

    // Sync orientation dropdown text to Custom
    const orientSel = document.getElementById('uice-orientation-sel');
    if (orientSel) {
        let optCustom = orientSel.querySelector('option[value="custom"]');
        if (!optCustom) {
            optCustom = document.createElement('option');
            optCustom.value = 'custom';
            orientSel.appendChild(optCustom);
        }
        optCustom.textContent = `Custom (${w}×${h})`;
        orientSel.value = 'custom';
    }

    renderUiceStage();
    pushUiceHistory(`Custom Dimensions (${w}×${h})`);
}

// ============================================================================
// PROJECT OMEGA PHASE 7: INDUSTRIAL EXPORT, PRINT PIPELINE & BATCH ENGINE
// ============================================================================

/**
 * Toggles dye-sublimation / CMYK gamut compression soft proofing simulation.
 */
function toggleUicePrintProofing(forceState) {
    if (typeof forceState === 'boolean') {
        UICE_STATE.showPrintProofing = forceState;
    } else {
        UICE_STATE.showPrintProofing = !UICE_STATE.showPrintProofing;
    }

    const btn = document.getElementById('btn-uice-print-proof');
    if (btn) btn.classList.toggle('active', UICE_STATE.showPrintProofing);

    const artboard = document.getElementById('uice-artboard');
    if (artboard) artboard.classList.toggle('uice-soft-proofing', UICE_STATE.showPrintProofing);

    return UICE_STATE.showPrintProofing;
}

/**
 * Opens Single Card High-DPI Export Modal.
 */
function openUiceExportModal() {
    const modal = document.getElementById('uice-export-modal');
    if (modal) {
        modal.classList.remove('hidden');
        updateUiceExportPreviewInfo();
        if (window.lucide) window.lucide.createIcons();
    }
}

/**
 * Closes Single Card High-DPI Export Modal.
 */
function closeUiceExportModal() {
    const modal = document.getElementById('uice-export-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Updates dimensions label in High-DPI Export Modal.
 */
function updateUiceExportPreviewInfo() {
    const dpiSel = document.getElementById('uice-export-dpi')?.value || '300dpi';
    const infoEl = document.getElementById('uice-export-dimensions-info');
    if (!infoEl) return;

    const layout = UICE_STATE.template && UICE_STATE.template.layouts
        ? UICE_STATE.template.layouts[UICE_STATE.orientation]
        : { width: 500, height: 320 };
    const isHoriz = (layout.width || 500) >= (layout.height || 320);

    let dimsText = '';
    switch (dpiSel) {
        case '300dpi':
            dimsText = isHoriz
                ? 'Target Render: 1011 × 638 px @ 300 DPI (ISO/IEC 7810 CR80 PVC Standard)'
                : 'Target Render: 638 × 1011 px @ 300 DPI (ISO/IEC 7810 CR80 PVC Standard)';
            break;
        case '600dpi':
            dimsText = isHoriz
                ? 'Target Render: 2000 × 1280 px @ 600 DPI (Ultra Master Archival Spec)'
                : 'Target Render: 1280 × 2000 px @ 600 DPI (Ultra Master Archival Spec)';
            break;
        case '2x':
            dimsText = isHoriz
                ? 'Target Render: 1000 × 640 px @ 192 DPI (Retina Crisp Screen/Digital Pass)'
                : 'Target Render: 640 × 1000 px @ 192 DPI (Retina Crisp Screen/Digital Pass)';
            break;
        case '1x':
        default:
            dimsText = isHoriz
                ? 'Target Render: 500 × 320 px @ 96 DPI (Standard Web Preview)'
                : 'Target Render: 320 × 500 px @ 96 DPI (Standard Web Preview)';
            break;
    }
    infoEl.textContent = dimsText;
}

/**
 * Handles submission of High-DPI Export Modal form.
 */
async function handleUiceExportSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const dpi = document.getElementById('uice-export-dpi')?.value || '300dpi';
    const format = document.getElementById('uice-export-format')?.value || 'png';
    const side = document.getElementById('uice-export-side')?.value || 'front';
    const includeBleed = !!document.getElementById('uice-export-bleed')?.checked;
    const simulateProof = !!document.getElementById('uice-export-cmyk-proof')?.checked;
    const gatekeeperEl = document.getElementById('uice-export-gatekeeper');
    const enforceGatekeeper = gatekeeperEl ? gatekeeperEl.checked : true;

    closeUiceExportModal();
    return await exportUiceCardWithResolution({
        dpi,
        format,
        side,
        includeBleed,
        simulateProof,
        enforceGatekeeper
    });
}

/**
 * Exports active or target ID card at precise specified DPI with optical scannability verification.
 */
async function exportUiceCardWithResolution(options = {}) {
    const {
        dpi = '300dpi',
        format = 'png',
        side = 'front',
        includeBleed = false,
        simulateProof = false,
        enforceGatekeeper = true,
        targetEmp = null
    } = options;

    const artboard = document.getElementById('uice-artboard');
    if (!artboard) return { success: false, error: 'Artboard not found' };

    const layout = UICE_STATE.template && UICE_STATE.template.layouts
        ? UICE_STATE.template.layouts[UICE_STATE.orientation]
        : null;
    const emp = targetEmp || UICE_STATE.previewEmp || (typeof VSA_STATE !== 'undefined' && VSA_STATE.employees && VSA_STATE.employees[0]) || { id: 'VSA-0042' };

    // Optical Scannability & Typography Gatekeeper
    if (layout && enforceGatekeeper) {
        const scannabilityReport = checkLayoutScannability(layout, emp);
        const typographyReport = checkLayoutTypography(layout, emp);
        const allCriticalIssues = [
            ...scannabilityReport.messages,
            ...(typographyReport.hasCritical ? typographyReport.messages : [])
        ];

        if (scannabilityReport.hasCritical || typographyReport.hasCritical) {
            const warningMsg = `⚠️ OPTICAL SCANNABILITY GATEKEEPER WARNING\n\n` +
                `This ID card design contains critical issues (scannability or text clipping/overflow):\n\n` +
                allCriticalIssues.map(m => `• ${m}`).join('\n') +
                `\n\nDo you want to ignore this warning and proceed with export anyway?`;
            const proceed = confirm(warningMsg);
            if (!proceed) return { success: false, cancelled: true };
        }
    }

    // Determine scale factor for html2canvas
    const baseW = layout ? (layout.width || 500) : 500;
    const baseH = layout ? (layout.height || 320) : 320;
    let targetScale = 2.022; // default 300 DPI for 500px CR80
    if (dpi === '300dpi') {
        targetScale = baseW >= baseH ? (1011 / baseW) : (638 / baseW);
    } else if (dpi === '600dpi') {
        targetScale = 4.0;
    } else if (dpi === '2x') {
        targetScale = 2.0;
    } else if (dpi === '1x') {
        targetScale = 1.0;
    }

    const prevSelected = UICE_STATE.selectedId;
    const prevProof = UICE_STATE.showPrintProofing;
    UICE_STATE.selectedId = null;
    if (simulateProof) {
        artboard.classList.add('uice-soft-proofing');
    }
    renderUiceStage();

    try {
        if (typeof html2canvas === 'undefined') {
            throw new Error('html2canvas library is not loaded');
        }

        const canvas = await html2canvas(artboard, {
            scale: Math.max(1, targetScale * 1.5),
            useCORS: true,
            allowTaint: false,
            backgroundColor: null,
            logging: false,
            letterRendering: true
        });

        // Compute final output canvas with exact dimensions
        let finalCanvas = canvas;
        if (dpi === '300dpi') {
            const targetW = baseW >= baseH ? 1011 : 638;
            const targetH = baseW >= baseH ? 638 : 1011;
            const bleedPad = includeBleed ? 35 : 0; // 3mm at 300 DPI = ~35px

            const resampledCanvas = document.createElement('canvas');
            resampledCanvas.width = targetW + (bleedPad * 2);
            resampledCanvas.height = targetH + (bleedPad * 2);
            const ctx = resampledCanvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            // Fill background color if bleed included
            if (includeBleed) {
                const bg = (layout && layout.background && layout.background.color) ? layout.background.color : '#ffffff';
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, resampledCanvas.width, resampledCanvas.height);
            }

            ctx.drawImage(canvas, bleedPad, bleedPad, targetW, targetH);

            // If bleed included, draw cut tick marks on canvas perimeter
            if (includeBleed) {
                ctx.strokeStyle = '#000000';
                ctx.lineWidth = 1;
                ctx.beginPath();
                // TL marks
                ctx.moveTo(bleedPad, 0); ctx.lineTo(bleedPad, bleedPad / 2);
                ctx.moveTo(0, bleedPad); ctx.lineTo(bleedPad / 2, bleedPad);
                // TR marks
                ctx.moveTo(targetW + bleedPad, 0); ctx.lineTo(targetW + bleedPad, bleedPad / 2);
                ctx.moveTo(resampledCanvas.width, bleedPad); ctx.lineTo(resampledCanvas.width - bleedPad / 2, bleedPad);
                // BL marks
                ctx.moveTo(bleedPad, resampledCanvas.height); ctx.lineTo(bleedPad, resampledCanvas.height - bleedPad / 2);
                ctx.moveTo(0, targetH + bleedPad); ctx.lineTo(bleedPad / 2, targetH + bleedPad);
                // BR marks
                ctx.moveTo(targetW + bleedPad, resampledCanvas.height); ctx.lineTo(targetW + bleedPad, resampledCanvas.height - bleedPad / 2);
                ctx.moveTo(resampledCanvas.width, targetH + bleedPad); ctx.lineTo(resampledCanvas.width - bleedPad / 2, targetH + bleedPad);
                ctx.stroke();
            }

            finalCanvas = resampledCanvas;
        }

        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        const ext = format === 'jpeg' ? 'jpg' : 'png';
        const empId = emp ? (emp.id || emp.employeeId || 'GUARD') : 'GUARD';
        const tplName = (UICE_STATE.template ? UICE_STATE.template.name : 'Card').replace(/\s+/g, '_');
        const filename = `VSA_Card_${empId}_${side.toUpperCase()}_${dpi}_${tplName}.${ext}`;

        const link = document.createElement('a');
        link.download = filename;
        link.href = finalCanvas.toDataURL(mime, 0.95);
        link.click();

        return { success: true, filename, width: finalCanvas.width, height: finalCanvas.height };
    } catch (err) {
        console.error('High-DPI Export failed:', err);
        alert('Card export failed: ' + err.message);
        return { success: false, error: err.message };
    } finally {
        UICE_STATE.selectedId = prevSelected;
        if (!prevProof) {
            artboard.classList.remove('uice-soft-proofing');
        }
        renderUiceStage();
    }
}

/**
 * Backward compatibility alias for single card PNG export.
 */
async function exportUiceCardPng() {
    return await exportUiceCardWithResolution({ dpi: '300dpi', format: 'png' });
}

/**
 * Calculates grid slot positions for multi-up card sheet printing with duplex long-edge mirroring.
 * On duplex flip along the long edge, horizontal columns mirror:
 * Column `c` becomes `(cols - 1 - c)`.
 */
function calculateDuplexGridPositions(cards, cols, rows, isBackPage = false) {
    if (!Array.isArray(cards) || cols <= 0 || rows <= 0) return [];
    const slots = [];
    const pageSize = cols * rows;
    const numPages = Math.ceil(cards.length / pageSize) || 1;

    for (let p = 0; p < numPages; p++) {
        const pageCards = cards.slice(p * pageSize, (p + 1) * pageSize);
        const pageSlots = new Array(pageSize).fill(null);

        pageCards.forEach((card, idx) => {
            const row = Math.floor(idx / cols);
            const col = idx % cols;
            const targetCol = isBackPage ? ((cols - 1) - col) : col;
            const targetIndex = row * cols + targetCol;
            pageSlots[targetIndex] = card;
        });

        slots.push(pageSlots);
    }
    return slots;
}

/**
 * Generates SVG HTML for physical cutting crop marks.
 */
function getCropMarksSvgHtml() {
    return `
        <div class="uice-crop-mark uice-crop-tl"></div>
        <div class="uice-crop-mark uice-crop-tr"></div>
        <div class="uice-crop-mark uice-crop-bl"></div>
        <div class="uice-crop-mark uice-crop-br"></div>
    `;
}

/**
 * Generates SVG HTML for alignment registration crosshairs (⊕).
 */
function getRegistrationCrosshairsSvgHtml() {
    const crosshairSvg = `<svg viewBox="-12 -12 24 24" style="width: 100%; height: 100%;">
        <circle cx="0" cy="0" r="8" fill="none" stroke="#000000" stroke-width="0.8"/>
        <line x1="-12" y1="0" x2="12" y2="0" stroke="#000000" stroke-width="0.8"/>
        <line x1="0" y1="-12" x2="0" y2="12" stroke="#000000" stroke-width="0.8"/>
    </svg>`;
    return `
        <div class="uice-reg-mark uice-reg-top">${crosshairSvg}</div>
        <div class="uice-reg-mark uice-reg-bottom">${crosshairSvg}</div>
        <div class="uice-reg-mark uice-reg-left">${crosshairSvg}</div>
        <div class="uice-reg-mark uice-reg-right">${crosshairSvg}</div>
    `;
}

/**
 * Opens A4 Multi-Up Print Sheet Modal.
 */
function openUiceSheetModal() {
    const modal = document.getElementById('uice-sheet-modal');
    if (modal) {
        modal.classList.remove('hidden');
        if (window.lucide) window.lucide.createIcons();
    }
}

/**
 * Closes A4 Multi-Up Print Sheet Modal.
 */
function closeUiceSheetModal() {
    const modal = document.getElementById('uice-sheet-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Handles submission of A4 Print Sheet Modal form.
 */
function handleUiceSheetSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const layout = document.getElementById('uice-sheet-layout')?.value || '8up';
    const duplex = document.getElementById('uice-sheet-duplex')?.value || 'duplex-mirrored';
    const source = document.getElementById('uice-sheet-source')?.value || 'preview';
    const cropMarks = !!document.getElementById('uice-sheet-crop-marks')?.checked;
    const crosshairs = !!document.getElementById('uice-sheet-crosshairs')?.checked;
    const holePunch = !!document.getElementById('uice-sheet-hole-punch')?.checked;

    closeUiceSheetModal();
    printUiceSheet({
        layoutType: layout,
        duplexMode: duplex,
        source,
        cropMarks,
        crosshairs,
        holePunch
    });
}

/**
 * Generates printable A4 multi-up card sheet HTML and launches browser print preview.
 */
function printUiceSheet(options = {}) {
    const {
        layoutType = '8up',
        duplexMode = 'duplex-mirrored',
        source = 'preview',
        cropMarks = true,
        crosshairs = true,
        holePunch = false,
        candidates = null
    } = options;

    const sheetContainer = document.getElementById('printable-uice-sheet');
    if (!sheetContainer) {
        alert("Printable container (#printable-uice-sheet) not found.");
        return;
    }

    // Resolve target guard candidates
    let guards = [];
    if (candidates && candidates.length > 0) {
        guards = candidates;
    } else if (source === 'project') {
        guards = VSA_STATE.activeProjectCandidates || [];
        if (guards.length === 0 && VSA_STATE.deploymentProjects) {
            const activeProj = VSA_STATE.deploymentProjects.find(p => p.id === VSA_STATE.activeDeploymentProjectId);
            if (activeProj) {
                guards = (VSA_STATE.employees || []).filter(e => e.projectSlug === activeProj.slug || e.projectId === activeProj.id);
            }
        }
    } else if (source === 'all-approved') {
        guards = (VSA_STATE.employees || []).filter(e => e.status === 'Active' || e.status === 'Approved');
    }

    // Fallback: fill full sheet with current preview employee or mock guard
    if (guards.length === 0) {
        const previewGuard = UICE_STATE.previewEmp || (typeof VSA_STATE !== 'undefined' && VSA_STATE.employees && VSA_STATE.employees[0]) || { id: 'VSA-0042', name: 'Rajesh Kumar' };
        const capacity = layoutType === '10up' ? 10 : (layoutType === '9up' ? 9 : (layoutType === '4up' ? 4 : (layoutType === '1up' ? 1 : 8)));
        guards = Array.from({ length: capacity }, () => ({ ...previewGuard }));
    }

    const tpl = UICE_STATE.template || { font: "'Plus Jakarta Sans', sans-serif" };
    const orientation = (layoutType === '9up') ? 'vertical' : (layoutType === '1up' && UICE_STATE.orientation === 'vertical' ? 'vertical' : 'horizontal');
    const cardLayout = (tpl.layouts && tpl.layouts[orientation]) || (tpl.layouts && (tpl.layouts.horizontal || tpl.layouts.vertical)) || { width: 500, height: 320, elements: [] };

    const gridClass = `uice-sheet-grid-${layoutType}`;
    let cols = 2, rows = 4;
    if (layoutType === '10up') { cols = 2; rows = 5; }
    else if (layoutType === '9up') { cols = 3; rows = 3; }
    else if (layoutType === '4up') { cols = 2; rows = 2; }
    else if (layoutType === '1up') { cols = 1; rows = 1; }

    let sheetHtml = '';

    // Generate Front Pages
    if (duplexMode === 'front-only' || duplexMode === 'duplex-mirrored') {
        const frontPages = calculateDuplexGridPositions(guards, cols, rows, false);
        frontPages.forEach((pageSlots, pageIdx) => {
            sheetHtml += `<div class="uice-print-sheet-page">`;
            if (crosshairs) sheetHtml += getRegistrationCrosshairsSvgHtml();
            sheetHtml += `<div class="${gridClass}">`;

            pageSlots.forEach(guard => {
                if (!guard) {
                    sheetHtml += `<div class="uice-sheet-card-cell"></div>`;
                } else {
                    const cardHtml = generateUiceCardHtml(guard, cardLayout, tpl);
                    sheetHtml += `
                        <div class="uice-sheet-card-cell">
                            ${cropMarks ? getCropMarksSvgHtml() : ''}
                            ${holePunch ? '<div class="uice-hole-punch-guide"></div>' : ''}
                            ${cardHtml}
                        </div>
                    `;
                }
            });

            sheetHtml += `</div></div>`;

            // If duplex-mirrored, generate corresponding Back Page with geometrically mirrored columns
            if (duplexMode === 'duplex-mirrored') {
                const backPageCards = guards.slice(pageIdx * (cols * rows), (pageIdx + 1) * (cols * rows));
                const backPageSlots = calculateDuplexGridPositions(backPageCards, cols, rows, true)[0] || [];
                sheetHtml += `<div class="uice-print-sheet-page">`;
                if (crosshairs) sheetHtml += getRegistrationCrosshairsSvgHtml();
                sheetHtml += `<div class="${gridClass}">`;

                backPageSlots.forEach(guard => {
                    if (!guard) {
                        sheetHtml += `<div class="uice-sheet-card-cell"></div>`;
                    } else {
                        const backCardHtml = generateUiceCardHtml(guard, cardLayout, tpl, 3, null, 'back');
                        sheetHtml += `
                            <div class="uice-sheet-card-cell">
                                ${cropMarks ? getCropMarksSvgHtml() : ''}
                                ${holePunch ? '<div class="uice-hole-punch-guide"></div>' : ''}
                                ${backCardHtml}
                            </div>
                        `;
                    }
                });

                sheetHtml += `</div></div>`;
            }
        });
    } else if (duplexMode === 'back-only') {
        const backPages = calculateDuplexGridPositions(guards, cols, rows, true);
        backPages.forEach(pageSlots => {
            sheetHtml += `<div class="uice-print-sheet-page">`;
            if (crosshairs) sheetHtml += getRegistrationCrosshairsSvgHtml();
            sheetHtml += `<div class="${gridClass}">`;

            pageSlots.forEach(guard => {
                if (!guard) {
                    sheetHtml += `<div class="uice-sheet-card-cell"></div>`;
                } else {
                    const cardHtml = generateUiceCardHtml(guard, cardLayout, tpl, 3, null, 'back');
                    sheetHtml += `
                        <div class="uice-sheet-card-cell">
                            ${cropMarks ? getCropMarksSvgHtml() : ''}
                            ${holePunch ? '<div class="uice-hole-punch-guide"></div>' : ''}
                            ${cardHtml}
                        </div>
                    `;
                }
            });

            sheetHtml += `</div></div>`;
        });
    }

    sheetContainer.innerHTML = sheetHtml;

    // Render QR codes if present in DOM
    if (typeof renderQrsInContainer === 'function') {
        renderQrsInContainer(sheetContainer);
    }

    // Activate print mode
    sheetContainer.classList.remove('hidden');
    document.body.classList.add('uice-sheet-print-active');

    // Launch print dialog after brief rendering delay
    setTimeout(() => {
        window.print();
        window.addEventListener('afterprint', () => {
            document.body.classList.remove('uice-sheet-print-active');
            sheetContainer.classList.add('hidden');
        }, { once: true });
    }, 400);

    return { totalGuards: guards.length, layoutType, duplexMode };
}

/**
 * Opens Industrial Batch Export Modal.
 */
function openUiceBatchModal() {
    const modal = document.getElementById('uice-batch-modal');
    if (modal) {
        modal.classList.remove('hidden');
        refreshUiceBatchPreflight();
        if (window.lucide) window.lucide.createIcons();
    }
}

/**
 * Closes Industrial Batch Export Modal.
 */
function closeUiceBatchModal() {
    const modal = document.getElementById('uice-batch-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * Executes optical scannability and typography pre-flight checks across an entire employee roster.
 */
function runUicePreFlightValidation(layout, employees = []) {
    const results = {
        total: employees.length,
        passed: [],
        warnings: [],
        critical: [],
        summary: {
            total: employees.length,
            passCount: 0,
            warnCount: 0,
            critCount: 0
        }
    };

    if (!layout) return results;

    employees.forEach(emp => {
        const scannability = (typeof checkLayoutScannability === 'function')
            ? checkLayoutScannability(layout, emp)
            : { hasCritical: false, messages: [] };

        const typography = (typeof checkLayoutTypography === 'function')
            ? checkLayoutTypography(layout, emp)
            : { hasCritical: false, messages: [] };

        const hasCrit = scannability.hasCritical || typography.hasCritical;
        const allMessages = [
            ...scannability.messages,
            ...typography.messages
        ];

        if (hasCrit) {
            results.critical.push({
                emp,
                messages: allMessages
            });
        } else if (allMessages.length > 0) {
            results.warnings.push({
                emp,
                messages: allMessages
            });
        } else {
            results.passed.push(emp);
        }
    });

    results.summary.passCount = results.passed.length;
    results.summary.warnCount = results.warnings.length;
    results.summary.critCount = results.critical.length;

    return results;
}

/**
 * Refreshes pre-flight report in batch modal.
 */
function refreshUiceBatchPreflight() {
    const targetSel = document.getElementById('uice-batch-target')?.value || 'project';
    let targetGuards = [];

    if (targetSel === 'project') {
        targetGuards = VSA_STATE.activeProjectCandidates || [];
        if (targetGuards.length === 0 && VSA_STATE.deploymentProjects) {
            const activeProj = VSA_STATE.deploymentProjects.find(p => p.id === VSA_STATE.activeDeploymentProjectId);
            if (activeProj) {
                targetGuards = (VSA_STATE.employees || []).filter(e => e.projectSlug === activeProj.slug || e.projectId === activeProj.id);
            }
        }
    } else if (targetSel === 'selected') {
        const ids = VSA_STATE.idSelectedEmployeeIds || VSA_STATE.selectedEmployeeIds || [];
        targetGuards = (VSA_STATE.employees || []).filter(e => ids.includes(e.id || e.employeeId));
    } else {
        targetGuards = (VSA_STATE.employees || []).filter(e => e.status === 'Active' || e.status === 'Approved');
    }

    if (targetGuards.length === 0) {
        targetGuards = (VSA_STATE.employees || []).slice(0, 10);
    }

    const layout = UICE_STATE.template && UICE_STATE.template.layouts
        ? UICE_STATE.template.layouts[UICE_STATE.orientation]
        : null;

    const report = runUicePreFlightValidation(layout, targetGuards);

    const summaryEl = document.getElementById('uice-batch-preflight-summary');
    if (summaryEl) {
        summaryEl.innerHTML = `
            <div class="uice-preflight-stat-box stat-passed">
                <div class="stat-val" style="color: #10b981;">${report.summary.passCount}</div>
                <div class="stat-lbl">100% Validated</div>
            </div>
            <div class="uice-preflight-stat-box stat-warn">
                <div class="stat-val" style="color: #f59e0b;">${report.summary.warnCount}</div>
                <div class="stat-lbl">Typography Warnings</div>
            </div>
            <div class="uice-preflight-stat-box stat-crit">
                <div class="stat-val" style="color: #ef4444;">${report.summary.critCount}</div>
                <div class="stat-lbl">Optical Failures</div>
            </div>
        `;
    }

    const issuesEl = document.getElementById('uice-batch-issues-list');
    if (issuesEl) {
        if (report.critical.length === 0 && report.warnings.length === 0) {
            issuesEl.innerHTML = `<span style="color: #10b981;">✅ Pre-flight quality verification passed! All ${report.total} guard cards conform to ISO/IEC CR80 optical scannability and typography safety boundaries.</span>`;
        } else {
            let listHtml = '';
            report.critical.forEach(item => {
                listHtml += `<div style="color: #ef4444; margin-bottom: 4px;">❌ [CRITICAL] ${item.emp.name || item.emp.id}: ${item.messages.join('; ')}</div>`;
            });
            report.warnings.forEach(item => {
                listHtml += `<div style="color: #f59e0b; margin-bottom: 4px;">⚠️ [WARNING] ${item.emp.name || item.emp.id}: ${item.messages.join('; ')}</div>`;
            });
            issuesEl.innerHTML = listHtml;
        }
    }

    return report;
}

/**
 * Handles batch generation submission.
 */
async function handleUiceBatchSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const target = document.getElementById('uice-batch-target')?.value || 'project';
    const format = document.getElementById('uice-batch-format')?.value || 'zip-300dpi';

    return await startUiceBatchExport({ target, format });
}

/**
 * Executes stream batch generation with non-blocking async yielding and ZIP compression.
 */
async function startUiceBatchExport(options = {}) {
    const { target = 'project', format = 'zip-300dpi' } = options;

    let targetGuards = [];
    if (target === 'project') {
        targetGuards = VSA_STATE.activeProjectCandidates || [];
        if (targetGuards.length === 0 && VSA_STATE.deploymentProjects) {
            const activeProj = VSA_STATE.deploymentProjects.find(p => p.id === VSA_STATE.activeDeploymentProjectId);
            if (activeProj) {
                targetGuards = (VSA_STATE.employees || []).filter(e => e.projectSlug === activeProj.slug || e.projectId === activeProj.id);
            }
        }
    } else if (target === 'selected') {
        const ids = VSA_STATE.idSelectedEmployeeIds || VSA_STATE.selectedEmployeeIds || [];
        targetGuards = (VSA_STATE.employees || []).filter(e => ids.includes(e.id || e.employeeId));
    } else {
        targetGuards = (VSA_STATE.employees || []).filter(e => e.status === 'Active' || e.status === 'Approved');
    }

    if (targetGuards.length === 0) {
        targetGuards = (VSA_STATE.employees || []).slice(0, 10);
    }

    if (targetGuards.length === 0) {
        alert("No employee records found to batch export.");
        return { success: false, error: 'No guards found' };
    }

    // Format: A4 Sheet
    if (format === 'a4-sheet') {
        closeUiceBatchModal();
        return printUiceSheet({
            layoutType: '8up',
            duplexMode: 'duplex-mirrored',
            candidates: targetGuards
        });
    }

    // Progress bar setup
    const progressContainer = document.getElementById('uice-batch-progress-container');
    const progressBar = document.getElementById('uice-batch-progress-bar');
    const progressPercent = document.getElementById('uice-batch-progress-percent');
    const progressEmp = document.getElementById('uice-batch-current-emp');
    const startBtn = document.getElementById('btn-start-uice-batch');

    if (progressContainer) progressContainer.classList.remove('hidden');
    if (startBtn) startBtn.disabled = true;

    const zip = (typeof JSZip !== 'undefined') ? new JSZip() : null;
    const dpi = format === 'zip-300dpi' ? '300dpi' : '2x';
    const total = targetGuards.length;
    const layout = UICE_STATE.template && UICE_STATE.template.layouts
        ? UICE_STATE.template.layouts[UICE_STATE.orientation]
        : { width: 500, height: 320 };

    const baseW = layout.width || 500;
    const baseH = layout.height || 320;
    const isHoriz = baseW >= baseH;
    const targetScale = dpi === '300dpi' ? (isHoriz ? 1011 / baseW : 638 / baseW) : 2.0;

    // Temporary offscreen render container for memory-safe generation
    const offscreen = document.createElement('div');
    offscreen.style.position = 'fixed';
    offscreen.style.left = '-9999px';
    offscreen.style.top = '-9999px';
    offscreen.style.width = baseW + 'px';
    offscreen.style.height = baseH + 'px';
    document.body.appendChild(offscreen);

    try {
        for (let i = 0; i < total; i++) {
            const emp = targetGuards[i];
            const pct = Math.round(((i + 1) / total) * 100);

            if (progressBar) progressBar.style.width = pct + '%';
            if (progressPercent) progressPercent.textContent = pct + '%';
            if (progressEmp) progressEmp.textContent = `Rendering card ${i + 1} of ${total}: ${emp.name || emp.id}...`;

            // Render single card DOM
            offscreen.innerHTML = generateUiceCardHtml(emp, layout, UICE_STATE.template || {});
            const cardEl = offscreen.querySelector('.visual-id-card-render') || offscreen;

            // Render QRs in offscreen card
            if (typeof renderQrsInContainer === 'function') {
                renderQrsInContainer(offscreen);
            }

            // High-DPI canvas capture
            const canvas = await html2canvas(cardEl, {
                scale: Math.max(1, targetScale * 1.5),
                useCORS: true,
                allowTaint: false,
                backgroundColor: null,
                logging: false
            });

            // Standardize exact CR80 size if 300dpi
            let outCanvas = canvas;
            if (dpi === '300dpi') {
                const targetW = isHoriz ? 1011 : 638;
                const targetH = isHoriz ? 638 : 1011;
                const resampled = document.createElement('canvas');
                resampled.width = targetW;
                resampled.height = targetH;
                const ctx = resampled.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(canvas, 0, 0, targetW, targetH);
                outCanvas = resampled;
            }

            const dataUrl = outCanvas.toDataURL('image/png');
            const cleanEmpName = (emp.name || 'Guard').replace(/[^a-zA-Z0-9_-]/g, '_');
            const empId = emp.id || emp.employeeId || `VSA-${i + 1}`;
            const filename = `${empId}_${cleanEmpName}_CR80_${dpi}.png`;

            if (zip) {
                const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
                zip.file(filename, base64Data, { base64: true });
            } else {
                const link = document.createElement('a');
                link.download = filename;
                link.href = dataUrl;
                link.click();
            }

            // Non-blocking async yield to release browser thread & garbage collect canvas
            await new Promise(resolve => setTimeout(resolve, 25));
        }

        // Generate and download ZIP archive
        if (zip) {
            if (progressEmp) progressEmp.textContent = "Compressing ZIP archive package...";
            const zipBlob = await zip.generateAsync({ type: "blob" });
            const zipUrl = URL.createObjectURL(zipBlob);
            const downloadLink = document.createElement('a');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            downloadLink.download = `VSA_ID_Cards_Batch_${dpi}_${timestamp}.zip`;
            downloadLink.href = zipUrl;
            downloadLink.click();
            setTimeout(() => URL.revokeObjectURL(zipUrl), 10000);
        }

        if (progressEmp) progressEmp.textContent = `✅ Batch generation complete! ${total} cards exported successfully.`;
        alert(`Successfully generated batch package containing ${total} high-DPI ID cards!`);
        return { success: true, count: total };
    } catch (err) {
        console.error("Batch card generation error:", err);
        alert("Batch generation encountered an issue: " + err.message);
        return { success: false, error: err.message };
    } finally {
        if (offscreen && offscreen.parentNode) {
            offscreen.parentNode.removeChild(offscreen);
        }
        if (startBtn) startBtn.disabled = false;
    }
}

// Global Window Exports
if (typeof window !== 'undefined') {
    window.toggleUicePrintProofing = toggleUicePrintProofing;
    window.openUiceExportModal = openUiceExportModal;
    window.closeUiceExportModal = closeUiceExportModal;
    window.updateUiceExportPreviewInfo = updateUiceExportPreviewInfo;
    window.handleUiceExportSubmit = handleUiceExportSubmit;
    window.exportUiceCardWithResolution = exportUiceCardWithResolution;
    window.exportUiceCardPng = exportUiceCardPng;
    window.calculateDuplexGridPositions = calculateDuplexGridPositions;
    window.getCropMarksSvgHtml = getCropMarksSvgHtml;
    window.getRegistrationCrosshairsSvgHtml = getRegistrationCrosshairsSvgHtml;
    window.openUiceSheetModal = openUiceSheetModal;
    window.closeUiceSheetModal = closeUiceSheetModal;
    window.handleUiceSheetSubmit = handleUiceSheetSubmit;
    window.printUiceSheet = printUiceSheet;
    window.openUiceBatchModal = openUiceBatchModal;
    window.closeUiceBatchModal = closeUiceBatchModal;
    window.runUicePreFlightValidation = runUicePreFlightValidation;
    window.refreshUiceBatchPreflight = refreshUiceBatchPreflight;
    window.handleUiceBatchSubmit = handleUiceBatchSubmit;
    window.startUiceBatchExport = startUiceBatchExport;


/**
 * Populates UICE Studio guard selector with all authentic database guards.
 */
function populateUicePreviewEmpSelect() {
    const previewEmpSel = document.getElementById('uice-preview-emp-select');
    if (!previewEmpSel) return;
    const emps = VSA_STATE.employees || [];
    if (emps.length === 0) return;

    const currentId = (UICE_STATE.previewEmp && UICE_STATE.previewEmp.id) || emps[0].id;
    previewEmpSel.innerHTML = emps.map(e =>
        `<option value="${e.id}" ${e.id == currentId ? 'selected' : ''}>${e.name || e.fullName || 'Guard'} (${e.id})</option>`
    ).join('');

    if (!UICE_STATE.previewEmp || !emps.some(e => e.id == UICE_STATE.previewEmp.id)) {
        UICE_STATE.previewEmp = emps[0];
    }
}

/**
 * Toggles single-card preview stage surface: front, back, or duplex.
 */
function setSingleCardPreviewSurface(surface) {
    VSA_STATE.singleCardPreviewSurface = surface;
    const btnFront = document.getElementById('btn-single-preview-front');
    const btnBack = document.getElementById('btn-single-preview-back');
    const btnDuplex = document.getElementById('btn-single-preview-duplex');

    if (btnFront) {
        btnFront.className = surface === 'front' ? 'btn btn-primary' : 'btn btn-outline';
    }
    if (btnBack) {
        btnBack.className = surface === 'back' ? 'btn btn-primary' : 'btn btn-outline';
    }
    if (btnDuplex) {
        btnDuplex.className = surface === 'duplex' ? 'btn btn-primary' : 'btn btn-outline';
    }

    const selectedEmpId = document.getElementById('id-select-employee')?.value;
    if (selectedEmpId) {
        loadIdCardDetails(selectedEmpId);
    }
}

function setupSingleCardSurfaceToggle() {
    const btnFront = document.getElementById('btn-single-preview-front');
    const btnBack = document.getElementById('btn-single-preview-back');
    const btnDuplex = document.getElementById('btn-single-preview-duplex');

    if (btnFront && !btnFront._bound) {
        btnFront._bound = true;
        btnFront.addEventListener('click', () => setSingleCardPreviewSurface('front'));
    }
    if (btnBack && !btnBack._bound) {
        btnBack._bound = true;
        btnBack.addEventListener('click', () => setSingleCardPreviewSurface('back'));
    }
    if (btnDuplex && !btnDuplex._bound) {
        btnDuplex._bound = true;
        btnDuplex.addEventListener('click', () => setSingleCardPreviewSurface('duplex'));
    }
}

    // Phase 9 Security Overlays & Token Binding Exports
    window.resolveUiceTokens = resolveUiceTokens;
    window.generateGuillocheSvg = generateGuillocheSvg;
    window.generateHologramFoilHtml = generateHologramFoilHtml;
    window.generateMicrotextLineHtml = generateMicrotextLineHtml;
    window.generateSecurityWatermarkHtml = generateSecurityWatermarkHtml;
    window.populateUicePreviewEmpSelect = populateUicePreviewEmpSelect;
    window.setSingleCardPreviewSurface = setSingleCardPreviewSurface;
    window.setupSingleCardSurfaceToggle = setupSingleCardSurfaceToggle;

    // Phase 8 Dual-Sided Engine & Archetype Presets Exports
    window.setUiceSurface = setUiceSurface;
    window.flipUiceCard = flipUiceCard;
    window.getUiceDefaultBackElements = getUiceDefaultBackElements;
    window.getUiceActiveElements = getUiceActiveElements;
    window.UICE_ARCHETYPES = UICE_ARCHETYPES;
    window.openUiceArchetypesModal = openUiceArchetypesModal;
    window.closeUiceArchetypesModal = closeUiceArchetypesModal;
    window.loadUiceArchetype = loadUiceArchetype;
    window.exportUiceTemplateJson = exportUiceTemplateJson;
    window.importUiceTemplateJson = importUiceTemplateJson;
    window.cloneUiceTemplate = cloneUiceTemplate;
}

/**
 * Saves the UICE template layout to the Neon PostgreSQL database.
 */
async function saveUiceTemplate() {
    if (!UICE_STATE.template) return;

    const tpl = UICE_STATE.template;
    if (!tpl.name) {
        const enteredName = prompt('Enter a name for this template layout:', 'Custom ID Badge');
        if (!enteredName || !enteredName.trim()) return;
        tpl.name = enteredName.trim();
    }

    if (!tpl.id) {
        tpl.id = 'tpl-' + Date.now();
    }

    if (typeof syncVisualPropertiesToRoot === 'function') {
        syncVisualPropertiesToRoot(tpl);
    }

    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tpl)
        });

        if (!response.ok) throw new Error('API save error');
        const savedTpl = await response.json();

        // Update state list
        const idx = (VSA_STATE.templates || []).findIndex(t => t.id === savedTpl.id);
        if (idx !== -1) {
            VSA_STATE.templates[idx] = savedTpl;
        } else {
            VSA_STATE.templates.push(savedTpl);
        }

        renderTemplatesList();
        populateSelectors();
        initUiceWithTemplate(savedTpl);
        if (typeof loadTemplateInStudio === 'function') {
            loadTemplateInStudio(savedTpl.id);
        }

        alert(`Template "${savedTpl.name}" saved successfully with dual-orientation layout nodes!`);
    } catch (err) {
        console.error('Save template failed:', err);
        alert('Failed to save template: ' + err.message);
    }
}

/**
 * Generates card HTML from modern UICE layout nodes for batch printing and modals.
 */
function generateUiceCardHtml(emp, layout, template, validityYears = 3, issueDate = null, side = 'front') {
    if (!emp || !layout) return '';

    if (side === 'duplex') {
        const frontHtml = generateUiceCardHtml(emp, layout, template, validityYears, issueDate, 'front');
        const backHtml = generateUiceCardHtml(emp, layout, template, validityYears, issueDate, 'back');
        return `
            <div class="visual-id-card-render-wrapper uice-duplex-wrapper" style="display: flex; gap: 24px; flex-wrap: wrap; justify-content: center; align-items: flex-start; width: 100%;">
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span class="badge badge-secondary" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">Front Face</span>
                    ${frontHtml}
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
                    <span class="badge badge-secondary" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">Reverse Face</span>
                    ${backHtml}
                </div>
            </div>`;
    }

    const width = layout.width || 500;
    const height = layout.height || 320;
    const isHoriz = width >= height;
    const bg = layout.background || {};
    const borderRadius = bg.borderRadius !== undefined ? bg.borderRadius : 14;

    const activeList = (side === 'back')
        ? (Array.isArray(layout.backElements) && layout.backElements.length > 0
            ? layout.backElements
            : getUiceDefaultBackElements(isHoriz ? 'horizontal' : 'vertical', template))
        : (layout.elements || []);

    const elementsHtml = activeList.filter(el => el.visible !== false).map(el => {
        const innerContent = renderUiceElementHtml(el, emp, validityYears, issueDate, template);
        return `
            <div style="position: absolute; left: ${el.x}px; top: ${el.y}px; width: ${el.width}px; height: ${el.height}px; transform: rotate(${el.rotation || 0}deg); z-index: ${el.zIndex || 1}; box-sizing: border-box; overflow: hidden;">
                ${innerContent}
            </div>`;
    }).join('');

    return `
        <div class="visual-id-card-render-wrapper" style="display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; align-items: center; width: 100%;">
            <div class="visual-id-card-render ${isHoriz ? 'id-card-horizontal' : 'id-card-vertical'}" style="position: relative; width: ${width}px; height: ${height}px; border-radius: ${borderRadius}px; overflow: hidden; background: ${bg.color || '#ffffff'}; border: ${bg.borderWidth || 2}px solid ${bg.accent || '#009688'}; box-shadow: 0 4px 15px rgba(0,0,0,0.15); box-sizing: border-box; font-family: ${(template && template.font) || "'Plus Jakarta Sans', sans-serif"};">
                <div style="position: absolute; inset: 0; pointer-events: none; z-index: 0; background: ${bg.color || '#ffffff'};"></div>
                <div style="position: absolute; inset: 0; z-index: 1;">
                    ${elementsHtml}
                </div>
            </div>
        </div>`;
}

function loadTemplateInStudio(id) {
    const tplSource = VSA_STATE.templates.find(t => t.id === id) || VSA_STATE.templates[0];
    if (!tplSource) return;

    // Deep clone template to avoid direct mutation of state list
    const tpl = JSON.parse(JSON.stringify(tplSource));
    if (typeof syncVisualPropertiesToRoot === 'function') {
        syncVisualPropertiesToRoot(tpl);
    }

    document.getElementById('tpl-id').value = tpl.id || '';
    document.getElementById('tpl-name').value = tpl.name || '';
    if (document.getElementById('tpl-card-title')) {
        document.getElementById('tpl-card-title').value = tpl.cardTitle || 'SECURITY ID CARD';
    }
    document.getElementById('tpl-layout').value = tpl.layout || 'vertical';
    document.getElementById('tpl-font').value = tpl.font || "'Plus Jakarta Sans', sans-serif";
    if (document.getElementById('tpl-card-theme')) {
        document.getElementById('tpl-card-theme').value = tpl.cardTheme || 'classic';
    }
    if (document.getElementById('tpl-photo-shape')) {
        document.getElementById('tpl-photo-shape').value = tpl.photoShape || 'standard';
    }
    if (document.getElementById('tpl-name-style')) {
        document.getElementById('tpl-name-style').value = tpl.nameStyle || 'clean';
    }
    if (document.getElementById('tpl-barcode-pos')) {
        document.getElementById('tpl-barcode-pos').value = tpl.barcodePosition || 'bottom-right';
    }
    document.getElementById('tpl-bg-color').value = colorToHex(tpl.backgroundColor || '#ffffff');
    document.getElementById('tpl-header-bg').value = colorToHex(tpl.headerBgColor || '#0e3e2b');
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

    const photoTopOffsetVal = tpl.photoTopOffset !== undefined ? tpl.photoTopOffset : 10;
    if (document.getElementById('tpl-photo-top-offset')) {
        document.getElementById('tpl-photo-top-offset').value = photoTopOffsetVal;
        if (document.getElementById('lbl-photo-top-offset')) {
            document.getElementById('lbl-photo-top-offset').textContent = photoTopOffsetVal;
        }
    }

    const qrSizeVal = tpl.qrSize || 70;
    document.getElementById('tpl-qr-size').value = qrSizeVal;
    document.getElementById('lbl-qr-size').textContent = qrSizeVal;

    const detailsFontSizeVal = tpl.detailsFontSize || 8;
    document.getElementById('tpl-details-font-size').value = detailsFontSizeVal;
    document.getElementById('lbl-details-font-size').textContent = detailsFontSizeVal;

    // New controls: label color, value color, row padding, label width
    document.getElementById('tpl-label-color').value = colorToHex(tpl.labelColor || '#555555');
    document.getElementById('tpl-value-color').value = colorToHex(tpl.valueColor || '#111111');
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

    // Sync template selector dropdowns on both Classic and Advance visual sides
    const tplEditSel = document.getElementById('tpl-edit-select');
    if (tplEditSel) {
        tplEditSel.value = tpl.id || '';
    }
    const topTplSel = document.getElementById('uice-top-tpl-select');
    if (topTplSel) {
        topTplSel.value = tpl.id || '';
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

    // Also initialize the Universal Intelligent Canvas Engine (UICE)
    if (typeof initUiceWithTemplate === 'function') {
        initUiceWithTemplate(tplSource);
    }
}

function getActiveTemplateFromForm() {
    const id = document.getElementById('tpl-id').value;
    const name = document.getElementById('tpl-name').value.trim() || 'Standard Guard Card';
    const cardTitle = document.getElementById('tpl-card-title') ? document.getElementById('tpl-card-title').value.trim() : 'SECURITY ID CARD';
    const layout = document.getElementById('tpl-layout').value;
    const cardTheme = document.getElementById('tpl-card-theme') ? document.getElementById('tpl-card-theme').value : 'classic';
    const photoShape = document.getElementById('tpl-photo-shape') ? document.getElementById('tpl-photo-shape').value : 'standard';
    const nameStyle = document.getElementById('tpl-name-style') ? document.getElementById('tpl-name-style').value : 'clean';
    const barcodePosition = document.getElementById('tpl-barcode-pos') ? document.getElementById('tpl-barcode-pos').value : 'bottom-right';
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
    const photoTopOffset = document.getElementById('tpl-photo-top-offset') ? parseInt(document.getElementById('tpl-photo-top-offset').value) : 10;
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

    const activeTplObj = {
        id,
        name,
        cardTitle,
        layout,
        cardTheme,
        photoShape,
        nameStyle,
        barcodePosition,
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
        photoTopOffset,
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

    // Preserve existing visual layouts and sync current form updates into them
    const existing = (VSA_STATE.templates || []).find(t => t.id === id);
    if (existing && existing.layouts) {
        activeTplObj.layouts = JSON.parse(JSON.stringify(existing.layouts));
        const orient = activeTplObj.layout || 'horizontal';
        const curLayout = activeTplObj.layouts[orient];
        if (curLayout && Array.isArray(curLayout.elements)) {
            curLayout.elements.forEach(el => {
                if (el.type === 'badge-pill' && el.properties) {
                    el.properties.text = cardTitle;
                }
                if (el.type === 'agency-brand' && el.properties) {
                    el.properties.title = headerText;
                    el.properties.subtitle = subheaderText;
                }
                if (el.type === 'svg-wave-top' && el.properties) {
                    el.properties.headerBgColor = headerBgColor;
                    el.properties.accentColor = accentColor;
                }
                if (el.type === 'employee-photo' && el.properties) {
                    el.properties.shape = photoShape;
                    el.properties.outlineColor = accentColor;
                }
                if (el.type === 'details-table' && el.properties) {
                    el.properties.valueColor = valueColor;
                    el.properties.labelColor = labelColor;
                    el.properties.fontSize = detailsFontSize;
                    el.properties.rowPadding = rowPadding;
                    el.properties.labelWidth = labelWidth;
                    el.properties.labelValueSpacing = labelValueSpacing;
                }
            });
            if (curLayout.background) {
                curLayout.background.accent = accentColor;
                curLayout.background.headerBg = headerBgColor;
                curLayout.background.color = backgroundColor;
            }
        }
    }

    return activeTplObj;
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
    requestAnimationFrame(() => {
        adjustCardTextSizes(container);
    });
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

/**
 * Prompts user for a template name, creates a new template, and immediately persists it to both Classic and Advance visual designers.
 */
async function promptAndCreateNewTemplate(mode = 'classic') {
    const defaultName = mode === 'visual' ? 'New Visual Card' : 'New ID Template';
    const enteredName = prompt('What would you like to name your new template?', defaultName);
    if (!enteredName || !enteredName.trim()) {
        return; // User cancelled
    }
    const cleanName = enteredName.trim();

    // Check if name already exists
    const existing = (VSA_STATE.templates || []).find(t => t.name && t.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) {
        if (confirm(`A template named "${cleanName}" already exists. Would you like to open it to edit?`)) {
            loadTemplateInStudio(existing.id);
            return;
        }
    }

    resetTemplateForm();
    const newTpl = getActiveTemplateFromForm();
    newTpl.id = 'tpl-' + Date.now();
    newTpl.name = cleanName;
    newTpl.isVisualTemplate = true;

    // Build dual-orientation layouts for UICE
    if (typeof convertLegacyTemplateToUice === 'function') {
        convertLegacyTemplateToUice(newTpl);
    }

    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTpl)
        });
        if (!response.ok) throw new Error('API save error');
        const savedTpl = await response.json();

        if (!VSA_STATE.templates) VSA_STATE.templates = [];
        const idx = VSA_STATE.templates.findIndex(t => t.id === savedTpl.id);
        if (idx !== -1) {
            VSA_STATE.templates[idx] = savedTpl;
        } else {
            VSA_STATE.templates.push(savedTpl);
        }

        renderTemplatesList();
        populateSelectors();
        loadTemplateInStudio(savedTpl.id);

        alert(`Template "${savedTpl.name}" created and saved! It is now available in both Classic and Advance ID Card makers.`);
    } catch (err) {
        console.error('Failed to create new template:', err);
        alert('Failed to save new template: ' + err.message);
    }
}

function resetTemplateForm() {
    document.getElementById('tpl-id').value = '';
    document.getElementById('tpl-name').value = '';
    if (document.getElementById('tpl-card-title')) document.getElementById('tpl-card-title').value = 'SECURITY ID CARD';
    document.getElementById('tpl-layout').value = 'vertical';
    document.getElementById('tpl-font').value = "'Plus Jakarta Sans', sans-serif";
    if (document.getElementById('tpl-card-theme')) document.getElementById('tpl-card-theme').value = 'classic';
    if (document.getElementById('tpl-photo-shape')) document.getElementById('tpl-photo-shape').value = 'standard';
    if (document.getElementById('tpl-name-style')) document.getElementById('tpl-name-style').value = 'clean';
    if (document.getElementById('tpl-barcode-pos')) document.getElementById('tpl-barcode-pos').value = 'bottom-right';
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

    if (document.getElementById('tpl-photo-top-offset')) {
        document.getElementById('tpl-photo-top-offset').value = 10;
        if (document.getElementById('lbl-photo-top-offset')) {
            document.getElementById('lbl-photo-top-offset').textContent = 10;
        }
    }

    document.getElementById('tpl-qr-size').value = 70;
    document.getElementById('lbl-qr-size').textContent = 70;

    document.getElementById('tpl-details-font-size').value = 8;
    document.getElementById('lbl-details-font-size').textContent = 8;

    document.getElementById('tpl-name-font-size').value = 14;
    document.getElementById('lbl-name-font-size').textContent = 14;

    document.getElementById('tpl-designation-font-size').value = 10;
    document.getElementById('lbl-designation-font-size').textContent = 10;

    if (document.getElementById('tpl-row-padding')) {
        document.getElementById('tpl-row-padding').value = 3;
        if (document.getElementById('lbl-row-padding')) document.getElementById('lbl-row-padding').textContent = 3;
    }
    if (document.getElementById('tpl-label-width')) {
        document.getElementById('tpl-label-width').value = 45;
        if (document.getElementById('lbl-label-width')) document.getElementById('lbl-label-width').textContent = 45;
    }
    if (document.getElementById('tpl-label-value-spacing')) {
        document.getElementById('tpl-label-value-spacing').value = 10;
        if (document.getElementById('lbl-label-value-spacing')) document.getElementById('lbl-label-value-spacing').textContent = 10;
    }
    if (document.getElementById('tpl-label-color')) {
        document.getElementById('tpl-label-color').value = '#555555';
    }
    if (document.getElementById('tpl-value-color')) {
        document.getElementById('tpl-value-color').value = '#111111';
    }

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

// 1-Click Master Design Clones Configuration
const MASTER_CLONE_PRESETS = {
    'office': {
        name: 'office',
        cardTitle: 'ADMIN',
        layout: 'horizontal',
        cardTheme: 'organic-wave',
        photoShape: 'circle',
        nameStyle: 'clean',
        barcodePosition: 'bottom-center',
        font: "'Playfair Display', 'Georgia', serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#7a0c0c',
        accentColor: '#c8102e',
        labelColor: '#64748b',
        valueColor: '#c8102e',
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'SHAHIDGUNJ SRINAGAR 7889311608',
        logoSize: 42,
        headerHeight: 65,
        headerFontSize: 12,
        photoWidth: 115,
        photoHeight: 115,
        photoTopOffset: 12,
        qrSize: 62,
        detailsFontSize: 8.5,
        nameFontSize: 18,
        designationFontSize: 11,
        rowPadding: 2,
        labelWidth: 38,
        labelValueSpacing: 6,
        logo: 'preset-vsa-logo',
        signature: 'preset-vsa-sig',
        fields: {
            photo: true,
            name: true,
            designation: true,
            department: true,
            empid: true,
            father: true,
            phone: true,
            email: false,
            blood: true,
            address: true,
            signature: true,
            qrcode: true,
            barcode: true,
            validity: true
        },
        fieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone']
    },
    'hanover-wave': {
        name: 'Hanover Teal Wave (100% Replica)',
        cardTitle: 'SECURITY ID CARD',
        layout: 'horizontal',
        cardTheme: 'organic-wave',
        photoShape: 'circle',
        nameStyle: 'clean',
        barcodePosition: 'bottom-left',
        font: "'Playfair Display', 'Georgia', serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#0d7a6e',
        accentColor: '#009688',
        labelColor: '#475569',
        valueColor: '#0f172a',
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'SHAHIDGUNJ SRINAGAR',
        logoSize: 44,
        headerHeight: 68,
        headerFontSize: 13,
        photoWidth: 125,
        photoHeight: 125,
        photoTopOffset: 10,
        qrSize: 50,
        detailsFontSize: 9,
        nameFontSize: 18,
        designationFontSize: 10.5,
        rowPadding: 2.5,
        labelWidth: 92,
        labelValueSpacing: 6,
        logo: 'preset-vsa-logo',
        signature: 'preset-vsa-sig',
        fields: {
            photo: true,
            name: true,
            designation: true,
            department: true,
            empid: true,
            father: true,
            phone: true,
            email: false,
            blood: true,
            address: false,
            signature: true,
            qrcode: true,
            barcode: true,
            validity: true
        },
        fieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'phone']
    },
    'borcelle-tech': {
        name: 'Borcelle Tech Chevron (100% Replica)',
        cardTitle: 'SECURITY ID CARD',
        layout: 'vertical',
        cardTheme: 'geometric-tech',
        photoShape: 'circle',
        nameStyle: 'banner',
        barcodePosition: 'bottom-center',
        font: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#0c2340',
        accentColor: '#0b63e5',
        labelColor: '#334155',
        valueColor: '#0f172a',
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'HEADQUARTERS SRINAGAR',
        logoSize: 48,
        headerHeight: 85,
        headerFontSize: 14,
        photoWidth: 105,
        photoHeight: 105,
        qrSize: 52,
        detailsFontSize: 8.5,
        nameFontSize: 15,
        designationFontSize: 10,
        rowPadding: 3,
        labelWidth: 40,
        labelValueSpacing: 6,
        logo: 'preset-vsa-logo',
        signature: 'preset-vsa-sig',
        fields: {
            photo: true,
            name: true,
            designation: true,
            department: true,
            empid: true,
            father: true,
            phone: true,
            email: true,
            blood: true,
            address: false,
            signature: true,
            qrcode: true,
            barcode: true,
            validity: true
        },
        fieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'phone']
    },
    'salford-pill': {
        name: 'Salford Forest Pill (100% Replica)',
        cardTitle: 'SECURITY ID CARD',
        layout: 'horizontal',
        cardTheme: 'modern-pill',
        photoShape: 'squircle',
        nameStyle: 'clean',
        barcodePosition: 'bottom-left',
        font: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#006039',
        accentColor: '#006039',
        labelColor: '#1e293b',
        valueColor: '#0f172a',
        headerText: 'VALLEY SECURITY SERVICES',
        subheaderText: 'OFFICIAL IDENTIFICATION PASS',
        logoSize: 44,
        headerHeight: 65,
        headerFontSize: 13,
        photoWidth: 100,
        photoHeight: 105,
        qrSize: 52,
        detailsFontSize: 8.5,
        nameFontSize: 15,
        designationFontSize: 10,
        rowPadding: 2,
        labelWidth: 38,
        labelValueSpacing: 6,
        logo: 'preset-vsa-logo',
        signature: 'preset-vsa-sig',
        fields: {
            photo: true,
            name: true,
            designation: true,
            department: true,
            empid: true,
            father: true,
            phone: true,
            email: true,
            blood: true,
            address: false,
            signature: true,
            qrcode: true,
            barcode: true,
            validity: true
        },
        fieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'phone']
    },
    'indira-wave': {
        name: 'Indira Wave Art (100% Replica)',
        cardTitle: 'STAFF IDENTITY CARD',
        layout: 'vertical',
        cardTheme: 'creative-social',
        photoShape: 'squircle',
        nameStyle: 'boxed',
        barcodePosition: 'bottom-center',
        font: "'Playfair Display', 'Georgia', serif",
        backgroundColor: '#fffbf5',
        headerBgColor: '#78350f',
        accentColor: '#b45309',
        labelColor: '#451a03',
        valueColor: '#1c1917',
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'ESTABLISHED 2012',
        logoSize: 46,
        headerHeight: 75,
        headerFontSize: 13,
        photoWidth: 95,
        photoHeight: 110,
        qrSize: 54,
        detailsFontSize: 8.5,
        nameFontSize: 14,
        designationFontSize: 9.5,
        rowPadding: 3,
        labelWidth: 42,
        labelValueSpacing: 6,
        logo: 'preset-vsa-logo',
        signature: 'preset-vsa-sig',
        fields: {
            photo: true,
            name: true,
            designation: true,
            department: true,
            empid: true,
            father: true,
            phone: true,
            email: true,
            blood: true,
            address: false,
            signature: true,
            qrcode: true,
            barcode: true,
            validity: true
        },
        fieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'phone']
    },
    'valley-classic': {
        name: 'Valley Elite Gold (Official Pass)',
        cardTitle: 'OFFICIAL IDENTITY CARD',
        layout: 'vertical',
        cardTheme: 'classic',
        photoShape: 'standard',
        nameStyle: 'clean',
        barcodePosition: 'bottom-center',
        font: "'Plus Jakarta Sans', sans-serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#0e3e2b',
        accentColor: '#dfba5f',
        labelColor: '#475569',
        valueColor: '#0f172a',
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'SHAHIDGUNJ SRINAGAR KASHMIR',
        logoSize: 50,
        headerHeight: 90,
        headerFontSize: 14,
        photoWidth: 85,
        photoHeight: 105,
        qrSize: 60,
        detailsFontSize: 8,
        nameFontSize: 14,
        designationFontSize: 10,
        rowPadding: 3,
        labelWidth: 45,
        labelValueSpacing: 8,
        logo: 'preset-vsa-logo',
        signature: 'preset-vsa-sig',
        fields: {
            photo: true,
            name: true,
            designation: true,
            department: true,
            empid: true,
            father: true,
            phone: true,
            email: true,
            blood: true,
            address: true,
            signature: true,
            qrcode: true,
            barcode: true,
            validity: true
        },
        fieldOrder: ['empid', 'father', 'department', 'blood', 'validity', 'address', 'phone', 'email']
    }
};

function applyMasterClonePreset(cloneKey) {
    const preset = MASTER_CLONE_PRESETS[cloneKey];
    if (!preset) return;

    // Sync template ID if an existing matching template exists in VSA_STATE.templates
    let existingTpl = (VSA_STATE.templates || []).find(t => 
        (cloneKey === 'office' && (t.id === 'tpl-office' || (t.name && t.name.toLowerCase() === 'office'))) ||
        (t.name && t.name.toLowerCase() === preset.name.toLowerCase())
    );
    if (existingTpl) {
        if (document.getElementById('tpl-id')) document.getElementById('tpl-id').value = existingTpl.id;
        const tplEditSel = document.getElementById('tpl-edit-select');
        if (tplEditSel) tplEditSel.value = existingTpl.id;
        const topTplSel = document.getElementById('uice-top-tpl-select');
        if (topTplSel) topTplSel.value = existingTpl.id;
    } else if (cloneKey === 'office') {
        if (document.getElementById('tpl-id')) document.getElementById('tpl-id').value = 'tpl-office';
        const tplEditSel = document.getElementById('tpl-edit-select');
        if (tplEditSel) tplEditSel.value = 'tpl-office';
        const topTplSel = document.getElementById('uice-top-tpl-select');
        if (topTplSel) topTplSel.value = 'tpl-office';
    }

    // Apply values to inputs
    if (document.getElementById('tpl-name')) document.getElementById('tpl-name').value = preset.name;
    if (document.getElementById('tpl-card-title')) document.getElementById('tpl-card-title').value = preset.cardTitle;
    if (document.getElementById('tpl-layout')) document.getElementById('tpl-layout').value = preset.layout;
    if (document.getElementById('tpl-card-theme')) document.getElementById('tpl-card-theme').value = preset.cardTheme;
    if (document.getElementById('tpl-photo-shape')) document.getElementById('tpl-photo-shape').value = preset.photoShape;
    if (document.getElementById('tpl-name-style')) document.getElementById('tpl-name-style').value = preset.nameStyle;
    if (document.getElementById('tpl-barcode-pos')) document.getElementById('tpl-barcode-pos').value = preset.barcodePosition;
    if (document.getElementById('tpl-font')) document.getElementById('tpl-font').value = preset.font;
    if (document.getElementById('tpl-bg-color')) document.getElementById('tpl-bg-color').value = preset.backgroundColor;
    if (document.getElementById('tpl-header-bg')) document.getElementById('tpl-header-bg').value = preset.headerBgColor;
    if (document.getElementById('tpl-accent-color')) {
        document.getElementById('tpl-accent-color').value = preset.accentColor;
        const parsedHsl = hexToHsl(preset.accentColor);
        updateHslSlidersUI(parsedHsl.h, parsedHsl.s, parsedHsl.l);
    }
    if (document.getElementById('tpl-header-text')) document.getElementById('tpl-header-text').value = preset.headerText;
    if (document.getElementById('tpl-subheader-text')) document.getElementById('tpl-subheader-text').value = preset.subheaderText;

    // Apply sliders
    const setSlider = (id, val, lblId) => {
        const slider = document.getElementById(id);
        if (slider && val !== undefined) {
            slider.value = val;
            const lbl = document.getElementById(lblId || `lbl-${id.replace('tpl-', '')}`);
            if (lbl) lbl.textContent = val;
        }
    };
    setSlider('tpl-logo-size', preset.logoSize, 'lbl-logo-size');
    setSlider('tpl-header-height', preset.headerHeight, 'lbl-header-height');
    setSlider('tpl-header-font-size', preset.headerFontSize, 'lbl-header-font-size');
    setSlider('tpl-photo-width', preset.photoWidth, 'lbl-photo-width');
    setSlider('tpl-photo-height', preset.photoHeight, 'lbl-photo-height');
    setSlider('tpl-photo-top-offset', preset.photoTopOffset !== undefined ? preset.photoTopOffset : 10, 'lbl-photo-top-offset');
    setSlider('tpl-qr-size', preset.qrSize, 'lbl-qr-size');
    setSlider('tpl-details-font-size', preset.detailsFontSize, 'lbl-details-font-size');
    setSlider('tpl-name-font-size', preset.nameFontSize, 'lbl-name-font-size');
    setSlider('tpl-designation-font-size', preset.designationFontSize, 'lbl-designation-font-size');
    setSlider('tpl-row-padding', preset.rowPadding, 'lbl-row-padding');
    setSlider('tpl-label-width', preset.labelWidth, 'lbl-label-width');
    setSlider('tpl-label-value-spacing', preset.labelValueSpacing, 'lbl-label-value-spacing');

    if (document.getElementById('tpl-label-color')) document.getElementById('tpl-label-color').value = preset.labelColor;
    if (document.getElementById('tpl-value-color')) document.getElementById('tpl-value-color').value = preset.valueColor;

    // Preset buttons toggle
    document.querySelectorAll('.btn-logo-preset').forEach(btn => {
        if (btn.getAttribute('data-logo') === preset.logo) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    document.querySelectorAll('.btn-sig-preset').forEach(btn => {
        if (btn.getAttribute('data-sig') === preset.signature) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Checkboxes
    if (preset.fields) {
        Object.keys(preset.fields).forEach(fKey => {
            const cb = document.getElementById(`field-tpl-${fKey}`);
            if (cb) cb.checked = preset.fields[fKey];
        });
    }

    if (preset.fieldOrder) {
        VSA_STATE.activeFieldOrder = [...preset.fieldOrder];
        renderReorderableFieldsList();
    }

    // Active button highlight
    document.querySelectorAll('.btn-clone-preset').forEach(btn => {
        if (btn.getAttribute('data-clone') === cloneKey) {
            btn.style.boxShadow = '0 0 10px var(--theme-accent, #cfa15c)';
            btn.style.borderColor = 'var(--theme-accent, #cfa15c)';
        } else {
            btn.style.boxShadow = 'none';
        }
    });

    updateLivePreview();
    if (typeof initUiceWithTemplate === 'function') {
        initUiceWithTemplate(getActiveTemplateFromForm());
    }
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

    // 0. Clone preset buttons listener
    document.querySelectorAll('.btn-clone-preset').forEach(btn => {
        btn.addEventListener('click', function() {
            const cloneKey = this.getAttribute('data-clone');
            if (cloneKey) applyMasterClonePreset(cloneKey);
        });
    });

    // 1. Text and value listeners
    const inputs = ['tpl-name', 'tpl-card-title', 'tpl-header-text', 'tpl-subheader-text'];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateLivePreview);
    });

    const selects = ['tpl-layout', 'tpl-font', 'tpl-preview-emp-select', 'tpl-card-theme', 'tpl-photo-shape', 'tpl-name-style', 'tpl-barcode-pos'];
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
        'tpl-photo-width', 'tpl-photo-height', 'tpl-photo-top-offset', 'tpl-qr-size', 'tpl-details-font-size',
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
                if (id === 'tpl-photo-top-offset') {
                    const lbl = document.getElementById('lbl-photo-top-offset');
                    if (lbl) lbl.textContent = val;
                }
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
                    credentials: 'same-origin',
                    headers: { 
                        'Content-Type': 'application/json'
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
                if (data.cardTitle && document.getElementById('tpl-card-title')) document.getElementById('tpl-card-title').value = data.cardTitle;
                if (data.layout) document.getElementById('tpl-layout').value = data.layout;
                if (data.cardTheme && document.getElementById('tpl-card-theme')) document.getElementById('tpl-card-theme').value = data.cardTheme;
                if (data.photoShape && document.getElementById('tpl-photo-shape')) document.getElementById('tpl-photo-shape').value = data.photoShape;
                if (data.nameStyle && document.getElementById('tpl-name-style')) document.getElementById('tpl-name-style').value = data.nameStyle;
                if (data.barcodePosition && document.getElementById('tpl-barcode-pos')) document.getElementById('tpl-barcode-pos').value = data.barcodePosition;
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
    if (btnNew) btnNew.addEventListener('click', () => promptAndCreateNewTemplate('classic'));

    const btnNewTop = document.getElementById('btn-tpl-new-top');
    if (btnNewTop) btnNewTop.addEventListener('click', () => promptAndCreateNewTemplate('classic'));

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
                            previewBox.innerHTML = `<img src="${processedBase64}" alt="Processed Photo" style="max-height: 100px;">`;
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
                            previewBox.innerHTML = `<img src="${base64Str}" alt="Processed Photo" style="max-height: 100px;">`;
                        }
                    });
                } else {
                    // Normal behavior for other uploads
                    if (inputEl) {
                        inputEl.dataset.imageData = base64Str;
                    }
                    if (previewBox) {
                        previewBox.innerHTML = `<img src="${base64Str}" alt="Processed Photo" style="max-height: 100px;">`;
                    }
                }
            }
            
            // Close modal
            closeModal();
        });
    }
}

// Accessibility (a11y) Modal Manager (Focus Trap & Escape key closer)
let lastFocusedElementBeforeModal = null;

function setupModalA11y() {
    // Track active element or clicked element before opening modals
    document.addEventListener('click', (e) => {
        const target = e.target.closest('button, [role="button"], a, input, select');
        if (target && !target.closest('.modal-overlay:not(.hidden), .modal-backdrop:not(.hidden)')) {
            lastFocusedElementBeforeModal = target;
        }
    }, true);

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
                if (lastFocusedElementBeforeModal && typeof lastFocusedElementBeforeModal.focus === 'function') {
                    lastFocusedElementBeforeModal.focus();
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

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });
}

// Phase 11: PWA Service Worker & Network Connectivity Sentinel
function initPwaAndOfflineSentinel() {
    // 1. Register Service Worker if supported
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then((registration) => {
                    console.log('⚡ VSA PWA Service Worker registered successfully (scope: ' + registration.scope + ')');
                })
                .catch((err) => {
                    console.warn('⚠️ VSA Service Worker registration note:', err.message);
                });
        });
    }

    // 2. Real-time Network Connectivity Sentinel
    let toastEl = document.getElementById('vsa-network-status');
    if (!toastEl) {
        toastEl = document.createElement('div');
        toastEl.id = 'vsa-network-status';
        toastEl.className = 'vsa-network-toast vsa-hidden';
        toastEl.setAttribute('role', 'status');
        toastEl.setAttribute('aria-live', 'polite');
        document.body.appendChild(toastEl);
    }

    let hideTimeout = null;

    function showNetworkToast(isOnline) {
        if (!toastEl) return;
        if (hideTimeout) clearTimeout(hideTimeout);

        if (!isOnline) {
            toastEl.className = 'vsa-network-toast vsa-offline';
            toastEl.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                    <path d="M10.71 5.05A16 16 0 0 1 22.56 9"></path>
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                    <line x1="12" y1="20" x2="12.01" y2="20"></line>
                </svg>
                <span>Working Offline — Cached Data Active</span>
            `;
        } else {
            toastEl.className = 'vsa-network-toast vsa-online';
            toastEl.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Connection Restored — Synchronized</span>
            `;
            hideTimeout = setTimeout(() => {
                toastEl.className = 'vsa-network-toast vsa-hidden';
            }, 3500);
        }
    }

    window.addEventListener('offline', () => showNetworkToast(false));
    window.addEventListener('online', () => showNetworkToast(true));

    if (navigator.onLine === false) {
        showNetworkToast(false);
    }
}

// Color Picker Helpers: Hex to HSL, Color to Hex, and Slider Updates
function colorToHex(col) {
    if (!col) return '#111111';
    if (typeof col !== 'string') return '#111111';
    col = col.trim();
    if (col.startsWith('#')) {
        if (col.length === 4) {
            return '#' + col[1] + col[1] + col[2] + col[2] + col[3] + col[3];
        }
        return col;
    }
    if (col.startsWith('hsl')) {
        const parts = col.match(/[\d.]+/g);
        if (parts && parts.length >= 3) {
            let h = parseFloat(parts[0]) / 360;
            let s = parseFloat(parts[1]) / 100;
            let l = parseFloat(parts[2]) / 100;
            let r, g, b;
            if (s === 0) {
                r = g = b = l;
            } else {
                const hue2rgb = (p, q, t) => {
                    if (t < 0) t += 1;
                    if (t > 1) t -= 1;
                    if (t < 1/6) return p + (q - p) * 6 * t;
                    if (t < 1/2) return q;
                    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                };
                const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                const p = 2 * l - q;
                r = hue2rgb(p, q, h + 1/3);
                g = hue2rgb(p, q, h);
                b = hue2rgb(p, q, h - 1/3);
            }
            const toHex = x => {
                const hex = Math.round(x * 255).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            };
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }
    }
    return col;
}

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
            lastFocusedElementBeforeModal = btnOpenInbox;
            renderInbox();
            inboxModal.classList.remove('hidden');
        });
    }
    
    if (btnCloseInbox && inboxModal) {
        btnCloseInbox.addEventListener('click', () => {
            inboxModal.classList.add('hidden');
            if (lastFocusedElementBeforeModal && typeof lastFocusedElementBeforeModal.focus === 'function') {
                lastFocusedElementBeforeModal.focus();
            }
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
        
        // Fix: handle base64 data URIs safely and reject dangerous SVG/script URLs
        let avatarSrc = '';
        if (emp.documents?.photo) {
            const rawPhoto = String(emp.documents.photo);
            if (/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(rawPhoto)) {
                avatarSrc = rawPhoto;
            } else if (/^\/api\/employees\/[^"'\s]+\/(photo|signature)/.test(rawPhoto)) {
                avatarSrc = rawPhoto.includes('token=') ? rawPhoto : `${rawPhoto}?token=${encodeURIComponent(emp.secureToken || '')}`;
            }
        }
        const avatarHtml = avatarSrc ? 
            `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(emp.name || 'Candidate')} Photo" style="width: 44px; height: 55px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border-color);" onerror="this.onerror=null; this.src='/api/employees/default-avatar.svg';">` : 
            `<div style="width: 44px; height: 55px; background: rgba(255,255,255,0.05); border-radius: 6px; display:flex; align-items:center; justify-content:center; color: var(--text-secondary);"><i data-lucide="user" style="width:18px;"></i></div>`;
            
        row.innerHTML = `
            <td style="padding: 10px; vertical-align: middle;">${avatarHtml}</td>
            <td style="padding: 10px; vertical-align: middle; font-weight:600; color: #fff;">${escapeHtml(toTitleCase(emp.name))}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.mobile || '-')}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.dob || '-')}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.designation || '-')}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.department || '-')}</td>
            <td style="padding: 10px; vertical-align: middle; text-align: right;">
                <div style="display: inline-flex; gap: 6px;">
                    <button class="btn btn-xs btn-outline btn-inbox-view" data-id="${escapeHtml(emp.id)}" style="border-color: rgba(255,255,255,0.15); color: #fff; display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer; background: rgba(255,255,255,0.03);"><i data-lucide="eye" style="width:12px;"></i> View</button>
                    <button class="btn btn-xs btn-success btn-inbox-approve" data-id="${escapeHtml(emp.id)}" style="background: #10b981; border-color: #10b981; color: #fff; display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer;"><i data-lucide="check" style="width:12px;"></i> Approve</button>
                    <button class="btn btn-xs btn-danger btn-inbox-reject" data-id="${escapeHtml(emp.id)}" style="background: #ef4444; border-color: #ef4444; color: #fff; display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer;"><i data-lucide="x" style="width:12px;"></i> Reject</button>
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

            if (!confirm(`Approve onboarding profile for ${emp.name}?`)) return;

            try {
                emp.status = 'Active';
                const row = btn.closest('tr');
                if (row) {
                    row.classList.add('row-optimistic-deleted');
                    setTimeout(() => row.remove(), 80);
                }

                showToast(`Registration for ${emp.name} approved successfully!`);

                const response = await fetch(`/api/employees/${encodeURIComponent(empId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emp)
                });
                
                if (!response.ok) throw new Error('Failed to approve registration on server');
            } catch (err) {
                showToast('Error approving: ' + err.message);
                fetchData();
            }
        });
    });
    
    tbody.querySelectorAll('.btn-inbox-reject').forEach(btn => {
        btn.addEventListener('click', async () => {
            const empId = btn.getAttribute('data-id');
            const reason = prompt("Enter the reason for rejecting this onboarding profile (this will be logged):");
            if (reason === null) return;
            
            const cleanReason = reason.trim() || "Details or photo did not meet requirements.";
            
            try {
                const emp = VSA_STATE.employees.find(e => e.id === empId);
                if (!emp) return;
                
                emp.status = 'Rejected';
                emp.rejectionReason = cleanReason;
                emp.rejectionDate = new Date().toISOString().substring(0, 10);
                
                const row = btn.closest('tr');
                if (row) {
                    row.classList.add('row-optimistic-deleted');
                    setTimeout(() => row.remove(), 80);
                }

                showToast(`Registration for ${emp.name} rejected.`);

                const response = await fetch(`/api/employees/${encodeURIComponent(empId)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(emp)
                });
                
                if (!response.ok) throw new Error('Failed to reject registration on server');
            } catch (err) {
                showToast('Error rejecting: ' + err.message);
                fetchData();
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
            showToast('Registration approved successfully!');
            await fetchData();
            renderInbox();
        } catch (err) {
            showToast('Error approving: ' + err.message);
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
            showToast('Registration rejected and logged.');
        } catch (err) {
            showToast('Error rejecting: ' + err.message);
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
            <td style="padding: 10px; vertical-align: middle; font-weight:600; color: #fff;">${escapeHtml(toTitleCase(emp.name))}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.mobile || '-')}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.dob || '-')}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.designation || '-')}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.department || '-')}</td>
            <td style="padding: 10px; vertical-align: middle;">${escapeHtml(emp.rejectionDate || '-')}</td>
            <td style="padding: 10px; vertical-align: middle; color: #f87171; font-style: italic;">${escapeHtml(emp.rejectionReason || '-')}</td>
            <td style="padding: 10px; vertical-align: middle; text-align: right;">
                <div style="display: inline-flex; gap: 8px;">
                    <button class="btn btn-xs btn-outline btn-inbox-reopen" data-id="${escapeHtml(emp.id)}" style="display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer; color: var(--theme-accent); border-color: rgba(212, 175, 55, 0.15);"><i data-lucide="edit" style="width:12px;"></i> Re-review</button>
                    <button class="btn btn-xs btn-danger btn-inbox-delete-log" data-id="${escapeHtml(emp.id)}" style="background: #ef4444; border-color: #ef4444; color: #fff; display: flex; align-items:center; gap:4px; padding: 4px 8px; font-size:11px; cursor:pointer;"><i data-lucide="trash-2" style="width:12px;"></i> Clear</button>
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
            if (!confirm(`Permanently delete rejected log for guard ${empId}?`)) return;
            
            try {
                const row = btn.closest('tr');
                if (row) {
                    row.classList.add('row-optimistic-deleted');
                    setTimeout(() => row.remove(), 80);
                }
                VSA_STATE.employees = VSA_STATE.employees.filter(e => e.id !== empId);
                showToast(`Rejected record ${empId} deleted.`);

                const response = await fetch(`/api/employees/${encodeURIComponent(empId)}`, { method: 'DELETE' });
                if (!response.ok) throw new Error('Deletion failed on server');
            } catch (err) {
                showToast('Error: ' + err.message);
                fetchData();
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
                        credentials: 'same-origin',
                        headers: { 
                            'Content-Type': 'application/json'
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
                    photoPreview.innerHTML = `<img src="${data.photo}" alt="Live Preview Photo" style="max-height: 100px; border-radius: 8px;">`;
                }
            }
        }
    }
}

// --- LIVE NOTIFICATION POLLING FOR ADMIN DASHBOARD ---
(function initLiveNotifications() {
  let seenNotificationIds = new Set();
  let firstPoll = true;

  async function checkNotifications() {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        data.notifications.forEach(n => {
          if (!seenNotificationIds.has(n.id)) {
            seenNotificationIds.add(n.id);
            if (!firstPoll && !n.is_read) {
              alert(`📷 Live Update: ${n.employee_name} (${n.employee_id}) has submitted their form & photo!`);
              if (typeof fetchData === 'function') {
                fetchData();
              }
            }
          }
        });
        firstPoll = false;
      }
    } catch (e) {}
  }

  setInterval(() => {
    if (!document.hidden) checkNotifications();
  }, 30000);
  checkNotifications();
})();

/* ==========================================================================
   PHASE 2: DEPLOYMENT ONBOARDING COMMAND CENTRE (TENDER WORKSPACE)
   ========================================================================== */

function formatProjectDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const yr = d.getFullYear();
    return `${day}/${mon}/${yr}`;
}

function updateDeploymentsBadge() {
    const badge = document.getElementById('nav-deployments-badge');
    if (!badge) return;
    const activeProjects = (VSA_STATE.deploymentProjects || []).filter(p => p.status === 'Active');
    const count = activeProjects.length;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

async function loadDeploymentsData() {
    try {
        const res = await fetch('/api/deployment-projects');
        if (res.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        if (!res.ok) {
            console.error('Failed to load deployment projects');
            return;
        }
        const projects = await res.json();
        VSA_STATE.deploymentProjects = Array.isArray(projects) ? projects : [];

        // Calculate KPI summary
        const total = VSA_STATE.deploymentProjects.length;
        const active = VSA_STATE.deploymentProjects.filter(p => p.status === 'Active').length;
        let totalTarget = 0;
        let totalRegistered = 0;
        let totalApproved = 0;
        let totalPending = 0;

        VSA_STATE.deploymentProjects.forEach(p => {
            const st = p.stats || {};
            totalTarget += Number(p.targetGuards || st.targetGuards || 0);
            totalRegistered += Number(st.totalRegistered || 0);
            totalApproved += Number(st.approvedCount || 0);
            totalPending += Number(st.pendingCount || 0);
        });

        const overallPct = totalTarget > 0 ? Math.min(100, Math.round((totalRegistered / totalTarget) * 100)) : 0;

        // Populate Top KPI Cards
        const elActive = document.getElementById('stat-dep-active-projects');
        if (elActive) elActive.textContent = active;

        const elSubTotal = document.getElementById('stat-dep-total-projects-sub');
        if (elSubTotal) elSubTotal.textContent = `${total} total tender${total === 1 ? '' : 's'}`;

        const elTarget = document.getElementById('stat-dep-target-guards');
        if (elTarget) elTarget.textContent = totalTarget;

        const elReg = document.getElementById('stat-dep-registered-guards');
        if (elReg) elReg.textContent = totalRegistered;

        const elProg = document.getElementById('stat-dep-overall-progress');
        if (elProg) elProg.textContent = `${overallPct}% overall intake progress`;

        const elApp = document.getElementById('stat-dep-approved-guards');
        if (elApp) elApp.textContent = totalApproved;

        const elPend = document.getElementById('stat-dep-pending-guards');
        if (elPend) elPend.textContent = `${totalPending} candidate${totalPending === 1 ? '' : 's'} awaiting review`;

        updateDeploymentsBadge();
        filterDeploymentProjects();
    } catch (err) {
        console.error('Error loading deployments data:', err);
    }
}

function filterDeploymentProjects() {
    const searchInput = document.getElementById('deployments-search-input');
    const statusSelect = document.getElementById('deployments-status-filter');
    const query = (searchInput?.value || '').toLowerCase().trim();
    const statusFilter = statusSelect?.value || 'Active';

    const projects = VSA_STATE.deploymentProjects || [];
    const filtered = projects.filter(p => {
        // Status filter
        if (statusFilter !== 'All' && p.status !== statusFilter) {
            return false;
        }
        // Search query
        if (query) {
            const name = (p.name || '').toLowerCase();
            const client = (p.clientName || '').toLowerCase();
            const loc = (p.location || '').toLowerCase();
            const dept = (p.department || '').toLowerCase();
            if (!name.includes(query) && !client.includes(query) && !loc.includes(query) && !dept.includes(query)) {
                return false;
            }
        }
        return true;
    });

    renderDeploymentProjects(filtered);
}

function renderDeploymentProjects(projects) {
    const grid = document.getElementById('deployment-projects-grid');
    const empty = document.getElementById('deployment-projects-empty');
    if (!grid) return;

    grid.innerHTML = '';
    if (!projects || projects.length === 0) {
        if (empty) empty.style.display = 'block';
        return;
    }
    if (empty) empty.style.display = 'none';

    projects.forEach(p => {
        const stats = p.stats || {};
        const target = Number(p.targetGuards || stats.targetGuards || 0);
        const registered = Number(stats.totalRegistered || 0);
        const approved = Number(stats.approvedCount || 0);
        const pending = Number(stats.pendingCount || 0);
        const pct = target > 0 ? Math.min(100, Math.round((registered / target) * 100)) : 0;

        // Status badge color
        let statusBg = 'rgba(16,185,129,0.15)';
        let statusColor = '#34d399';
        if (p.status === 'Completed') {
            statusBg = 'rgba(99,102,241,0.15)';
            statusColor = '#818cf8';
        } else if (p.status === 'Archived') {
            statusBg = 'rgba(148,163,184,0.15)';
            statusColor = '#94a3b8';
        }

        // Deadline label
        let deadlineHtml = '';
        if (p.deadline) {
            const dlFormatted = formatProjectDate(p.deadline);
            const dlDate = new Date(p.deadline);
            const isOverdue = !isNaN(dlDate.getTime()) && dlDate < new Date() && p.status === 'Active';
            deadlineHtml = `
                <span style="font-size: 11px; padding: 3px 8px; border-radius: 6px; background: ${isOverdue ? 'rgba(239,68,68,0.15)' : 'var(--vs-surface-2)'}; color: ${isOverdue ? '#f87171' : 'var(--vs-text-muted)'}; display: inline-flex; align-items: center; gap: 4px;">
                    <i data-lucide="calendar" style="width: 12px; height: 12px;"></i>
                    ${isOverdue ? 'Overdue: ' : 'Deadline: '}${escapeHtml(dlFormatted)}
                </span>
            `;
        }

        const fullInviteUrl = `${window.location.origin}/register.html?project=${encodeURIComponent(p.slug)}`;
        const card = document.createElement('div');
        card.className = 'dashboard-card';
        card.style.cssText = 'padding: 20px; display: flex; flex-direction: column; justify-content: space-between; border-radius: 16px; border: 1px solid var(--vs-border-subtle); background: var(--vs-surface-1); transition: transform 0.2s ease, box-shadow 0.2s ease;';

        card.innerHTML = `
            <div>
                <!-- Top Meta Row -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; gap: 8px;">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 9px; border-radius: 10px; background: ${statusBg}; color: ${statusColor};">
                        ${escapeHtml(p.status || 'Active')}
                    </span>
                    ${deadlineHtml}
                </div>

                <!-- Project Title & Client -->
                <h3 style="font-size: 16px; font-weight: 700; color: var(--vs-text-primary); margin-bottom: 4px; line-height: 1.35;">
                    ${escapeHtml(p.name)}
                </h3>
                <div style="font-size: 12px; color: var(--vs-text-muted); display: flex; align-items: center; gap: 6px; margin-bottom: 16px;">
                    <i data-lucide="map-pin" style="width: 13px; height: 13px; color: #818cf8; flex-shrink: 0;"></i>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${escapeHtml(p.clientName || 'General Tender')} ${p.location ? '• ' + escapeHtml(p.location) : ''}
                    </span>
                </div>

                <!-- Progress Bar & Target -->
                <div style="background: var(--vs-surface-2); border: 1px solid var(--vs-border-subtle); border-radius: 12px; padding: 12px; margin-bottom: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 6px;">
                        <span style="color: var(--vs-text-primary); font-weight: 600;">
                            ${registered} / ${target} Guards
                        </span>
                        <span style="color: ${pct >= 100 ? '#10b981' : '#818cf8'}; font-weight: 700;">
                            ${pct}% Intake
                        </span>
                    </div>
                    <div style="height: 7px; border-radius: 4px; background: rgba(255,255,255,0.06); overflow: hidden;">
                        <div style="height: 100%; border-radius: 4px; background: ${pct >= 100 ? '#10b981' : 'linear-gradient(90deg, #6366f1, #3b82f6)'}; width: ${pct}%; transition: width 0.4s ease;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 11px; margin-top: 8px;">
                        <span style="color: #34d399; font-weight: 600;">${approved} Approved</span>
                        <span style="color: #f59e0b; font-weight: 600;">${pending} Pending Review</span>
                    </div>
                </div>
            </div>

            <!-- Action Buttons Footer -->
            <div>
                <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                    <button class="btn btn-primary" onclick="openProjectCandidatesModal('${escapeHtml(p.id)}')" style="flex: 1; padding: 8px 10px; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <i data-lucide="users" style="width: 14px; height: 14px;"></i>
                        Candidates (${registered})
                    </button>
                    <button class="btn btn-outline" onclick="batchPrintProjectCards('${escapeHtml(p.id)}')" title="⚡ 1-Click Print All Approved ID Badges" style="padding: 8px 10px; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 5px; color: #10b981; border-color: rgba(16,185,129,0.4); background: rgba(16,185,129,0.06); font-weight: 600;">
                        <i data-lucide="zap" style="width: 14px; height: 14px; fill: currentColor;"></i>
                        ⚡ Print Cards (${approved})
                    </button>
                    <button class="btn btn-outline" onclick="openDeploymentQrModal('${escapeHtml(p.id)}')" title="View Onboarding QR & Link" style="padding: 8px 10px; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <i data-lucide="qr-code" style="width: 14px; height: 14px;"></i>
                        QR Link
                    </button>
                </div>
                
                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 10px; border-top: 1px solid var(--vs-border-subtle);">
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-outline" onclick="copyProjectLink('${encodeURIComponent(fullInviteUrl)}')" title="Copy Onboarding Link" style="padding: 5px 8px; font-size: 11px;">
                            <i data-lucide="copy" style="width: 12px; height: 12px;"></i> Copy
                        </button>
                        <button class="btn btn-outline" onclick="shareProjectWhatsApp('${encodeURIComponent(p.name)}', '${encodeURIComponent(fullInviteUrl)}')" title="Share to WhatsApp" style="padding: 5px 8px; font-size: 11px; color: #25D366; border-color: rgba(37,211,102,0.3);">
                            <i data-lucide="send" style="width: 12px; height: 12px;"></i> WhatsApp
                        </button>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-outline" onclick="openEditProjectModal('${escapeHtml(p.id)}')" title="Edit Project Details" style="padding: 5px 8px; font-size: 11px;">
                            <i data-lucide="edit-3" style="width: 12px; height: 12px;"></i>
                        </button>
                        <button class="btn btn-outline" onclick="deleteOrArchiveProject('${escapeHtml(p.id)}')" title="Delete or Archive Project" style="padding: 5px 8px; font-size: 11px; color: #ef4444; border-color: rgba(239,68,68,0.3);">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

        grid.appendChild(card);
    });

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function openCreateProjectModal() {
    const form = document.getElementById('deployment-project-form');
    if (form) form.reset();
    document.getElementById('dep-project-id').value = '';
    document.getElementById('dep-project-designation').value = 'Security Guard';
    document.getElementById('dep-project-status-group').style.display = 'none';
    document.getElementById('deployment-project-modal-title').innerHTML = `
        <i data-lucide="building-2" style="width: 20px; height: 20px; color: #818cf8;"></i>
        Create Deployment Project
    `;
    document.getElementById('btn-save-deployment-project').innerHTML = `
        <i data-lucide="check-circle"></i> Save Deployment Project
    `;
    const modal = document.getElementById('deployment-project-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

function openEditProjectModal(projectId) {
    const project = (VSA_STATE.deploymentProjects || []).find(p => p.id === projectId);
    if (!project) return;

    document.getElementById('dep-project-id').value = project.id;
    document.getElementById('dep-project-name').value = project.name || '';
    document.getElementById('dep-project-client').value = project.clientName || '';
    document.getElementById('dep-project-location').value = project.location || '';
    document.getElementById('dep-project-target').value = project.targetGuards || '';
    document.getElementById('dep-project-deadline').value = project.deadline || '';
    document.getElementById('dep-project-department').value = project.department || '';
    document.getElementById('dep-project-designation').value = project.designation || 'Security Guard';
    document.getElementById('dep-project-status').value = project.status || 'Active';
    document.getElementById('dep-project-instructions').value = project.instructions || '';
    document.getElementById('dep-project-notes').value = project.notes || '';

    document.getElementById('dep-project-status-group').style.display = 'block';
    document.getElementById('deployment-project-modal-title').innerHTML = `
        <i data-lucide="edit-3" style="width: 20px; height: 20px; color: #818cf8;"></i>
        Edit Deployment Project
    `;
    document.getElementById('btn-save-deployment-project').innerHTML = `
        <i data-lucide="check-circle"></i> Update Project
    `;
    const modal = document.getElementById('deployment-project-modal');
    if (modal) modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

function closeDeploymentProjectModal() {
    const modal = document.getElementById('deployment-project-modal');
    if (modal) modal.classList.add('hidden');
}

async function handleDeploymentProjectSubmit(event) {
    event.preventDefault();
    const id = document.getElementById('dep-project-id').value;
    const name = document.getElementById('dep-project-name').value.trim();
    const clientName = document.getElementById('dep-project-client').value.trim();
    const location = document.getElementById('dep-project-location').value.trim();
    const targetGuards = parseInt(document.getElementById('dep-project-target').value, 10) || 0;
    const deadline = document.getElementById('dep-project-deadline').value.trim();
    const department = document.getElementById('dep-project-department').value.trim();
    const designation = document.getElementById('dep-project-designation').value.trim();
    const status = document.getElementById('dep-project-status').value;
    const instructions = document.getElementById('dep-project-instructions').value.trim();
    const notes = document.getElementById('dep-project-notes').value.trim();

    if (!name) {
        alert("Project name is required.");
        return;
    }

    const payload = {
        name,
        clientName,
        location,
        targetGuards,
        deadline,
        department,
        designation,
        status,
        instructions,
        notes
    };

    const saveBtn = document.getElementById('btn-save-deployment-project');
    if (saveBtn) saveBtn.disabled = true;

    try {
        let res;
        if (id) {
            // Update
            res = await fetch(`/api/deployment-projects/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } else {
            // Create
            res = await fetch('/api/deployment-projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        }

        const data = await res.json();
        if (saveBtn) saveBtn.disabled = false;

        if (!res.ok) {
            alert(data.error || "Failed to save deployment project.");
            return;
        }

        closeDeploymentProjectModal();
        alert(id ? "Deployment project updated successfully!" : "Deployment project created successfully!");
        loadDeploymentsData();
    } catch (err) {
        if (saveBtn) saveBtn.disabled = false;
        console.error('Error saving deployment project:', err);
        alert("Network error while saving deployment project.");
    }
}

async function openProjectCandidatesModal(projectId) {
    VSA_STATE.activeDeploymentProjectId = projectId;
    const modal = document.getElementById('project-candidates-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    document.getElementById('candidates-project-title').textContent = "Loading candidates...";
    document.getElementById('candidates-project-subtitle').textContent = "Connecting to server...";
    document.getElementById('project-candidates-tbody').innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 30px; color: var(--vs-text-muted);">Fetching registered candidates...</td></tr>';

    try {
        const res = await fetch(`/api/deployment-projects/${encodeURIComponent(projectId)}`);
        if (!res.ok) {
            alert("Could not load candidates for this deployment.");
            closeProjectCandidatesModal();
            return;
        }
        const data = await res.json();
        const project = data.project || {};
        const stats = data.stats || {};
        const employees = data.employees || [];

        // Save active candidates for ID card handoff
        VSA_STATE.activeProjectCandidates = employees;

        document.getElementById('candidates-project-title').textContent = `${project.name} Candidates`;
        document.getElementById('candidates-project-subtitle').textContent = `${project.clientName || ''} ${project.location ? '• ' + project.location : ''} • Department: ${project.department || 'All'}`;

        const totalReg = employees.length;
        const approvedCount = employees.filter(e => e.status === 'Active' || e.status === 'Approved').length;
        const pendingCount = employees.filter(e => e.status === 'Pending').length;
        const rejectedCount = employees.filter(e => e.status === 'Rejected' || e.status === 'Suspended').length;

        document.getElementById('badge-cand-total').textContent = `${totalReg} Total Registered`;
        document.getElementById('badge-cand-approved').textContent = `${approvedCount} Approved`;
        document.getElementById('badge-cand-pending').textContent = `${pendingCount} Pending Review`;
        const rejBadge = document.getElementById('badge-cand-rejected');
        if (rejBadge) rejBadge.textContent = `${rejectedCount} Rejected`;
        document.getElementById('badge-cand-target').textContent = `Target: ${project.targetGuards || stats.targetGuards || 0} Guards`;

        const batchPrintBtn = document.getElementById('btn-print-project-cards');
        if (batchPrintBtn) {
            batchPrintBtn.innerHTML = `<i data-lucide="zap" style="width: 16px; height: 16px; fill: currentColor;"></i> ⚡ Print All Project ID Cards (${approvedCount})`;
        }

        const tbody = document.getElementById('project-candidates-tbody');
        const emptyDiv = document.getElementById('project-candidates-empty');
        const tableWrap = document.getElementById('project-candidates-table-wrap');

        tbody.innerHTML = '';
        if (employees.length === 0) {
            if (emptyDiv) emptyDiv.style.display = 'block';
            if (tableWrap) tableWrap.style.display = 'none';
        } else {
            if (emptyDiv) emptyDiv.style.display = 'none';
            if (tableWrap) tableWrap.style.display = 'block';

            employees.forEach(emp => {
                const tr = document.createElement('tr');
                const empId = emp.id || emp.employeeId;
                tr.setAttribute('data-cand-id', empId);
                const photoSrc = emp.documents?.photo || '';
                const photoHtml = photoSrc
                    ? `<img src="${photoSrc}" alt="${escapeHtml(emp.name || 'Candidate')}" style="width: 36px; height: 36px; border-radius: 8px; object-fit: cover; border: 1px solid var(--vs-border-subtle);" onerror="this.onerror=null; this.src='/api/employees/default-avatar.svg';">`
                    : `<div style="width: 36px; height: 36px; border-radius: 8px; background: var(--vs-surface-2); display: flex; align-items: center; justify-content: center; color: var(--vs-text-muted);"><i data-lucide="user" style="width: 16px; height: 16px;"></i></div>`;

                let statusBadge = '<span class="cand-status-pill" style="font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(245,158,11,0.15); color: #f59e0b; font-weight: 700;">Pending</span>';
                if (emp.status === 'Active' || emp.status === 'Approved') {
                    statusBadge = '<span class="cand-status-pill" style="font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(16,185,129,0.15); color: #34d399; font-weight: 700;">Active</span>';
                } else if (emp.status === 'Suspended' || emp.status === 'Rejected') {
                    statusBadge = '<span class="cand-status-pill" style="font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(239,68,68,0.15); color: #f87171; font-weight: 700;">Rejected</span>';
                }

                const actionsHtml = `
                    <div style="display: flex; gap: 4px; justify-content: flex-end; align-items: center;">
                        ${(emp.status !== 'Active' && emp.status !== 'Approved') ? `
                            <button class="btn btn-xs btn-primary" onclick="quickUpdateCandidateStatus('${escapeHtml(empId)}', 'Active')" title="Accept / Approve Candidate" style="background: #059669; border-color: #059669; padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;">
                                <i data-lucide="check" style="width: 12px; height: 12px;"></i> Accept
                            </button>
                        ` : `
                            <button class="btn btn-xs btn-outline" onclick="quickUpdateCandidateStatus('${escapeHtml(empId)}', 'Suspended')" title="Suspend / Reject Candidate" style="color: #f59e0b; border-color: rgba(245,158,11,0.4); padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;">
                                <i data-lucide="x" style="width: 12px; height: 12px;"></i> Reject
                            </button>
                        `}
                        ${emp.status === 'Pending' ? `
                            <button class="btn btn-xs btn-outline" onclick="quickUpdateCandidateStatus('${escapeHtml(empId)}', 'Rejected')" title="Reject Candidate" style="color: #f87171; border-color: rgba(239,68,68,0.4); padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;">
                                <i data-lucide="x-circle" style="width: 12px; height: 12px;"></i> Reject
                            </button>
                        ` : ''}
                        <button class="btn btn-xs btn-outline" onclick="quickDeleteCandidate('${escapeHtml(empId)}')" title="Permanently Delete Candidate" style="color: #ef4444; border-color: rgba(239,68,68,0.3); padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center;">
                            <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                        </button>
                    </div>
                `;

                tr.innerHTML = `
                    <td style="width: 48px;">${photoHtml}</td>
                    <td style="font-weight: 700; color: #818cf8; font-family: monospace;">${escapeHtml(empId)}</td>
                    <td>
                        <div style="font-weight: 600; color: var(--vs-text-primary);">${escapeHtml(toTitleCase(emp.name || ''))}</div>
                        <div style="font-size: 11px; color: var(--vs-text-muted);">S/o: ${escapeHtml(toTitleCase(emp.fatherName || emp.father_name || '-'))}</div>
                    </td>
                    <td>${escapeHtml(emp.mobile || '-')}</td>
                    <td>${escapeHtml(emp.department || '-')}</td>
                    <td class="cand-status-cell">${statusBadge}</td>
                    <td style="text-align: right;" class="cand-actions-cell">${actionsHtml}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        if (window.lucide) window.lucide.createIcons();
    } catch (err) {
        console.error('Error fetching candidates:', err);
        showToast("Failed to fetch project candidate list.");
    }
}

function closeProjectCandidatesModal() {
    const modal = document.getElementById('project-candidates-modal');
    if (modal) modal.classList.add('hidden');
}

function updateProjectCandidatesLiveBadges() {
    const candidates = VSA_STATE.activeProjectCandidates || [];
    const totalReg = candidates.length;
    const approvedCount = candidates.filter(e => e.status === 'Active' || e.status === 'Approved').length;
    const pendingCount = candidates.filter(e => e.status === 'Pending').length;
    const rejectedCount = candidates.filter(e => e.status === 'Rejected' || e.status === 'Suspended').length;

    const bTotal = document.getElementById('badge-cand-total');
    if (bTotal) bTotal.textContent = `${totalReg} Total Registered`;
    const bApp = document.getElementById('badge-cand-approved');
    if (bApp) bApp.textContent = `${approvedCount} Approved`;
    const bPend = document.getElementById('badge-cand-pending');
    if (bPend) bPend.textContent = `${pendingCount} Pending Review`;
    const bRej = document.getElementById('badge-cand-rejected');
    if (bRej) bRej.textContent = `${rejectedCount} Rejected`;

    const batchPrintBtn = document.getElementById('btn-print-project-cards');
    if (batchPrintBtn) {
        batchPrintBtn.innerHTML = `<i data-lucide="zap" style="width: 16px; height: 16px; fill: currentColor;"></i> ⚡ Print All Project ID Cards (${approvedCount})`;
        if (window.lucide) window.lucide.createIcons();
    }
}

async function quickUpdateCandidateStatus(empId, targetStatus) {
    if (!empId) return;

    // 1. Optimistic update in memory
    const candidates = VSA_STATE.activeProjectCandidates || [];
    const cand = candidates.find(c => (c.id || c.employeeId) === empId);
    if (cand) cand.status = targetStatus;

    const globalEmp = VSA_STATE.employees.find(e => e.id === empId);
    if (globalEmp) globalEmp.status = targetStatus;

    // 2. Optimistic DOM update in candidates drawer
    const row = document.querySelector(`tr[data-cand-id="${empId}"]`);
    if (row) {
        const statusCell = row.querySelector('.cand-status-cell');
        const actionsCell = row.querySelector('.cand-actions-cell');

        let statusBadge = '<span class="cand-status-pill" style="font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(245,158,11,0.15); color: #f59e0b; font-weight: 700;">Pending</span>';
        if (targetStatus === 'Active' || targetStatus === 'Approved') {
            statusBadge = '<span class="cand-status-pill" style="font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(16,185,129,0.15); color: #34d399; font-weight: 700;">Active</span>';
        } else if (targetStatus === 'Suspended' || targetStatus === 'Rejected') {
            statusBadge = '<span class="cand-status-pill" style="font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(239,68,68,0.15); color: #f87171; font-weight: 700;">Rejected</span>';
        }
        if (statusCell) statusCell.innerHTML = statusBadge;

        const actionsHtml = `
            <div style="display: flex; gap: 4px; justify-content: flex-end; align-items: center;">
                ${(targetStatus !== 'Active' && targetStatus !== 'Approved') ? `
                    <button class="btn btn-xs btn-primary" onclick="quickUpdateCandidateStatus('${escapeHtml(empId)}', 'Active')" title="Accept / Approve Candidate" style="background: #059669; border-color: #059669; padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;">
                        <i data-lucide="check" style="width: 12px; height: 12px;"></i> Accept
                    </button>
                ` : `
                    <button class="btn btn-xs btn-outline" onclick="quickUpdateCandidateStatus('${escapeHtml(empId)}', 'Suspended')" title="Suspend / Reject Candidate" style="color: #f59e0b; border-color: rgba(245,158,11,0.4); padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;">
                        <i data-lucide="x" style="width: 12px; height: 12px;"></i> Reject
                    </button>
                `}
                <button class="btn btn-xs btn-outline" onclick="quickDeleteCandidate('${escapeHtml(empId)}')" title="Permanently Delete Candidate" style="color: #ef4444; border-color: rgba(239,68,68,0.3); padding: 4px 8px; font-size: 11px; display: inline-flex; align-items: center;">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                </button>
            </div>
        `;
        if (actionsCell) actionsCell.innerHTML = actionsHtml;
        if (window.lucide) window.lucide.createIcons();
    }

    updateProjectCandidatesLiveBadges();
    showToast(`Candidate ${empId} set to ${targetStatus}.`);

    // 3. Background server sync
    try {
        await fetch(`/api/employees/${encodeURIComponent(empId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStatus })
        });
        loadDeploymentsData();
    } catch (err) {
        console.error('Error updating candidate status:', err);
        showToast(`Sync failed for ${empId}: ${err.message}`);
    }
}

async function quickDeleteCandidate(empId) {
    if (!empId) return;
    if (!confirm(`Are you sure you want to permanently delete candidate ${empId}?`)) return;

    // 1. Optimistic removal from DOM in 80ms
    const row = document.querySelector(`tr[data-cand-id="${empId}"]`);
    if (row) {
        row.classList.add('row-optimistic-deleted');
        setTimeout(() => row.remove(), 80);
    }

    // 2. Remove from local states
    if (VSA_STATE.activeProjectCandidates) {
        VSA_STATE.activeProjectCandidates = VSA_STATE.activeProjectCandidates.filter(c => (c.id || c.employeeId) !== empId);
    }
    VSA_STATE.employees = VSA_STATE.employees.filter(e => e.id !== empId);
    updateProjectCandidatesLiveBadges();
    showToast(`Candidate ${empId} deleted successfully.`);

    // 3. Background server delete
    try {
        await fetch(`/api/employees/${encodeURIComponent(empId)}`, { method: 'DELETE' });
        loadDeploymentsData();
    } catch (err) {
        console.error('Error deleting candidate:', err);
        showToast(`Failed to delete candidate ${empId}: ${err.message}`);
    }
}

async function bulkApproveCurrentProject() {
    if (!VSA_STATE.activeDeploymentProjectId) {
        showToast("No active deployment selected.");
        return;
    }
    const candidates = VSA_STATE.activeProjectCandidates || [];
    const pendingCandidates = candidates.filter(e => e.status === 'Pending');
    if (pendingCandidates.length === 0) {
        showToast("No pending candidates awaiting approval.");
        return;
    }

    if (!confirm(`Bulk approve all ${pendingCandidates.length} pending candidate(s) to 'Active' status?`)) {
        return;
    }

    // Optimistically update all pending rows in 0ms
    pendingCandidates.forEach(c => {
        c.status = 'Active';
        const cid = c.id || c.employeeId;
        const row = document.querySelector(`tr[data-cand-id="${cid}"]`);
        if (row) {
            const statusCell = row.querySelector('.cand-status-cell');
            if (statusCell) {
                statusCell.innerHTML = '<span class="cand-status-pill" style="font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(16,185,129,0.15); color: #34d399; font-weight: 700;">Active</span>';
            }
        }
    });
    updateProjectCandidatesLiveBadges();
    showToast(`Bulk approved ${pendingCandidates.length} candidates to Active!`);

    try {
        await fetch(`/api/deployment-projects/${encodeURIComponent(VSA_STATE.activeDeploymentProjectId)}/bulk-approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        loadDeploymentsData();
    } catch (err) {
        console.error('Error during bulk approve:', err);
        showToast("Network error while bulk approving candidates.");
    }
}

async function bulkRejectCurrentProject() {
    if (!VSA_STATE.activeDeploymentProjectId) {
        showToast("No active deployment selected.");
        return;
    }
    const candidates = VSA_STATE.activeProjectCandidates || [];
    const pendingCandidates = candidates.filter(e => e.status === 'Pending');
    if (pendingCandidates.length === 0) {
        showToast("No pending candidates to reject.");
        return;
    }

    if (!confirm(`Bulk reject all ${pendingCandidates.length} pending candidate(s)?`)) {
        return;
    }

    const pendingIds = pendingCandidates.map(c => c.id || c.employeeId);
    pendingCandidates.forEach(c => {
        c.status = 'Rejected';
        const cid = c.id || c.employeeId;
        const row = document.querySelector(`tr[data-cand-id="${cid}"]`);
        if (row) {
            const statusCell = row.querySelector('.cand-status-cell');
            if (statusCell) {
                statusCell.innerHTML = '<span class="cand-status-pill" style="font-size: 11px; padding: 2px 8px; border-radius: 8px; background: rgba(239,68,68,0.15); color: #f87171; font-weight: 700;">Rejected</span>';
            }
        }
    });
    updateProjectCandidatesLiveBadges();
    showToast(`Bulk rejected ${pendingCandidates.length} candidate(s).`);

    try {
        await fetch('/api/employees/bulk-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeIds: pendingIds, status: 'Rejected' })
        });
        loadDeploymentsData();
    } catch (err) {
        console.error('Error during bulk reject:', err);
        showToast("Network error while bulk rejecting candidates.");
    }
}

async function bulkDeleteCurrentProjectCandidates() {
    if (!VSA_STATE.activeDeploymentProjectId) {
        showToast("No active deployment selected.");
        return;
    }
    const candidates = VSA_STATE.activeProjectCandidates || [];
    const targetCandidates = candidates.filter(e => e.status !== 'Active' && e.status !== 'Approved');
    if (targetCandidates.length === 0) {
        showToast("No rejected or inactive candidates to delete in this project.");
        return;
    }

    if (!confirm(`Permanently delete ${targetCandidates.length} rejected/inactive candidate record(s) from this deployment?`)) {
        return;
    }

    const targetIds = targetCandidates.map(c => c.id || c.employeeId);
    targetIds.forEach(id => {
        const row = document.querySelector(`tr[data-cand-id="${id}"]`);
        if (row) {
            row.classList.add('row-optimistic-deleted');
            setTimeout(() => row.remove(), 80);
        }
    });

    VSA_STATE.activeProjectCandidates = candidates.filter(c => !targetIds.includes(c.id || c.employeeId));
    VSA_STATE.employees = VSA_STATE.employees.filter(e => !targetIds.includes(e.id));
    updateProjectCandidatesLiveBadges();
    showToast(`Bulk deleted ${targetIds.length} candidate(s).`);

    try {
        await fetch('/api/employees/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeIds: targetIds })
        });
        loadDeploymentsData();
    } catch (err) {
        console.error('Error during candidate bulk delete:', err);
        showToast("Network error while deleting candidates.");
    }
}

// Function definitions & backwards-compatibility aliases
function approveIndividualCandidate(empId) {
    return quickUpdateCandidateStatus(empId, 'Active');
}
window.approveIndividualCandidate = approveIndividualCandidate;

function filterProjectCandidates(statusFilter = 'all') {
    const tbody = document.getElementById('project-candidates-tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr[data-cand-id]');
    const filter = String(statusFilter).toLowerCase();

    rows.forEach(row => {
        const statusCell = row.querySelector('.cand-status-cell');
        const statusText = (statusCell ? statusCell.textContent : '').toLowerCase().trim();
        if (filter === 'all') {
            row.style.display = '';
        } else if (filter === 'approved') {
            row.style.display = (statusText.includes('active') || statusText.includes('approved')) ? '' : 'none';
        } else if (filter === 'pending') {
            row.style.display = statusText.includes('pending') ? '' : 'none';
        } else if (filter === 'rejected') {
            row.style.display = (statusText.includes('rejected') || statusText.includes('suspended')) ? '' : 'none';
        }
    });

    const bTotal = document.getElementById('badge-cand-total');
    const bApp = document.getElementById('badge-cand-approved');
    const bPend = document.getElementById('badge-cand-pending');
    const bRej = document.getElementById('badge-cand-rejected');
    if (bTotal) bTotal.style.outline = filter === 'all' ? '2px solid #818cf8' : 'none';
    if (bApp) bApp.style.outline = filter === 'approved' ? '2px solid #34d399' : 'none';
    if (bPend) bPend.style.outline = filter === 'pending' ? '2px solid #f59e0b' : 'none';
    if (bRej) bRej.style.outline = filter === 'rejected' ? '2px solid #f87171' : 'none';
}
window.filterProjectCandidates = filterProjectCandidates;

async function exportProjectCandidatesRoster(projectId) {
    const targetProjectId = projectId || VSA_STATE.activeDeploymentProjectId;
    if (!targetProjectId) {
        showToast("No active deployment selected for export.");
        return;
    }

    const project = (VSA_STATE.deploymentProjects || []).find(p => p.id === targetProjectId) || { name: 'Deployment', slug: 'deployment' };
    const candidates = VSA_STATE.activeProjectCandidates || [];

    if (candidates.length === 0) {
        showToast("No candidates registered in this project to export.");
        return;
    }

    const sanitizeCsvCell = (val) => {
        let str = String(val === undefined || val === null ? '' : val).trim();
        if (/^[=+@\-\t\r|%]/.test(str)) {
            str = "'" + str;
        }
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            str = '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    };

    const headers = ['Staff ID', 'Name', 'Father/Guardian Name', 'Designation', 'Department', 'Mobile Number', 'Gender', 'Blood Group', 'Status', 'Registered Date'];
    const rows = [headers.join(',')];

    for (const cand of candidates) {
        const empId = cand.id || cand.employeeId || '';
        const name = cand.name || '';
        const fatherName = cand.fatherName || cand.father_name || '';
        const designation = cand.designation || project.designation || 'Security Guard';
        const department = cand.department || project.department || project.name || '';
        const mobile = cand.mobile || '';
        const gender = cand.gender || '';
        const blood = cand.bloodGroup || '';
        const status = cand.status || 'Pending';
        const regDate = cand.joiningDate || cand.createdAt || '';

        rows.push([
            sanitizeCsvCell(empId),
            sanitizeCsvCell(name),
            sanitizeCsvCell(fatherName),
            sanitizeCsvCell(designation),
            sanitizeCsvCell(department),
            sanitizeCsvCell(mobile),
            sanitizeCsvCell(gender),
            sanitizeCsvCell(blood),
            sanitizeCsvCell(status),
            sanitizeCsvCell(regDate)
        ].join(','));
    }

    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const safeSlug = (project.slug || project.name || 'deployment').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `roster_${safeSlug}_${new Date().toISOString().slice(0, 10)}.csv`;

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported roster with ${candidates.length} candidate(s) as CSV.`);
}
window.exportProjectCandidatesRoster = exportProjectCandidatesRoster;

async function batchPrintProjectCards(projectId) {
    const targetProjectId = projectId || VSA_STATE.activeDeploymentProjectId;
    if (!targetProjectId) {
        alert("Please select a deployment project first.");
        return;
    }

    let project = (VSA_STATE.deploymentProjects || []).find(p => p.id === targetProjectId);
    let candidates = (VSA_STATE.activeDeploymentProjectId === targetProjectId && VSA_STATE.activeProjectCandidates && VSA_STATE.activeProjectCandidates.length > 0)
        ? VSA_STATE.activeProjectCandidates
        : null;

    // If candidates not yet loaded in active state, fetch fresh from server
    if (!candidates) {
        try {
            const res = await fetch(`/api/deployment-projects/${encodeURIComponent(targetProjectId)}`);
            if (!res.ok) throw new Error("Server returned status " + res.status);
            const data = await res.json();
            project = project || data.project;
            candidates = data.employees || [];
            VSA_STATE.activeProjectCandidates = candidates;
            VSA_STATE.activeDeploymentProjectId = targetProjectId;
        } catch (err) {
            console.error("Error loading candidates for batch printing:", err);
            alert("Could not load project candidate data for batch ID card printing.");
            return;
        }
    }

    if (!candidates || candidates.length === 0) {
        alert(`No candidates registered for ${project ? project.name : 'this deployment'}.`);
        return;
    }

    // Filter for approved / active guards
    let approvedGuards = candidates.filter(e => e.status === 'Active' || e.status === 'Approved');
    if (approvedGuards.length === 0) {
        const proceedWithAll = confirm(
            `None of the ${candidates.length} candidate(s) in this project are marked 'Active' (Approved) yet.\n\nWould you like to batch print ID badges for all ${candidates.length} registered candidates anyway?`
        );
        if (!proceedWithAll) return;
        approvedGuards = [...candidates];
    }

    // Standardize and sync candidates into VSA_STATE.employees for ID Card Studio
    const ids = approvedGuards.map(c => c.id || c.employeeId);
    VSA_STATE.idSelectedEmployeeIds = ids;
    VSA_STATE.selectedEmployeeIds = ids;

    approvedGuards.forEach(cand => {
        const cid = cand.id || cand.employeeId;
        if (!cand.documents) cand.documents = {};
        if (cand.photo && !cand.documents.photo) cand.documents.photo = cand.photo;
        if (!cand.fatherName && cand.father_name) cand.fatherName = cand.father_name;

        const empRecord = {
            ...cand,
            id: cid,
            name: cand.name || 'Security Guard',
            fatherName: cand.fatherName || cand.father_name || '',
            designation: cand.designation || project?.designation || 'Security Guard',
            department: cand.department || project?.department || project?.name || 'Security'
        };

        const idx = VSA_STATE.employees.findIndex(e => e.id === cid);
        if (idx >= 0) {
            VSA_STATE.employees[idx] = { ...VSA_STATE.employees[idx], ...empRecord };
        } else {
            VSA_STATE.employees.push(empRecord);
        }
    });

    // Resolve template
    const selectedTemplateId = document.getElementById('id-select-template')?.value || document.getElementById('bulk-select-template')?.value;
    const template = (VSA_STATE.templates || []).find(t => t.id === selectedTemplateId) || (VSA_STATE.templates && VSA_STATE.templates[0]) || {
        id: 'tpl-standard',
        layout: 'vertical',
        font: "'Plus Jakarta Sans', sans-serif"
    };

    if (template.font && typeof ensureFontLoaded === 'function') {
        ensureFontLoaded(template.font);
    }

    const bulkContainer = document.getElementById('printable-id-bulk');
    if (!bulkContainer) {
        alert("Batch print container (#printable-id-bulk) not found in DOM.");
        return;
    }

    // Grid layout: 8 cards per A4 for horizontal (2x4), 9 cards per A4 for vertical (3x3)
    const isHorizontal = template.layout === 'horizontal';
    const cardsPerPage = isHorizontal ? 8 : 9;
    const gridClass = isHorizontal ? 'horizontal-grid' : 'vertical-grid';
    const validity = parseInt(document.getElementById('id-validity-years')?.value, 10) || 3;
    const issueDateVal = document.getElementById('id-card-issue-date')?.value || null;

    let bulkHtml = '';
    for (let i = 0; i < approvedGuards.length; i += cardsPerPage) {
        const pageCards = approvedGuards.slice(i, i + cardsPerPage);
        bulkHtml += `<div class="print-page ${gridClass}">`;
        pageCards.forEach(cand => {
            const cid = cand.id || cand.employeeId;
            const fullEmp = VSA_STATE.employees.find(e => e.id === cid) || cand;
            bulkHtml += `
                <div class="printable-id-card-wrapper">
                    ${generateIdCardHtml(fullEmp, template, fullEmp.cardValidity || validity, issueDateVal)}
                </div>
            `;
        });
        bulkHtml += `</div>`;
    }

    bulkContainer.innerHTML = bulkHtml;
    if (typeof renderQrsInContainer === 'function') {
        renderQrsInContainer(bulkContainer);
    }

    // Update ID Studio controls in background
    if (typeof populateIdEmployeeSelect === 'function') {
        try { populateIdEmployeeSelect(); } catch(e) {}
    }
    if (typeof populateIdEmployeeChecklist === 'function') {
        try { populateIdEmployeeChecklist(); } catch(e) {}
    }

    // Close candidates modal if open
    closeProjectCandidatesModal();

    // Activate print styles
    bulkContainer.classList.remove('hidden');
    document.body.classList.add('bulk-print-active');

    // Trigger print dialog after brief render delay for barcodes & portraits
    setTimeout(() => {
        window.print();
    }, 350);
}

// Global aliases & function definitions
function printProjectCards(projectId) {
    return batchPrintProjectCards(projectId);
}
window.batchPrintProjectCards = batchPrintProjectCards;
window.printProjectCards = batchPrintProjectCards;

let activeQrProject = null;

function openDeploymentQrModal(projectId) {
    const project = (VSA_STATE.deploymentProjects || []).find(p => p.id === projectId);
    if (!project) return;

    activeQrProject = project;
    const modal = document.getElementById('deployment-qr-modal');
    if (!modal) return;

    document.getElementById('qr-modal-project-name').textContent = project.name;
    document.getElementById('qr-modal-client-sub').textContent = `${project.clientName || 'General Tender'} ${project.location ? '• ' + project.location : ''}`;

    const fullUrl = `${window.location.origin}/register.html?project=${encodeURIComponent(project.slug)}`;
    document.getElementById('qr-modal-url-text').textContent = fullUrl;

    const canvas = document.getElementById('deployment-qr-canvas');
    if (canvas && window.QRious) {
        new window.QRious({
            element: canvas,
            value: fullUrl,
            size: 220,
            level: 'H'
        });
    }

    modal.classList.remove('hidden');
    if (window.lucide) window.lucide.createIcons();
}

function closeDeploymentQrModal() {
    const modal = document.getElementById('deployment-qr-modal');
    if (modal) modal.classList.add('hidden');
    activeQrProject = null;
}

function copyProjectLinkFromModal() {
    if (!activeQrProject) return;
    const fullUrl = `${window.location.origin}/register.html?project=${encodeURIComponent(activeQrProject.slug)}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
        alert("Onboarding link copied to clipboard!");
    }).catch(() => {
        prompt("Copy this onboarding link:", fullUrl);
    });
}

function shareProjectWhatsAppFromModal() {
    if (!activeQrProject) return;
    const fullUrl = `${window.location.origin}/register.html?project=${encodeURIComponent(activeQrProject.slug)}`;
    shareProjectWhatsApp(activeQrProject.name, fullUrl);
}

function copyProjectLink(encodedUrl) {
    const url = decodeURIComponent(encodedUrl);
    navigator.clipboard.writeText(url).then(() => {
        alert("Onboarding link copied to clipboard!");
    }).catch(() => {
        prompt("Copy onboarding link:", url);
    });
}

function shareProjectWhatsApp(projectName, inviteUrl) {
    const name = decodeURIComponent(projectName);
    const url = decodeURIComponent(inviteUrl);
    const message = `*VALLEY SECURITY SERVICES*\nOfficial Guard Onboarding Link for: *${name}*\n\nPlease complete your guard registration and upload portrait photo here:\n${url}\n\nThank you.`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
}

function downloadQrCodeImage() {
    const canvas = document.getElementById('deployment-qr-canvas');
    if (!canvas || !activeQrProject) return;
    const link = document.createElement('a');
    link.download = `${activeQrProject.slug}-onboarding-qr.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

async function deleteOrArchiveProject(projectId) {
    const project = (VSA_STATE.deploymentProjects || []).find(p => p.id === projectId);
    if (!project) return;

    if (!confirm(`Are you sure you want to remove or archive "${project.name}"? If guards have registered under this project, it will be safely archived to preserve their records.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/deployment-projects/${encodeURIComponent(projectId)}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) {
            alert(data.error || "Failed to remove project.");
            return;
        }
        alert(data.message || "Project updated.");
        loadDeploymentsData();
    } catch (err) {
        console.error('Error deleting project:', err);
        alert("Network error while removing project.");
    }
}



