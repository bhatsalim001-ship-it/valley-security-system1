const { Client } = require('pg');

const connectionString = "postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected!");

  try {
    const res = await client.query('SELECT * FROM server_errors ORDER BY id DESC LIMIT 10');
    console.log(`Found ${res.rows.length} errors in database:`);
    res.rows.forEach(row => {
      console.log(`--------------------------------------------------`);
      console.log(`ID: ${row.id} | Timestamp: ${row.timestamp}`);
      console.log(`Message: ${row.message}`);
      console.log(`Stack: ${row.stack}`);
    });
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    await client.end();
  }
}

main();
