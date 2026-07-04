const fs = require('fs');
const path = require('path');

async function convert() {
  const sharp = require('sharp');
  const pngToIco = require('png-to-ico');

  const pngPath = path.join(__dirname, '..', 'build', 'sufralogo.png');
  const icoPath = path.join(__dirname, '..', 'build', 'icon.ico');
  const tmpDir = path.join(__dirname, '..', 'build', '_ico_tmp');

  if (!fs.existsSync(pngPath)) {
    console.error('PNG not found:', pngPath);
    process.exit(1);
  }

  fs.mkdirSync(tmpDir, { recursive: true });

  // Windows requires multiple sizes in the ICO for proper display everywhere
  const sizes = [16, 32, 48, 256];
  const tmpPaths = [];

  for (const size of sizes) {
    const tmpPath = path.join(tmpDir, `icon-${size}.png`);
    await sharp(pngPath)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png()
      .toFile(tmpPath);
    tmpPaths.push(tmpPath);
    console.log(`  Generated ${size}x${size} PNG`);
  }

  const icoBuffer = await pngToIco(tmpPaths);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Created multi-size ICO:', icoPath);

  // Clean up temp files
  for (const p of tmpPaths) fs.unlinkSync(p);
  fs.rmdirSync(tmpDir);
}

convert().catch(err => {
  console.error('Icon conversion failed:', err);
  process.exit(1);
});
