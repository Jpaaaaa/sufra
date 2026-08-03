/**
 * First-time dev setup: install dependencies and fetch prebuilt native binaries
 * where available (better-sqlite3). bcrypt / canvas / node-printer still require
 * Visual Studio Build Tools — run `npm run rebuild:native --prefix electron` after.
 */
const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

function run(cmd, cwd = root) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

console.log('[SETUP] Installing project dependencies...\n');

run('npm install');
run('npm install --prefix frontend');
run('npm install --prefix electron');
run('npm install --prefix electron/backend --ignore-scripts');

const betterSqlite3 = path.join(
  root,
  'electron',
  'backend',
  'node_modules',
  'better-sqlite3',
);

console.log('\n[SETUP] Fetching prebuilt better-sqlite3 for Electron 30...');
run(
  'npx prebuild-install --runtime electron --target 30.0.0',
  betterSqlite3,
);

console.log(`
[SETUP] ✓ Dev setup complete.

Next steps:
  1. Install Visual Studio Build Tools (Desktop development with C++)
     https://visualstudio.microsoft.com/visual-cpp-build-tools/
  2. Rebuild remaining native modules:
       npm run rebuild:native --prefix electron
  3. Start development:
       npm run dev
`);
