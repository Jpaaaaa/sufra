/**
 * Prepares backend for production packaging:
 * 1. ncc bundle (all JS inlined)
 * 2. minimal runtime-node_modules (native modules only)
 */
const { execSync } = require('child_process');
const path = require('path');

const electronDir = path.join(__dirname, '..');
const backendDir = path.join(electronDir, 'backend');

const start = Date.now();

console.log('[DIST] Bundling backend with ncc...');
execSync('node build-bundle.js', { cwd: backendDir, stdio: 'inherit', shell: true });

console.log('[DIST] Creating minimal native runtime node_modules...');
execSync('node scripts/create-runtime-node-modules.js', {
  cwd: electronDir,
  stdio: 'inherit',
  shell: true,
});

console.log(`[DIST] Backend packaging prep done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
