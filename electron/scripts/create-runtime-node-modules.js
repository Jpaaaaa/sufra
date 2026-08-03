/**
 * Creates minimal backend/runtime-node_modules by copying native packages
 * (and their deps) from the already electron-rebuilt backend/node_modules.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const electronDir = path.join(__dirname, '..');
const backendDir = path.join(electronDir, 'backend');
const srcRoot = path.join(backendDir, 'node_modules');
const outputDir = path.join(backendDir, 'runtime-node_modules');

const ROOT_PACKAGES = ['better-sqlite3', 'bcrypt', '@thiagoelg/node-printer'];

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function resolvePackageDir(root, name) {
  if (name.startsWith('@')) {
    return path.join(root, name);
  }
  return path.join(root, name);
}

function copyDir(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true, dereference: true });
}

function collectDeps(pkgJson) {
  const deps = new Set();
  for (const section of ['dependencies', 'optionalDependencies']) {
    const block = pkgJson[section];
    if (!block) continue;
    for (const name of Object.keys(block)) {
      deps.add(name);
    }
  }
  return deps;
}

function locatePackage(root, name, referrerDir) {
  const candidates = [
    path.join(referrerDir, 'node_modules', name),
    resolvePackageDir(root, name),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function copyPackageTree(root, destRoot, packageName, copied, referrerDir = root) {
  if (copied.has(packageName)) return;

  const src = locatePackage(root, packageName, referrerDir);
  if (!src) {
    console.warn(`[RUNTIME] Skipping optional/missing dependency: ${packageName}`);
    return;
  }

  const dest = resolvePackageDir(destRoot, packageName);
  copyDir(src, dest);
  copied.add(packageName);

  const pkgJsonPath = path.join(src, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) return;

  const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  for (const dep of collectDeps(pkgJson)) {
    copyPackageTree(root, destRoot, dep, copied, src);
  }
}

console.log('[RUNTIME] Rebuilding native modules in backend (Electron ABI)...');
execSync('npx electron-rebuild -f -w better-sqlite3,bcrypt,@thiagoelg/node-printer -m ./backend', {
  cwd: electronDir,
  stdio: 'inherit',
  shell: true,
});

console.log('[RUNTIME] Copying native runtime packages from backend/node_modules...');
rmDir(outputDir);
fs.mkdirSync(outputDir, { recursive: true });

const copied = new Set();
for (const pkg of ROOT_PACKAGES) {
  copyPackageTree(srcRoot, outputDir, pkg, copied);
}

function dirSizeBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += dirSizeBytes(full);
    } else {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

const sizeMb = (dirSizeBytes(outputDir) / 1024 / 1024).toFixed(1);
console.log(`[RUNTIME] ✓ runtime-node_modules ready (${copied.size} packages, ${sizeMb} MB)`);
