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

const unmatched = [
  "Mohammad Iqbal",
  "Shahnawaz",
  "Heena",
  "Faizan",
  "Irshad",
  "Narinder",
  "Manohar",
  "Mudasir",
  "Mohassin"
];

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    for (const name of unmatched) {
      const res = await client.query("SELECT id, data->>'name' as name, data->>'designation' as designation FROM employees WHERE data->>'name' ILIKE $1", [`%${name}%`]);
      console.log(`Unmatched search for "${name}":`);
      res.rows.forEach(r => {
        console.log(`  - Match: ${r.name} (ID: ${r.id}, Desig: ${r.designation})`);
      });
    }
  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main().catch(err => console.error(err));
