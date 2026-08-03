/**
 * Ensures backend devDependencies exist before dist build steps.
 * Needed when a previous dist was interrupted after prepare-dist (npm install --omit=dev).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const backendDir = path.join(__dirname, '..', 'backend');
const devDepsMarker = path.join(backendDir, 'node_modules', '@types', 'better-sqlite3');

if (fs.existsSync(devDepsMarker)) {
  console.log('[DIST] ✓ Backend devDependencies already present');
  process.exit(0);
}

console.log('[DIST] Backend missing devDependencies (likely from interrupted dist); installing...');
execSync('npm install', {
  cwd: backendDir,
  stdio: 'inherit',
  shell: true,
});
console.log('[DIST] ✓ Backend devDependencies ready for build');
