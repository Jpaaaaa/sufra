/**
 * Validate electron deps before dist. Cleans accidental file: dependency loops:
 *   - "sufra-lite-electron": "file:"  → infinite node_modules nesting
 *   - "sufra-lite-pos": "file:.."     → packs entire monorepo (+ release/*.exe) into installer
 *
 * Does NOT run npm install during dist — that lifecycle step re-creates loops.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkgPath = path.join(root, 'package.json');
const lockPath = path.join(root, 'package-lock.json');

const SCRUB_DEPS = ['sufra-lite-electron', 'sufra-lite-pos'];

function scrubPackageJson() {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let changed = false;
  for (const name of SCRUB_DEPS) {
    if (!pkg.dependencies?.[name]) continue;
    delete pkg.dependencies[name];
    console.log(`[DEPS] Removed accidental dependency: ${name}`);
    changed = true;
  }
  if (changed) {
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  return changed;
}

function scrubLockfile() {
  if (!fs.existsSync(lockPath)) return false;
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  let changed = false;

  for (const name of SCRUB_DEPS) {
    if (lock.packages?.['']?.dependencies?.[name]) {
      delete lock.packages[''].dependencies[name];
      changed = true;
    }
    if (lock.packages?.[`node_modules/${name}`]) {
      delete lock.packages[`node_modules/${name}`];
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    console.log('[DEPS] Removed scrubbed deps from package-lock.json');
  }
  return changed;
}

function removeNestedFolders() {
  let changed = false;
  for (const name of SCRUB_DEPS) {
    const nested = path.join(root, 'node_modules', name);
    if (!fs.existsSync(nested)) continue;
    fs.rmSync(nested, { recursive: true, force: true });
    console.log(`[DEPS] Removed nested node_modules/${name}`);
    changed = true;
  }
  return changed;
}

scrubPackageJson();
scrubLockfile();
removeNestedFolders();

const required = ['electron', 'electron-builder', 'canvas'];
const missing = required.filter((name) => !fs.existsSync(path.join(root, 'node_modules', name)));

if (missing.length > 0) {
  console.error(`[DEPS] Missing packages: ${missing.join(', ')}`);
  console.error('[DEPS] Run once in electron/:  npm install');
  process.exit(1);
}

for (const name of SCRUB_DEPS) {
  const nested = path.join(root, 'node_modules', name);
  if (fs.existsSync(nested)) {
    console.error(
      `[DEPS] "${name}" file: dependency still present under node_modules. ` +
        `Delete electron/node_modules/${name} and remove it from package.json.`,
    );
    process.exit(1);
  }
}

console.log('[DEPS] ✓ electron dependencies OK (skipped npm install during dist)');
