const express = require('express');
const cors = require('cors');
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

const JWT_SECRET = process.env.JWT_SECRET || 'valley-security-secret-session-key';
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'db.json');

// PostgreSQL Setup
let pool = null;
const NEON_FALLBACK_URL = "postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const dbUrl = process.env.DATABASE_URL || NEON_FALLBACK_URL;
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
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// --------------------------------------------------------------------------
// KILL SWITCH — Site Enable/Disable State
// --------------------------------------------------------------------------
const KILL_SWITCH_KEY = process.env.KILL_SWITCH_KEY || 'VSA-SALIM-MASTER-2024';
let _siteEnabled = true; // in-memory flag (loaded from DB on startup)

async function loadSiteEnabledFromDb() {
  if (!usePostgres || !pool) return;
  try {
    const res = await pool.query("SELECT value FROM settings WHERE key = 'site_enabled'");
    if (res.rows.length > 0) {
      _siteEnabled = res.rows[0].value === true || res.rows[0].value === 'true';
    } else {
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', ['site_enabled', JSON.stringify(true)]);
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
      await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['site_enabled', JSON.stringify(value)]);
    } catch (e) {
      console.warn('⚠️ Could not persist kill switch state to DB:', e.message);
    }
  }
}

// Kill switch control page — secret URL only Salim knows
app.get('/kill-switch', (req, res) => {
  if (req.query.key !== KILL_SWITCH_KEY) {
    return req.socket.destroy();
  }
  const isOn = _siteEnabled;
  const bg = isOn ? 'linear-gradient(135deg,#071a0f,#0d3320)' : 'linear-gradient(135deg,#1a0505,#3a0a0a)';
  const dotColor = isOn ? '#22c55e' : '#ef4444';
  const dotGlow = isOn ? 'rgba(34,197,94,0.45)' : 'rgba(239,68,68,0.45)';
  const stateText = isOn ? 'LIVE' : 'OFFLINE';

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

  const publicPages = ['/login.html', '/verification.html', '/styles.css', '/NEW_MASTER_STYLES.css', '/developer.jpg'];
  const isGoogleVerification = req.path.match(/^\/google[a-f0-9]+\.html$/);
  
  if (publicPages.some(page => req.path.endsWith(page)) || isGoogleVerification) {
    return next();
  }

  const token = req.cookies.auth_token;
  if (!token) {
    return res.redirect('/login.html');
  }

  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie('auth_token');
    return res.redirect('/login.html');
  }
}

app.get('/login', (req, res) => {
  res.redirect('/login.html');
});

// Serve protected dashboard index page with disabled cache headers
const noCacheOptions = {
  headers: {
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
};

app.get('/', protectHtmlPages, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), noCacheOptions);
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

    console.log('✅ PostgreSQL Database Tables Verified/Initialized');

    // Synchronize PostgreSQL admin password with local db.json unconditionally
    const localDb = readLocalDb();
    const adminUser = localDb.users.find(u => u.email === 'vllscrtservice@gmail.com');
    if (adminUser) {
      const hash = await bcrypt.hash(adminUser.password, 10);
      const updateRes = await pool.query('UPDATE users SET password = $1 WHERE email = $2', [hash, 'vllscrtservice@gmail.com']);
      console.log(`✅ PostgreSQL admin user password synchronized successfully (${updateRes.rowCount} rows updated)`);
    }

    // Check if initial seeding has already been performed in the past
    const seedCheck = await pool.query("SELECT value FROM settings WHERE key = 'initial_seeding_done'");
    if (seedCheck.rows.length > 0 && (seedCheck.rows[0].value === true || seedCheck.rows[0].value === 'true')) {
      console.log('✅ Database already seeded. Skipping initial migration seeding.');
      return;
    }

    console.log('🔄 Seeding database for the first time...');

    // 1. Seed settings classifications
    const settingsCheck = await pool.query('SELECT COUNT(*) FROM settings');
    if (parseInt(settingsCheck.rows[0].count, 10) === 0) {
      console.log('🔄 Seeding settings classifications...');
      if (localDb.departments) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['departments', JSON.stringify(localDb.departments)]);
      if (localDb.designations) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['designations', JSON.stringify(localDb.designations)]);
      if (localDb.manpowerTypes) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['manpowerTypes', JSON.stringify(localDb.manpowerTypes)]);
    }

    // 2. Seed users
    const userCheck = await pool.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCheck.rows[0].count, 10) === 0) {
      console.log('🔄 Seeding admin users...');
      for (const u of (localDb.users || [])) {
        const hash = await bcrypt.hash(u.password, 10);
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
    await pool.query("UPDATE settings SET value = REPLACE(value::text, '6006495505', '7889311608')::jsonb");
    console.log('✅ PostgreSQL database records cleaned (phone number updated)');

    // Mark initial seeding as completed
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['initial_seeding_done', JSON.stringify(true)]);
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
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  try {
    let userRecord = null;
    let authSuccess = false;

    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (dbRes.rows.length > 0) {
        const dbUser = dbRes.rows[0];
        const passMatch = await bcrypt.compare(password, dbUser.password);
        if (passMatch) {
          authSuccess = true;
          const uData = typeof dbUser.data === 'string' ? JSON.parse(dbUser.data) : dbUser.data;
          userRecord = { email: dbUser.email, name: uData?.name || 'Admin', role: uData?.role || 'admin' };
        }
      }
    }

    // Local DB Fallback or initial migrations
    if (!authSuccess) {
      const localDb = readLocalDb();
      const localUser = localDb.users.find(u => u.email === email);
      if (localUser) {
        // Support either bcrypt comparison or plaintext comparison (migration helper)
        let passMatch = false;
        if (localUser.password.startsWith('$2')) {
          passMatch = await bcrypt.compare(password, localUser.password);
        } else {
          passMatch = localUser.password === password;
        }

        if (passMatch) {
          authSuccess = true;
          userRecord = { email: localUser.email, name: localUser.name, role: localUser.role };
        }
      }
    }

    // Default fail-safe credentials (never locked out)
    if (!authSuccess && email === 'vllscrtservice@gmail.com' && password === 'Lisa5198042022!@#$%^&*()') {
      authSuccess = true;
      userRecord = { email: 'vllscrtservice@gmail.com', name: 'Salim Bhat', role: 'admin' };
    }

    if (authSuccess && userRecord) {
      // Create JWT session cookie
      const token = jwt.sign(userRecord, JWT_SECRET, { expiresIn: '7d' });
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      return res.json({
        success: true,
        user: userRecord,
        message: `Welcome back, ${userRecord.name}!`
      });
    } else {
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

app.post('/api/auth/google-login', async (req, res) => {
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

    const sessionToken = jwt.sign(userRecord, JWT_SECRET, { expiresIn: '7d' });
    res.cookie('auth_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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

    return res.json(empData);
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
    if (usePostgres && pool) {
      const dbRes = await pool.query('SELECT data FROM employees ORDER BY id ASC');
      const emps = dbRes.rows.map(r => r.data);
      return res.json(emps);
    } else {
      const db = readLocalDb();
      return res.json(db.employees);
    }
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

    // Server-Side Compression of Profile Photo and Signature
    if (newEmp.documents) {
      if (newEmp.documents.photo) {
        newEmp.documents.photo = await compressImageBase64(newEmp.documents.photo, 300, 300, 'cover');
      }
      if (newEmp.documents.signature) {
        newEmp.documents.signature = await compressImageBase64(newEmp.documents.signature, 300, 150, 'contain');
      }
    }

    if (usePostgres && pool) {
      await pool.query('INSERT INTO employees (id, data) VALUES ($1, $2)', [newEmp.id, JSON.stringify(newEmp)]);
    } else {
      db.employees.push(newEmp);
      writeLocalDb(db);
    }

    return res.status(201).json(newEmp);
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

    // Apply compression to updated photo or signature if changed
    if (mergedEmp.documents) {
      if (mergedEmp.documents.photo && mergedEmp.documents.photo !== existingEmp.documents?.photo) {
        mergedEmp.documents.photo = await compressImageBase64(mergedEmp.documents.photo, 300, 300, 'cover');
      }
      if (mergedEmp.documents.signature && mergedEmp.documents.signature !== existingEmp.documents?.signature) {
        mergedEmp.documents.signature = await compressImageBase64(mergedEmp.documents.signature, 300, 150, 'contain');
      }
    }

    if (usePostgres && pool) {
      await pool.query('UPDATE employees SET data = $2, updated_at = NOW() WHERE id = $1', [empId, JSON.stringify(mergedEmp)]);
    } else {
      const idx = db.employees.findIndex(e => e.id === empId);
      db.employees[idx] = mergedEmp;
      writeLocalDb(db);
    }

    return res.json(mergedEmp);
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
      await pool.query('DELETE FROM employees WHERE id = $1', [empId]);
    } else {
      const db = readLocalDb();
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
      const depts = await pool.query('SELECT value FROM settings WHERE key = \'departments\'');
      const desigs = await pool.query('SELECT value FROM settings WHERE key = \'designations\'');
      const manpower = await pool.query('SELECT value FROM settings WHERE key = \'manpowerTypes\'');
      
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
      if (departments) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['departments', JSON.stringify(departments)]);
      if (designations) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['designations', JSON.stringify(designations)]);
      if (manpowerTypes) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', ['manpowerTypes', JSON.stringify(manpowerTypes)]);
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
      const clientsRes = await pool.query('SELECT data FROM clients');
      const templatesRes = await pool.query('SELECT data FROM templates');
      const usersRes = await pool.query('SELECT email, password, data FROM users');
      const depts = await pool.query('SELECT value FROM settings WHERE key = \'departments\'');
      const desigs = await pool.query('SELECT value FROM settings WHERE key = \'designations\'');
      const manpower = await pool.query('SELECT value FROM settings WHERE key = \'manpowerTypes\'');

      const dbPayload = {
        employees: empsRes.rows.map(r => r.data),
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
      const catalogRes = await pool.query('SELECT value FROM settings WHERE key = \'assetsCatalog\'');
      dbPayload.assetsCatalog = catalogRes.rows.length > 0 ? catalogRes.rows[0].value : [];
      
      return res.json(dbPayload);
    } else {
      return res.json(readLocalDb());
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
      await pool.query('DELETE FROM employees');
      await pool.query('DELETE FROM clients');
      await pool.query('DELETE FROM templates');
      await pool.query('DELETE FROM users');
      await pool.query('DELETE FROM settings');

      if (incoming.departments) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['departments', JSON.stringify(incoming.departments)]);
      if (incoming.designations) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['designations', JSON.stringify(incoming.designations)]);
      if (incoming.manpowerTypes) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['manpowerTypes', JSON.stringify(incoming.manpowerTypes)]);
      if (incoming.assetsCatalog) await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', ['assetsCatalog', JSON.stringify(incoming.assetsCatalog)]);

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
      writeLocalDb(incoming);
    }
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

// Start Server
app.listen(PORT, async () => {
  await initDatabase();
  await ensureAllEmployeesHaveTokens();
  await loadSiteEnabledFromDb();
  console.log('================================================================');
  console.log(' VALLEY SECURITY AGENCY - EMPLOYEE MANAGEMENT & ID SYSTEM SERVER');
  console.log('================================================================');
  console.log(`[Local Server] Running locally at: http://localhost:${PORT}`);
  console.log(`[LAN Office Network] Scan/Access from your phone: http://${getLANIP()}:${PORT}`);
  console.log(`[Kill Switch URL] https://valleysecurityserviceagency.in/kill-switch?key=${KILL_SWITCH_KEY}`);
  console.log('================================================================');
});
