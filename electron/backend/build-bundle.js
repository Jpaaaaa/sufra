/**
 * Bundle backend for production with @vercel/ncc.
 * JS is inlined; native modules load from runtime node_modules at pack time.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const backendDir = __dirname;
const bundleDir = path.join(backendDir, 'dist-bundle');
const NATIVE_EXTERNALS = [
  'better-sqlite3',
  'bcrypt',
  '@thiagoelg/node-printer',
].map((name) => `--external ${name}`).join(' ');

console.log('[BUNDLE] Building backend TypeScript...');
execSync('npm run build', { stdio: 'inherit', cwd: backendDir });

const packagedEntry = path.join(backendDir, 'dist', 'packaged-entry.js');
if (!fs.existsSync(packagedEntry)) {
  throw new Error(`Packaged entry not found after tsc: ${packagedEntry}`);
}

if (fs.existsSync(bundleDir)) {
  fs.rmSync(bundleDir, { recursive: true, force: true });
}
fs.mkdirSync(bundleDir, { recursive: true });

console.log('[BUNDLE] Running @vercel/ncc...');
execSync(
  `npx ncc build dist/packaged-entry.js -o dist-bundle --minify --source-map --license licenses.txt ${NATIVE_EXTERNALS}`,
  { stdio: 'inherit', cwd: backendDir, shell: true },
);

const bundledIndex = path.join(bundleDir, 'index.js');
const bundledMain = path.join(bundleDir, 'main.js');
if (!fs.existsSync(bundledIndex)) {
  throw new Error(`ncc output missing: ${bundledIndex}`);
}

fs.renameSync(bundledIndex, bundledMain);
const bundledIndexMap = path.join(bundleDir, 'index.js.map');
const bundledMainMap = path.join(bundleDir, 'main.js.map');
if (fs.existsSync(bundledIndexMap)) {
  fs.renameSync(bundledIndexMap, bundledMainMap);
}

const filesToKeep = new Set(['main.js', 'main.js.map', 'licenses.txt', 'sourcemap-register.js']);
for (const file of fs.readdirSync(bundleDir)) {
  const filePath = path.join(bundleDir, file);
  const stat = fs.statSync(filePath);
  if (stat.isDirectory() || !filesToKeep.has(file)) {
    fs.rmSync(filePath, { recursive: true, force: true });
  }
}

const stats = fs.statSync(bundledMain);
console.log(`[BUNDLE] ✓ Backend bundle ready (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
