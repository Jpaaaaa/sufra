/**
 * Runs dist with timing. Use: node scripts/dist-timed.js
 * Or add "dist:timed": "node scripts/dist-timed.js" to package.json
 */
const { execSync } = require('child_process');

const start = Date.now();
console.log('[DIST] Starting full dist build...\n');

try {
  execSync('npm run dist', {
    stdio: 'inherit',
    cwd: require('path').join(__dirname, '..'),
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`\n[DIST] ✅ Complete in ${elapsed}s`);
} catch (err) {
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.error(`\n[DIST] ❌ Failed after ${elapsed}s`);
  process.exit(1);
}
