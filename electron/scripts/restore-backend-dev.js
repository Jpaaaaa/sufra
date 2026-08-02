/**
 * Restores backend devDependencies after dist for local development.
 */
const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');
const electronDir = path.join(__dirname, '..');
console.log('[DIST] Restoring backend devDependencies for local dev...');
execSync('npm install', {
  cwd: backendDir,
  stdio: 'inherit',
});
console.log('[DIST] Rebuilding native modules for Electron ABI...');
execSync('npx electron-rebuild -f -w better-sqlite3,bcrypt -m ./backend', {
  cwd: electronDir,
  stdio: 'inherit',
});
console.log('[DIST] Backend devDependencies restored.');
