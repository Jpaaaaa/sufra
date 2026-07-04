// Simple Electron launcher that keeps terminal open
const { spawn } = require('child_process');

console.log('========================================');
console.log('Starting Electron...');
console.log('========================================\n');

// Kill existing Electron processes first - be more aggressive
try {
  const { execSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  
  console.log('Killing existing Electron processes...');
  
  // First, check if Electron is actually running
  try {
    const checkResult = execSync('tasklist /FI "IMAGENAME eq electron.exe" /FO CSV', { encoding: 'utf8', timeout: 1000 });
    if (checkResult.includes('electron.exe')) {
      console.log('Found running Electron process, killing...');
    } else {
      console.log('No Electron process found in tasklist');
    }
  } catch (e) {
    // Ignore - might not be running
  }
  
  // Try multiple methods to kill Electron
  const killCommands = [
    'taskkill /F /IM electron.exe',
    'taskkill /F /FI "WINDOWTITLE eq electron*"',
    'taskkill /F /FI "IMAGENAME eq electron.exe"',
  ];
  
  let killed = false;
  for (const cmd of killCommands) {
    try {
      execSync(cmd, { stdio: 'pipe', timeout: 2000 });
      console.log(`✓ Executed: ${cmd}`);
      killed = true;
    } catch (e) {
      // Check if error is because process doesn't exist (that's okay)
      if (e.message && e.message.includes('not found')) {
        // Process doesn't exist, that's fine
      } else {
        // Other error, log it
        console.log(`  (Command failed: ${e.message})`);
      }
    }
  }
  
  if (killed) {
    console.log('✓ Killed existing Electron processes');
  } else {
    console.log('No existing Electron processes found (or already killed)');
  }
  
  // Also try to clear single instance lock files
  // Electron stores lock files in temp directory
  try {
    const tempDir = os.tmpdir();
    const lockPattern = /electron.*\.lock/i;
    const files = fs.readdirSync(tempDir);
    let lockFilesCleared = 0;
    
    for (const file of files) {
      if (lockPattern.test(file)) {
        try {
          const lockPath = path.join(tempDir, file);
          fs.unlinkSync(lockPath);
          console.log(`✓ Cleared lock file: ${file}`);
          lockFilesCleared++;
        } catch (e) {
          // Lock file might be in use, that's okay
        }
      }
    }
    
    if (lockFilesCleared > 0) {
      console.log(`✓ Cleared ${lockFilesCleared} lock file(s)`);
    }
  } catch (e) {
    // Ignore lock file errors
  }
  
  // Wait longer for processes and locks to fully clear
  console.log('Waiting 2 seconds for processes to fully terminate...\n');
  const startTime = Date.now();
  while (Date.now() - startTime < 2000) {
    // Busy wait
  }
  
  // Final check - try to kill one more time
  try {
    execSync('taskkill /F /IM electron.exe', { stdio: 'ignore', timeout: 1000 });
    console.log('✓ Final kill attempt succeeded');
  } catch (e) {
    // Expected if no process exists
  }
} catch (e) {
  console.log('Error killing processes:', e.message);
}

// Now start Electron
console.log('Launching Electron...\n');
const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  cwd: __dirname
});

electron.on('error', (error) => {
  console.error('\n========================================');
  console.error('ERROR: Failed to start Electron');
  console.error('========================================');
  console.error(error);
  console.error('\nPress any key to exit...');
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => process.exit(1));
});

electron.on('exit', (code, signal) => {
  console.log('\n========================================');
  console.log(`Electron exited with code ${code}${signal ? ` and signal ${signal}` : ''}`);
  console.log('========================================\n');
  
  if (code === 0) {
    console.log('Electron closed normally (user closed window or app quit).');
  } else {
    console.log(`⚠️ Electron exited with error code ${code}.`);
    console.log('This indicates a crash or error. Check the logs above for details.');
  }
  
  if (signal) {
    console.log(`⚠️ Electron was terminated by signal: ${signal}`);
  }
  
  console.log('\n========================================');
  console.log('Terminal will stay open so you can review the logs.');
  console.log('Press Ctrl+C to close this terminal when done.');
  console.log('========================================\n');
  
  // Keep process alive indefinitely so user can read logs
  // User must press Ctrl+C to close
  // Don't auto-exit - this was causing the "cursor closing" problem
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\nReceived Ctrl+C, killing Electron...');
  electron.kill();
  process.exit(0);
});

