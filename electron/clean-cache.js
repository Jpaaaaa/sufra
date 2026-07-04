const fs = require('fs');
const path = require('path');

// Clean electron-builder cache to prevent stale signing configs
const cacheDir = path.join(__dirname, 'node_modules', '.cache');

console.log('🧹 Cleaning electron-builder cache...');

if (fs.existsSync(cacheDir)) {
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    console.log('✓ Cache directory removed:', cacheDir);
  } catch (error) {
    console.warn('⚠️  Could not remove cache directory:', error.message);
  }
} else {
  console.log('✓ Cache directory does not exist (already clean)');
}

// Also clean release directory's builder cache
const releaseCache = path.join(__dirname, 'release', 'builder-effective-config.yaml');
if (fs.existsSync(releaseCache)) {
  try {
    fs.unlinkSync(releaseCache);
    console.log('✓ Removed builder-effective-config.yaml');
  } catch (error) {
    console.warn('⚠️  Could not remove builder config:', error.message);
  }
}

console.log('✓ Cache cleanup complete');

