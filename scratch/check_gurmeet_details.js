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
if (!connectionString) {
  console.error("Error: DATABASE_URL not found in .env file.");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query("SELECT id, data->>'name' as name, data->>'dob' as dob, data->>'fatherName' as father, data FROM employees WHERE data->>'name' LIKE '%Gurmeet%'");
    console.log(`Found ${res.rows.length} Gurmeet employees:`);
    res.rows.forEach(r => {
      console.log(`ID: ${r.id}, Name: ${r.name}, DOB: ${r.dob}, Father: ${r.father}`);
      console.log(JSON.stringify(r.data, null, 2));
      console.log('-----------------------------------');
    });
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main().catch(err => console.error(err));
