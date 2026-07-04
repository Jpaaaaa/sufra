const fs = require('fs');
const path = require('path');

// Copy fonts
const srcDir = path.join(__dirname, 'fonts');
const destDir = path.join(__dirname, 'dist', 'fonts');

// Create destination directory
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy .ttf files if fonts folder exists
if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.endsWith('.ttf')) {
      fs.copyFileSync(
        path.join(srcDir, file),
        path.join(destDir, file)
      );
    }
  }
}

// Copy backend dist to electron dist so runtime imports work
const backendDistSrc = path.join(__dirname, 'backend', 'dist');
const backendDistDest = path.join(__dirname, 'dist', 'backend', 'dist');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    return;
  }
  
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

if (fs.existsSync(backendDistSrc)) {
  copyRecursive(backendDistSrc, backendDistDest);
  console.log("Backend dist copied successfully.");
  
  // Create symlink/junction to backend node_modules so backend code can find dependencies
  const backendNodeModulesSrc = path.join(__dirname, 'backend', 'node_modules');
  const backendNodeModulesDest = path.join(__dirname, 'dist', 'backend', 'node_modules');

  /** Clear stale link, empty dir, or accidental copy under dist (build output only). */
  function removeDestNodeModules() {
    try {
      fs.lstatSync(backendNodeModulesDest);
    } catch {
      return;
    }
    try {
      fs.unlinkSync(backendNodeModulesDest);
      return;
    } catch {
      /* not a symlink/junction, or unlink failed */
    }
    try {
      fs.rmSync(backendNodeModulesDest, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  if (fs.existsSync(backendNodeModulesSrc)) {
    removeDestNodeModules();
    const srcAbs = path.resolve(backendNodeModulesSrc);
    const destAbs = path.resolve(backendNodeModulesDest);
    try {
      if (process.platform === 'win32') {
        // Prefer Node junction (no cmd.exe); mklink is a cmd built-in and often fails from execSync.
        fs.symlinkSync(srcAbs, destAbs, 'junction');
        console.log('Backend node_modules junction created successfully.');
      } else {
        fs.symlinkSync(srcAbs, destAbs, 'dir');
        console.log('Backend node_modules symlink created successfully.');
      }
    } catch (error) {
      try {
        const { execSync } = require('child_process');
        execSync(`cmd /c mklink /J "${destAbs}" "${srcAbs}"`, {
          stdio: 'ignore',
          windowsHide: true,
        });
        console.log('Backend node_modules junction created successfully (via cmd mklink).');
      } catch (error2) {
        console.warn('Warning: Could not create node_modules symlink/junction:', error.message);
        console.warn('Fallback error:', error2 && error2.message);
        console.warn('Backend dependencies may not be found. Install backend deps: cd backend && npm install');
      }
    }
  } else {
    console.warn("Warning: Backend node_modules not found at:", backendNodeModulesSrc);
  }
} else {
  console.warn("Warning: Backend dist not found. Make sure to run 'npm run build:backend' first.");
}

// Copy splash screen and logo for app startup
const splashSrc = path.join(__dirname, 'build', 'splash.html');
const logoCandidates = [
  path.join(__dirname, 'build', 'sufralogo.png'),
  path.join(__dirname, '..', 'frontend', 'public', 'logo', 'logo.png'),
];
const distDir = path.join(__dirname, 'dist');
if (fs.existsSync(splashSrc)) {
  fs.copyFileSync(splashSrc, path.join(distDir, 'splash.html'));
  console.log('Splash screen copied to dist.');
}
for (const logoPath of logoCandidates) {
  if (fs.existsSync(logoPath)) {
    fs.copyFileSync(logoPath, path.join(distDir, 'logo.png'));
    console.log('Logo copied to dist for splash.');
    break;
  }
}

console.log("Fonts copied successfully.");
