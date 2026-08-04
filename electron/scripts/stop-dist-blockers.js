/**
 * Stops dev processes that commonly lock native .node files during dist.
 * Safe to run before packaging; only targets Sufra dev ports and app binary.
 */
const { execSync } = require('child_process');

function tryRun(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore', shell: true });
  } catch {
    // ignore — process may not exist
  }
}

function killPort(port) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: 'utf8', shell: true },
    );
    const pids = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s));
    for (const pid of pids) {
      tryRun(`taskkill /PID ${pid} /F`);
    }
  } catch {
    // Get-NetTCPConnection unavailable or no listeners
  }
}

console.log('[DIST] Stopping processes that may lock native modules...');
tryRun('taskkill /IM "sufra pos.exe" /F');
killPort(3000);
killPort(3333);
// Brief pause so Windows releases file handles
tryRun('ping -n 3 127.0.0.1 > nul');
console.log('[DIST] ✓ Dist blocker cleanup done');
