const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const releaseDir = path.join(root, 'release');

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

if (!fs.existsSync(distDir)) {
  fail(`dist folder not found at ${distDir}. Run 'npm run build' first.`);
}

// Read version from package.json (requested)
let version = '0.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  version = pkg.version || version;
} catch (e) {
  console.warn('Could not read version from package.json; using 0.0.0');
}

// Ensure release dir exists
fs.mkdirSync(releaseDir, { recursive: true });

const outFile = path.join(releaseDir, `custom-event-catcher-${version}.zip`);
if (fs.existsSync(outFile)) {
  fs.unlinkSync(outFile);
}

console.log(`Creating ${outFile} from ${distDir}...`);

if (process.platform === 'win32') {
  // Use PowerShell Compress-Archive for Windows
  const psCmd = `Compress-Archive -Path "${distDir}\\*" -DestinationPath "${outFile}" -Force`;
  const res = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', psCmd], { stdio: 'inherit' });
  if (res.status !== 0) fail('Packaging failed via PowerShell.');
} else {
  // Fallback: zip CLI on Unix/macOS
  const res = spawnSync('zip', ['-r', outFile, '.'], { cwd: distDir, stdio: 'inherit' });
  if (res.status !== 0) fail('Packaging failed via zip CLI.');
}

console.log(`Created ${outFile}`);
