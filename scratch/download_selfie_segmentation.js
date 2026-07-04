const fs = require('fs');
const https = require('https');
const path = require('path');

const targetDir = path.join(__dirname, '../public/lib/selfie_segmentation');

if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

const files = [
    'selfie_segmentation.js',
    'selfie_segmentation_solution_simd_wasm_bin.js',
    'selfie_segmentation_solution_wasm_bin.js',
    'selfie_segmentation_solution_simd_wasm_bin.wasm',
    'selfie_segmentation_solution_wasm_bin.wasm',
    'selfie_segmentation.binarypb',
    'selfie_segmentation_landscape.tflite',
    'selfie_segmentation.tflite'
];

const cdnBase = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@0.1.1632777926/'; // Using the exact version jsdelivr resolved to

function downloadFile(fileName) {
    const fileUrl = cdnBase + fileName;
    const destPath = path.join(targetDir, fileName);
    const fileStream = fs.createWriteStream(destPath);
    
    console.log(`Downloading ${fileName}...`);
    
    https.get(fileUrl, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
            // Handle redirect
            https.get(response.headers.location, (redirectResponse) => {
                redirectResponse.pipe(fileStream);
            });
        } else {
            response.pipe(fileStream);
        }
        
        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Successfully saved ${fileName}`);
        });
    }).on('error', (err) => {
        fs.unlink(destPath, () => {});
        console.error(`Error downloading ${fileName}:`, err.message);
    });
}

files.forEach(fileName => {
    downloadFile(fileName);
});
