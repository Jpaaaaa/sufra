/**
 * Windows dev: patch electron.exe with our icon so the taskbar shows Sufra (not default Electron).
 * Packaged builds embed the icon via electron-builder; this only runs in development.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

if (process.platform !== 'win32') {
  process.exit(0);
}

const root = path.join(__dirname, '..');
const iconPath = path.join(root, 'build', 'icon.ico');
const markerPath = path.join(root, 'build', '.electron-icon-patched.json');

if (!fs.existsSync(iconPath)) {
  console.warn('[ICON] Skipping electron.exe patch — icon.ico not found at', iconPath);
  process.exit(0);
}

let electronExe;
try {
  electronExe = require('electron');
} catch (e) {
  console.warn('[ICON] Could not resolve electron.exe:', e.message);
  process.exit(0);
}

if (!fs.existsSync(electronExe)) {
  console.warn('[ICON] electron.exe not found:', electronExe);
  process.exit(0);
}

const payload = {
  iconMtime: fs.statSync(iconPath).mtimeMs,
  electronMtime: fs.statSync(electronExe).mtimeMs,
  electronExe,
};

if (fs.existsSync(markerPath)) {
  try {
    const prev = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (
      prev.iconMtime === payload.iconMtime &&
      prev.electronMtime === payload.electronMtime &&
      prev.electronExe === payload.electronExe
    ) {
      console.log('[ICON] electron.exe already patched with current icon');
      process.exit(0);
    }
  } catch {
    /* repatch */
  }
}

function findRcedit() {
  const candidates = [
    path.join(root, 'node_modules', 'rcedit', 'bin', 'rcedit.exe'),
    path.join(root, 'node_modules', 'rcedit', 'rcedit.exe'),
    path.join(root, 'node_modules', '.bin', 'rcedit.cmd'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function patchWithRceditBinary(rceditBin) {
  execFileSync(rceditBin, [electronExe, '--set-icon', iconPath], {
    stdio: 'inherit',
    windowsHide: true,
  });
}

function patchWithRceditModule() {
  const rcedit = require('rcedit');
  if (typeof rcedit === 'function') {
    return rcedit(electronExe, { icon: iconPath });
  }
  if (rcedit && typeof rcedit.rcedit === 'function') {
    return rcedit.rcedit(electronExe, { icon: iconPath });
  }
  throw new Error('rcedit module has unexpected export shape');
}

(async () => {
  try {
    const rceditBin = findRcedit();
    if (rceditBin) {
      console.log('[ICON] Patching electron.exe icon via rcedit binary...');
      patchWithRceditBinary(rceditBin);
    } else {
      console.log('[ICON] Patching electron.exe icon via rcedit module...');
      await patchWithRceditModule();
    }
    fs.writeFileSync(markerPath, JSON.stringify(payload, null, 2));
    console.log('[ICON] ✓ electron.exe patched for dev taskbar icon');
  } catch (err) {
    console.warn('[ICON] Could not patch electron.exe (taskbar may show default icon in dev):', err.message);
    console.warn('[ICON] Install rcedit: cd electron && npm install --save-dev rcedit');
  }
})();
