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
    // Fetch all active employees in Accountant General's Office
    const res = await client.query(`
      SELECT id, data->>'name' as name, data->>'department' as department, data->>'status' as status, data
      FROM employees
      WHERE (UPPER(data->>'department') LIKE '%ACCOUNTANT GENERAL%' 
         OR UPPER(data->>'department') LIKE '%AG OFFICE%'
         OR UPPER(data->>'department') LIKE '%A.G.%')
        AND (data->>'status' IS NULL OR data->>'status' = 'Active')
      ORDER BY name ASC
    `);

    const agEmployees = res.rows;
    console.log(`\nFound ${agEmployees.length} active AG Office employees in database.`);

    // Fetch list of employee IDs that have photos in employee_photos table
    const photoRes = await client.query("SELECT employee_id FROM employee_photos WHERE photo IS NOT NULL AND photo != ''");
    const photoIds = new Set(photoRes.rows.map(r => r.employee_id));

    const pendingPhotos = [];
    const hasPhotos = [];

    for (const emp of agEmployees) {
      const hasPhotoInMetadata = emp.data?.documents?.photo;
      const hasPhotoInTable = photoIds.has(emp.id);

      if (hasPhotoInMetadata || hasPhotoInTable) {
        hasPhotos.push(emp);
      } else {
        pendingPhotos.push(emp);
      }
    }

    console.log(`\n=============================================================`);
    console.log(`AG OFFICE EMPLOYEES PHOTO STATUS SUMMARY`);
    console.log(`=============================================================`);
    console.log(`Total Employees in AG Office: ${agEmployees.length}`);
    console.log(`Employees with Photos: ${hasPhotos.length}`);
    console.log(`Employees PENDING Photos: ${pendingPhotos.length}`);
    console.log(`=============================================================\n`);

    if (pendingPhotos.length > 0) {
      console.log(`PENDING PHOTO LIST (${pendingPhotos.length} guards):`);
      pendingPhotos.forEach((emp, index) => {
        const designation = emp.data?.designation || '-';
        console.log(`${index + 1}. [${emp.id}] ${emp.name} - ${designation} (Dept: ${emp.department})`);
      });
    } else {
      console.log("All AG Office employees have photos uploaded!");
    }

  } catch (err) {
    console.error("Database query failed:", err);
  } finally {
    await client.end();
  }
}

main().catch(err => console.error(err));
