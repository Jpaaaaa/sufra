/**
 * Creates NSIS installer branding assets (sidebar, header) using app design.
 * Uses: cyber-aqua #2EE7C9, charcoal-graphite #1A1F25, obsidian #121212
 */
const fs = require('fs');
const path = require('path');

const BUILD_DIR = path.join(__dirname, '..', 'build');
const LOGO_SOURCES = [
  path.join(BUILD_DIR, 'sufralogo.png'),
  path.join(__dirname, '..', '..', 'frontend', 'public', 'logo', 'logo.png'),
];

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
  throw new Error('No logo found. Add sufra-lite/electron/build/sufralogo.png or frontend/public/logo/logo.png');
}

async function createAssets() {
  const { Jimp } = require('jimp');
  const logoPath = ensureLogo();

  fs.mkdirSync(BUILD_DIR, { recursive: true });

  const CYBER_AQUA = 0x2ee7c9ff;
  const CHARCOAL = 0x1a1f25ff;
  const OBSIDIAN = 0x121212ff;

  // Load logo
  const logo = await Jimp.read(logoPath);

  // Sidebar: 164×314 - dark gradient with logo
  const sidebar = new Jimp({ width: 164, height: 314, color: CHARCOAL });
  const logoResized = logo.clone().resize({ w: 100, h: 100 });
  const x = Math.floor((164 - logoResized.bitmap.width) / 2);
  const y = Math.floor((314 - logoResized.bitmap.height) / 2) - 20;
  sidebar.composite(logoResized, x, y);

  // Add accent line at bottom
  for (let i = 0; i < 164; i++) {
    sidebar.setPixelColor(CYBER_AQUA, i, 313);
  }

  await sidebar.write(path.join(BUILD_DIR, 'installerSidebar.bmp'));
  console.log('[INSTALLER] Created installerSidebar.bmp (164×314)');

  // Header: 150×57 - compact header with logo
  const header = new Jimp({ width: 150, height: 57, color: CHARCOAL });
  const headerLogo = logo.clone().resize({ w: 40, h: 40 });
  header.composite(headerLogo, 10, 8);
  for (let i = 0; i < 150; i++) {
    header.setPixelColor(CYBER_AQUA, i, 56);
  }
  await header.write(path.join(BUILD_DIR, 'installerHeader.bmp'));
  console.log('[INSTALLER] Created installerHeader.bmp (150×57)');
}

createAssets().catch((err) => {
  console.error('[INSTALLER] Failed to create assets:', err?.message || String(err));
  process.exit(1);
});
