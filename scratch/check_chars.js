const { Pool } = require('pg');
const NEON_FALLBACK_URL = "postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: NEON_FALLBACK_URL,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM employees WHERE id = 'VSA-1017'");
    if (res.rows.length === 0) {
      console.log('Employee VSA-1017 not found.');
      return;
    }
    const emp = res.rows[0].data;
    const fields = ['name', 'fatherName', 'department', 'currentAddress'];
    for (const field of fields) {
      const val = emp[field];
      if (!val) {
        console.log(`${field}: is empty/null`);
        continue;
      }
      console.log(`${field}: "${val}"`);
      const chars = [];
      for (let i = 0; i < val.length; i++) {
        chars.push(`${val[i]}(${val.charCodeAt(i)})`);
      }
      console.log(`  Chars: ${chars.join(' ')}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
