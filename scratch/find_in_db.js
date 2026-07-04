const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const tables = ['employees', 'templates', 'clients', 'settings'];
    for (const table of tables) {
      const res = await pool.query(`SELECT * FROM ${table}`);
      for (const row of res.rows) {
        const str = JSON.stringify(row);
        if (str.includes('NATHCOMPLEX') || str.includes('ReturnShaheed') || str.includes('SYEDQUMARUDDIN') || str.includes('VALLEYSECURITY')) {
          console.log(`FOUND IN TABLE ${table}:`);
          console.log(JSON.stringify(row, null, 2));
        }
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
