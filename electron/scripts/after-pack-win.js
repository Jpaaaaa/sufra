/**
 * afterPack: embed restaurant icon into the Windows .exe (Explorer + desktop shortcut).
 * Used because signAndEditExecutable is false (avoids signing side-effects).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function findRcedit(electronDir) {
  const candidates = [
    path.join(electronDir, 'node_modules', 'rcedit', 'bin', 'rcedit.exe'),
    path.join(electronDir, 'node_modules', 'rcedit', 'rcedit.exe'),
  ];
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

async function patchExeIcon(exePath, iconPath, rceditBin) {
  if (!fs.existsSync(exePath)) {
    console.warn('[AFTER-PACK] EXE not found:', exePath);
    return false;
  }
  if (rceditBin) {
    execFileSync(rceditBin, [exePath, '--set-icon', iconPath], {
      stdio: 'inherit',
      windowsHide: true,
    });
    return true;
  }
  const rcedit = require('rcedit');
  if (typeof rcedit === 'function') {
    await rcedit(exePath, { icon: iconPath });
    return true;
  }
  if (rcedit && typeof rcedit.rcedit === 'function') {
    await rcedit.rcedit(exePath, { icon: iconPath });
    return true;
  }
  throw new Error('rcedit not available');
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const electronDir = path.join(__dirname, '..');
  const iconPath = path.join(electronDir, 'build', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    console.warn('[AFTER-PACK] icon.ico missing — packaged exe may show Electron icon');
    return;
  }

  const appOutDir = context.appOutDir;
  const executableName =
    context.packager.platformSpecificBuildOptions.executableName ||
    context.packager.appInfo.productFilename;
  const exePath = path.join(appOutDir, `${executableName}.exe`);

  const rceditBin = findRcedit(electronDir);
  console.log('[AFTER-PACK] Embedding app icon into', path.basename(exePath));

  try {
    const ok = await patchExeIcon(exePath, iconPath, rceditBin);
    if (ok) {
      console.log('[AFTER-PACK] ✓ Icon embedded into', path.basename(exePath));
    }
  } catch (err) {
    console.error('[AFTER-PACK] ✗ Failed to embed icon:', err?.message || err);
    throw err;
  }
};
