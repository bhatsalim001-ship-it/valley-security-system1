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

const manualMappings = [
  { dbId: "VSA-1124", parentage: "Mohammad Asadullah", address: "Jahangir pora Baramulla", designation: "Canteen Attendent" }, // Mohammad Iqbal Wani
  { dbId: "VSA-1111", parentage: "Ab Gaffar Lone", address: "Semthan Bijehara Anantnag", designation: "DEO" }, // Shahnawaz Gaffar Lone
  { dbId: "VSA-1064", parentage: "Mohd Shoib Baba", address: "Hathi Khan Kathi Darwaza Sgr", designation: "MTS" }, // Heena Nazir
  { dbId: "VSA-1061", parentage: "Manzoor Ahmad Rather", address: "Kursoo Padshahi Bagh", designation: "MTS" }, // Faizan Manzoor
  { dbId: "VSA-1074", parentage: "Mohammad Yousuf Zargar", address: "Gousia Colony Baghi Mehtab", designation: "MTS" }, // Irshad Ahmad Zargar
  { dbId: "VSA-1104", parentage: "Som Raj", address: "Pathankot Gurdaspora Punjab", designation: "MTS" }, // Narinder Kumar
  { dbId: "VSA-1105", parentage: "Shambhu", address: "Village Ramnagar Udhampur", designation: "MTS" }, // Manohar Lal
  { dbId: "VSA-1079", parentage: "Riyaz Ahmad Shah", address: "Derapora Sempora Kulgam", designation: "MTS" }, // Mudasir Ahmed Shah
  { dbId: "VSA-1091", parentage: "Nissar Ahmad Bhat", address: "Tailbal Hazratbal Sgr", designation: "MTS" } // Mohammad Mohassin Bhat
];

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  let updateCount = 0;

  for (const mapping of manualMappings) {
    try {
      const res = await client.query("SELECT data FROM employees WHERE id = $1", [mapping.dbId]);
      if (res.rows.length > 0) {
        const rowData = res.rows[0].data;
        const empData = typeof rowData === 'string' ? JSON.parse(rowData) : rowData;

        empData.fatherName = mapping.parentage;
        empData.currentAddress = mapping.address;
        empData.permanentAddress = mapping.address;
        empData.designation = mapping.designation;

        await client.query("UPDATE employees SET data = $1 WHERE id = $2", [JSON.stringify(empData), mapping.dbId]);
        console.log(`✅ Manually Updated: "${empData.name}" (${mapping.dbId})`);
        updateCount++;
      } else {
        console.error(`Error: ID ${mapping.dbId} not found in database.`);
      }
    } catch (err) {
      console.error(`Failed to update ${mapping.dbId}:`, err);
    }
  }

  console.log(`\n=============================================================`);
  console.log(`MANUAL UPDATE SUMMARY`);
  console.log(`=============================================================`);
  console.log(`Successfully updated ${updateCount} out of ${manualMappings.length} remaining employees.`);
  console.log(`=============================================================`);

  await client.end();
}

main().catch(err => console.error(err));
