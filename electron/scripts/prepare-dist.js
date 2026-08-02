/**
 * Slims backend/node_modules for production packaging.
 * Removes devDependencies to speed up electron-builder and reduce installer size.
 */
const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');
const electronDir = path.join(__dirname, '..');
console.log('[DIST] Slimming backend node_modules (removing devDependencies)...');
const start = Date.now();
execSync('npm install --omit=dev', {
  cwd: backendDir,
  stdio: 'inherit',
});
console.log('[DIST] Rebuilding native modules for Electron ABI...');
execSync('npx electron-rebuild -f -w better-sqlite3,bcrypt -m ./backend', {
  cwd: electronDir,
  stdio: 'inherit',
});
console.log(`[DIST] Backend slimmed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
