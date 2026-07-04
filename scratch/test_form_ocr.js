const { createWorker } = require('tesseract.js');
const path = require('path');

async function main() {
  const worker = await createWorker('eng');
  const imagePath = path.join(__dirname, '..', 'Form_employeesMTS', 'WhatsApp Image 2026-07-03 at 2.53.19 PM.jpeg');
  
  console.log(`Running OCR on: ${imagePath}`);
  const { data: { text } } = await worker.recognize(imagePath);
  console.log("=========================================");
  console.log("EXTRACTED TEXT:");
  console.log("=========================================");
  console.log(text);
  console.log("=========================================");
  
  await worker.terminate();
}

main().catch(err => console.error(err));
