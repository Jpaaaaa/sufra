/**
 * Restores backend devDependencies after dist for local development.
 */
const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, '..', 'backend');
console.log('[DIST] Restoring backend devDependencies for local dev...');
execSync('npm install', {
  cwd: backendDir,
  stdio: 'inherit',
});
console.log('[DIST] Backend devDependencies restored.');
