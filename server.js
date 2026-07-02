const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const sharp = require('sharp');
const crypto = require('crypto');

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split(/\r?\n/).forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
      if (key && !key.startsWith('#')) {
        process.env[key] = value;
      }
    }
  });
}

// ---------------------------------------------------------------------------
// SECURITY: check environment variables – warn but use safe fallback if missing
// ---------------------------------------------------------------------------
function checkEnv(name, { minLength = 0, fallback = '' } = {}) {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    console.warn(`⚠️ WARNING: environment variable ${name} is missing. Using safe fallback.`);
    return fallback;
  }
  if (minLength && v.length < minLength) {
    console.warn(`⚠️ WARNING: ${name} is shorter than ${minLength} characters. Using safe fallback.`);
    return fallback;
  }
  return v;
}

const JWT_SECRET = checkEnv('JWT_SECRET', { minLength: 32, fallback: 'valley-security-secret-session-key-fallback-long-32-chars' });
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const BCRYPT_COST = parseInt(process.env.BCRYPT_COST || '12', 10);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_PATH = path.join(__dirname, 'db.json');
const PHOTOS_DB_PATH = path.join(__dirname, 'photos.json');

let pool = null;
const dbUrl = checkEnv('DATABASE_URL', { fallback: '' });
let usePostgres = dbUrl ? true : false;

if (usePostgres) {
  try {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: dbUrl,
      ssl: { rejectUnauthorized: false }
    });
    console.log('✅ PostgreSQL Connection Initialized');
  } catch (e) {
    console.error('❌ PostgreSQL Initialization Error:', e.message);
    usePostgres = false;
  }
}

// Flat-file local DB helper as fallback
function readLocalDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } else {
      const backupPath = path.join(__dirname, 'db.json.backup');
      if (fs.existsSync(backupPath)) {
        const data = fs.readFileSync(backupPath, 'utf8');
        return JSON.parse(data);
      }
    }
  } catch (e) {
    console.error('Error reading local JSON database:', e);
  }
  return { employees: [], clients: [], assetsCatalog: [], departments: [], designations: [], manpowerTypes: [], templates: [], users: [] };
}

function writeLocalDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local JSON database:', e);
  }
}

function readPhotosDb() {
  try {
    if (fs.existsSync(PHOTOS_DB_PATH)) {
      const data = fs.readFileSync(PHOTOS_DB_PATH, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Error reading local photos JSON database:', e);
  }
  return {};
}

function writePhotosDb(data) {
  try {
    fs.writeFileSync(PHOTOS_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local photos JSON database:', e);
  }
}

// Image Compression Helper via Sharp
async function compressImageBase64(base64Str, width, height, fit = 'cover') {
  if (!base64Str || !base64Str.startsWith('data:image/')) {
    return base64Str;
  }
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return base64Str;

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    // Compress to JPEG for photo or PNG for transparent sig
    let outputBuffer;
    let outputMime = 'image/jpeg';

    if (mimeType.includes('png') && fit === 'contain') {
      outputBuffer = await sharp(buffer)
        .resize(width, height, { fit })
        .png({ quality: 80 })
        .toBuffer();
      outputMime = 'image/png';
    } else {
      outputBuffer = await sharp(buffer)
        .resize(width, height, { fit })
        .jpeg({ quality: 80 })
        .toBuffer();
    }

    return `data:${outputMime};base64,${outputBuffer.toString('base64')}`;
  } catch (e) {
    console.error('Image compression failed, using original file:', e.message);
    return base64Str;
  }
}

const app = express();

// SECURITY: trust exactly 1 proxy hop (Render's edge / Cloudflare in front of us).
// Without this, express-rate-limit cannot read the real client IP from X-Forwarded-For
// and throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every /api/* request.
app.set('trust proxy', 1);

// SECURITY: disable framework fingerprint leak
app.disable('x-powered-by');

// SECURITY: HTTP security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy)
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      // Frontend loads: lucide (unpkg), jsbarcode (jsdelivr), qrious/html2canvas/jszip/cropperjs (cdnjs), Google GSI
      "script-src": [
        "'self'", "'unsafe-inline'", "'unsafe-eval'", "'wasm-unsafe-eval'",
        "https://cdnjs.cloudflare.com",
        "https://cdn.jsdelivr.net",
        "https://unpkg.com",
        "https://accounts.google.com"
      ],
      // The legacy vanilla-JS frontend uses inline onclick/onsubmit/onload handlers throughout.
      // Without this, every button in the dashboard stops working.
      "script-src-attr": ["'unsafe-inline'"],
      "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
      "img-src": ["'self'", "data:", "blob:", "https:"],
      "connect-src": ["'self'", "https://accounts.google.com", "https://oauth2.googleapis.com"],
      "frame-src": ["'self'", "https://accounts.google.com"],
      "worker-src": ["'self'", "blob:"],
      "form-action": ["'self'"],
      "frame-ancestors": ["'none'"],
      "object-src": ["'none'"],
      "base-uri": ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Google Sign-In needs to open its own popup/iframe – relax COOP from default
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  frameguard: { action: "deny" },
  hsts: NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false
}));

// SECURITY: explicit CORS allowlist (no wildcard in production)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow same-origin requests (no Origin header from server-to-server / curl / mobile apps)
    if (!origin) return callback(null, true);
    
    try {
      const originUrl = new URL(origin);
      const hostname = originUrl.hostname;
      
      // Always allow the site's own hostnames and subdomains (same-origin & production domains)
      if (
        hostname === 'valleysecurityserviceagency.in' ||
        hostname === 'www.valleysecurityserviceagency.in' ||
        hostname.endsWith('.onrender.com') ||
        hostname === 'localhost' ||
        hostname === '127.0.0.1'
      ) {
        return callback(null, true);
      }
    } catch (urlErr) {
      // If the origin is not a valid URL, ignore URL parsing error
    }

    if (allowedOrigins.includes(origin)) return callback(null, true);
    
    // Instead of throwing an Error (which crashes the request with a 500 Internal Server Error),
    // return false as standard CORS behavior to block the browser's access gracefully.
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// SECURITY: rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,   // 15 minutes
  max: 5,                     // 5 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts. Try again in 15 minutes.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 60,                    // 60 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Rate limit exceeded. Please slow down.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,   // 1 hour
  max: 10,                    // 10 submissions per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts. Please try again in an hour.' }
});

// Apply general API limiter to every /api/* route
app.use('/api/', apiLimiter);


// --------------------------------------------------------------------------
// KILL SWITCH — Site Enable/Disable State
// --------------------------------------------------------------------------
const KILL_SWITCH_KEY = checkEnv('KILL_SWITCH_KEY', { fallback: 'VSA-SALIM-MASTER-2024' });
let _siteEnabled = true; // in-memory flag (loaded from DB on startup)

async function loadSiteEnabledFromDb() {
  if (!usePostgres || !pool) return;
  try {
    const res = await pool.query('SELECT "value" FROM settings WHERE key = \'site_enabled\'');
    if (res.rows.length > 0) {
      _siteEnabled = res.rows[0].value === true || res.rows[0].value === 'true';
    } else {
      await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['site_enabled', JSON.stringify(true)]);
      _siteEnabled = true;
    }
    console.log(`🔌 Kill Switch loaded — Site is ${_siteEnabled ? '✅ ENABLED' : '🔴 DISABLED'}`);
  } catch (e) {
    console.warn('⚠️ Could not load kill switch state from DB:', e.message);
  }
}

async function setSiteEnabled(value) {
  _siteEnabled = value;
  if (usePostgres && pool) {
    try {
      await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['site_enabled', JSON.stringify(value)]);
    } catch (e) {
      console.warn('⚠️ Could not persist kill switch state to DB:', e.message);
    }
  }
}

// Kill switch control page — secret URL only Salim knows
app.get('/kill-switch', async (req, res) => {
  const userKey = req.query.key;
  if (userKey !== KILL_SWITCH_KEY) {
    const errorHtml = userKey ? '<div style="color:#ef4444; margin-bottom:20px; font-size:14px; font-weight:600;">⚠️ Invalid Master Key. Please try again.</div>' : '';
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VSA Access Portal</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      font-family:'Outfit',sans-serif;
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:linear-gradient(135deg,#0c0f17,#1e2536);
      color:#fff;
    }
    .card{
      padding:40px;
      background:rgba(255,255,255,0.03);
      border:1px solid rgba(255,255,255,0.08);
      border-radius:24px;
      max-width:380px;
      width:92%;
      backdrop-filter:blur(20px);
      box-shadow:0 24px 80px rgba(0,0,0,0.6);
      text-align:center;
    }
    .shield-icon{
      font-size:48px;
      margin-bottom:20px;
      display:inline-block;
    }
    h1{font-size:24px;font-weight:800;margin-bottom:8px;letter-spacing:-0.5px;}
    p{font-size:14px;color:rgba(255,255,255,0.5);margin-bottom:30px;line-height:1.4;}
    .input-group{margin-bottom:20px;text-align:left;}
    label{display:block;font-size:11px;font-weight:700;color:#c8102e;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;}
    input{
      width:100%;
      padding:14px 18px;
      background:rgba(0,0,0,0.3);
      border:1px solid rgba(255,255,255,0.1);
      border-radius:12px;
      color:#fff;
      font-size:15px;
      font-family:'Outfit',sans-serif;
      transition:all 0.25s ease;
    }
    input:focus{
      outline:none;
      border-color:#c8102e;
      box-shadow:0 0 0 3px rgba(200,16,46,0.25);
    }
    .btn{
      display:block;
      width:100%;
      padding:15px;
      background:linear-gradient(135deg,#c8102e,#980c22);
      border:none;
      border-radius:12px;
      font-size:16px;
      font-weight:700;
      color:#fff;
      cursor:pointer;
      font-family:'Outfit',sans-serif;
      box-shadow:0 6px 20px rgba(200,16,46,0.3);
      transition:transform 0.15s, box-shadow 0.15s;
    }
    .btn:active{transform:scale(0.98);}
    .btn:hover{box-shadow:0 10px 25px rgba(200,16,46,0.45);}
    .footer{margin-top:30px;font-size:10px;color:rgba(255,255,255,0.2);letter-spacing:1.5px;text-transform:uppercase;}
  </style>
</head>
<body>
  <div class="card">
    <div class="shield-icon">🛡️</div>
    <h1>Secure Admin Portal</h1>
    <p>Please enter the Master Key to access the Valley Security Agency Site Control Panel.</p>
    
    ${errorHtml}
    
    <form method="GET" action="/kill-switch">
      <div class="input-group">
        <label for="master-key">Master Key</label>
        <input type="password" id="master-key" name="key" placeholder="Enter key" required autocomplete="off">
      </div>
      <button class="btn" type="submit">Verify Access</button>
    </form>
    
    <div class="footer">Salim Ilyas Bhat — Admin Only</div>
  </div>
</body>
</html>`);
  }
  const isOn = _siteEnabled;
  const bg = isOn ? 'linear-gradient(135deg,#071a0f,#0d3320)' : 'linear-gradient(135deg,#1a0505,#3a0a0a)';
  const dotColor = isOn ? '#22c55e' : '#ef4444';
  const dotGlow = isOn ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)';
  const stateText = isOn ? 'LIVE' : 'OFFLINE';

  // Calculate database size info dynamically
  let dbSizeInfo = { used: '0 MB', free: '512 MB', total: '512 MB', percentage: 1 };
  if (usePostgres && pool) {
    try {
      const sizeRes = await pool.query("SELECT pg_database_size('neondb') AS bytes");
      if (sizeRes.rows.length > 0) {
        const bytes = parseInt(sizeRes.rows[0].bytes);
        const limitBytes = 512 * 1024 * 1024; // 512 MB
        const usedMB = (bytes / (1024 * 1024)).toFixed(1);
        const freeMB = Math.max(0, (limitBytes - bytes) / (1024 * 1024)).toFixed(1);
        const percentage = Math.min(100, Math.max(1, Math.round((bytes / limitBytes) * 100)));
        dbSizeInfo = {
          used: `${usedMB} MB`,
          free: `${freeMB} MB`,
          total: '512 MB',
          percentage
        };
      }
    } catch (e) {
      console.error('Error fetching db size in kill switch:', e.message);
    }
  } else {
    try {
      if (fs.existsSync(DB_PATH)) {
        const stats = fs.statSync(DB_PATH);
        const bytes = stats.size;
        const limitBytes = 50 * 1024 * 1024; // 50MB local
        const usedMB = (bytes / (1024 * 1024)).toFixed(2);
        const freeMB = Math.max(0, (limitBytes - bytes) / (1024 * 1024)).toFixed(2);
        const percentage = Math.min(100, Math.max(1, Math.round((bytes / limitBytes) * 100)));
        dbSizeInfo = {
          used: `${usedMB} MB`,
          free: `${freeMB} MB`,
          total: '50 MB',
          percentage
        };
      }
    } catch (e) {}
  }

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VSA Control Panel</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{
      font-family:'Outfit',sans-serif;
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:${bg};
      color:#fff;
    }
    .card{
      text-align:center;
      padding:48px 36px 40px;
      background:rgba(255,255,255,0.05);
      border:1px solid rgba(255,255,255,0.1);
      border-radius:32px;
      max-width:360px;
      width:92%;
      backdrop-filter:blur(16px);
      box-shadow:0 24px 80px rgba(0,0,0,0.5);
    }
    .dot{
      width:88px;height:88px;
      border-radius:50%;
      margin:0 auto 22px;
      display:flex;align-items:center;justify-content:center;
      font-size:40px;
      background:rgba(255,255,255,0.05);
      border:3px solid ${dotColor};
      box-shadow:0 0 36px ${dotGlow},0 0 60px ${dotGlow};
    }
    .site-name{font-size:13px;color:rgba(255,255,255,0.4);letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;}
    h1{font-size:22px;font-weight:900;margin-bottom:6px;letter-spacing:-0.5px;}
    .state{
      display:inline-block;
      margin-bottom:32px;
      padding:5px 18px;
      border-radius:50px;
      font-size:13px;
      font-weight:700;
      letter-spacing:2px;
      text-transform:uppercase;
      background:${isOn ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};
      color:${dotColor};
      border:1px solid ${isOn ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'};
    }
    .btn{
      display:block;
      width:100%;
      padding:17px;
      border:none;
      border-radius:14px;
      font-size:17px;
      font-weight:800;
      font-family:'Outfit',sans-serif;
      cursor:pointer;
      transition:transform 0.15s,box-shadow 0.15s;
      color:#fff;
      letter-spacing:0.3px;
      margin-top:12px;
    }
    .btn:active{transform:scale(0.97);}
    .btn-kill{
      background:linear-gradient(135deg,#dc2626,#b91c1c);
      box-shadow:0 8px 24px rgba(220,38,38,0.4);
    }
    .btn-kill:hover{box-shadow:0 12px 32px rgba(220,38,38,0.6);}
    .btn-live{
      background:linear-gradient(135deg,#16a34a,#15803d);
      box-shadow:0 8px 24px rgba(22,163,74,0.4);
    }
    .btn-live:hover{box-shadow:0 12px 32px rgba(22,163,74,0.6);}
    .confirm-txt{
      font-size:12px;
      color:rgba(255,255,255,0.3);
      margin-top:10px;
    }
    .owner{margin-top:28px;font-size:11px;color:rgba(255,255,255,0.2);letter-spacing:1.5px;text-transform:uppercase;}
  </style>
</head>
<body>
  <div class="card">
    <div class="dot">${isOn ? '🟢' : '🔴'}</div>
    <div class="site-name">Valley Security Agency</div>
    <h1>Site Control Panel</h1>
    <div class="state">● ${stateText}</div>
    ${isOn ? `
    <form method="POST" action="/kill-switch/set?key=${KILL_SWITCH_KEY}&enable=false">
      <button class="btn btn-kill" type="submit" onclick="return confirm('Are you sure? This will take the site OFFLINE for everyone.')">🔴&nbsp;&nbsp;Kill Site Now</button>
    </form>
    <div class="confirm-txt">Tap to take the entire site offline</div>
    ` : `
    <form method="POST" action="/kill-switch/set?key=${KILL_SWITCH_KEY}&enable=true">
      <button class="btn btn-live" type="submit">🟢&nbsp;&nbsp;Bring Site Online</button>
    </form>
    <div class="confirm-txt">Tap to restore the site for everyone</div>
    `}
    
    <!-- Dynamic Storage Status Bar (Mobile Phone style) -->
    <div class="storage-card" style="margin-top: 28px; padding: 20px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; text-align: left;">
      <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
        <span>Database Storage</span>
        <span>${dbSizeInfo.percentage}% Used</span>
      </div>
      <div style="width: 100%; height: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; overflow: hidden; margin-bottom: 12px; position: relative;">
        <div style="width: ${dbSizeInfo.percentage}%; height: 100%; background: linear-gradient(90deg, #c8102e, #ff4d6d); border-radius: 5px; box-shadow: 0 0 10px rgba(200, 16, 46, 0.5);"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 600;">
        <div>
          <span style="color: #fff;">${dbSizeInfo.used}</span>
          <span style="color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 500;">used</span>
        </div>
        <div style="text-align: right;">
          <span style="color: #fff;">${dbSizeInfo.free}</span>
          <span style="color: rgba(255,255,255,0.4); font-size: 11px; font-weight: 500;">free of ${dbSizeInfo.total}</span>
        </div>
      </div>
    </div>

    <div class="owner">Salim Ilyas Bhat — Admin Only</div>
  </div>
</body>
</html>`);
});

// Kill switch SET action — POST with explicit enable=true or enable=false
// Uses explicit value so double-tapping never causes confusion
app.post('/kill-switch/set', async (req, res) => {
  if (req.query.key !== KILL_SWITCH_KEY) {
    return req.socket.destroy();
  }
  const enableValue = req.query.enable === 'true';
  await setSiteEnabled(enableValue);
  console.log(`🔌 Kill Switch SET — Site is now ${_siteEnabled ? '✅ ENABLED' : '🔴 DISABLED'}`);
  res.redirect(`/kill-switch?key=${KILL_SWITCH_KEY}`);
});

// Legacy toggle route (kept for backward compat but now redirects to SET)
app.post('/kill-switch/toggle', async (req, res) => {
  if (req.query.key !== KILL_SWITCH_KEY) {
    return req.socket.destroy();
  }
  await setSiteEnabled(!_siteEnabled);
  res.redirect(`/kill-switch?key=${KILL_SWITCH_KEY}`);
});

// Kill switch middleware — destroy connection for ALL traffic when site is disabled
// (makes it look like ERR_CONNECTION_RESET in Chrome — a real dead site)
function killSwitchMiddleware(req, res, next) {
  // Always let through: the secret kill switch control page & its toggle
  if (req.path === '/kill-switch' || req.path === '/kill-switch/toggle' || req.path === '/kill-switch/set') {
    return next();
  }
  // Site is disabled — forcibly close TCP connection with no response
  // Browser shows native ERR_CONNECTION_RESET (looks like site is truly offline)
  if (!_siteEnabled) {
    return req.socket.destroy();
  }
  next();
}

app.use(killSwitchMiddleware);

// --------------------------------------------------------------------------
// AUTHENTICATION MIDDLEWARE
// --------------------------------------------------------------------------
function authenticateToken(req, res, next) {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Session expired or missing' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid session' });
  }
}

// Redirect middleware for static HTML pages
function protectHtmlPages(req, res, next) {
  // Bypass protection for API routes (they have their own JSON auth checks)
  if (req.path.startsWith('/api')) {
    return next();
  }

  const publicPages = ['/login.html', '/register.html', '/verification.html', '/styles.css', '/NEW_MASTER_STYLES.css', '/developer.jpg', '/favicon.png'];
  const isGoogleVerification = req.path.match(/^\/google[a-f0-9]+\.html$/);
  
  if (publicPages.some(page => req.path.endsWith(page)) || isGoogleVerification) {
    return next();
  }

  const token = req.cookies.auth_token;
  if (!token) {
    return res.redirect('/');
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    return res.redirect('/');
  }
}

app.get('/login', (req, res) => {
  res.redirect('/');
});

// Serve protected dashboard index page with disabled cache headers
const noCacheOptions = {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
};

app.get('/', (req, res) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.sendFile(path.join(__dirname, 'public', 'login.html'), noCacheOptions);
  }

  try {
    jwt.verify(token, JWT_SECRET);
    res.sendFile(path.join(__dirname, 'public', 'index.html'), noCacheOptions);
  } catch (err) {
    res.clearCookie('auth_token');
    res.sendFile(path.join(__dirname, 'public', 'login.html'), noCacheOptions);
  }
});

app.get('/index.html', protectHtmlPages, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), noCacheOptions);
});

// Serve public login and other static assets with absolute no-cache headers
app.use(protectHtmlPages);
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0,
  setHeaders: function (res, path) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}));

// --------------------------------------------------------------------------
// IMAGE SEPARATION & STORAGE MIGRATION
// --------------------------------------------------------------------------
async function runImageMigration() {
  console.log('🔄 Running image separation & storage migration check...');
  let migratedCount = 0;

  try {
    if (usePostgres && pool) {
      // Ensure employee_photos table exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS employee_photos (
          employee_id TEXT PRIMARY KEY,
          photo TEXT,
          signature TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Fetch employee IDs
      const res = await pool.query('SELECT id FROM employees ORDER BY id ASC');
      for (const row of res.rows) {
        const empRes = await pool.query('SELECT data FROM employees WHERE id = $1', [row.id]);
        if (empRes.rows.length === 0) continue;

        let emp = typeof empRes.rows[0].data === 'string' ? JSON.parse(empRes.rows[0].data) : empRes.rows[0].data;
        let modified = false;
        let photoBase64 = null;
        let signatureBase64 = null;

        if (emp.documents) {
          if (emp.documents.photo && emp.documents.photo.startsWith('data:image/')) {
            photoBase64 = emp.documents.photo;
            emp.documents.photo = `/api/employees/${row.id}/photo`;
            modified = true;
          }
          if (emp.documents.signature && emp.documents.signature.startsWith('data:image/')) {
            signatureBase64 = emp.documents.signature;
            emp.documents.signature = `/api/employees/${row.id}/signature`;
            modified = true;
          }
        }

        if (modified) {
          // Save base64 strings to employee_photos
          await pool.query(`
            INSERT INTO employee_photos (employee_id, photo, signature)
            VALUES ($1, $2, $3)
            ON CONFLICT (employee_id) DO UPDATE SET
              photo = COALESCE(EXCLUDED.photo, employee_photos.photo),
              signature = COALESCE(EXCLUDED.signature, employee_photos.signature),
              updated_at = NOW()
          `, [row.id, photoBase64, signatureBase64]);

          // Update main employees table
          await pool.query('UPDATE employees SET data = $2, updated_at = NOW() WHERE id = $1', [row.id, JSON.stringify(emp)]);
          migratedCount++;
        }
      }
    } else {
      // Local fallback migration
      const db = readLocalDb();
      const photosDb = readPhotosDb();
      let modified = false;

      for (const emp of db.employees) {
        let empModified = false;
        let photoBase64 = null;
        let signatureBase64 = null;

        if (emp.documents) {
          if (emp.documents.photo && emp.documents.photo.startsWith('data:image/')) {
            photoBase64 = emp.documents.photo;
            emp.documents.photo = `/api/employees/${emp.id}/photo`;
            empModified = true;
            modified = true;
          }
          if (emp.documents.signature && emp.documents.signature.startsWith('data:image/')) {
            signatureBase64 = emp.documents.signature;
            emp.documents.signature = `/api/employees/${emp.id}/signature`;
            empModified = true;
            modified = true;
          }
        }

        if (empModified) {
          if (!photosDb[emp.id]) photosDb[emp.id] = {};
          if (photoBase64) photosDb[emp.id].photo = photoBase64;
          if (signatureBase64) photosDb[emp.id].signature = signatureBase64;
          migratedCount++;
        }
      }

      if (modified) {
        writePhotosDb(photosDb);
        writeLocalDb(db);
      }
    }
    console.log(`✅ Image separation migration complete. Migrated ${migratedCount} records.`);
  } catch (err) {
    console.error('❌ Image separation migration failed:', err.message);
  }
}

// --------------------------------------------------------------------------
// POSTGRESQL TABLE INIT & AUTO-MIGRATION
// --------------------------------------------------------------------------
async function initDatabase() {
  if (!usePostgres || !pool) return;
  try {
    // Test if the connection works (database might be offline or incorrect credentials)
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL Connection Verified Online');
  } catch (err) {
    console.warn('⚠️ PostgreSQL is offline/unreachable. Falling back to local db.json database.');
    console.warn(`Reason: ${err.message}`);
    usePostgres = false;
    return;
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_photos (
        employee_id TEXT PRIMARY KEY,
        photo TEXT,
        signature TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS server_errors (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        message TEXT,
        stack TEXT
      )
    `);

    // Persist actual kill switch key for verification/diagnostics
    await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['actual_kill_switch_key', JSON.stringify(KILL_SWITCH_KEY)]);

    console.log('✅ PostgreSQL Database Tables Verified/Initialized');

    // 🔑 Secure Password Synchronization (Always from the git-tracked db.json.backup)
    const backupPath = path.join(__dirname, 'db.json.backup');
    if (fs.existsSync(backupPath)) {
      try {
        const backupDb = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        const backupAdmin = backupDb.users.find(u => u.email === 'vllscrtservice@gmail.com');
        if (backupAdmin) {
          // Sync to PostgreSQL
          const hash = await bcrypt.hash(backupAdmin.password, BCRYPT_COST);
          const updateRes = await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'vllscrtservice@gmail.com']);
          console.log(`✅ PostgreSQL admin user password synchronized from backup (${updateRes.rowCount} rows updated)`);

          // Sync to local db.json if it exists (stale cleanup on persistent volume)
          if (fs.existsSync(DB_PATH)) {
            const localDb = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
            const localAdmin = localDb.users.find(u => u.email === 'vllscrtservice@gmail.com');
            if (localAdmin && localAdmin.password !== backupAdmin.password) {
              localAdmin.password = backupAdmin.password;
              fs.writeFileSync(DB_PATH, JSON.stringify(localDb, null, 2), 'utf8');
              console.log('✅ Local db.json admin password updated to match backup');
            }
          }
        }
      } catch (err) {
        console.error('❌ Failed to synchronize passwords on startup:', err.message);
      }
    }

    // Check if initial seeding has already been performed in the past
    const seedCheck = await pool.query('SELECT "value" FROM settings WHERE key = \'initial_seeding_done\'');
    if (seedCheck.rows.length > 0 && (seedCheck.rows[0].value === true || seedCheck.rows[0].value === 'true')) {
      console.log('✅ Database already seeded. Skipping initial migration seeding.');
      return;
    }

    console.log('🔄 Seeding database for the first time...');
    const localDb = readLocalDb();

    // 1. Seed settings classifications
    const settingsCheck = await pool.query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCheck.rows[0].count, 10) === 0) {
      console.log('🔄 Seeding settings classifications...');
      if (localDb.departments) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['departments', JSON.stringify(localDb.departments)]);
      if (localDb.designations) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['designations', JSON.stringify(localDb.designations)]);
      if (localDb.manpowerTypes) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['manpowerTypes', JSON.stringify(localDb.manpowerTypes)]);
    }

    // 2. Seed users
    const userCheck = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      console.log('🔄 Seeding admin users...');
      for (const u of (localDb.users || [])) {
        let hash = u.password;
        if (!hash.startsWith('$2')) {
          hash = await bcrypt.hash(u.password, BCRYPT_COST);
        }
        await pool.query('INSERT INTO users (email, password, data) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
          u.email,
          hash,
          JSON.stringify({ name: u.name, role: u.role, createdAt: u.createdAt })
        ]);
      }
    }

    // 3. Seed templates
    console.log('🔄 Seeding badge templates...');
    for (const t of (localDb.templates || [])) {
      await pool.query('INSERT INTO templates (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [t.id, JSON.stringify(t)]);
    }

    // Seed NIFT template if not present
    const niftCheck = await pool.query("SELECT id FROM templates WHERE id = 'tpl-nift'");
    if (niftCheck.rows.length === 0) {
      console.log('🔄 Seeding NIFT Srinagar badge template...');
      const defaultTplRes = await pool.query("SELECT data FROM templates WHERE id = 'tpl-default'");
      let defaultLogo = 'preset-vsa-logo';
      let defaultSig = 'preset-vsa-sig';
      if (defaultTplRes.rows.length > 0) {
        const defaultData = typeof defaultTplRes.rows[0].data === 'string' 
          ? JSON.parse(defaultTplRes.rows[0].data) 
          : defaultTplRes.rows[0].data;
        defaultLogo = defaultData.logo || defaultLogo;
        defaultSig = defaultData.signature || defaultSig;
      }
      const niftTemplate = {
        id: 'tpl-nift',
        name: 'NIFT Srinagar Template',
        layout: 'vertical',
        font: "'Outfit', sans-serif",
        backgroundColor: '#ffffff',
        headerBgColor: '#0c2340', // Navy blue
        accentColor: '#dfba5f',   // Gold
        headerText: 'VALLEY SECURITY AGENCY',
        subheaderText: 'NIFT SRINAGAR CAMPUS',
        logoSize: 50,
        headerHeight: 90,
        headerFontSize: 14,
        photoWidth: 85,
        photoHeight: 105,
        qrSize: 70,
        detailsFontSize: 8,
        backgroundImage: '',
        logo: defaultLogo,
        signature: defaultSig,
        fields: {
          photo: true,
          name: false,
          designation: false,
          department: false,
          empid: false,
          father: false,
          phone: false,
          email: false,
          blood: false,
          address: false,
          signature: true,
          qrcode: true,
          barcode: true,
          validity: false
        },
        isVisualTemplate: true
      };
      await pool.query('INSERT INTO templates (id, data) VALUES ($1, $2)', ['tpl-nift', JSON.stringify(niftTemplate)]);
    }

    // Auto-compress default logo/signature in existing templates table if they exist
    try {
      const templatesRes = await pool.query('SELECT id, data FROM templates');
      for (const row of templatesRes.rows) {
        const t = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        let modified = false;
        if (t.logo && t.logo.length > 500000) {
          const backupTpl = (localDb.templates || []).find(bt => bt.id === row.id || bt.name === t.name);
          if (backupTpl && backupTpl.logo && backupTpl.logo.length < 50000) {
            console.log(`⚡️ Compressing massive logo in PostgreSQL template "${t.name}"`);
            t.logo = backupTpl.logo;
            modified = true;
          }
        }
        if (t.signature && t.signature.length > 200000) {
          const backupTpl = (localDb.templates || []).find(bt => bt.id === row.id || bt.name === t.name);
          if (backupTpl && backupTpl.signature && backupTpl.signature.length < 50000) {
            console.log(`⚡️ Compressing massive signature in PostgreSQL template "${t.name}"`);
            t.signature = backupTpl.signature;
            modified = true;
          }
        }
        if (modified) {
          await pool.query('UPDATE templates SET data = $1 WHERE id = $2', [JSON.stringify(t), row.id]);
        }
      }
    } catch (err) {
      console.warn('⚠️ Could not auto-compress PostgreSQL templates:', err.message);
    }

    // 4. Seed clients
    const clientsCheck = await pool.query('SELECT COUNT(*) FROM clients');
    if (parseInt(clientsCheck.rows[0].count, 10) === 0) {
      console.log('🔄 Seeding clients...');
      for (const c of (localDb.clients || [])) {
        await pool.query('INSERT INTO clients (name, data) VALUES ($1, $2) ON CONFLICT DO NOTHING', [c.name, JSON.stringify(c)]);
      }
    }

    // 5. Seed employees
    const employeesCheck = await pool.query('SELECT COUNT(*) FROM employees');
    if (parseInt(employeesCheck.rows[0].count, 10) === 0) {
      console.log('🔄 Seeding employees...');
      for (const emp of (localDb.employees || [])) {
        await pool.query('INSERT INTO employees (id, data) VALUES ($1, $2) ON CONFLICT DO NOTHING', [emp.id, JSON.stringify(emp)]);
      }
    }

    // Clean up target phone number in templates, settings, and employees in PostgreSQL
    await pool.query("UPDATE templates SET data = REPLACE(data::text, '6006495505', '7889311608')::jsonb");
    await pool.query("UPDATE employees SET data = REPLACE(data::text, '6006495505', '7889311608')::jsonb");
    await pool.query('UPDATE settings SET "value" = REPLACE("value"::text, \'6006495505\', \'7889311608\')::jsonb');
    console.log('✅ PostgreSQL database records cleaned (phone number updated)');

    // Mark initial seeding as completed
    await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['initial_seeding_done', JSON.stringify(true)]);
    console.log('✅ Initial database seeding marked completed.');
  } catch (err) {
    console.error('❌ PostgreSQL Initialization Error:', err.message);
  }
}

// --------------------------------------------------------------------------
// API ENDPOINTS
// --------------------------------------------------------------------------

// (Kill switch endpoints are handled above via /kill-switch secret URL)

// 1. Authentication Route (Public)
// 1. Authentication Route (Public) – with strict rate limit, input validation, lockout
const loginAttempts = new Map(); // email -> { count, lockedUntil }
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

function isLockedOut(email) {
  const rec = loginAttempts.get(email);
  if (!rec) return false;
  if (rec.lockedUntil && rec.lockedUntil > Date.now()) return true;
  if (rec.lockedUntil && rec.lockedUntil <= Date.now()) {
    loginAttempts.delete(email);
    return false;
  }
  return false;
}

function recordFailedAttempt(email) {
  const rec = loginAttempts.get(email) || { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= MAX_FAILED_ATTEMPTS) {
    rec.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(email, rec);
}

function clearFailedAttempts(email) {
  loginAttempts.delete(email);
}

app.get('/api/public/classifications', async (req, res) => {
  try {
    if (usePostgres && pool) {
      const [depts, desigs, manpower] = await Promise.all([
        pool.query('SELECT "value" FROM settings WHERE key = \'departments\''),
        pool.query('SELECT "value" FROM settings WHERE key = \'designations\''),
        pool.query('SELECT "value" FROM settings WHERE key = \'manpowerTypes\'')
      ]);
      
      return res.json({
        departments: depts.rows.length > 0 ? depts.rows[0].value : [],
        designations: desigs.rows.length > 0 ? desigs.rows[0].value : [],
        manpowerTypes: manpower.rows.length > 0 ? manpower.rows[0].value : []
      });
    } else {
      const db = readLocalDb();
      return res.json({
        departments: db.departments || [],
        designations: db.designations || [],
        manpowerTypes: db.manpowerTypes || []
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to load classifications.' });
  }
});

app.post('/api/public/register', registerLimiter, async (req, res) => {
  const { name, mobile, guardianName, relationType, dob, bloodGroup, department, designation, gender, currentAddress, photoBase64 } = req.body;
  
  if (!name || !mobile || !photoBase64 || !designation || !department) {
    return res.status(400).json({ error: 'Name, Mobile, Photo, Designation, and Department are required.' });
  }

  try {
    const db = readLocalDb();

    // Check for duplicate registrations by mobile number (last 10 digits)
    const cleanMobile = String(mobile).replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }
    const lastTen = cleanMobile.slice(-10);

    if (usePostgres && pool) {
      const dupRes = await pool.query(
        "SELECT id FROM employees WHERE right(regexp_replace(data->>'mobile', '[^0-9]', '', 'g'), 10) = $1 AND (data->>'status') <> 'Rejected'",
        [lastTen]
      );
      if (dupRes.rows.length > 0) {
        return res.status(400).json({ error: 'An employee with this mobile number has already registered or is pending approval.' });
      }
    } else {
      const dupLocal = db.employees.some(
        e => {
          const m = String(e.mobile).replace(/\D/g, '');
          return m.length >= 10 && m.slice(-10) === lastTen && e.status !== 'Rejected';
        }
      );
      if (dupLocal) {
        return res.status(400).json({ error: 'An employee with this mobile number has already registered or is pending approval.' });
      }
    }

    
    // Auto calculate ID (VSA-XXXX)
    let nextNum = 1001;
    let allIds = [];

    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT id FROM employees');
      allIds = dbRes.rows.map(r => parseInt(r.id.replace('VSA-', ''))).filter(n => !isNaN(n));
    } else {
      allIds = db.employees.map(e => parseInt(e.id.replace('VSA-', ''))).filter(n => !isNaN(n));
    }

    if (allIds.length > 0) {
      nextNum = Math.max(...allIds) + 1;
    }
    
    const empId = `VSA-${nextNum}`;
    const secureToken = crypto.randomBytes(16).toString('hex');

    // Server-Side Compression of Profile Photo
    let compressedPhoto = null;
    if (photoBase64.startsWith('data:image/')) {
      compressedPhoto = await compressImageBase64(photoBase64, 300, null);
    } else {
      return res.status(400).json({ error: 'Invalid photo format.' });
    }

    // Input sanitization against Stored XSS
    const sanitizeHtml = (str) => {
      if (typeof str !== 'string') return str;
      return str.replace(/<[^>]*>/g, '').trim();
    };

    const sanitizedName = sanitizeHtml(name);
    const sanitizedGuardian = sanitizeHtml(guardianName);
    const sanitizedAddress = sanitizeHtml(currentAddress);

    const empData = {
      id: empId,
      name: sanitizedName,
      mobile,
      guardianName: sanitizedGuardian,
      relationType,
      dob,
      bloodGroup,
      department,
      designation,
      gender,
      currentAddress: sanitizedAddress,
      permanentAddress: sanitizedAddress,
      status: 'Pending',
      joiningDate: new Date().toISOString().substring(0, 10),
      cardValidity: 3,
      secureToken,
      documents: {
        aadhaar: "Pending Verification",
        policeVerification: "Pending Verification",
        pan: "Pending Verification",
        photo: `/api/employees/${empId}/photo`,
        signature: ""
      }
    };

    if (usePostgres && pool) {
      await pool.query('INSERT INTO employee_photos (employee_id, photo, signature) VALUES ($1, $2, $3)', [empId, compressedPhoto, ""]);
      await pool.query('INSERT INTO employees (id, data) VALUES ($1, $2)', [empId, JSON.stringify(empData)]);
    } else {
      const photosDb = readPhotosDb();
      photosDb[empId] = { photo: compressedPhoto, signature: "" };
      writePhotosDb(photosDb);

      db.employees.push(empData);
      writeLocalDb(db);
    }

    return res.json({ success: true, employeeId: empId });
  } catch (err) {
    console.error("Self-registration error:", err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

app.post('/api/login', authLimiter, async (req, res) => {
  const { email, password } = req.body || {};

  // Server-side input validation
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }
  const emailTrim = email.trim().toLowerCase();
  if (emailTrim.length === 0 || emailTrim.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) {
    return res.status(400).json({ success: false, error: 'Invalid email format.' });
  }
  if (password.length === 0 || password.length > 200) {
    return res.status(400).json({ success: false, error: 'Invalid password length.' });
  }

  // Account lockout check
  if (isLockedOut(emailTrim)) {
    return res.status(429).json({
      success: false,
      error: 'Account temporarily locked due to too many failed attempts. Try again in 15 minutes.'
    });
  }

  try {
    let userRecord = null;
    let authSuccess = false;

    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT * FROM users WHERE email = $1', [emailTrim]);
      if (dbRes.rows.length > 0) {
        const dbUser = dbRes.rows[0];
        const passMatch = await bcrypt.compare(password, dbUser.password);
        if (passMatch) {
          authSuccess = true;
          const uData = typeof dbUser.data === 'string' ? JSON.parse(dbUser.data) : dbUser.data;
          userRecord = { email: dbUser.email, name: uData?.name || 'Admin', role: uData?.role || 'admin' };
        }
      }
    } else {
      // Local DB Fallback (ONLY used if PostgreSQL is offline/disabled)
      const localDb = readLocalDb();
      const localUser = localDb.users.find(u => u.email === emailTrim);
      if (localUser) {
        let passMatch = false;
        if (localUser.password.startsWith('$2')) {
          passMatch = await bcrypt.compare(password, localUser.password);
        } else {
          // legacy plaintext – migrate to bcrypt on successful match
          passMatch = localUser.password === password;
          if (passMatch) {
            localUser.password = await bcrypt.hash(password, BCRYPT_COST);
            writeLocalDb(localDb);
          }
        }

        if (passMatch) {
          authSuccess = true;
          userRecord = { email: localUser.email, name: localUser.name, role: localUser.role };
        }
      }
    }

    if (authSuccess && userRecord) {
      clearFailedAttempts(emailTrim);

      // Short-lived JWT session cookie
      const token = jwt.sign(userRecord, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000 // 1 hour – matches default JWT_EXPIRES_IN
      });

      return res.json({
        success: true,
        user: userRecord,
        message: `Welcome back, ${userRecord.name}!`
      });
    } else {
      recordFailedAttempt(emailTrim);
      // Generic error – do not reveal which field was wrong
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Internal server login error.' });
  }
});

// 2. Logout (Public)
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Google Authentication Helper Function
function verifyGoogleToken(token) {
  const https = require('https');
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 200) {
            resolve(parsed);
          } else {
            reject(new Error(parsed.error_description || parsed.error || 'Failed to verify token'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Google Authentication Endpoints
app.get('/api/auth/google-client-id', (req, res) => {
  res.json({ clientId: process.env.GOOGLE_CLIENT_ID || null });
});

app.post('/api/auth/google-login', authLimiter, async (req, res) => {
  const { token } = req.body;
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return res.status(500).json({ success: false, error: 'Google Login is not configured on the server.' });
  }

  if (!token) {
    return res.status(400).json({ success: false, error: 'Google token is required.' });
  }

  try {
    const payload = await verifyGoogleToken(token);

    // Verify issuer
    const validIssuers = ['https://accounts.google.com', 'accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      return res.status(401).json({ success: false, error: 'Access Denied: Invalid token issuer.' });
    }

    // Verify audience
    if (payload.aud !== clientId) {
      return res.status(401).json({ success: false, error: 'Access Denied: Invalid audience.' });
    }

    // Verify email verification status
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      return res.status(401).json({ success: false, error: 'Access Denied: Google email is not verified.' });
    }

    // Restrict access to exactly vllscrtservice@gmail.com
    const allowedEmail = 'vllscrtservice@gmail.com';
    if (payload.email !== allowedEmail) {
      return res.status(403).json({ success: false, error: `Access Denied: Unauthorized Google account (${payload.email}).` });
    }

    // Setup session identical to normal login
    const userRecord = {
      email: payload.email,
      name: payload.name || 'Salim Bhat',
      role: 'admin'
    };

    const sessionToken = jwt.sign(userRecord, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.cookie('auth_token', sessionToken, {
      httpOnly: true,
      secure: NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000 // 1 hour – matches default JWT_EXPIRES_IN
    });

    return res.json({
      success: true,
      user: userRecord,
      message: `Welcome back, ${userRecord.name} (signed in via Google)!`
    });

  } catch (error) {
    console.error('Google login verification error:', error);
    return res.status(401).json({ success: false, error: error.message || 'Failed to authenticate with Google.' });
  }
});


// Helper to check if current request has a valid Admin session cookie
function isAdmin(req) {
  const token = req.cookies.auth_token;
  if (!token) return false;
  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    return true;
  } catch (err) {
    return false;
  }
}

// Helper to verify if the request has access to the employee's photo/signature
async function verifyImageAccess(req, res, empId) {
  if (isAdmin(req)) return true;

  const queryToken = req.query.token;
  if (queryToken) {
    let empData = null;
    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT data FROM employees WHERE id = $1', [empId]);
      if (dbRes.rows.length > 0) empData = dbRes.rows[0].data;
    } else {
      const db = readLocalDb();
      empData = db.employees.find(e => e.id === empId);
    }
    if (empData && empData.secureToken === queryToken) {
      return true;
    }
  }
  return false;
}

// Serving binary photo
app.get('/api/employees/:id/photo', async (req, res) => {
  const empId = req.params.id;
  try {
    const hasAccess = await verifyImageAccess(req, res, empId);
    if (!hasAccess) {
      return res.status(401).json({ error: 'Unauthorized image access.' });
    }

    let base64Str = null;
    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT photo FROM employee_photos WHERE employee_id = $1', [empId]);
      if (dbRes.rows.length > 0) base64Str = dbRes.rows[0].photo;
    } else {
      const photosDb = readPhotosDb();
      if (photosDb[empId]) base64Str = photosDb[empId].photo;
    }

    if (!base64Str || !base64Str.startsWith('data:image/')) {
      return res.status(404).json({ error: 'Photo not found.' });
    }

    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(500).json({ error: 'Invalid photo format.' });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    return res.send(buffer);
  } catch (e) {
    console.error('Error serving photo:', e);
    return res.status(500).json({ error: 'Failed to serve photo.' });
  }
});

// Serving binary signature
app.get('/api/employees/:id/signature', async (req, res) => {
  const empId = req.params.id;
  try {
    const hasAccess = await verifyImageAccess(req, res, empId);
    if (!hasAccess) {
      return res.status(401).json({ error: 'Unauthorized signature access.' });
    }

    let base64Str = null;
    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT signature FROM employee_photos WHERE employee_id = $1', [empId]);
      if (dbRes.rows.length > 0) base64Str = dbRes.rows[0].signature;
    } else {
      const photosDb = readPhotosDb();
      if (photosDb[empId]) base64Str = photosDb[empId].signature;
    }

    if (!base64Str || !base64Str.startsWith('data:image/')) {
      return res.status(404).json({ error: 'Signature not found.' });
    }

    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(500).json({ error: 'Invalid signature format.' });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    return res.send(buffer);
  } catch (e) {
    console.error('Error serving signature:', e);
    return res.status(500).json({ error: 'Failed to serve signature.' });
  }
});

// 3. Employee GET Details (Public for QR Code Verification with security token check)
app.get('/api/employees/:id', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const empId = req.params.id;
  const token = req.query.token;

  try {
    let empData = null;

    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT data FROM employees WHERE id = $1', [empId]);
      if (dbRes.rows.length > 0) {
        empData = dbRes.rows[0].data;
      }
    } else {
      const db = readLocalDb();
      const emp = db.employees.find(e => e.id === empId);
      if (emp) empData = emp;
    }

    if (!empData) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    // Security Check: If requester is not an admin, they must provide the correct secureToken
    if (!isAdmin(req)) {
      if (!token || empData.secureToken !== token) {
        return res.status(401).json({ error: 'Unauthorized: Invalid verification token.' });
      }
    }

    // Dynamically append verification token to image URLs so client can fetch them securely
    const responseData = JSON.parse(JSON.stringify(empData));
    if (responseData.documents) {
      if (responseData.documents.photo && responseData.documents.photo.startsWith('/api/')) {
        responseData.documents.photo = `${responseData.documents.photo}?token=${responseData.secureToken}`;
      }
      if (responseData.documents.signature && responseData.documents.signature.startsWith('/api/')) {
        responseData.documents.signature = `${responseData.documents.signature}?token=${responseData.secureToken}`;
      }
    }

    return res.json(responseData);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to retrieve employee.' });
  }
});

// Database Connection Status Endpoint
app.get('/api/db-status', authenticateToken, (req, res) => {
  res.json({
    success: true,
    usePostgres: usePostgres,
    postgresOnline: pool ? true : false,
    databaseType: usePostgres ? 'PostgreSQL (Cloud Database)' : 'Local Database File (Ephemeral Fallback)'
  });
});

// 4. Employee GET Directory List
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    let emps = [];
    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT data FROM employees ORDER BY id ASC');
      emps = dbRes.rows.map(r => r.data);
    } else {
      const db = readLocalDb();
      emps = db.employees;
    }

    // Append security tokens to image URLs for frontend fetching
    const processedEmps = emps.map(emp => {
      const responseData = JSON.parse(JSON.stringify(emp));
      if (responseData.documents) {
        if (responseData.documents.photo && responseData.documents.photo.startsWith('/api/')) {
          responseData.documents.photo = `${responseData.documents.photo}?token=${responseData.secureToken}`;
        }
        if (responseData.documents.signature && responseData.documents.signature.startsWith('/api/')) {
          responseData.documents.signature = `${responseData.documents.signature}?token=${responseData.secureToken}`;
        }
      }
      return responseData;
    });

    return res.json(processedEmps);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load guard directory.' });
  }
});

// 5. Employee Create Profile
app.post('/api/employees', authenticateToken, async (req, res) => {
  const newEmp = req.body;
  if (!newEmp.name) {
    return res.status(400).json({ error: 'Employee name is required.' });
  }

  try {
    const db = readLocalDb();
    
    // Auto calculate ID (VSA-XXXX)
    let nextNum = 1001;
    let allIds = [];

    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT id FROM employees');
      allIds = dbRes.rows.map(r => parseInt(r.id.replace('VSA-', ''))).filter(n => !isNaN(n));
    } else {
      allIds = db.employees.map(e => parseInt(e.id.replace('VSA-', ''))).filter(n => !isNaN(n));
    }

    if (allIds.length > 0) {
      nextNum = Math.max(...allIds) + 1;
    }
    newEmp.id = `VSA-${nextNum}`;
    newEmp.secureToken = crypto.randomBytes(16).toString('hex');

    // Server-Side Compression and separation of Profile Photo and Signature
    let photoBase64 = null;
    let signatureBase64 = null;

    if (newEmp.documents) {
      if (newEmp.documents.photo && newEmp.documents.photo.startsWith('data:image/')) {
        newEmp.documents.photo = await compressImageBase64(newEmp.documents.photo, 300, null);
        photoBase64 = newEmp.documents.photo;
        newEmp.documents.photo = `/api/employees/${newEmp.id}/photo`;
      }
      if (newEmp.documents.signature && newEmp.documents.signature.startsWith('data:image/')) {
        newEmp.documents.signature = await compressImageBase64(newEmp.documents.signature, 300, 150, 'contain');
        signatureBase64 = newEmp.documents.signature;
        newEmp.documents.signature = `/api/employees/${newEmp.id}/signature`;
      }
    }

    if (usePostgres && pool) {
      if (photoBase64 || signatureBase64) {
        await pool.query('INSERT INTO employee_photos (employee_id, photo, signature) VALUES ($1, $2, $3)', [newEmp.id, photoBase64, signatureBase64]);
      }
      await pool.query('INSERT INTO employees (id, data) VALUES ($1, $2)', [newEmp.id, JSON.stringify(newEmp)]);
    } else {
      if (photoBase64 || signatureBase64) {
        const photosDb = readPhotosDb();
        photosDb[newEmp.id] = { photo: photoBase64, signature: signatureBase64 };
        writePhotosDb(photosDb);
      }
      db.employees.push(newEmp);
      writeLocalDb(db);
    }

    // Dynamic token append for response
    const responseData = JSON.parse(JSON.stringify(newEmp));
    if (responseData.documents) {
      if (responseData.documents.photo && responseData.documents.photo.startsWith('/api/')) {
        responseData.documents.photo = `${responseData.documents.photo}?token=${responseData.secureToken}`;
      }
      if (responseData.documents.signature && responseData.documents.signature.startsWith('/api/')) {
        responseData.documents.signature = `${responseData.documents.signature}?token=${responseData.secureToken}`;
      }
    }

    return res.status(201).json(responseData);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to register guard profile.' });
  }
});

// 6. Employee Update Profile
app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  const empId = req.params.id;
  const updateData = req.body;

  try {
    let existingEmp = null;
    const db = readLocalDb();

    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT data FROM employees WHERE id = $1', [empId]);
      if (dbRes.rows.length > 0) existingEmp = dbRes.rows[0].data;
    } else {
      existingEmp = db.employees.find(e => e.id === empId);
    }

    if (!existingEmp) {
      return res.status(404).json({ error: 'Employee not found.' });
    }

    const mergedEmp = { ...existingEmp, ...updateData, id: empId };

    // Apply compression and separate updated photo or signature if changed
    let photoBase64 = null;
    let signatureBase64 = null;
    let updatePhoto = false;
    let updateSignature = false;

    if (mergedEmp.documents) {
      // Photo processing
      if (mergedEmp.documents.photo) {
        if (mergedEmp.documents.photo.startsWith('data:image/')) {
          mergedEmp.documents.photo = await compressImageBase64(mergedEmp.documents.photo, 300, null);
          photoBase64 = mergedEmp.documents.photo;
          mergedEmp.documents.photo = `/api/employees/${empId}/photo`;
          updatePhoto = true;
        } else if (mergedEmp.documents.photo.startsWith('/api/') || mergedEmp.documents.photo.startsWith('http')) {
          // Keep existing clean URL
          mergedEmp.documents.photo = `/api/employees/${empId}/photo`;
        }
      } else {
        // Photo deleted
        updatePhoto = true;
      }

      // Signature processing
      if (mergedEmp.documents.signature) {
        if (mergedEmp.documents.signature.startsWith('data:image/')) {
          mergedEmp.documents.signature = await compressImageBase64(mergedEmp.documents.signature, 300, 150, 'contain');
          signatureBase64 = mergedEmp.documents.signature;
          mergedEmp.documents.signature = `/api/employees/${empId}/signature`;
          updateSignature = true;
        } else if (mergedEmp.documents.signature.startsWith('/api/') || mergedEmp.documents.signature.startsWith('http')) {
          // Keep existing clean URL
          mergedEmp.documents.signature = `/api/employees/${empId}/signature`;
        }
      } else {
        // Signature deleted
        updateSignature = true;
      }
    }

    if (usePostgres && pool) {
      if (updatePhoto || updateSignature) {
        // Check if record exists in employee_photos
        const checkRes = await pool.query('SELECT 1 FROM employee_photos WHERE employee_id = $1', [empId]);
        if (checkRes.rows.length > 0) {
          let query = 'UPDATE employee_photos SET updated_at = NOW()';
          let params = [empId];
          let paramIdx = 2;
          if (updatePhoto) {
            query += `, photo = $${paramIdx}`;
            params.push(photoBase64);
            paramIdx++;
          }
          if (updateSignature) {
            query += `, signature = $${paramIdx}`;
            params.push(signatureBase64);
            paramIdx++;
          }
          query += ` WHERE employee_id = $1`;
          await pool.query(query, params);
        } else {
          await pool.query('INSERT INTO employee_photos (employee_id, photo, signature) VALUES ($1, $2, $3)', [empId, photoBase64, signatureBase64]);
        }
      }
      await pool.query('UPDATE employees SET data = $2, updated_at = NOW() WHERE id = $1', [empId, JSON.stringify(mergedEmp)]);
    } else {
      if (updatePhoto || updateSignature) {
        const photosDb = readPhotosDb();
        if (!photosDb[empId]) photosDb[empId] = {};
        if (updatePhoto) {
          if (photoBase64) photosDb[empId].photo = photoBase64;
          else delete photosDb[empId].photo;
        }
        if (updateSignature) {
          if (signatureBase64) photosDb[empId].signature = signatureBase64;
          else delete photosDb[empId].signature;
        }
        writePhotosDb(photosDb);
      }
      const idx = db.employees.findIndex(e => e.id === empId);
      db.employees[idx] = mergedEmp;
      writeLocalDb(db);
    }

    // Dynamic token append for response
    const responseData = JSON.parse(JSON.stringify(mergedEmp));
    if (responseData.documents) {
      if (responseData.documents.photo && responseData.documents.photo.startsWith('/api/')) {
        responseData.documents.photo = `${responseData.documents.photo}?token=${responseData.secureToken}`;
      }
      if (responseData.documents.signature && responseData.documents.signature.startsWith('/api/')) {
        responseData.documents.signature = `${responseData.documents.signature}?token=${responseData.secureToken}`;
      }
    }

    return res.json(responseData);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to update employee details.' });
  }
});

// 7. Employee Delete Profile
app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  const empId = req.params.id;
  try {
    if (usePostgres && pool) {
      await pool.query('DELETE FROM employee_photos WHERE employee_id = $1', [empId]);
      await pool.query('DELETE FROM employees WHERE id = $1', [empId]);
    } else {
      const db = readLocalDb();
      const photosDb = readPhotosDb();
      delete photosDb[empId];
      writePhotosDb(photosDb);
      const idx = db.employees.findIndex(e => e.id === empId);
      if (idx !== -1) {
        db.employees.splice(idx, 1);
        writeLocalDb(db);
      }
    }
    return res.json({ success: true, message: 'Employee deleted successfully.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete employee.' });
  }
});

// 8. Classifications GET (Protected)
app.get('/api/classifications', authenticateToken, async (req, res) => {
  try {
    if (usePostgres && pool) {
      const depts = await pool.query('SELECT "value" FROM settings WHERE key = \'departments\'');
      const desigs = await pool.query('SELECT "value" FROM settings WHERE key = \'designations\'');
      const manpower = await pool.query('SELECT "value" FROM settings WHERE key = \'manpowerTypes\'');
      
      return res.json({
        departments: depts.rows.length > 0 ? depts.rows[0].value : [],
        designations: desigs.rows.length > 0 ? desigs.rows[0].value : [],
        manpowerTypes: manpower.rows.length > 0 ? manpower.rows[0].value : []
      });
    } else {
      const db = readLocalDb();
      return res.json({
        departments: db.departments || [],
        designations: db.designations || [],
        manpowerTypes: db.manpowerTypes || []
      });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load classifications.' });
  }
});

// 9. Classifications POST Update (Protected)
app.post('/api/classifications', authenticateToken, async (req, res) => {
  const { departments, designations, manpowerTypes } = req.body;
  try {
    if (usePostgres && pool) {
      if (departments) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['departments', JSON.stringify(departments)]);
      if (designations) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['designations', JSON.stringify(designations)]);
      if (manpowerTypes) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"', ['manpowerTypes', JSON.stringify(manpowerTypes)]);
    } else {
      const db = readLocalDb();
      db.departments = departments || [];
      db.designations = designations || [];
      db.manpowerTypes = manpowerTypes || [];
      writeLocalDb(db);
    }
    return res.json({ success: true, departments, designations, manpowerTypes });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update classifications.' });
  }
});

// 10. Templates GET (Protected)
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT data FROM templates ORDER BY id ASC');
      const templates = dbRes.rows.map(r => r.data);
      return res.json(templates);
    } else {
      const db = readLocalDb();
      return res.json(db.templates || []);
    }
  } catch (e) {
    return res.status(500).json({ error: 'Failed to load badge templates.' });
  }
});

// 11. Templates POST Save (Protected)
app.post('/api/templates', authenticateToken, async (req, res) => {
  const tpl = req.body;
  if (!tpl.id) {
    tpl.id = `tpl-${Date.now()}`;
  }

  try {
    if (usePostgres && pool) {
      await pool.query('INSERT INTO templates (id, data) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data', [tpl.id, JSON.stringify(tpl)]);
    } else {
      const db = readLocalDb();
      if (!db.templates) db.templates = [];
      const idx = db.templates.findIndex(t => t.id === tpl.id);
      if (idx !== -1) {
        db.templates[idx] = tpl;
      } else {
        db.templates.push(tpl);
      }
      writeLocalDb(db);
    }
    return res.json(tpl);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to save template.' });
  }
});

// 12. Templates DELETE (Protected)
app.delete('/api/templates/:id', authenticateToken, async (req, res) => {
  const tplId = req.params.id;
  try {
    if (usePostgres && pool) {
      await pool.query('DELETE FROM templates WHERE id = $1', [tplId]);
    } else {
      const db = readLocalDb();
      if (!db.templates) db.templates = [];
      const idx = db.templates.findIndex(t => t.id === tplId);
      if (idx !== -1) {
        db.templates.splice(idx, 1);
        writeLocalDb(db);
      }
    }
    return res.json({ success: true, message: 'Template deleted.' });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete template.' });
  }
});

// 13. System Database Dump GET (Protected)
app.get('/api/db', authenticateToken, async (req, res) => {
  try {
    if (usePostgres && pool) {
      const empsRes = await pool.query('SELECT data FROM employees');
      const photosRes = await pool.query('SELECT employee_id, photo, signature FROM employee_photos');
      const clientsRes = await pool.query('SELECT data FROM clients');
      const templatesRes = await pool.query('SELECT data FROM templates');
      const usersRes = await pool.query('SELECT email, password, data FROM users');
      const depts = await pool.query('SELECT "value" FROM settings WHERE key = \'departments\'');
      const desigs = await pool.query('SELECT "value" FROM settings WHERE key = \'designations\'');
      const manpower = await pool.query('SELECT "value" FROM settings WHERE key = \'manpowerTypes\'');

      // Create a map for fast lookup of photos/signatures
      const photosMap = {};
      photosRes.rows.forEach(r => {
        photosMap[r.employee_id] = r;
      });

      const dbPayload = {
        employees: empsRes.rows.map(r => {
          const emp = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
          const photoRec = photosMap[emp.id];
          if (photoRec) {
            if (!emp.documents) emp.documents = {};
            if (photoRec.photo) emp.documents.photo = photoRec.photo;
            if (photoRec.signature) emp.documents.signature = photoRec.signature;
          }
          return emp;
        }),
        clients: clientsRes.rows.map(r => r.data),
        assetsCatalog: [], // Add if needed, or query from a settings/catalog table
        departments: depts.rows.length > 0 ? depts.rows[0].value : [],
        designations: desigs.rows.length > 0 ? desigs.rows[0].value : [],
        manpowerTypes: manpower.rows.length > 0 ? manpower.rows[0].value : [],
        templates: templatesRes.rows.map(r => r.data),
        users: usersRes.rows.map(r => {
          const uData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
          return { email: r.email, password: r.password, name: uData?.name, role: uData?.role, createdAt: uData?.createdAt };
        })
      };
      
      // Merge assets catalog from settings if present
      const catalogRes = await pool.query('SELECT "value" FROM settings WHERE key = \'assetsCatalog\'');
      dbPayload.assetsCatalog = catalogRes.rows.length > 0 ? catalogRes.rows[0].value : [];
      
      return res.json(dbPayload);
    } else {
      const localDb = readLocalDb();
      const photosDb = readPhotosDb();
      localDb.employees = localDb.employees.map(emp => {
        const photoRec = photosDb[emp.id];
        if (photoRec) {
          if (!emp.documents) emp.documents = {};
          if (photoRec.photo) emp.documents.photo = photoRec.photo;
          if (photoRec.signature) emp.documents.signature = photoRec.signature;
        }
        return emp;
      });
      return res.json(localDb);
    }
  } catch (e) {
    return res.status(500).json({ error: 'Failed to export database backup.' });
  }
});

// 14. System Database Import POST (Protected)
app.post('/api/db/import', authenticateToken, async (req, res) => {
  const incoming = req.body;
  if (!incoming.employees) {
    return res.status(400).json({ success: false, error: 'Invalid database backup format.' });
  }

  try {
    if (usePostgres && pool) {
      await pool.query('DELETE FROM employee_photos');
      await pool.query('DELETE FROM employees');
      await pool.query('DELETE FROM clients');
      await pool.query('DELETE FROM templates');
      await pool.query('DELETE FROM users');
      await pool.query('DELETE FROM settings');

      if (incoming.departments) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2)', ['departments', JSON.stringify(incoming.departments)]);
      if (incoming.designations) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2)', ['designations', JSON.stringify(incoming.designations)]);
      if (incoming.manpowerTypes) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2)', ['manpowerTypes', JSON.stringify(incoming.manpowerTypes)]);
      if (incoming.assetsCatalog) await pool.query('INSERT INTO settings (key, "value") VALUES ($1, $2)', ['assetsCatalog', JSON.stringify(incoming.assetsCatalog)]);

      for (const u of (incoming.users || [])) {
        await pool.query('INSERT INTO users (email, password, data) VALUES ($1, $2, $3)', [
          u.email,
          u.password, // Keep current hashed or plaintext password
          JSON.stringify({ name: u.name, role: u.role, createdAt: u.createdAt })
        ]);
      }

      for (const t of (incoming.templates || [])) {
        await pool.query('INSERT INTO templates (id, data) VALUES ($1, $2)', [t.id, JSON.stringify(t)]);
      }

      for (const c of (incoming.clients || [])) {
        await pool.query('INSERT INTO clients (name, data) VALUES ($1, $2)', [c.name, JSON.stringify(c)]);
      }

      for (const emp of (incoming.employees || [])) {
        await pool.query('INSERT INTO employees (id, data) VALUES ($1, $2)', [emp.id, JSON.stringify(emp)]);
      }
    } else {
      writePhotosDb({}); // Clear local photos database
      writeLocalDb(incoming);
    }
    
    // Automatically trigger migration to separate any imported base64 photos/signatures
    await runImageMigration();
    
    return res.json({ success: true, message: 'Database imported successfully.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ success: false, error: 'Database import failed.' });
  }
});

// 15. LAN IP Endpoint (Public)
function getLANIP() {
  const networkInterfaces = os.networkInterfaces();
  let fallbackIp = 'localhost';
  const virtualRegex = /(virtualbox|vmware|vbox|wsl|vethernet|host-only|hostonly|hyper-v|hyperv|loopback|vpn)/i;
  let candidates = [];
  
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    const isVirtual = virtualRegex.test(interfaceName);
    
    for (const face of interfaces) {
      if (face.family === 'IPv4' && !face.internal) {
        const isVirtualSubnet = face.address.startsWith('192.168.56.') || face.address.startsWith('169.254.');
        candidates.push({
          address: face.address,
          name: interfaceName,
          isVirtual: isVirtual || isVirtualSubnet,
          isWifiOrEthernet: /wifi|wi-fi|ethernet|wlan/i.test(interfaceName)
        });
      }
    }
  }
  
  candidates.sort((a, b) => {
    if (a.isVirtual !== b.isVirtual) return a.isVirtual ? 1 : -1;
    if (a.isWifiOrEthernet !== b.isWifiOrEthernet) return a.isWifiOrEthernet ? -1 : 1;
    return 0;
  });
  
  if (candidates.length > 0) return candidates[0].address;
  return fallbackIp;
}

app.get('/api/lan-ip', (req, res) => {
  res.json({ lanIp: `${getLANIP()}:${PORT}` });
});

// Automatically generate secureToken for any existing employee rows in local/PostgreSQL databases
async function ensureAllEmployeesHaveTokens() {
  try {
    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT id, data FROM employees');
      for (const row of dbRes.rows) {
        let empData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        if (!empData.secureToken) {
          empData.secureToken = crypto.randomBytes(16).toString('hex');
          await pool.query('UPDATE employees SET data = $1 WHERE id = $2', [JSON.stringify(empData), row.id]);
          console.log(`Generated secureToken for employee ${row.id} in PostgreSQL`);
        }
      }
    } else {
      const db = readLocalDb();
      let changed = false;
      db.employees.forEach(emp => {
        if (!emp.secureToken) {
          emp.secureToken = crypto.randomBytes(16).toString('hex');
          changed = true;
          console.log(`Generated secureToken for employee ${emp.id} in Local DB`);
        }
      });
      if (changed) {
        writeLocalDb(db);
      }
    }
  } catch (err) {
    console.error('Error generating secure tokens:', err.message);
  }
}

// Express Error Handling Middleware to capture and log any unhandled route errors to PostgreSQL
app.use(async (err, req, res, next) => {
  console.error('Captured Route Error:', err);
  if (usePostgres && pool) {
    try {
      await pool.query('INSERT INTO server_errors (message, stack) VALUES ($1, $2)', [err.message || 'Route Error', err.stack || '']);
    } catch (dbErr) {
      console.error('Failed to log route error to database:', dbErr);
    }
  }
  res.status(500).send('Internal Server Error: ' + err.message);
});

// Capture and log process uncaught exceptions to PostgreSQL
process.on('uncaughtException', async (err) => {
  console.error('Uncaught Exception:', err);
  if (usePostgres && pool) {
    try {
      await pool.query('INSERT INTO server_errors (message, stack) VALUES ($1, $2)', ['Uncaught Exception: ' + err.message, err.stack || '']);
    } catch (e) {}
  }
});

// Capture and log process unhandled rejections to PostgreSQL
process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (usePostgres && pool) {
    try {
      const msg = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : '';
      await pool.query('INSERT INTO server_errors (message, stack) VALUES ($1, $2)', ['Unhandled Rejection: ' + msg, stack]);
    } catch (e) {}
  }
});

// Start Server
app.listen(PORT, async () => {
  await initDatabase();
  await runImageMigration();
  await ensureAllEmployeesHaveTokens();
  await loadSiteEnabledFromDb();
  console.log('================================================================');
  console.log(' VALLEY SECURITY AGENCY - EMPLOYEE MANAGEMENT & ID SYSTEM SERVER');
  console.log('================================================================');
  console.log(`[Local Server] Running locally at: http://localhost:${PORT}`);
  console.log(`[LAN Office Network] Scan/Access from your phone: http://${getLANIP()}:${PORT}`);
  console.log(`[Kill Switch] Configured – access URL is loaded from .env (KILL_SWITCH_KEY).`);
  console.log('================================================================');
});
