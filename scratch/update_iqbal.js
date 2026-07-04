const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

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

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const dbId = "VSA-1124";
    const res = await client.query("SELECT data FROM employees WHERE id = $1", [dbId]);
    if (res.rows.length > 0) {
      const rowData = res.rows[0].data;
      const empData = typeof rowData === 'string' ? JSON.parse(rowData) : rowData;

      empData.fatherName = "Mohammad Asadullah";
      empData.currentAddress = "Jahangir pora Baramulla";
      empData.permanentAddress = "Jahangir pora Baramulla";
      empData.designation = "Canteen Attendent";

      await client.query("UPDATE employees SET data = $1 WHERE id = $2", [JSON.stringify(empData), dbId]);
      console.log(`✅ Successfully updated: "${empData.name}" (${dbId})`);
    } else {
      console.error("Employee not found");
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main().catch(err => console.error(err));
