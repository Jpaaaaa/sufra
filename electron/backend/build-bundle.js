/**
 * Build script to bundle backend with @vercel/ncc
 * Creates a single-file backend that doesn't require node_modules
 *
 * Note: native modules (better-sqlite3, bcrypt, node-printer) cannot be
 * fully inlined by ncc — prefer the normal dist + node_modules packaging path.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📦 Bundling backend with @vercel/ncc...\n');

try {
  // Step 1: Build NestJS (TypeScript compilation)
  console.log('Step 1/3: Building NestJS (TypeScript)...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ NestJS build complete\n');

  // Step 2: Bundle with ncc
  console.log('Step 2/3: Bundling with @vercel/ncc...');
  const distMain = path.join(__dirname, 'dist', 'main.js');

  if (!fs.existsSync(distMain)) {
    throw new Error(`Backend entry file not found: ${distMain}`);
  }

  // Create dist-bundle directory
  const bundleDir = path.join(__dirname, 'dist-bundle');
  if (fs.existsSync(bundleDir)) {
    fs.rmSync(bundleDir, { recursive: true, force: true });
  }
  fs.mkdirSync(bundleDir, { recursive: true });

  // Bundle with ncc (outputs as index.js by default)
  // Externalize native modules so they load from node_modules at runtime
  execSync(
    `npx ncc build dist/main.js -o dist-bundle --minify --source-map --license licenses.txt --external better-sqlite3 --external bcrypt --external @thiagoelg/node-printer`,
    { stdio: 'inherit', cwd: __dirname }
  );
  console.log('✓ NCC bundle complete\n');

  // Step 3: Rename and clean up bundle output
  console.log('Step 3/3: Renaming bundle output and cleaning up...');
  const bundledIndex = path.join(bundleDir, 'index.js');
  const bundledMain = path.join(bundleDir, 'main.js');
  const bundledIndexMap = path.join(bundleDir, 'index.js.map');
  const bundledMainMap = path.join(bundleDir, 'main.js.map');

  if (!fs.existsSync(bundledIndex)) {
    throw new Error(`Bundled file not found: ${bundledIndex}`);
  }

  // Rename index.js to main.js
  fs.renameSync(bundledIndex, bundledMain);
  console.log('✓ Renamed index.js → main.js');

  // Rename source map if it exists
  if (fs.existsSync(bundledIndexMap)) {
    fs.renameSync(bundledIndexMap, bundledMainMap);
    console.log('✓ Renamed index.js.map → main.js.map');
  }

  // Clean up unnecessary files (ncc sometimes includes data files)
  // Keep sourcemap-register.js - it's required by the bundled main.js
  const filesToKeep = ['main.js', 'main.js.map', 'licenses.txt', 'sourcemap-register.js'];
  const files = fs.readdirSync(bundleDir);
  let cleanedCount = 0;

  for (const file of files) {
    const filePath = path.join(bundleDir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      console.log(`  Removing directory: ${file}`);
      fs.rmSync(filePath, { recursive: true, force: true });
      cleanedCount++;
    } else if (!filesToKeep.includes(file)) {
      console.log(`  Removing file: ${file}`);
      fs.unlinkSync(filePath);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`✓ Cleaned up ${cleanedCount} unnecessary file(s)`);
  }

  // Verify final bundle
  if (!fs.existsSync(bundledMain)) {
    throw new Error(`Bundled file not found after rename: ${bundledMain}`);
  }

  const stats = fs.statSync(bundledMain);
  console.log(`✓ Bundle created: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`✓ Location: ${bundledMain}\n`);

  console.log('✅ Backend bundling complete!\n');
} catch (error) {
  console.error('\n❌ Backend bundling failed:', error.message);
  process.exit(1);
}
