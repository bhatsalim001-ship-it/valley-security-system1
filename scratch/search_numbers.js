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

function normalize(str) {
  if (!str) return "";
  return str.replace(/[^0-9]/g, '');
}

async function main() {
  const indexData = JSON.parse(fs.readFileSync(path.join(__dirname, 'parsed_forms_index.json'), 'utf8'));

  const client = new Client({ connectionString });
  await client.connect();

  const res = await client.query("SELECT id, data->>'name' as name, data FROM employees");
  const employees = res.rows.map(row => ({
    id: row.id,
    name: row.name,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
  }));

  console.log(`Loaded ${employees.length} employees.`);

  for (const item of indexData) {
    if (item.error) continue;

    const numbers = item.numbers || [];
    for (const num of numbers) {
      const cleanNum = normalize(num);
      if (cleanNum.length < 6) continue;

      // Ignore common header numbers
      if (cleanNum.includes("9419689773") || cleanNum.includes("38060315") || cleanNum.includes("181152")) continue;

      // Look for a match in database employee records
      const matches = employees.filter(emp => {
        const uan = normalize(emp.data?.uanNumber || emp.data?.uanNo || "");
        const acc = normalize(emp.data?.bankAccount || "");
        const mob = normalize(emp.data?.mobile || "");
        const aadh = normalize(emp.data?.aadhaarNumber || emp.data?.aadhaarNo || "");
        
        return (uan.includes(cleanNum) || acc.includes(cleanNum) || mob.includes(cleanNum) || aadh.includes(cleanNum) || cleanNum.includes(uan) || cleanNum.includes(acc) || cleanNum.includes(mob) || cleanNum.includes(aadh));
      });

      if (matches.length > 0) {
        console.log(`FILE: ${item.file} ➡️ MATCH found for number "${num}":`);
        matches.forEach(m => {
          console.log(`  - Employee: ${m.name} (${m.id})`);
        });
      }
    }
  }

  await client.end();
}

main().catch(err => console.error(err));
