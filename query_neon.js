const { Client } = require('pg');

const connectionString = "postgresql://neondb_owner:npg_cXIo8r0OBYaJ@ep-shiny-king-aosr4w3y-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log("Connected to Neon PostgreSQL database!");

  try {
    const res = await client.query(`
      SELECT id, name, "fatherName", dob, gender, mobile, designation, department, "bloodGroup"
      FROM "Employee"
      WHERE UPPER(department) LIKE '%NIFT%'
    `);
    
    console.log(`Found ${res.rows.length} NIFT employees in Neon:`);
    for (const emp of res.rows) {
      const dob = emp.dob;
      let age = 'Unknown';
      if (dob) {
        const dobDate = new Date(dob);
        age = 2026 - dobDate.getFullYear();
      }
      console.log(`ID: ${emp.id}, Name: ${emp.name}, Dept: ${emp.department}, Age: ${age}, DOB: ${dob}, Mobile: ${emp.mobile}, BloodGroup: ${emp.bloodGroup}`);
    }
  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    await client.end();
  }
}

main();
