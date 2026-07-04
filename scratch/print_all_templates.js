const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Load environment variables from .env file
const envPath = path.join(__dirname, '..', '.env');
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

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("Error: DATABASE_URL not found in .env file.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query('SELECT * FROM templates');
    for (const r of res.rows) {
      console.log(`TEMPLATE ID: ${r.id}`);
      console.log(JSON.stringify(typeof r.data === 'string' ? JSON.parse(r.data) : r.data, null, 2));
      console.log('-----------------------------------');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
