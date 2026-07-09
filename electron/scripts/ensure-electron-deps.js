/**
 * Validate electron deps before dist. Cleans the accidental self-reference loop:
 *   "sufra-lite-electron": "file:"  → infinite node_modules nesting on Windows.
 *
 * Does NOT run npm install during dist — that lifecycle step re-creates the loop.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');
const nested = path.join(root, 'node_modules', 'sufra-lite-electron');
const SELF_DEP = 'sufra-lite-electron';

function scrubPackageJson() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.dependencies?.[SELF_DEP]) return false;
  delete pkg.dependencies[SELF_DEP];
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`[DEPS] Removed accidental self-dependency: ${SELF_DEP}`);
  return true;
}

function scrubLockfile() {
  if (!fs.existsSync(lockPath)) return false;
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  let changed = false;

  if (lock.packages?.['']?.dependencies?.[SELF_DEP]) {
    delete lock.packages[''].dependencies[SELF_DEP];
    changed = true;
  }
  if (lock.packages?.[`node_modules/${SELF_DEP}`]) {
    delete lock.packages[`node_modules/${SELF_DEP}`];
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    console.log('[DEPS] Removed self-dependency from package-lock.json');
  }
  return changed;
}

function removeNestedFolder() {
  if (!fs.existsSync(nested)) return false;
  fs.rmSync(nested, { recursive: true, force: true });
  console.log(`[DEPS] Removed nested node_modules/${SELF_DEP}`);
  return true;
}

scrubPackageJson();
scrubLockfile();
removeNestedFolder();

const required = ['electron', 'electron-builder', 'canvas'];
const missing = required.filter((name) => !fs.existsSync(path.join(root, 'node_modules', name)));

if (missing.length > 0) {
  console.error(`[DEPS] Missing packages: ${missing.join(', ')}`);
  console.error('[DEPS] Run once in electron/:  npm install');
  process.exit(1);
}

if (fs.existsSync(nested)) {
  console.error(
    `[DEPS] "${SELF_DEP}" self-dependency loop still present. ` +
      'Delete electron/node_modules/sufra-lite-electron and remove "sufra-lite-electron": "file:" from package.json.',
  );
  process.exit(1);
}

console.log('[DEPS] ✓ electron dependencies OK (skipped npm install during dist)');
