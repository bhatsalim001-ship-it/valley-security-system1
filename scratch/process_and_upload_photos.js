const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const sharp = require('sharp');
const { createWorker } = require('tesseract.js');

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

// Directory paths (using relative paths for flexibility)
const absoluteImagesDir = path.join(__dirname, '..', 'employee_images');

// Command line arguments
const isLive = process.argv.includes('--live');

// Levenshtein distance for fuzzy matching
function getLevenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1  // deletion
          )
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// Clean and normalize strings for matching
function normalizeText(text) {
  if (!text) return "";
  return text.toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

async function main() {
  console.log("=============================================================");
  console.log(isLive ? "RUNNING IN LIVE/WRITE MODE" : "RUNNING IN DRY-RUN MODE (No changes will be written)");
  console.log("=============================================================");

  // Connect to PostgreSQL
  console.log("Connecting to PostgreSQL live database...");
  const client = new Client({ connectionString });
  await client.connect();

  let employees = [];
  try {
    const res = await client.query("SELECT id, data->>'name' as name, data FROM employees");
    employees = res.rows.map(row => ({
      id: row.id,
      name: row.name,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    }));
    console.log(`Successfully fetched ${employees.length} employees from live database.`);
  } catch (err) {
    console.error("Failed to fetch employees:", err);
    await client.end();
    return;
  }

  // Read images directory
  if (!fs.existsSync(absoluteImagesDir)) {
    console.error(`Images directory not found at: ${absoluteImagesDir}`);
    await client.end();
    return;
  }

  const files = fs.readdirSync(absoluteImagesDir)
    .filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png'))
    .filter(f => !f.toLowerCase().startsWith('screenshot')); // Ignore screenshots

  console.log(`Found ${files.length} images to process in employee_images folder.`);

  if (files.length === 0) {
    console.log("No images found. Exiting.");
    await client.end();
    return;
  }

  // Initialize OCR worker
  console.log("Initializing OCR engine...");
  const worker = await createWorker('eng');

  let matchCount = 0;
  let skipCount = 0;
  const matchLog = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imagePath = path.join(absoluteImagesDir, file);
    console.log(`\n[${i+1}/${files.length}] Processing: ${file}...`);

    try {
      // 1. Get metadata
      const metadata = await sharp(imagePath).metadata();
      const width = metadata.width;
      const height = metadata.height;

      // 2. Crop the bottom section where name is printed (bottom ~18% of image)
      const cropHeight = Math.round(height * 0.18);
      const cropTop = height - cropHeight;
      
      const bottomBuffer = await sharp(imagePath)
        .extract({ left: 0, top: cropTop, width: width, height: cropHeight })
        .toBuffer();

      // 3. OCR Text Extraction
      const { data: { text } } = await worker.recognize(bottomBuffer);
      const extractedNameRaw = text.trim();
      const cleanedOcrName = extractedNameRaw.replace(/[^A-Za-z\s]/g, "").replace(/\s+/g, " ").trim();
      
      console.log(`OCR Extracted Text: "${extractedNameRaw}" -> Cleaned: "${cleanedOcrName}"`);

      if (!cleanedOcrName || cleanedOcrName.length < 3) {
        console.log("⚠️ Could not extract a valid name from this photo. Skipping.");
        skipCount++;
        matchLog.push({ file, status: "SKIPPED_OCR_FAILED", ocrText: extractedNameRaw });
        continue;
      }

      // 4. Match with database employee
      const ocrNormalized = normalizeText(cleanedOcrName);
      const ocrWords = cleanedOcrName.toLowerCase().split(/\s+/).filter(Boolean);
      const possibleMatches = [];

      for (const emp of employees) {
        // Strip parenthetical text (e.g., "(Female)", "(I)") from database name for matching
        const cleanEmpName = emp.name.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
        const empNormalized = normalizeText(cleanEmpName);
        const empWords = cleanEmpName.toLowerCase().split(/\s+/).filter(Boolean);
        
        if (ocrWords.length === 0 || empWords.length === 0) continue;
        
        // Verify if database first name exists anywhere in the OCR words
        const firstEmpWord = empWords[0];
        let matchedOcrIndex = -1;

        for (let idx = 0; idx < ocrWords.length; idx++) {
          const w = ocrWords[idx];
          const d = getLevenshteinDistance(w, firstEmpWord);
          const sim = 1 - (d / Math.max(w.length, firstEmpWord.length));
          
          // Allow high similarity OR prefix match (require word length >= 3 to avoid single letter matches)
          const isPrefixMatch = (w.startsWith(firstEmpWord) || firstEmpWord.startsWith(w)) && Math.min(w.length, firstEmpWord.length) >= 3;
          if (sim > 0.80 || isPrefixMatch) {
            matchedOcrIndex = idx;
            break;
          }
        }

        if (matchedOcrIndex === -1) continue;

        // Slice OCR words from the matched first word index onwards to strip prefix noise
        const slicedOcrNormalized = normalizeText(ocrWords.slice(matchedOcrIndex).join(""));

        // Overall distance matching against the sliced OCR text
        const distance = getLevenshteinDistance(slicedOcrNormalized, empNormalized);
        const maxLen = Math.max(slicedOcrNormalized.length, empNormalized.length);
        const similarity = 1 - (distance / maxLen);

        // Match criteria:
        // 1. Exact normalized match of sliced text
        // 2. High overall similarity (> 0.80)
        // 3. Sliced OCR text contains database name or vice-versa (require at least 70% length overlap to avoid short sub-word matches like 'shah')
        const overlapPct = Math.min(slicedOcrNormalized.length, empNormalized.length) / Math.max(slicedOcrNormalized.length, empNormalized.length);
        const isSubstrMatch = (slicedOcrNormalized.includes(empNormalized) || empNormalized.includes(slicedOcrNormalized)) && overlapPct >= 0.70;
        const isFuzzyMatch = similarity > 0.80;

        if (slicedOcrNormalized === empNormalized || isSubstrMatch || isFuzzyMatch) {
          possibleMatches.push({ emp, similarity: slicedOcrNormalized === empNormalized ? 1.0 : similarity });
        }
      }

      let bestMatch = null;
      let matchStatus = "NO_MATCH";

      if (possibleMatches.length === 1) {
        bestMatch = possibleMatches[0].emp;
        matchStatus = "MATCHED";
      } else if (possibleMatches.length > 1) {
        console.log(`⚠️ AMBIGUOUS: "${cleanedOcrName}" matches multiple database records: ${possibleMatches.map(m => `${m.emp.name} (${m.emp.id})`).join(', ')}`);
        matchStatus = "AMBIGUOUS";
      }

      if (matchStatus === "MATCHED" && bestMatch) {
        matchCount++;
        console.log(`✅ MATCHED: "${cleanedOcrName}" matches Employee: "${bestMatch.name}" (${bestMatch.id})`);
        
        // 5. Crop headshot (removing white borders on all sides: crop inner 90% width, 75% height)
        // Keep 5% padding on left/right/top, cut off bottom 20%
        const headshotLeft = Math.round(width * 0.05);
        const headshotTop = Math.round(height * 0.05);
        const headshotWidth = Math.round(width * 0.90);
        const headshotHeight = Math.round(height * 0.75);

        const croppedBuffer = await sharp(imagePath)
          .extract({ left: headshotLeft, top: headshotTop, width: headshotWidth, height: headshotHeight })
          .jpeg({ quality: 90 })
          .toBuffer();

        const base64Photo = `data:image/jpeg;base64,${croppedBuffer.toString('base64')}`;
        
        matchLog.push({ 
          file, 
          status: "MATCHED", 
          ocrText: cleanedOcrName, 
          empName: bestMatch.name, 
          empId: bestMatch.id,
          photoSizeKB: Math.round(croppedBuffer.length / 1024)
        });

        // 6. Save/Upload in Live Mode
        if (isLive) {
          console.log(`Writing photo to database for ${bestMatch.id}...`);

          // Update employee_photos table
          const checkRes = await client.query('SELECT 1 FROM employee_photos WHERE employee_id = $1', [bestMatch.id]);
          if (checkRes.rows.length > 0) {
            await client.query('UPDATE employee_photos SET photo = $1, updated_at = NOW() WHERE employee_id = $2', [base64Photo, bestMatch.id]);
          } else {
            await client.query('INSERT INTO employee_photos (employee_id, photo, signature) VALUES ($1, $2, $3)', [bestMatch.id, base64Photo, ""]);
          }

          // Update main employee data documents state
          const updatedData = { ...bestMatch.data };
          if (!updatedData.documents) updatedData.documents = {};
          updatedData.documents.photo = `/api/employees/${bestMatch.id}/photo`;

          await client.query('UPDATE employees SET data = $1 WHERE id = $2', [JSON.stringify(updatedData), bestMatch.id]);
          console.log(`successfully updated database tables for ${bestMatch.id}.`);
        }
      } else {
        if (matchStatus === "AMBIGUOUS") {
          matchLog.push({ file, status: "AMBIGUOUS", ocrText: cleanedOcrName });
        } else {
          console.log(`❌ NO MATCH FOUND for extracted text: "${cleanedOcrName}"`);
          matchLog.push({ file, status: "NO_MATCH", ocrText: cleanedOcrName });
        }
      }

    } catch (err) {
      console.error(`Failed to process file ${file}:`, err);
      matchLog.push({ file, status: "ERROR", error: err.message });
    }
  }

  // Terminate OCR worker
  await worker.terminate();
  await client.end();

  console.log("\n=============================================================");
  console.log("PROCESSING SUMMARY");
  console.log("=============================================================");
  console.log(`Total Images Scanned: ${files.length}`);
  console.log(`Matched and Processed: ${matchCount}`);
  console.log(`Failed OCR / Skipped: ${skipCount}`);
  console.log(`No Matches Found: ${files.length - matchCount - skipCount}`);
  console.log("=============================================================");
  
  // Write dry run report to a file
  const absoluteReportPath = "C:\\Users\\salim\\.gemini\\antigravity\\brain\\7dbd627f-6ee4-40d8-8e11-80bf7ab183a3\\photo_processing_results.md";
  
  let reportText = `# Photo Processing Results\n\n`;
  reportText += `**Execution Mode:** ${isLive ? "LIVE/WRITE" : "DRY-RUN"}\n`;
  reportText += `**Date:** ${new Date().toLocaleString()}\n\n`;
  reportText += `## Statistics\n`;
  reportText += `- **Total Images Scanned:** ${files.length}\n`;
  reportText += `- **Matched and Processed:** ${matchCount}\n`;
  reportText += `- **Failed OCR/Skipped:** ${skipCount}\n`;
  reportText += `- **Unmatched Images:** ${files.length - matchCount - skipCount}\n\n`;
  reportText += `## Match Log\n\n`;
  reportText += `| File Name | OCR Extracted Name | Matched Employee | Employee ID | Status | Photo Size |\n`;
  reportText += `| :--- | :--- | :--- | :--- | :--- | :--- |\n`;
  
  for (const log of matchLog) {
    const ocr = log.ocrText || "-";
    const name = log.empName || "-";
    const id = log.empId || "-";
    const size = log.photoSizeKB ? `${log.photoSizeKB} KB` : "-";
    reportText += `| ${log.file} | ${ocr} | ${name} | ${id} | ${log.status} | ${size} |\n`;
  }

  fs.writeFileSync(absoluteReportPath, reportText);
  console.log(`Written report to: ${absoluteReportPath}`);
}

main().catch(err => {
  console.error("Global Error:", err);
});
