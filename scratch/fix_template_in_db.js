const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query("SELECT * FROM templates WHERE id = 'tpl-default'");
    if (res.rows.length === 0) {
      console.log('Template tpl-default not found.');
      return;
    }
    const template = res.rows[0].data;
    console.log('Current subheaderText:', template.subheaderText);
    
    // Fix spaces in NATHCOMPLEX and PH7889311608
    template.subheaderText = "SHAHEED GUNJ NATH COMPLEX SRINAGAR 190001 PH 7889311608";
    
    await pool.query("UPDATE templates SET data = $1 WHERE id = 'tpl-default'", [JSON.stringify(template)]);
    console.log('Successfully updated template subheaderText in database.');
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
