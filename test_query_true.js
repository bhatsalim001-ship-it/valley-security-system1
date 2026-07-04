const { Client } = require('pg');

const connectionString = "postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected!");

  try {
    const res = await client.query(
      'INSERT INTO settings (key, "value") VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET "value" = EXCLUDED."value"',
      ['site_enabled', JSON.stringify(true)]
    );
    console.log("Success! RowCount:", res.rowCount);
  } catch (err) {
    console.error("Query failed:", err);
  } finally {
    await client.end();
  }
}

main();
