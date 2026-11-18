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
 * Robust JSON extraction from AI response.
 * Handles markdown code blocks, pre/post narrative text, and trailing commas.
 */
function parseGeminiJson(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error('Empty or invalid response from AI model.');
    }
    let str = rawText.trim();
    // 1. Look for fenced markdown blocks (```json ... ``` or ``` ... ```)
    const codeBlockMatch = str.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
        str = codeBlockMatch[1].trim();
    } else {
        // 2. Fall back to finding the outermost JSON object or array delimiters
        const firstObj = str.indexOf('{');
        const firstArr = str.indexOf('[');
        let startIdx = -1;
        let endIdx = -1;
        if (firstObj !== -1 && (firstArr === -1 || firstObj < firstArr)) {
            startIdx = firstObj;
            endIdx = str.lastIndexOf('}');
        } else if (firstArr !== -1) {
            startIdx = firstArr;
            endIdx = str.lastIndexOf(']');
        }
        if (startIdx !== -1 && endIdx > startIdx) {
            str = str.substring(startIdx, endIdx + 1).trim();
        }
    }
    // Neutralize trailing commas before closing braces/brackets
    str = str.replace(/,\s*([\]}])/g, '$1');
    return JSON.parse(str);
}

/**
 * Normalize date strings (DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY, YYYY-MM-DD, or verbal dates)
 * to standard ISO YYYY-MM-DD format.
 */
function normalizeDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return '';
    const trimmed = dateStr.trim();
    if (!trimmed) return '';

    // 1. YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (ymdMatch) {
        const y = parseInt(ymdMatch[1], 10);
        const m = parseInt(ymdMatch[2], 10);
        const d = parseInt(ymdMatch[3], 10);
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    // 2. DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
        const d = parseInt(dmyMatch[1], 10);
        const m = parseInt(dmyMatch[2], 10);
        const y = parseInt(dmyMatch[3], 10);
        if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
    }

    // 3. Fallback date parser for textual dates e.g. "15 Aug 1990"
    try {
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = parsed.getMonth() + 1;
            const d = parsed.getDate();
            if (y >= 1900 && y <= 2100) {
                return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            }
        }
    } catch (_) {}

    return trimmed;
}

/**
 * Normalize Aadhaar numbers: strips non-digits, formats as XXXX-XXXX-XXXX, extracts last 4.
 */
function normalizeAadhaar(aadhaarStr) {
    if (!aadhaarStr) return { raw: '', formatted: '', last4: '' };
    const digits = String(aadhaarStr).replace(/\D/g, '');
    if (digits.length === 12) {
        const formatted = `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8, 12)}`;
        const last4 = digits.slice(-4);
        return { raw: digits, formatted, last4 };
    }
    return {
        raw: digits || String(aadhaarStr).trim(),
        formatted: digits || String(aadhaarStr).trim(),
        last4: digits.length >= 4 ? digits.slice(-4) : ''
    };
}

/**
 * Normalize mobile numbers to 10 digits.
 */
function normalizeMobile(mobileStr) {
    if (!mobileStr) return '';
    const digits = String(mobileStr).replace(/\D/g, '');
    if (digits.length >= 10) {
        return digits.slice(-10);
    }
    return digits;
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
    
    let data;
    try {
        data = parseGeminiJson(responseText);
    } catch (e) {
        console.error("Failed to parse Gemini JSON output:", responseText, e.message);
        throw new Error("AI returned invalid JSON formatting. Please try again.");
    }

    // Normalize OCR extracted fields
    if (data.dob) data.dob = normalizeDate(data.dob);
    if (data.joiningDate) data.joiningDate = normalizeDate(data.joiningDate);
    if (data.mobile) data.mobile = normalizeMobile(data.mobile) || data.mobile;
    if (data.aadhaar) {
        const adh = normalizeAadhaar(data.aadhaar);
        data.aadhaar = adh.raw || data.aadhaar;
        data.aadhaarFormatted = adh.formatted;
        data.aadhaarLast4 = adh.last4;
    }
    if (data.bloodGroup) data.bloodGroup = (data.bloodGroup || '').toUpperCase().trim();

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
    processRegistrationForm,
    parseGeminiJson,
    normalizeDate,
    normalizeAadhaar,
    normalizeMobile
};
