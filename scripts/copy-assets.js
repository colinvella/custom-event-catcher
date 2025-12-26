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
  // DevTools bootstrap HTML moved under src/devtools; copy into dist/devtools/
  copy(path.join('src','devtools','devtools.html'), path.join('dist','devtools','devtools.html'));
  // Panel assets relocated under src/panel; copy into dist/panel/
  copy(path.join('src','panel','panel.html'), path.join('dist','panel','panel.html'));
  copy(path.join('src','panel','panel.css'), path.join('dist','panel','panel.css'));
  // Popup assets relocated under src/popup; copy into dist/popup/
  copy(path.join('src','popup','popup.html'), path.join('dist','popup','popup.html'));
  copy(path.join('src','popup','popup.css'), path.join('dist','popup','popup.css'));
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
