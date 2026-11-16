const { GoogleGenerativeAI } = require('@google/generative-ai');
const sharp = require('sharp');

/**
 * Clean up text returned by AI
 */
function cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/^['"\s]+|['"\s]+$/g, '');
}

/**
 * Parse base64 image data URL to buffer
 */
function dataUrlToBuffer(dataUrl) {
    const matches = dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
        throw new Error('Invalid image format. Must be base64 data URL.');
    }
    return Buffer.from(matches[2], 'base64');
}

/**
 * Process a completed registration form image.
 * Extracts details via Gemini 2.5 Flash, crops the photo via sharp,
 * and cleans the cropped images.
 */
async function processRegistrationForm(base64Image, apiKey) {
    if (!apiKey) {
        throw new Error('Gemini API Key is not configured on the server.');
    }

    const imageBuffer = dataUrlToBuffer(base64Image);
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;

    // 1. Send the image to Gemini (primary: gemini-3.8-flash, fallback: gemini-2.5-flash)
    const genAI = new GoogleGenerativeAI(apiKey);
    const primaryModel = (process.env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
    const fallbackModel = 'gemini-2.5-flash';
    let model = genAI.getGenerativeModel({ model: primaryModel });

    const imageParts = [
        {
            inlineData: {
                data: imageBuffer.toString('base64'),
                mimeType: 'image/jpeg'
            }
        }
    ];

    const prompt = `You are an expert OCR system. Extract all handwritten text details from this completed Employee Registration Form image.
Return a raw JSON object matching the exact schema below. If any field is empty or unreadable, return empty string:

{
  "name": "Employee Name",
  "fatherName": "Father or Spouse Name (S/O)",
  "address": "Full permanent/current Address (R/O)",
  "pincode": "Pincode",
  "dob": "Date of Birth (CRITICAL: Convert any handwritten date format like DD-MM-YYYY, DD/MM/YYYY, or verbal dates into standard YYYY-MM-DD format strictly. Example: '17-06-2016' -> '2016-06-17')",
  "gender": "Gender (Male/Female/Other)",
  "bloodGroup": "Blood Group",
  "mobile": "Contact/Mobile No.",
  "ifsc": "IFSC code",
  "bankAccount": "Bank Account Detail",
  "designation": "Designation / Post",
  "department": "Deputed At / Client Site / Department",
  "esic": "ESIC No.",
  "uan": "UAN / PF No.",
  "aadhaar": "Aadhaar Card No.",
  "joiningDate": "Date of Joining (CRITICAL: Convert any handwritten date format like DD-MM-YYYY into standard YYYY-MM-DD format strictly. Example: '17-06-2016' -> '2016-06-17')",
  "salary": "Salary/Month",
  "detectedPhotoBox": {
    "ymin": "top of photo box as integer percentage (0 to 100)",
    "xmin": "left of photo box as integer percentage (0 to 100)",
    "ymax": "bottom of photo box as integer percentage (0 to 100)",
    "xmax": "right of photo box as integer percentage (0 to 100)"
  }
}

Guidelines for bounding boxes:
- Look for the pasted passport photograph at the top-right. Its standard coordinates are roughly ymin=10, xmin=80, ymax=26, xmax=96.
- Return integer percentages (0-100) relative to the full image width and height.

Do not include markdown code block tags. Return only the raw JSON.`;

    let result;
    try {
        result = await model.generateContent([...imageParts, prompt]);
    } catch (err) {
        const isTransientFailure = err.message && (
            err.message.includes('503') ||
            err.message.includes('high demand') ||
            err.message.includes('overloaded') ||
            err.message.includes('ResourceExhausted') ||
            err.message.includes('fetch failed') ||
            err.message.includes('ECONNRESET') ||
            err.message.includes('ETIMEDOUT')
        );
        if (isTransientFailure && primaryModel !== fallbackModel) {
            console.warn(`[Form Scanner] Primary model ${primaryModel} transient failure. Auto-falling back to ${fallbackModel}...`);
            const fallbackGenModel = genAI.getGenerativeModel({ model: fallbackModel });
            result = await fallbackGenModel.generateContent([...imageParts, prompt]);
        } else {
            throw err;
        }
    }
    const responseText = result.response.text().trim();
    
    let jsonText = responseText;
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.substring(7);
    }
    if (jsonText.startsWith('```')) {
        jsonText = jsonText.substring(3);
    }
    if (jsonText.endsWith('```')) {
        jsonText = jsonText.substring(0, jsonText.length - 3);
    }
    jsonText = jsonText.trim();

    let data;
    try {
        data = JSON.parse(jsonText);
    } catch (e) {
        console.error("Failed to parse Gemini JSON output:", responseText);
        throw new Error("AI returned invalid JSON formatting. Please try again.");
    }

    // 2. Crop the Passport Photo
    let photoBox = { ymin: 11, xmin: 81, ymax: 25, xmax: 96 }; // default standard presets
    if (data.detectedPhotoBox && 
        data.detectedPhotoBox.ymin !== undefined && 
        data.detectedPhotoBox.xmin !== undefined &&
        data.detectedPhotoBox.ymax !== undefined && 
        data.detectedPhotoBox.xmax !== undefined) {
        
        const ymin = parseInt(data.detectedPhotoBox.ymin);
        const xmin = parseInt(data.detectedPhotoBox.xmin);
        const ymax = parseInt(data.detectedPhotoBox.ymax);
        const xmax = parseInt(data.detectedPhotoBox.xmax);

        if (ymin < ymax && xmin < xmax && ymin >= 0 && xmax <= 100) {
            photoBox = { ymin, xmin, ymax, xmax };
            console.log("Using Gemini-detected photo coordinates:", photoBox);
        }
    }

    // Convert percentages to pixels
    const photoLeft = Math.floor((photoBox.xmin / 100) * width);
    const photoTop = Math.floor((photoBox.ymin / 100) * height);
    const photoWidth = Math.floor(((photoBox.xmax - photoBox.xmin) / 100) * width);
    const photoHeight = Math.floor(((photoBox.ymax - photoBox.ymin) / 100) * height);

    let croppedPhotoBase64 = null;
    try {
        const croppedPhotoBuffer = await sharp(imageBuffer)
            .extract({ left: photoLeft, top: photoTop, width: photoWidth, height: photoHeight })
            .resize(300, 400, { fit: 'cover' }) // Standard portrait proportions
            .jpeg({ quality: 85 })
            .toBuffer();
        
        croppedPhotoBase64 = `data:image/jpeg;base64,${croppedPhotoBuffer.toString('base64')}`;
    } catch (err) {
        console.error("Sharp photo cropping failed, using fallback:", err);
    }

    // Clean dynamic detection values from client response payload
    delete data.detectedPhotoBox;

    return {
        success: true,
        data: {
            ...data,
            photo: croppedPhotoBase64,
            signature: null // No signature scan as requested
        }
    };
}

module.exports = {
    processRegistrationForm
};
