/**
 * NSIS installer branding: sidebar (164×314) + header (150×57).
 * Prefers custom BMPs from repo use-it/, else generates from logo.
 */
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const USE_IT_DIR = path.join(__dirname, '..', '..', 'use-it');

const NSIS_SIDEBAR = { w: 164, h: 314 };
const NSIS_HEADER = { w: 150, h: 57 };

const CUSTOM_SIDEBAR_CANDIDATES = [
  path.join(USE_IT_DIR, 'intsallimage.bmp'),
  path.join(USE_IT_DIR, 'installimage.bmp'),
  path.join(USE_IT_DIR, 'installerSidebar.bmp'),
];

const CUSTOM_HEADER_CANDIDATES = [
  path.join(USE_IT_DIR, 'installimage2.bmp'),
  path.join(USE_IT_DIR, 'installerHeader.bmp'),
];

const LOGO_SOURCES = [
  path.join(BUILD_DIR, 'sufralogo.png'),
  path.join(__dirname, '..', '..', 'frontend', 'public', 'logo', 'logo.png'),
];

function findFirstExisting(candidates) {
  return candidates.find((p) => fs.existsSync(p)) ?? null;
}

function ensureLogo() {
  if (fs.existsSync(LOGO_SOURCES[0])) return LOGO_SOURCES[0];
  for (const src of LOGO_SOURCES) {
    if (fs.existsSync(src)) {
      fs.mkdirSync(BUILD_DIR, { recursive: true });
      fs.copyFileSync(src, LOGO_SOURCES[0]);
      console.log('[INSTALLER] Copied logo to build:', LOGO_SOURCES[0]);
      return LOGO_SOURCES[0];
    }
  }
  throw new Error('No logo found. Add electron/build/sufralogo.png or frontend/public/logo/logo.png');
}

async function writeNsisBmp(Jimp, srcPath, destPath, size, label) {
  const image = await Jimp.read(srcPath);
  image.cover(size);
  await image.write(destPath);
  console.log(`[INSTALLER] ${label} from ${path.basename(srcPath)} -> ${path.basename(destPath)} (${size.w}x${size.h})`);
}

async function copyCustomAssets(Jimp) {
  const sidebarSrc = findFirstExisting(CUSTOM_SIDEBAR_CANDIDATES);
  const headerSrc = findFirstExisting(CUSTOM_HEADER_CANDIDATES);
  if (!sidebarSrc || !headerSrc) {
    return false;
  }

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  await writeNsisBmp(
    Jimp,
    sidebarSrc,
    path.join(BUILD_DIR, 'installerSidebar.bmp'),
    NSIS_SIDEBAR,
    'Sidebar',
  );
  await writeNsisBmp(
    Jimp,
    headerSrc,
    path.join(BUILD_DIR, 'installerHeader.bmp'),
    NSIS_HEADER,
    'Header',
  );
  return true;
}

async function generateFromLogo(Jimp) {
  const logoPath = ensureLogo();
  fs.mkdirSync(BUILD_DIR, { recursive: true });

  const CYBER_AQUA = 0x2ee7c9ff;
  const CHARCOAL = 0x1a1f25ff;
  const logo = await Jimp.read(logoPath);

  const sidebar = new Jimp({ width: NSIS_SIDEBAR.w, height: NSIS_SIDEBAR.h, color: CHARCOAL });
  const logoResized = logo.clone().resize({ w: 100, h: 100 });
  sidebar.composite(
    logoResized,
    Math.floor((NSIS_SIDEBAR.w - logoResized.bitmap.width) / 2),
    Math.floor((NSIS_SIDEBAR.h - logoResized.bitmap.height) / 2) - 20,
  );
  for (let i = 0; i < NSIS_SIDEBAR.w; i++) {
    sidebar.setPixelColor(CYBER_AQUA, i, NSIS_SIDEBAR.h - 1);
  }
  await sidebar.write(path.join(BUILD_DIR, 'installerSidebar.bmp'));
  console.log(`[INSTALLER] Created installerSidebar.bmp (${NSIS_SIDEBAR.w}×${NSIS_SIDEBAR.h}) from logo`);

  const header = new Jimp({ width: NSIS_HEADER.w, height: NSIS_HEADER.h, color: CHARCOAL });
  const headerLogo = logo.clone().resize({ w: 40, h: 40 });
  header.composite(headerLogo, 10, 8);
  for (let i = 0; i < NSIS_HEADER.w; i++) {
    header.setPixelColor(CYBER_AQUA, i, NSIS_HEADER.h - 1);
  }
  await header.write(path.join(BUILD_DIR, 'installerHeader.bmp'));
  console.log(`[INSTALLER] Created installerHeader.bmp (${NSIS_HEADER.w}×${NSIS_HEADER.h}) from logo`);
}

async function createAssets() {
  const { Jimp } = require('jimp');
  const usedCustom = await copyCustomAssets(Jimp);
  if (usedCustom) {
    console.log('[INSTALLER] Using custom images from use-it/');
    return;
  }
  console.log('[INSTALLER] use-it/ images not found; generating from logo');
  await generateFromLogo(Jimp);
}

createAssets().catch((err) => {
  console.error('[INSTALLER] Failed to create assets:', err?.message || String(err));
  process.exit(1);
});
