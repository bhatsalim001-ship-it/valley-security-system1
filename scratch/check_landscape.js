const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
  ssl: { rejectUnauthorized: false }
});
pool.query("SELECT * FROM templates WHERE id = 'tpl-vip-landscape'").then(res => {
  console.log(JSON.stringify(res.rows[0].data, null, 2));
  pool.end();
});
