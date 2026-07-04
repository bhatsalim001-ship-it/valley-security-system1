const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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

const apiKey = process.env.GEMINI_API_KEY;

async function testModel(modelName) {
  try {
    console.log(`Testing model: "${modelName}"...`);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelName });
    const result = await model.generateContent("Hello, write a 3-word response.");
    const response = await result.response;
    console.log(`✅ Success with "${modelName}":`, response.text().trim());
    return true;
  } catch (err) {
    console.log(`❌ Failed with "${modelName}":`, err.message);
    return false;
  }
}

async function main() {
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in environment.");
    return;
  }

  const models = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-latest",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemini-pro"
  ];

  for (const m of models) {
    const ok = await testModel(m);
    if (ok) {
      console.log(`Found working model: ${m}`);
      break;
    }
  }
}

main().catch(err => console.error(err));
