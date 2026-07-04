const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const sharp = require('sharp');

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

// Swapped configuration
const targets = [
  {
    empId: "VSA-1081", // Gurmeet Singh (I) - First form (Moti Singh)
    filename: "WhatsApp Image 2026-07-02 at 10.26.11 AM.jpeg", // Pink Turban photo from directory
    details: {
      fatherName: "Moti Singh",
      dob: "1982-03-23",
      currentAddress: "Bandi Bagh Badgam",
      permanentAddress: "Bandi Bagh Badgam",
      pinCode: "191111",
      aadhaarNumber: "803605090404",
      aadhaarNo: "803605090404",
      ipno: "1902010244"
    }
  },
  {
    empId: "VSA-1089", // Gurmeet Singh (Ii) - Second form (Kuldeep Singh)
    filename: "WhatsApp Image 2026-07-02 at 11.47.56 AM.jpeg", // Navy Turban photo from directory
    details: {
      fatherName: "Kuldeep Singh",
      dob: "1999-09-10",
      currentAddress: "Q4, Peth Gam Gadoora Pulwama",
      permanentAddress: "Q4, Peth Gam Gadoora Pulwama",
      pinCode: "192123",
      aadhaarNumber: "982326405490",
      aadhaarNo: "982326405490",
      esic: "191310200"
    }
  }
];

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  for (const t of targets) {
    console.log(`\n=============================================================`);
    console.log(`Updating details and uploading photo for ${t.empId}...`);
    console.log(`=============================================================`);

    const imagePath = path.join(__dirname, '..', 'employee_images', t.filename);

    if (!fs.existsSync(imagePath)) {
      console.error(`Error: Photo not found at: ${imagePath}`);
      continue;
    }

    try {
      // 1. Fetch employee metadata
      const empRes = await client.query('SELECT data FROM employees WHERE id = $1', [t.empId]);
      if (empRes.rows.length === 0) {
        console.error(`Error: Employee ${t.empId} not found in database.`);
        continue;
      }

      const rowData = empRes.rows[0].data;
      const empData = typeof rowData === 'string' ? JSON.parse(rowData) : rowData;
      console.log(`Original Name in DB: "${empData.name}"`);

      // Merge handwritten details
      Object.assign(empData, t.details);

      // 2. Load and crop the image
      const metadata = await sharp(imagePath).metadata();
      const width = metadata.width;
      const height = metadata.height;

      // Crop headshot (removing white borders: inner 90% width, 75% height)
      const headshotLeft = Math.round(width * 0.05);
      const headshotTop = Math.round(height * 0.05);
      const headshotWidth = Math.round(width * 0.90);
      const headshotHeight = Math.round(height * 0.75);

      const croppedBuffer = await sharp(imagePath)
        .extract({ left: headshotLeft, top: headshotTop, width: headshotWidth, height: headshotHeight })
        .jpeg({ quality: 90 })
        .toBuffer();

      const base64Photo = `data:image/jpeg;base64,${croppedBuffer.toString('base64')}`;
      console.log(`Photo cropped to ${Math.round(croppedBuffer.length / 1024)} KB.`);

      // 3. Write photo to employee_photos table
      const checkRes = await client.query('SELECT 1 FROM employee_photos WHERE employee_id = $1', [t.empId]);
      if (checkRes.rows.length > 0) {
        await client.query('UPDATE employee_photos SET photo = $1, updated_at = NOW() WHERE employee_id = $2', [base64Photo, t.empId]);
        console.log(`Updated photo in employee_photos table.`);
      } else {
        await client.query('INSERT INTO employee_photos (employee_id, photo, signature) VALUES ($1, $2, $3)', [t.empId, base64Photo, ""]);
        console.log(`Inserted photo in employee_photos table.`);
      }

      // 4. Update photo path in main employees data document
      if (!empData.documents) empData.documents = {};
      empData.documents.photo = `/api/employees/${t.empId}/photo`;

      await client.query('UPDATE employees SET data = $1 WHERE id = $2', [JSON.stringify(empData), t.empId]);
      console.log(`Successfully updated database records for ${t.empId}.`);
      console.log(`✅ Update complete for ${t.empId}!`);

    } catch (err) {
      console.error(`Upload failed for ${t.empId}:`, err);
    }
  }

  await client.end();
}

main().catch(err => console.error(err));
