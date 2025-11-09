// Cross-platform cleanup script for dist directory
const fs = require('fs');
const path = require('path');

const distPath = path.resolve(__dirname, '..', 'dist');

function rmDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.lstatSync(fullPath);
    if (stat.isDirectory()) {
      rmDir(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }
  fs.rmdirSync(dirPath);
}

try {
  rmDir(distPath);
  console.log('Removed dist/');
} catch (err) {
  // If removal failed for some reason, still continue
  console.warn('Could not remove dist/:', err.message);
}
