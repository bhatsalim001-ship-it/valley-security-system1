const { Pool } = require('pg');
const NEON_FALLBACK_URL = "postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({
  connectionString: NEON_FALLBACK_URL,
  ssl: { rejectUnauthorized: false }
});

async function query() {
  try {
    const templatesRes = await pool.query('SELECT * FROM templates');
    console.log('TEMPLATES:');
    for (const row of templatesRes.rows) {
      console.log(`- ID: ${row.id}, Data:`, JSON.stringify(row.data, null, 2));
    }

    const employeesRes = await pool.query("SELECT * FROM employees WHERE id = 'VSA-1017' OR data::text LIKE '%Rasekh%'");
    console.log('\nEMPLOYEES matching Rasekh/VSA-1017:');
    for (const row of employeesRes.rows) {
      console.log(`- ID: ${row.id}, Data:`, JSON.stringify(row.data, null, 2));
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

query();
