const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copy(srcRelative, destRelative) {
  const src = path.join(root, srcRelative);
  const dest = path.join(root, destRelative);
  if (!fs.existsSync(src)) {
    console.warn(`copy-assets: source not found: ${srcRelative}`);
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log(`Copied ${srcRelative} -> ${destRelative}`);
}

try {
  ensureDir(dist);
  copy('manifest.json', 'dist/manifest.json');
  copy('devtools.html', 'dist/devtools.html');
  copy('panel.html', 'dist/panel.html');
  copy('panel.css', 'dist/panel.css');
  copy('popup.html', 'dist/popup.html');
  // inject.js now produced by esbuild; no copy needed, but keep placeholder comment.
  
  // Copy icons directory
  const iconsDir = path.join(dist, 'icons');
  ensureDir(iconsDir);
  const iconFiles = fs.readdirSync(path.join(root, 'icons'));
  iconFiles.forEach(file => {
    copy(path.join('icons', file), path.join('dist', 'icons', file));
  });
} catch (err) {
  console.error('copy-assets failed', err);
  process.exit(1);
}
