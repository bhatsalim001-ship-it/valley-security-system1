const sharp = require('sharp');
const fs = require('fs');

const originalPath = 'public/favicon.png';
const tempPath = 'public/favicon_192.png';

sharp(originalPath)
  .resize(192, 192)
  .toFile(tempPath)
  .then(info => {
    console.log('Favicon resized to 192x192:', info);
    fs.renameSync(tempPath, originalPath);
    console.log('Replaced original favicon.png successfully.');
  })
  .catch(err => {
    console.error('Error resizing favicon:', err);
  });
