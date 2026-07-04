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

const empId = "VSA-1081";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const res = await client.query("SELECT data FROM employees WHERE id = $1", [empId]);
    if (res.rows.length === 0) {
      console.error("Employee not found");
      await client.end();
      return;
    }

    const rowData = res.rows[0].data;
    const empData = typeof rowData === 'string' ? JSON.parse(rowData) : rowData;

    // Update with handwritten sheet details
    empData.fatherName = "Moti Singh";
    empData.dob = "1982-03-23";
    empData.currentAddress = "Bandi Bagh Badgam";
    empData.permanentAddress = "Bandi Bagh Badgam";
    empData.pinCode = "191111";
    empData.aadhaarNumber = "803605090404";
    empData.aadhaarNo = "803605090404";
    empData.ipno = "1902010244"; // Insurance / IP number

    await client.query("UPDATE employees SET data = $1 WHERE id = $2", [JSON.stringify(empData), empId]);
    console.log(`Successfully updated Gurmeet Singh (I) details in database!`);

  } catch (err) {
    console.error(err);
  } finally {
    await client.end();
  }
}

main().catch(err => console.error(err));
