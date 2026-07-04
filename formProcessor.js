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
 * Extracts details via Gemini 2.5 Flash, crops the photo & signature via sharp,
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

    // 1. Send the image to Gemini 2.5 Flash
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

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
  "dob": "Date of Birth (in YYYY-MM-DD format if readable, or exact string)",
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
  "joiningDate": "Date of Joining (in YYYY-MM-DD format if readable)",
  "salary": "Salary/Month",
  "detectedPhotoBox": {
    "ymin": "top of photo box as integer percentage (0 to 100)",
    "xmin": "left of photo box as integer percentage (0 to 100)",
    "ymax": "bottom of photo box as integer percentage (0 to 100)",
    "xmax": "right of photo box as integer percentage (0 to 100)"
  },
  "detectedSignatureBox": {
    "ymin": "top of signature area as integer percentage (0 to 100)",
    "xmin": "left of signature area as integer percentage (0 to 100)",
    "ymax": "bottom of signature area as integer percentage (0 to 100)",
    "xmax": "right of signature area as integer percentage (0 to 100)"
  }
}

Guidelines for bounding boxes:
- Look for the pasted passport photograph at the top-right. Its standard coordinates are roughly ymin=10, xmin=80, ymax=26, xmax=96.
- Look for the handwritten signature above the "Sig.Of Employee" line at the bottom. Standard coordinates are roughly ymin=88, xmin=37, ymax=94, xmax=70.
- Return integer percentages (0-100) relative to the full image width and height.

Do not include markdown code block tags. Return only the raw JSON.`;

    const result = await model.generateContent([...imageParts, prompt]);
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

    // 3. Crop the Signature
    let sigBox = { ymin: 88, xmin: 38, ymax: 94, xmax: 68 }; // default standard presets
    if (data.detectedSignatureBox && 
        data.detectedSignatureBox.ymin !== undefined && 
        data.detectedSignatureBox.xmin !== undefined &&
        data.detectedSignatureBox.ymax !== undefined && 
        data.detectedSignatureBox.xmax !== undefined) {
        
        const ymin = parseInt(data.detectedSignatureBox.ymin);
        const xmin = parseInt(data.detectedSignatureBox.xmin);
        const ymax = parseInt(data.detectedSignatureBox.ymax);
        const xmax = parseInt(data.detectedSignatureBox.xmax);

        if (ymin < ymax && xmin < xmax && ymin >= 0 && xmax <= 100) {
            sigBox = { ymin, xmin, ymax, xmax };
            console.log("Using Gemini-detected signature coordinates:", sigBox);
        }
    }

    const sigLeft = Math.floor((sigBox.xmin / 100) * width);
    const sigTop = Math.floor((sigBox.ymin / 100) * height);
    const sigWidth = Math.floor(((sigBox.xmax - sigBox.xmin) / 100) * width);
    const sigHeight = Math.floor(((sigBox.ymax - sigBox.ymin) / 100) * height);

    let croppedSigBase64 = null;
    try {
        const croppedSigBuffer = await sharp(imageBuffer)
            .extract({ left: sigLeft, top: sigTop, width: sigWidth, height: sigHeight })
            .resize(400, 120, { fit: 'inside' })
            .png()
            .toBuffer();
        
        croppedSigBase64 = `data:image/png;base64,${croppedSigBuffer.toString('base64')}`;
    } catch (err) {
        console.error("Sharp signature cropping failed:", err);
    }

    // Clean dynamic detection values from client response payload
    delete data.detectedPhotoBox;
    delete data.detectedSignatureBox;

    return {
        success: true,
        data: {
            ...data,
            photo: croppedPhotoBase64,
            signature: croppedSigBase64
        }
    };
}

module.exports = {
    processRegistrationForm
};
