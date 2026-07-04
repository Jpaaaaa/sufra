// Simple test to see if Electron can run and capture output
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('========================================');
console.log('Starting Electron test...');
console.log('Working directory:', process.cwd());
console.log('========================================\n');

// Write to a log file as well
const logFile = path.join(__dirname, 'electron-debug.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}\n`;
  process.stdout.write(logMsg);
  logStream.write(logMsg);
}

log('Starting Electron process...');

const electron = spawn('npx', ['electron', '.'], {
  cwd: __dirname,
  stdio: ['inherit', 'pipe', 'pipe'], // stdin inherit, stdout/stderr pipe
  shell: true
});

// Capture stdout
electron.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  logStream.write(`[STDOUT] ${output}`);
});

// Capture stderr
electron.stderr.on('data', (data) => {
  const output = data.toString();
  process.stderr.write(output);
  logStream.write(`[STDERR] ${output}`);
});

electron.on('error', (error) => {
  const errorMsg = `Electron spawn error: ${error.message}\n${error.stack}\n`;
  console.error(errorMsg);
  logStream.write(`[ERROR] ${errorMsg}`);
  logStream.end();
  process.exit(1);
});

electron.on('exit', (code, signal) => {
  const exitMsg = `\n========================================\nElectron exited with code ${code} and signal ${signal}\n========================================\n`;
  console.log(exitMsg);
  logStream.write(exitMsg);
  logStream.end();
  
  // Don't exit immediately - keep terminal open for a moment to see output
  // Only exit if code is non-zero (error)
  if (code !== 0) {
    console.log('\nPress any key to exit...');
    setTimeout(() => {
      process.exit(code || 0);
    }, 2000);
  } else {
    // For normal exit, keep process alive so terminal stays open
    console.log('\nElectron closed normally. Terminal will stay open.');
    // Don't exit - let user close terminal manually or press Ctrl+C
  }
});

// Keep this process alive
process.on('SIGINT', () => {
  log('Received SIGINT, killing Electron...');
  electron.kill();
  logStream.end();
  process.exit(0);
});

log('Electron process spawned, waiting for output...');

