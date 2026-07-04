// Kill all Electron processes more reliably
const { execSync } = require('child_process');

console.log('Killing existing Electron processes...');

try {
  // Try to kill electron.exe
  execSync('taskkill /F /IM electron.exe', { stdio: 'ignore' });
  console.log('✓ Killed electron.exe');
} catch (e) {
  // Process might not exist, that's okay
  console.log('No electron.exe process found');
}

try {
  // Also try to kill any node processes running electron
  execSync('taskkill /F /FI "WINDOWTITLE eq electron*"', { stdio: 'ignore' });
} catch (e) {
  // Ignore errors
}

// Wait a bit for processes to fully terminate
// Don't exit - let the next command in the chain run
setTimeout(() => {
  // Just return, don't exit - the script chain will continue
}, 500);


