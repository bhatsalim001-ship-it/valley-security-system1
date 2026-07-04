import os

file_path = 'public/app.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Target code segment inside saveBtn listener
target = """            if (canvas) {
                // Compress automatically on client side to high quality JPEG
                const base64Str = canvas.toDataURL('image/jpeg', 0.85);
                
                // Save base64 string to the target input element's dataset
                const inputEl = document.getElementById(cropperTriggerInputId);
                if (inputEl) {
                    inputEl.dataset.imageData = base64Str;
                }
                
                // Show preview in target box
                const previewBox = document.getElementById(cropperPreviewBoxId);
                if (previewBox) {
                    previewBox.innerHTML = `<img src="${base64Str}" style="max-height: 100px;">`;
                }
            }"""

replacement = """            if (canvas) {
                // Compress automatically on client side to high quality JPEG
                const base64Str = canvas.toDataURL('image/jpeg', 0.85);
                
                const inputEl = document.getElementById(cropperTriggerInputId);
                const previewBox = document.getElementById(cropperPreviewBoxId);
                
                if (cropperPreviewBoxId === 'reg-photo-preview' || cropperPreviewBoxId === 'form-photo-preview-box') {
                    if (previewBox) {
                        previewBox.innerHTML = '<span class="preview-placeholder" style="color: var(--theme-accent); font-weight: 500;">✨ Auto-cleaning background...</span>';
                    }
                    
                    removePortraitBackground(base64Str, 55).then(processedBase64 => {
                        if (inputEl) {
                            inputEl.dataset.imageData = processedBase64;
                        }
                        if (previewBox) {
                            previewBox.innerHTML = `<img src="${processedBase64}" style="max-height: 100px;">`;
                        }
                        // Instantly update live card previews if visible
                        const selectedId = document.getElementById('id-select-employee')?.value;
                        if (selectedId) {
                            loadIdCardDetails(selectedId);
                        }
                        updateLivePreview();
                    }).catch(err => {
                        console.error("Auto background cleaning failed:", err);
                        if (inputEl) {
                            inputEl.dataset.imageData = base64Str;
                        }
                        if (previewBox) {
                            previewBox.innerHTML = `<img src="${base64Str}" style="max-height: 100px;">`;
                        }
                    });
                } else {
                    // Normal behavior for other uploads
                    if (inputEl) {
                        inputEl.dataset.imageData = base64Str;
                    }
                    if (previewBox) {
                        previewBox.innerHTML = `<img src="${base64Str}" style="max-height: 100px;">`;
                    }
                }
            }"""

if target in content:
    content = content.replace(target, replacement)
    print("Cropper save button updated successfully.")
else:
    target_lf = target.replace('\r\n', '\n')
    content_lf = content.replace('\r\n', '\n')
    if target_lf in content_lf:
        content = content_lf.replace(target_lf, replacement.replace('\r\n', '\n'))
        print("Cropper save button updated successfully (LF).")
    else:
        print("Error: Target segment in cropper saveBtn not found in public/app.js!")

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
