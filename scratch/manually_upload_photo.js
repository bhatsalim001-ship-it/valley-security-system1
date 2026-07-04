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

const empId = "VSA-1110";
const filename = "WhatsApp Image 2026-07-01 at 4.45.25 PM.jpeg";
const imagePath = path.join(__dirname, '..', 'employee_images', filename);

async function main() {
  console.log(`Manually uploading photo "${filename}" for Employee ID: ${empId}...`);

  if (!fs.existsSync(imagePath)) {
    console.error(`Error: Photo not found at path: ${imagePath}`);
    return;
  }

  // Connect to PostgreSQL
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Fetch employee metadata to verify existence and get data object
    const empRes = await client.query('SELECT data FROM employees WHERE id = $1', [empId]);
    if (empRes.rows.length === 0) {
      console.error(`Error: Employee ${empId} not found in database.`);
      await client.end();
      return;
    }

    const rowData = empRes.rows[0].data;
    const empData = typeof rowData === 'string' ? JSON.parse(rowData) : rowData;
    console.log(`Matched employee record: "${empData.name}"`);

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
    console.log(`Photo cropped and compressed to ${Math.round(croppedBuffer.length / 1024)} KB.`);

    // 3. Write photo to employee_photos table
    const checkRes = await client.query('SELECT 1 FROM employee_photos WHERE employee_id = $1', [empId]);
    if (checkRes.rows.length > 0) {
      await client.query('UPDATE employee_photos SET photo = $1, updated_at = NOW() WHERE employee_id = $2', [base64Photo, empId]);
      console.log(`Updated photo in employee_photos table.`);
    } else {
      await client.query('INSERT INTO employee_photos (employee_id, photo, signature) VALUES ($1, $2, $3)', [empId, base64Photo, ""]);
      console.log(`Inserted photo in employee_photos table.`);
    }

    // 4. Update photo path in main employees data document
    if (!empData.documents) empData.documents = {};
    empData.documents.photo = `/api/employees/${empId}/photo`;

    await client.query('UPDATE employees SET data = $1 WHERE id = $2', [JSON.stringify(empData), empId]);
    console.log(`Successfully updated photo URL in main employee profile data.`);
    console.log(`✅ Upload complete!`);

  } catch (err) {
    console.error("Upload failed:", err);
  } finally {
    await client.end();
  }
}

main().catch(err => console.error(err));
