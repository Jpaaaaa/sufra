// 🔒 Disable ALL Windows code-signing attempts
process.env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
delete process.env.CSC_LINK;
delete process.env.CSC_KEY_PASSWORD;
delete process.env.WIN_CSC_LINK;
delete process.env.WIN_CSC_KEY_PASSWORD;
process.env.ELECTRON_BUILDER_OFFLINE = "true";
process.env.DISABLE_CODE_SIGNING = "true";

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building Windows Electron App Directory...\n');

(async () => {
try {
  // Step 1: Build Frontend
  console.log('📦 Step 1/4: Building frontend...');
  execSync('cd ../frontend && npm run build', { stdio: 'inherit' });
  console.log('✓ Frontend built successfully\n');

  // Step 2: Build Backend (normal build, no bundling - native modules need node_modules)
  console.log('📦 Step 2/4: Building backend...');
  execSync('npm run build:backend', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ Backend built successfully\n');

  // Step 3: Build Electron
  console.log('📦 Step 3/4: Building Electron app...');
  execSync('npm run build', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ Electron app built successfully\n');

  // Step 4: Create icon check
  console.log('📦 Step 4/4: Checking icon...');
  execSync('node create-icon.js', { stdio: 'inherit', cwd: __dirname });
  console.log('✓ Icon check complete\n');

  // Step 5: Clean previous build (if exists)
  const unpackedDir = path.join(__dirname, 'release', 'win-unpacked');
  
  if (fs.existsSync(unpackedDir)) {
    console.log('🧹 Cleaning previous build directory...');
    
    // Try to kill any Electron processes that might be locking files
    try {
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        try {
          execSync('taskkill /F /IM "sufra-pos.exe" /T 2>nul', { stdio: 'ignore' });
          execSync('taskkill /F /IM "sufra pos.exe" /T 2>nul', { stdio: 'ignore' });
          execSync('taskkill /F /IM "Sufra Lite POS.exe" /T 2>nul', { stdio: 'ignore' });
          execSync('taskkill /F /FI "WINDOWTITLE eq Sufra*" 2>nul', { stdio: 'ignore' });
        } catch (e) {
          // Ignore errors - processes might not be running
        }
      }
    } catch (e) {
      // Ignore
    }
    
    // Wait a moment for processes to close
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let cleaned = false;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!cleaned && attempts < maxAttempts) {
      attempts++;
      try {
        // Try to remove the directory with aggressive options
        if (process.platform === 'win32') {
          // On Windows, use PowerShell for more aggressive removal
          try {
            // Escape backslashes for PowerShell
            const psPath = unpackedDir.replace(/\\/g, '\\\\');
            const psCommand = `Start-Sleep -Seconds 1; if (Test-Path '${psPath}') { Remove-Item -Path '${psPath}' -Recurse -Force -ErrorAction Stop }`;
            execSync(`powershell -Command "${psCommand}"`, { 
              stdio: 'inherit',
              timeout: 10000 
            });
            cleaned = true;
          } catch (psError) {
            if (attempts < maxAttempts) {
              console.log(`⏳ Retry ${attempts}/${maxAttempts} - waiting for files to unlock...`);
              await new Promise(resolve => setTimeout(resolve, 2000));
              continue;
            }
            throw psError;
          }
        } else {
          fs.rmSync(unpackedDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 1000 });
          cleaned = true;
        }
      } catch (cleanError) {
        if (attempts >= maxAttempts) {
          console.error('❌ Could not clean previous build after', maxAttempts, 'attempts');
          console.error('💡 Please manually:');
          console.error('   1. Close all Electron/Sufra apps');
          console.error('   2. Close File Explorer windows showing that folder');
          console.error('   3. Or manually delete:', unpackedDir);
          console.error('   4. Then try building again\n');
          process.exit(1);
        }
      }
    }
    
    if (cleaned) {
      console.log('✓ Previous build cleaned\n');
    }
  }

  // Step 6: Build app directory
  console.log('📦 Final step: Creating Windows app directory...');
  // Ensure all signing env vars are unset
  const env = { ...process.env };
  delete env.CSC_LINK;
  delete env.CSC_KEY_PASSWORD;
  delete env.WIN_CSC_LINK;
  delete env.WIN_CSC_KEY_PASSWORD;
  env.CSC_IDENTITY_AUTO_DISCOVERY = "false";
  env.ELECTRON_BUILDER_OFFLINE = "true";
  env.DISABLE_CODE_SIGNING = "true";
  
  execSync('npx electron-builder --win --dir', {
    stdio: 'inherit',
    cwd: __dirname,
    shell: true,
    env: env
  });

  // Check for win-unpacked directory
  if (fs.existsSync(unpackedDir)) {
    console.log('\n✅ SUCCESS! App directory created successfully!\n');
    console.log(`📁 Location: ${unpackedDir}`);
    
    // Check for main executable
    const exeFiles = fs.readdirSync(unpackedDir).filter(f => f.endsWith('.exe'));
    if (exeFiles.length > 0) {
      const exePath = path.join(unpackedDir, exeFiles[0]);
      console.log(`🚀 Executable: ${exePath}`);
      console.log(`📦 Size: ${(fs.statSync(exePath).size / 1024 / 1024).toFixed(2)} MB\n`);
    }
  } else {
    console.log('\n⚠️  Build completed, but win-unpacked directory not found.\n');
    console.log(`📁 Expected: ${unpackedDir}\n`);
  }
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
}
})();
