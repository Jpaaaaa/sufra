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
  shell: true,
});

console.log('[DIST] Rebuilding native modules for Electron ABI...');
try {
  execSync('npx electron-rebuild -f -w better-sqlite3,bcrypt -m ./backend', {
    cwd: electronDir,
    stdio: 'inherit',
    shell: true,
  });
} catch (err) {
  console.warn('[DIST] ⚠️ Native rebuild after restore failed (dev may still work):', err?.message || err);
  console.warn('[DIST] If dev fails, run: npm run rebuild:native --prefix electron');
}

console.log('[DIST] Backend devDependencies restored.');
