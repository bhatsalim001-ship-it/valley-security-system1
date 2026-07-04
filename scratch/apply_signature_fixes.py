import os

file_path = 'public/app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Define caching and processing functions
processed_functions = """// Global cache for processed signature base64 strings to ensure fast rendering
const VSA_PROCESSED_SIG_CACHE = {};

/**
 * Programmatically processes a signature image (removes gray background, applies
 * smooth anti-aliased transparency, and tones strokes to a realistic navy-black ink).
 */
function processSignatureBase64(base64Str, targetColor = {r: 16, g: 32, b: 82}) {
    return new Promise((resolve) => {
        if (!base64Str || !base64Str.startsWith('data:image/')) {
            resolve(base64Str);
            return;
        }
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    const r = data[i];
                    const g = data[i+1];
                    const b = data[i+2];
                    const originalAlpha = data[i+3];
                    
                    // Calculate brightness (luminance)
                    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                    
                    // Thresholds for realistic ink and background removal
                    const upperThreshold = 220; // values above this are paper background
                    const lowerThreshold = 140; // values below this are solid ink
                    
                    let alphaFactor = 1.0;
                    if (brightness >= upperThreshold) {
                        alphaFactor = 0.0;
                    } else if (brightness <= lowerThreshold) {
                        alphaFactor = 1.0;
                    } else {
                        // Smooth transition for edge anti-aliasing
                        alphaFactor = 1.0 - (brightness - lowerThreshold) / (upperThreshold - lowerThreshold);
                    }
                    
                    const newAlpha = Math.round(originalAlpha * alphaFactor);
                    
                    // Check if this pixel is part of the background to avoid turning it blue/black if it's transparent
                    if (newAlpha > 0) {
                        // Tone ink to target realistic navy-black ink color
                        data[i] = targetColor.r;
                        data[i+1] = targetColor.g;
                        data[i+2] = targetColor.b;
                    }
                    data[i+3] = newAlpha;
                }
                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL('image/png'));
            } catch (e) {
                console.error("Signature processing failed:", e);
                resolve(base64Str);
            }
        };
        img.onerror = () => {
            resolve(base64Str);
        };
        img.src = base64Str;
    });
}

function getProcessedSignature(src) {
    if (!src || !src.startsWith('data:image/')) {
        return src;
    }
    if (VSA_PROCESSED_SIG_CACHE[src]) {
        return VSA_PROCESSED_SIG_CACHE[src];
    }
    
    // Cache original temporarily to prevent multiple simultaneous processing requests
    VSA_PROCESSED_SIG_CACHE[src] = src;
    
    processSignatureBase64(src).then(processed => {
        VSA_PROCESSED_SIG_CACHE[src] = processed;
        
        // Refresh previews
        const selectedId = document.getElementById('id-select-employee')?.value;
        if (selectedId) {
            loadIdCardDetails(selectedId);
        }
        updateLivePreview();
        
        // Also update any inline previews
        const recSigEl = document.getElementById('rec-signature-img');
        if (recSigEl && recSigEl.src === src) {
            recSigEl.src = processed;
        }
    });
    
    return src;
}

"""

target1 = '// Helpers to fetch the default VSA logo and signature scans from the templates array.'
if target1 in content:
    content = content.replace(target1, processed_functions + target1)
    print("Match 1: Cache and helper functions injected successfully.")
else:
    print("Error: Match 1 target not found.")

# 2. Modify getVsaDefaultSig
target2 = """function getVsaDefaultSig() {
    const tpl = VSA_STATE.templates.find(t => t.id === 'tpl-default');
    const dbSig = (tpl && tpl.signature) ? tpl.signature : '';
    return dbSig.startsWith('data:image/') ? dbSig : VSA_FALLBACK_SIG;
}"""

replacement2 = """function getVsaDefaultSig() {
    const tpl = VSA_STATE.templates.find(t => t.id === 'tpl-default');
    const dbSig = (tpl && tpl.signature) ? tpl.signature : '';
    const rawSig = dbSig.startsWith('data:image/') ? dbSig : VSA_FALLBACK_SIG;
    return getProcessedSignature(rawSig);
}"""

if target2 in content:
    content = content.replace(target2, replacement2)
    print("Match 2: getVsaDefaultSig modified successfully.")
else:
    # Let's try with looser line endings or formatting
    print("Error: Match 2 target not found. Checking variant.")

# 3. Modify generateIdCardHtml signature resolution
target3 = """    // Resolve Signature (permanent scan)
    let sigSrc = '';
    if (template.signature) {
        if (template.signature === 'preset-vsa-sig') {
            const vsaSig = getVsaDefaultSig();
            if (vsaSig && vsaSig.startsWith('data:image/')) {
                sigSrc = vsaSig;
            } else {
                sigSrc = getPresetSig1('#000000');
            }
        } else if (template.signature === 'preset-sig1') {
            sigSrc = getPresetSig1('#000000');
        } else if (template.signature === 'preset-sig2') {
            sigSrc = getPresetSig2('#000000');
        } else {
            sigSrc = template.signature;
        }
    } else {
        sigSrc = getPresetSig1('#000000');
    }"""

replacement3 = target3 + """
    
    // Apply dynamic client-side signature background cleaning & ink-toning
    sigSrc = getProcessedSignature(sigSrc);"""

if target3 in content:
    content = content.replace(target3, replacement3)
    print("Match 3: generateIdCardHtml signature resolution updated.")
else:
    print("Error: Match 3 target not found.")

# 4. Modify populateRegistrationForm signature preview
target4 = """    if (emp.documents?.signature) {
        document.getElementById('reg-signature-preview').innerHTML = `<img src="${emp.documents.signature}" style="max-height: 100px;">`;
    } else {"""

replacement4 = """    if (emp.documents?.signature) {
        document.getElementById('reg-signature-preview').innerHTML = `<img src="${getProcessedSignature(emp.documents.signature)}" style="max-height: 100px;">`;
    } else {"""

if target4 in content:
    content = content.replace(target4, replacement4)
    print("Match 4: populateRegistrationForm signature preview updated.")
else:
    print("Error: Match 4 target not found.")

# 5. Modify loadEmployeeRecord signature preview
target5 = """    // Signature
    const sigEl = document.getElementById('rec-signature-img');
    const sigPlaceholder = document.getElementById('rec-sig-placeholder');
    if (sigEl && sigPlaceholder) {
        if (emp.documents?.signature) {
            sigEl.src = emp.documents.signature;
            sigEl.style.display = 'block';
            sigPlaceholder.style.display = 'none';
        } else {"""

replacement5 = """    // Signature
    const sigEl = document.getElementById('rec-signature-img');
    const sigPlaceholder = document.getElementById('rec-sig-placeholder');
    if (sigEl && sigPlaceholder) {
        if (emp.documents?.signature) {
            sigEl.src = getProcessedSignature(emp.documents.signature);
            sigEl.style.display = 'block';
            sigPlaceholder.style.display = 'none';
        } else {"""

if target5 in content:
    content = content.replace(target5, replacement5)
    print("Match 5: loadEmployeeRecord signature preview updated.")
else:
    print("Error: Match 5 target not found.")

# Save modified content
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Modification complete.")
