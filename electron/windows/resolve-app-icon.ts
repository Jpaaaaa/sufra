import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, nativeImage, type NativeImage } from 'electron';

export interface ResolvedAppIcon {
  image: NativeImage;
  /** Absolute .ico path for Windows setAppDetails */
  icoPath: string;
}

function loadImageFromPath(filePath: string): NativeImage | null {
  if (!fs.existsSync(filePath)) return null;
  const image = nativeImage.createFromPath(path.resolve(filePath));
  return image.isEmpty() ? null : image;
}

function findFirstExisting(paths: string[]): string | null {
  for (const p of paths) {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved)) return resolved;
  }
  return null;
}

function ensureTaskbarIcoPath(sourceIco: string): string {
  if (process.platform !== 'win32') return sourceIco;
  try {
    const dir = path.join(app.getPath('userData'), 'branding');
    fs.mkdirSync(dir, { recursive: true });
    const dest = path.join(dir, 'taskbar-icon.ico');
    const srcStat = fs.statSync(sourceIco);
    const needsCopy =
      !fs.existsSync(dest) ||
      fs.statSync(dest).size !== srcStat.size ||
      fs.statSync(dest).mtimeMs < srcStat.mtimeMs;
    if (needsCopy) fs.copyFileSync(sourceIco, dest);
    return dest;
  } catch {
    return sourceIco;
  }
}

/** Resolve multi-size .ico for Windows taskbar / window chrome. */
export function resolveAppIcon(): ResolvedAppIcon | null {
  const icoCandidates: string[] = [];
  const pngCandidates: string[] = [];

  if (app.isPackaged) {
    icoCandidates.push(
      path.join(process.resourcesPath, 'icon.ico'),
      path.join(path.dirname(process.execPath), 'resources', 'icon.ico'),
      path.join(app.getAppPath(), '..', 'icon.ico'),
    );
  } else {
    icoCandidates.push(
      path.join(__dirname, '..', 'icon.ico'),
      path.join(__dirname, '..', '..', 'build', 'icon.ico'),
      path.join(app.getAppPath(), 'build', 'icon.ico'),
      path.join(app.getAppPath(), 'dist', 'icon.ico'),
      path.join(process.cwd(), 'build', 'icon.ico'),
      path.join(process.cwd(), 'dist', 'icon.ico'),
    );
    pngCandidates.push(
      path.join(__dirname, '..', 'logo.png'),
      path.join(app.getAppPath(), 'build', 'sufralogo.png'),
      path.join(app.getAppPath(), 'dist', 'logo.png'),
      path.join(process.cwd(), 'build', 'sufralogo.png'),
    );
  }

  const icoPath = findFirstExisting(icoCandidates);
  let image: NativeImage | null = null;

  if (icoPath) {
    image = loadImageFromPath(icoPath);
  }

  if (!image) {
    const pngPath = findFirstExisting(pngCandidates);
    if (pngPath) image = loadImageFromPath(pngPath);
  }

  if (!image || !icoPath) return null;

  return { image, icoPath: ensureTaskbarIcoPath(icoPath) };
}

export function applyWindowsTaskbarIcon(
  win: BrowserWindow,
  icon: ResolvedAppIcon,
): void {
  if (process.platform !== 'win32') return;
  try {
    win.setIcon(icon.image);
  } catch (e) {
    console.warn('[WINDOW] setIcon failed:', e);
  }
  try {
    win.setAppDetails({
      appId: 'com.sufra.lite.pos',
      appIconPath: icon.icoPath,
      appIconIndex: 0,
      relaunchCommand: process.argv.join(' '),
      relaunchDisplayName: 'Sufra Lite POS',
    });
  } catch (e) {
    console.warn('[WINDOW] setAppDetails failed:', e);
  }
}
