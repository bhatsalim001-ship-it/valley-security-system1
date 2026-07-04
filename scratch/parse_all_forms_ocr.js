const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const formsDir = path.join(__dirname, '..', 'Form_employeesMTS');

async function main() {
  const files = fs.readdirSync(formsDir)
    .filter(f => f.toLowerCase().endsWith('.jpg') || f.toLowerCase().endsWith('.jpeg') || f.toLowerCase().endsWith('.png'));

  console.log(`Found ${files.length} form images in Form_employeesMTS folder.`);

  const worker = await createWorker('eng');
  const results = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const imagePath = path.join(formsDir, file);
    console.log(`[${i+1}/${files.length}] Processing: ${file}...`);

    try {
      const { data: { text } } = await worker.recognize(imagePath);
      
      // Extract numbers (Aadhaar is 12 digits, UAN is 12 digits, Mobile is 10 digits, Account is 11-16 digits)
      const digits = text.replace(/[^0-9\s]/g, ' ');
      const numbers = digits.split(/\s+/).filter(n => n.length >= 8);

      results.push({
        file,
        textSnippet: text.substring(0, 800).replace(/\s+/g, ' '),
        numbers: [...new Set(numbers)]
      });

    } catch (err) {
      console.error(`Failed to process ${file}:`, err.message);
      results.push({ file, error: err.message });
    }
  }

  await worker.terminate();

  // Save parsed index
  fs.writeFileSync(
    path.join(__dirname, '..', 'scratch', 'parsed_forms_index.json'),
    JSON.stringify(results, null, 2)
  );
  console.log(`Done! Written index to scratch/parsed_forms_index.json`);
}

main().catch(err => console.error(err));
