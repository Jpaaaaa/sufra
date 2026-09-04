/**
 * NSIS installer branding: restaurant-themed sidebar (164×314) + header (150×57).
 * Prefers custom BMPs from repo use-it/, else generates a teal restaurant look from logo.
 */
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const USE_IT_DIR = path.join(__dirname, '..', '..', 'use-it');

const NSIS_SIDEBAR = { w: 164, h: 314 };
const NSIS_HEADER = { w: 150, h: 57 };

/** Restaurant / POS palette (matches product teal) */
const TEAL = 0x0f9f91ff;
const TEAL_DARK = 0x0a7369ff;
const TEAL_DEEP = 0x085a53ff;
const CREAM = 0xf5f7faff;
const PLATE_RING = 0xd8f5f1ff;

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

function setPixelSafe(img, x, y, color) {
  if (x < 0 || y < 0 || x >= img.bitmap.width || y >= img.bitmap.height) return;
  img.setPixelColor(color, x, y);
}

/** Soft vertical teal gradient for restaurant sidebar atmosphere */
function fillTealGradient(img) {
  const { width: w, height: h } = img.bitmap;
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const r = Math.round(0x0f + (0x08 - 0x0f) * t);
    const g = Math.round(0x9f + (0x5a - 0x9f) * t);
    const b = Math.round(0x91 + (0x53 - 0x91) * t);
    const color = (((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | 255) >>> 0;
    for (let x = 0; x < w; x++) {
      img.setPixelColor(color, x, y);
    }
  }
}

/** Subtle plate / ring motif (restaurant cue without clutter) */
function drawPlateMotif(img, cx, cy, radius, color) {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    const x = Math.round(cx + Math.cos(rad) * radius);
    const y = Math.round(cy + Math.sin(rad) * radius);
    setPixelSafe(img, x, y, color);
    setPixelSafe(img, Math.round(cx + Math.cos(rad) * (radius - 6)), Math.round(cy + Math.sin(rad) * (radius - 6)), color);
  }
}

function drawAccentBar(img, y, color) {
  for (let x = 0; x < img.bitmap.width; x++) {
    img.setPixelColor(color, x, y);
    if (y + 1 < img.bitmap.height) img.setPixelColor(color, x, y + 1);
  }
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

  const logo = await Jimp.read(logoPath);

  // --- Sidebar: teal restaurant panel + centered logo + plate motif ---
  const sidebar = new Jimp({ width: NSIS_SIDEBAR.w, height: NSIS_SIDEBAR.h, color: TEAL_DEEP });
  fillTealGradient(sidebar);

  // Soft cream band near bottom for brand strip
  for (let y = NSIS_SIDEBAR.h - 72; y < NSIS_SIDEBAR.h; y++) {
    for (let x = 0; x < NSIS_SIDEBAR.w; x++) {
      sidebar.setPixelColor(CREAM, x, y);
    }
  }
  drawAccentBar(sidebar, NSIS_SIDEBAR.h - 72, TEAL);
  drawAccentBar(sidebar, NSIS_SIDEBAR.h - 2, TEAL_DARK);

  drawPlateMotif(sidebar, 82, 118, 58, PLATE_RING);
  drawPlateMotif(sidebar, 82, 118, 48, PLATE_RING);

  const logoResized = logo.clone().resize({ w: 92, h: 92 });
  sidebar.composite(
    logoResized,
    Math.floor((NSIS_SIDEBAR.w - logoResized.bitmap.width) / 2),
    72,
  );

  await sidebar.write(path.join(BUILD_DIR, 'installerSidebar.bmp'));
  console.log(`[INSTALLER] Created restaurant installerSidebar.bmp (${NSIS_SIDEBAR.w}×${NSIS_SIDEBAR.h})`);

  // --- Header: cream bar with teal accent + logo ---
  const header = new Jimp({ width: NSIS_HEADER.w, height: NSIS_HEADER.h, color: CREAM });
  for (let y = 0; y < NSIS_HEADER.h; y++) {
    for (let x = 0; x < 6; x++) {
      header.setPixelColor(TEAL, x, y);
    }
  }
  drawAccentBar(header, NSIS_HEADER.h - 2, TEAL);

  const headerLogo = logo.clone().resize({ w: 40, h: 40 });
  header.composite(headerLogo, 14, 8);

  // subtle ink rule under logo area
  for (let x = 60; x < NSIS_HEADER.w - 10; x++) {
    header.setPixelColor(0xe2e8f0ff, x, 28);
  }

  await header.write(path.join(BUILD_DIR, 'installerHeader.bmp'));
  console.log(`[INSTALLER] Created restaurant installerHeader.bmp (${NSIS_HEADER.w}×${NSIS_HEADER.h})`);
}

async function createAssets() {
  const { Jimp } = require('jimp');
  const usedCustom = await copyCustomAssets(Jimp);
  if (usedCustom) {
    console.log('[INSTALLER] Using custom images from use-it/');
    return;
  }
  console.log('[INSTALLER] Generating restaurant-themed installer graphics from logo');
  await generateFromLogo(Jimp);
}

createAssets().catch((err) => {
  console.error('[INSTALLER] Failed to create assets:', err?.message || String(err));
  process.exit(1);
});
