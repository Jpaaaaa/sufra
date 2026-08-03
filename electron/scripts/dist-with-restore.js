/**
 * Full Windows dist pipeline with guaranteed backend dev restore on success or failure.
 */
const { execSync } = require('child_process');
const path = require('path');

const electronDir = path.join(__dirname, '..');

function run(cmd, extraEnv = {}) {
  execSync(cmd, {
    cwd: electronDir,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
      ...extraEnv,
    },
  });
}

function restoreBackendDev() {
  console.log('[DIST] Restoring backend devDependencies...');
  try {
    run('node scripts/restore-backend-dev.js');
  } catch (err) {
    console.error('[DIST] ✗ restore-backend-dev failed:', err?.message || err);
    console.error('[DIST] Run manually: cd electron && node scripts/restore-backend-dev.js');
    process.exitCode = process.exitCode || 1;
  }
}

let distFailed = false;

try {
  run('node scripts/stop-dist-blockers.js');
  run('node scripts/ensure-backend-dev.js');
  run('node scripts/prepare-installer-assets.js');
  run('node scripts/convert-icon.js');
  run('npm run build:frontend');
  run('npm run build:backend');
  run('node scripts/prepare-dist.js');
  run('npm run ensure-electron-deps');
  run('npm run build', { SUFRA_SKIP_BACKEND_NODE_MODULES_LINK: '1' });
  run('npx electron-builder --win');
  console.log('[DIST] ✓ Packaging complete');
} catch (err) {
  distFailed = true;
  console.error('[DIST] ✗ Packaging failed:', err?.message || err);
} finally {
  restoreBackendDev();
}

if (distFailed) {
  process.exit(1);
}
