/**
 * Run electron dist from repo root with cwd locked to electron/
 * (avoids npm --prefix side effects that can re-add self-dependencies).
 */
const path = require('path');
const { execSync } = require('child_process');

const electronDir = path.resolve(__dirname, '..', 'electron');

console.log('[DIST] Running from repo root →', electronDir);

execSync('npm run dist', {
  cwd: electronDir,
  stdio: 'inherit',
  env: {
    ...process.env,
    INIT_CWD: electronDir,
  },
  shell: true,
});
