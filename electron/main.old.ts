import { app } from "electron";

// Must run BEFORE app.whenReady()
app.commandLine.appendSwitch("ignore-gpu-blocklist");

import { BrowserWindow, ipcMain, dialog, protocol, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { setIsDev } from './electron-env';
import { renderOrderToPng } from './print/render-kitchen-receipt';
import { renderReceiptToPng } from './print/render-customer-receipt';
import { printPngToPrinter, getAvailablePrinters } from './print/printer';
import { BACKEND_URL } from './electron-env';
import { loadDev } from './loaders/devLoader';

// Tell env whether dev or prod
setIsDev(!app.isPackaged);

let mainWindow: BrowserWindow | null = null;
let backendProcess: ChildProcess | null = null;
let backendStartedByUs: boolean = false; // Track if we started the backend

// ======================================================================
// REGISTER CUSTOM PROTOCOL (MUST BE BEFORE APP READY)
// ======================================================================
// Register 'app' protocol to serve static Next.js files
// This allows absolute paths like /_next/static/... to resolve correctly
protocol.registerSchemesAsPrivileged([
  { 
    scheme: 'app', 
    privileges: { 
      secure: true, 
      standard: true, 
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    } 
  }
]);

// ======================================================================
// SINGLE INSTANCE LOCK
// ======================================================================
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// ======================================================================
// GLOBAL ERROR HANDLERS
// ======================================================================
process.on('uncaughtException', (err) => {
  console.error('[ELECTRON] Uncaught Exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('[ELECTRON] Unhandled Promise Rejection:', err);
});

// ======================================================================
// LICENSE CHECK - ZERO SECURITY MODE (TESTING)
// ======================================================================
async function ensureLicensed(): Promise<boolean> {
  console.log('[LICENSE] Security disabled for TEST mode');
  return true;
}

// ======================================================================
// GET STATIC FRONTEND PATH
// ======================================================================
function getStaticFrontendPath(): string {
  if (!app.isPackaged) {
    // DEV mode
    return path.join(__dirname, "..", "frontend", "out");
  }

  // PRODUCTION mode — Check both locations (files array and extraResources)
  // Files array → resources/app/frontend/out (via app.getAppPath())
  // extraResources → resources/frontend/out (via process.resourcesPath)
  
  // First try extraResources location (preferred for NSIS installer)
  const extraResourcesPath = path.join(process.resourcesPath, "frontend", "out");
  if (fs.existsSync(extraResourcesPath)) {
    console.log("[FRONTEND] STATIC PATH (extraResources):", extraResourcesPath);
    return extraResourcesPath;
  }
  
  // Fallback to files array location
  const filesPath = path.join(app.getAppPath(), "frontend", "out");
  if (fs.existsSync(filesPath)) {
    console.log("[FRONTEND] STATIC PATH (files):", filesPath);
    return filesPath;
  }
  
  // Default to extraResources path (will show error if not found)
  console.log("[FRONTEND] STATIC PATH (default):", extraResourcesPath);
  return extraResourcesPath;
}

// ======================================================================
// CHECK IF BACKEND IS ALREADY RUNNING
// ======================================================================
async function checkBackendHealth(): Promise<boolean> {
  try {
    // Use Node.js http module for better compatibility
    const http = await import('http');
    
    return new Promise<boolean>((resolve) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: 3333,
          path: '/health',
          method: 'GET',
          timeout: 3000, // Increased timeout for health check
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk.toString();
          });
          
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const health = JSON.parse(data);
                // Verify health response indicates ready state
                if (health.status === 'ok' && health.database === 'ready') {
                  resolve(true);
                } else {
                  console.warn('[HEALTH] Backend responded but not ready:', health);
                  resolve(false);
                }
              } catch (parseError) {
                // If JSON parse fails but status is 200, assume ready
                resolve(true);
              }
            } else {
              console.warn(`[HEALTH] Backend returned status ${res.statusCode}`);
              resolve(false);
            }
          });
        }
      );

      req.on('error', (error) => {
        // Don't log connection refused - it's expected during startup
        if (error && (error as any).code !== 'ECONNREFUSED') {
          console.warn('[HEALTH] Health check error:', (error as any).code || error);
        }
        resolve(false);
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    });
  } catch (error) {
    // Backend is not running or not accessible
    return false;
  }
}

// ======================================================================
// START BACKEND
// ======================================================================
async function startBackend() {
  if (backendProcess) {
    console.log('[BACKEND] Backend process already exists');
    return;
  }

  // Check if backend is already running
  console.log('[BACKEND] Checking if backend is already running...');
  const isRunning = await checkBackendHealth();
  
  if (isRunning) {
    console.log('[BACKEND] ✓ Backend is already running on port 3333, reusing it');
    backendStartedByUs = false;
    return;
  }

  console.log('[BACKEND] Backend not running, starting new process...');
  
  // PRODUCTION mode — Use normal build (dist/main.js) with node_modules
  // Native modules (bcrypt, @thiagoelg/node-printer) require node_modules to be present
  // Location: process.resourcesPath/app.asar.unpacked/backend/dist/main.js (unpacked by electron-builder)
  let backendEntry: string;
  
  if (app.isPackaged) {
    backendEntry = path.join(
      process.resourcesPath,
      'app.asar.unpacked',
      'backend',
      'dist',
      'main.js'
    );

    console.log('[BACKEND] process.resourcesPath:', process.resourcesPath);
    console.log('[BACKEND] resolved backendEntry path:', backendEntry);

    if (!fs.existsSync(backendEntry)) {
      dialog.showErrorBox(
        'Backend Not Found',
        `Backend entry file not found:\n${backendEntry}`
      );
      return;
    }

    console.log('[BACKEND] ✓ Using backend:', backendEntry);
  } else {
    // DEV mode: Use unbundled backend from dist
    // From electron/dist/main.js, go up 2 levels to root, then to backend/dist/main.js
    backendEntry = path.join(__dirname, '..', '..', 'backend', 'dist', 'main.js');
    if (!fs.existsSync(backendEntry)) {
      console.error('[BACKEND] ✗ Backend entry file not found:', backendEntry);
      console.error('[BACKEND] Expected at:', backendEntry);
      console.error('[BACKEND] Current __dirname:', __dirname);
      // Try alternative path (if running from source)
      const altPath = path.join(process.cwd(), 'backend', 'dist', 'main.js');
      if (fs.existsSync(altPath)) {
        console.log('[BACKEND] Found backend at alternative path:', altPath);
        backendEntry = altPath;
      } else {
        return;
      }
    }
    console.log('[BACKEND] Using dev backend:', backendEntry);
  }

  try {
    // In production, use embedded Node.js runtime instead of Electron executable
    let nodePath: string;
    if (app.isPackaged) {
      // Use embedded Node.js from electron-builder
      nodePath = path.join(process.resourcesPath, "node", "node.exe");
    } else {
      // Dev mode: use system Node.js from PATH
      // process.execPath is Electron, not Node.js, so we need to find Node.js
      // Use 'node' and let the system find it from PATH
      nodePath = 'node';
    }

    // Verify node.exe exists in production
    if (app.isPackaged) {
      console.log('[BACKEND] Checking for Node.js at:', nodePath);
      if (!fs.existsSync(nodePath)) {
        console.error('[BACKEND] ✗ Node.js not found at:', nodePath);
        console.error('[BACKEND] Resources directory:', process.resourcesPath);
        console.error('[BACKEND] Resources contents:', fs.existsSync(process.resourcesPath) ? fs.readdirSync(process.resourcesPath).join(', ') : 'DOES NOT EXIST');
        dialog.showErrorBox(
          'Node.js Not Found',
          `Node.js runtime not found at:\n${nodePath}\n\nPlease rebuild the application with Node.js bundled.`
        );
        return;
      }
      console.log('[BACKEND] ✓ Node.js found at:', nodePath);
    }
    
    console.log("[BACKEND] Starting backend using:");
    console.log("[BACKEND]   Node path:", nodePath);
    console.log("[BACKEND]   Backend entry:", backendEntry);
    
    // Pass Electron's userData path to backend via environment variable
    // This allows backend to write files to user's AppData instead of Program Files
    const userDataPath = app.getPath('userData');
    const logsDir = path.join(userDataPath, 'logs');
    
    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const env = {
      ...process.env,
      ELECTRON_USER_DATA: userDataPath,
      NODE_ENV: 'production',
      // Set working directory to userData to avoid any path issues
      PWD: userDataPath,
    };
    
    console.log("[BACKEND] Setting ELECTRON_USER_DATA to:", userDataPath);
    console.log("[BACKEND] Logs directory:", logsDir);
    console.log("[BACKEND] Spawning backend process...");
    
    // Set working directory to userData (writable location)
    // This ensures any relative paths in backend resolve correctly
    // On Windows, use shell: true to find 'node' from PATH
    const spawnOptions: any = {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: false,
      env: env,
      cwd: userDataPath, // Use userData as working directory (writable)
    };
    
    // In dev mode, if using 'node' command, enable shell on Windows
    if (!app.isPackaged && process.platform === 'win32') {
      spawnOptions.shell = true;
    }
    
    console.log("[BACKEND] Spawning with options:", JSON.stringify({
      nodePath,
      backendEntry,
      cwd: userDataPath,
      shell: spawnOptions.shell || false
    }, null, 2));
    
    backendProcess = spawn(nodePath, [backendEntry], spawnOptions);
    
    console.log("[BACKEND] Backend process spawned, PID:", backendProcess.pid);

    backendStartedByUs = true;

    // Setup log file for backend output
    const logFile = path.join(logsDir, `backend-${Date.now()}.log`);
    let logStream: fs.WriteStream | null = null;
    
    try {
      logStream = fs.createWriteStream(logFile, { flags: 'a' });
      logStream.write(`\n=== Backend started at ${new Date().toISOString()} ===\n`);
      logStream.write(`Node path: ${nodePath}\n`);
      logStream.write(`Backend entry: ${backendEntry}\n`);
      logStream.write(`User data: ${userDataPath}\n`);
      logStream.write(`PID: ${backendProcess.pid}\n\n`);
      console.log(`[BACKEND] Log file: ${logFile}`);
    } catch (err) {
      console.error('[BACKEND] Failed to create log file:', err);
    }

    // Capture and log backend stdout (both console and file)
    if (backendProcess.stdout) {
      backendProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          console.log('[BACKEND]', output);
          try {
            if (logStream) {
              logStream.write(`[STDOUT] ${output}\n`);
            }
          } catch (err) {
            // Ignore log write errors
          }
        }
      });
    }

    // Capture and log backend stderr (both console and file)
    // CRITICAL: stderr often contains startup errors
    if (backendProcess.stderr) {
      backendProcess.stderr.on('data', (data: Buffer) => {
        const output = data.toString().trim();
        if (output) {
          // Always log stderr - it's critical for debugging startup failures
          console.error('[BACKEND ERROR]', output);
          try {
            if (logStream) {
              logStream.write(`[STDERR] ${output}\n`);
            }
          } catch (err) {
            // Ignore log write errors
          }
        }
      });
    }
    
    // Monitor for immediate crashes (before health check)
    let hasReceivedOutput = false;
    const outputTimeout = setTimeout(() => {
      if (!hasReceivedOutput && backendProcess && !backendProcess.killed) {
        console.warn('[BACKEND] No output received from backend process after 2 seconds');
        console.warn('[BACKEND] This may indicate the backend is stuck or crashed silently');
      }
    }, 2000);
    
    if (backendProcess.stdout) {
      backendProcess.stdout.once('data', () => {
        hasReceivedOutput = true;
        clearTimeout(outputTimeout);
      });
    }

    // Track if backend exited early (before health check completes)
    let backendExitedEarly = false;
    let earlyExitCode: number | null = null;
    let earlyExitSignal: string | null = null;
    
    backendProcess.on('exit', (code, signal) => {
      // Close log stream
      try {
        if (logStream) {
          logStream.write(`\n=== Backend exited at ${new Date().toISOString()} ===\n`);
          logStream.write(`Exit code: ${code}, Signal: ${signal}\n\n`);
          logStream.end();
          logStream = null;
        }
      } catch (err) {
        // Ignore log close errors
      }
      
      // Mark as exited early if we're still waiting for health check
      backendExitedEarly = true;
      earlyExitCode = code;
      earlyExitSignal = signal;
      
      backendProcess = null;
      backendStartedByUs = false;
      
      if (signal) {
        console.error(`[BACKEND] Process exited with signal: ${signal}${code !== null ? `, code: ${code}` : ''}`);
      } else if (code !== 0 && code !== null) {
        console.error(`[BACKEND] Process exited with code: ${code}`);
        // Exit code 1 usually means a startup error
        if (code === 1) {
          console.error('[BACKEND] Exit code 1 typically indicates:');
          console.error('[BACKEND]   - Module not found error');
          console.error('[BACKEND]   - Syntax error in code');
          console.error('[BACKEND]   - Missing dependencies');
          console.error('[BACKEND]   - Database initialization failure');
        }
      } else if (code === null) {
        console.error(`[BACKEND] Process exited with null code${signal ? `, signal: ${signal}` : ''}`);
      } else {
        console.log(`[BACKEND] Process exited cleanly with code: ${code}`);
      }
      
      // Only show error dialog if it wasn't a clean shutdown
      // But don't show if we're still in startup phase (will be handled by startup timeout)
      if (code !== 0 && code !== null && !backendExitedEarly) {
        // Don't show dialog for EADDRINUSE - we handle that below
        if (code !== 1) {
          dialog.showErrorBox(
            'Backend Error',
            `خادم الـ API توقف unexpectedly${signal ? ` (signal: ${signal})` : ''}${code !== null ? ` (code: ${code})` : ''}.\n\nLogs: ${logFile}`
          );
        }
      }
    });

    backendProcess.on('error', (error: any) => {
      console.error('[BACKEND] ✗ Failed to start backend process:', error);
      console.error('[BACKEND] Error code:', error.code);
      console.error('[BACKEND] Error message:', error.message);
      console.error('[BACKEND] Node path used:', nodePath);
      console.error('[BACKEND] Backend entry used:', backendEntry);
      console.error('[BACKEND] Working directory:', userDataPath);
      backendProcess = null;
      backendStartedByUs = false;

      // Handle EADDRINUSE specifically
      if (error.code === 'EADDRINUSE') {
        console.log('[BACKEND] Port 3333 is already in use');
        // Check again if backend is actually responding
        setTimeout(async () => {
          const isRunning = await checkBackendHealth();
          if (isRunning) {
            console.log('[BACKEND] ✓ Backend is responding, reusing existing instance');
          } else {
            dialog.showErrorBox(
              'Backend Port Conflict',
              'Port 3333 is already in use, but the backend is not responding.\n\n' +
              'Please stop the process using port 3333 or restart your system.'
            );
          }
        }, 1000);
      } else {
        const errorMsg = `Failed to start backend:\n\n${error.message}\n\nNode: ${nodePath}\nBackend: ${backendEntry}\n\nCheck the console for more details.`;
        dialog.showErrorBox('Backend Start Error', errorMsg);
      }
    });

    // Wait for backend to be ready before continuing
    console.log('[BACKEND] Waiting for backend to be ready...');
    const maxRetries = 30;
    const retryDelay = 500;
    let isReady = false;
    
    for (let i = 0; i < maxRetries; i++) {
      // Check if backend exited early
      if (backendExitedEarly) {
        console.error('[BACKEND] ✗ Backend process exited before becoming ready');
        console.error(`[BACKEND] Exit code: ${earlyExitCode}, Signal: ${earlyExitSignal}`);
        break; // Exit loop early
      }
      
      // Check if process is still running
      if (!backendProcess || backendProcess.killed) {
        console.error('[BACKEND] ✗ Backend process is not running');
        break; // Exit loop early
      }
      
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      isReady = await checkBackendHealth();
      if (isReady) {
        console.log('[BACKEND] ✓ Backend started successfully and is responding');
        return; // Backend is ready, exit function
      }
      if (i < maxRetries - 1) {
        console.log(`[BACKEND] Waiting for backend... (${i + 1}/${maxRetries})`);
      }
    }
    
    // If we get here, backend didn't start in time
    console.error('[BACKEND] ✗ Backend failed to start within timeout');
    
    // Check if process is still running
    let processStatus = 'unknown';
    let exitCode: number | null = earlyExitCode;
    
    if (backendExitedEarly) {
      processStatus = 'exited early';
      exitCode = earlyExitCode;
      console.error('[BACKEND] Backend process exited before becoming ready');
      console.error(`[BACKEND] Exit code: ${exitCode}, Signal: ${earlyExitSignal}`);
      if (exitCode === 1) {
        console.error('[BACKEND] Exit code 1 indicates a startup error - check logs for details');
      }
    } else if (backendProcess) {
      if (backendProcess.killed) {
        processStatus = 'killed';
      } else {
        // Process is still running but not responding
        processStatus = 'running but unresponsive';
        console.error('[BACKEND] Process is running but not responding to health checks');
        console.error('[BACKEND] This may indicate:');
        console.error('[BACKEND]   - Backend is stuck in initialization');
        console.error('[BACKEND]   - Database is taking too long to initialize');
        console.error('[BACKEND]   - Backend is listening on wrong port');
        console.error('[BACKEND]   - Health endpoint is not working');
        
        // Try to get more info before killing
        try {
          // Give it one more second
          await new Promise(resolve => setTimeout(resolve, 1000));
          const finalCheck = await checkBackendHealth();
          if (finalCheck) {
            console.log('[BACKEND] ✓ Backend became ready after additional wait');
            return; // Success!
          }
        } catch (checkError) {
          console.error('[BACKEND] Final health check also failed:', checkError);
        }
        
        // Kill the unresponsive process
        try {
          backendProcess.kill();
          processStatus = 'killed (was unresponsive)';
        } catch (killError) {
          console.error('[BACKEND] Failed to kill unresponsive process:', killError);
          processStatus = 'failed to kill';
        }
      }
    } else {
      processStatus = 'crashed or never started';
      console.error('[BACKEND] Backend process appears to have crashed or never started');
    }
    
    // Get log file path for error message (reuse variables from earlier in function)
    const errorLogFiles = fs.existsSync(logsDir) 
      ? fs.readdirSync(logsDir).filter(f => f.startsWith('backend-')).sort().reverse().slice(0, 3)
      : [];
    const latestLog = errorLogFiles.length > 0 ? path.join(logsDir, errorLogFiles[0]) : 'N/A';
    
    backendProcess = null;
    backendStartedByUs = false;
    
    // CRITICAL: Block app startup - show error with detailed diagnostics
    const errorMessage = `Backend failed to start.\n\n` +
      `Process status: ${processStatus}\n` +
      `Exit code: ${exitCode !== null ? exitCode : 'N/A'}\n\n` +
      `The application cannot run without the backend server.\n\n` +
      `Please check:\n` +
      `- Node.js runtime is available at: ${nodePath}\n` +
      `- Backend file exists at: ${backendEntry}\n` +
      `- Port 3333 is not in use\n` +
      `- Application files are not corrupted\n\n` +
      `Latest log file: ${latestLog}\n\n` +
      `Check the console logs for more details.`;
    
    dialog.showErrorBox('Backend Startup Failed', errorMessage);
    throw new Error(`Backend failed to start - process status: ${processStatus}`);

  } catch (error: any) {
    console.error('[BACKEND] Exception starting backend:', error);
    backendProcess = null;
    backendStartedByUs = false;

    if (error.code === 'EADDRINUSE') {
      // Check if backend is actually responding
      const isRunning = await checkBackendHealth();
      if (isRunning) {
        console.log('[BACKEND] ✓ Backend is responding, reusing existing instance');
        return; // Success - backend is already running
      } else {
        const errorMsg = 'Port 3333 is already in use, but the backend is not responding.\n\n' +
          'Please stop the process using port 3333 or restart your system.';
        dialog.showErrorBox('Backend Port Conflict', errorMsg);
        throw new Error('Backend port conflict - application cannot continue');
      }
    } else {
      const errorMsg = `Failed to start backend:\n\n${error.message}\n\n` +
        `The application cannot run without the backend server.`;
      dialog.showErrorBox('Backend Start Error', errorMsg);
      throw error; // Re-throw to prevent app from continuing
    }
  }
}

// ======================================================================
// CREATE ELECTRON WINDOW
// ======================================================================
async function createWindow() {
  if (mainWindow !== null) return;
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: app.isPackaged ? true : false,
      devTools: true, // Always enable DevTools for debugging
    }
  });

  // Prevent new windows/tabs from opening
  mainWindow.webContents.setWindowOpenHandler(() => {
    console.log('[ELECTRON] Blocked new window/tab request');
    return { action: 'deny' };
  });

  // Prevent navigation to external URLs
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow navigation within the app (app://, file://, or localhost)
    if (parsedUrl.protocol === 'app:' || 
        parsedUrl.protocol === 'file:' || 
        parsedUrl.hostname === 'localhost' || 
        parsedUrl.hostname === '127.0.0.1') {
      return;
    }
    
    // Block external URLs
    console.log('[ELECTRON] Blocked navigation to external URL:', navigationUrl);
    event.preventDefault();
  });

  try {
    if (!app.isPackaged) {
      // Dev mode: use Next.js dev server
      await loadDev(mainWindow);
      console.log('[ELECTRON] Frontend loaded in DEV mode from http://localhost:3000');
    } else {
      // Production: load static files using custom 'app' protocol
      const staticPath = getStaticFrontendPath();
      const indexHtml = path.join(staticPath, 'index.html');
      
      console.log('[ELECTRON] Loading static frontend from:', staticPath);
      
      if (!fs.existsSync(indexHtml)) {
        const errorHtml = `
          <html>
            <head>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  padding: 40px; 
                  text-align: center; 
                  background: #1e1e1e;
                  color: #fff;
                }
                h1 { color: #ff6b6b; }
                code { 
                  background: #2d2d2d; 
                  padding: 15px; 
                  border-radius: 5px; 
                  display: block;
                  margin: 20px auto;
                  max-width: 500px;
                  font-family: 'Courier New', monospace;
                }
                .instructions { margin: 20px 0; line-height: 1.8; }
              </style>
            </head>
            <body>
              <h1>⚠️ Frontend Not Found</h1>
              <div class="instructions">
                <p>Static frontend files not found at:</p>
                <code>${indexHtml}</code>
                <p>Please rebuild the frontend with:</p>
                <code>cd frontend && npm run build</code>
              </div>
            </body>
          </html>
        `;
        mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
        console.error('[ELECTRON] ✗ Frontend index.html not found:', indexHtml);
        return;
      }
      
      // Use custom 'app' protocol to serve static files
      // Load root path - protocol handler will serve index.html
      // This ensures absolute paths like /_next/static/... resolve correctly
      // Try different URL formats - app://./ works better than app:///
      console.log('[ELECTRON] Loading via app protocol: app://./');
      mainWindow.loadURL("app://./");
      
      // Open DevTools automatically in production for debugging
      if (app.isPackaged && mainWindow) {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
      
      // Log all console messages from renderer
      if (mainWindow) {
        mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
          console.log(`[RENDERER ${level}]: ${message} (${sourceId}:${line})`);
        });
        
        mainWindow.webContents.on('did-finish-load', () => {
          console.log('[ELECTRON] ✓ Static frontend loaded successfully');
          if (mainWindow) {
            console.log('[ELECTRON] Current URL:', mainWindow.webContents.getURL());
          }
        });
        
        mainWindow.webContents.on('did-fail-load', (e, code, desc, validatedURL, isMainFrame) => {
          console.error('[ELECTRON] ✗ Frontend failed to load:', code, desc);
          console.error('[ELECTRON] URL:', validatedURL);
          console.error('[ELECTRON] Is Main Frame:', isMainFrame);
          console.error('[ELECTRON] Static path:', staticPath);
        });
        
        // Log navigation events
        mainWindow.webContents.on('did-navigate', (event, url) => {
          console.log('[ELECTRON] Navigated to:', url);
        });
        
        mainWindow.webContents.on('did-navigate-in-page', (event, url, isMainFrame) => {
          console.log('[ELECTRON] Navigated in page to:', url, '(main frame:', isMainFrame, ')');
        });
        
        // Log any errors
        mainWindow.webContents.on('render-process-gone', (event, details) => {
          console.error('[ELECTRON] Renderer process gone! Reason:', details.reason, 'Exit code:', details.exitCode);
        });
        
        mainWindow.webContents.on('unresponsive', () => {
          console.error('[ELECTRON] Renderer process became unresponsive!');
        });
        
        mainWindow.webContents.on('responsive', () => {
          console.log('[ELECTRON] Renderer process became responsive again');
        });
      }
    }
  } catch (err: any) {
    console.error('[ELECTRON] Failed to load frontend:', err);
    const errorHtml = `
      <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              text-align: center; 
              background: #1e1e1e;
              color: #fff;
            }
            h1 { color: #ff6b6b; }
            code { 
              background: #2d2d2d; 
              padding: 15px; 
              border-radius: 5px; 
              display: block;
              margin: 20px auto;
              max-width: 500px;
              font-family: 'Courier New', monospace;
            }
            .instructions { margin: 20px 0; line-height: 1.8; }
          </style>
        </head>
        <body>
          <h1>⚠️ Frontend Load Error</h1>
          <div class="instructions">
            <p>${err.message || 'Unknown error occurred'}</p>
          </div>
        </body>
      </html>
    `;
    mainWindow?.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
    dialog.showErrorBox(
      'Frontend Load Error',
      `Failed to load frontend: ${err.message}`
    );
  }

  // DevTools are now opened automatically in both dev and production for debugging

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ======================================================================
// APP READY
// ======================================================================
app.whenReady().then(async () => {
  console.log('[ELECTRON] App ready — starting...');
  
  // Register file protocol handler for static Next.js export
  // This must be done in app.whenReady(), after protocol registration
  if (app.isPackaged) {
    const staticPath = getStaticFrontendPath();
    console.log('[ELECTRON] Registering app protocol handler for:', staticPath);
    
    protocol.registerFileProtocol("app", (request, callback) => {
      try {
        let urlPath = request.url.replace("app://./", "");

        // Remove query + hash
        urlPath = urlPath.split("?")[0].split("#")[0];

        // Normalize: remove leading slashes
        urlPath = urlPath.replace(/^\/+/, "");

        const staticPath = getStaticFrontendPath();

        // ------------------------------------------------------------
        // FIX FOR NEXT.JS APP ROUTER:
        // 1. If Next.js requests an RSC .txt → serve the .html version
        // 2. If no extension → assume .html
        // ------------------------------------------------------------
        if (urlPath.endsWith(".txt")) {
          urlPath = urlPath.replace(".txt", ".html");
        }

        if (!path.extname(urlPath)) {
          urlPath = urlPath + ".html";
        }

        let filePath = path.join(staticPath, urlPath);

        // If file does not exist, fallback to index.html
        if (!fs.existsSync(filePath)) {
          filePath = path.join(staticPath, "index.html");
        }

        console.log("[PROTOCOL] Serving:", filePath);
        callback({ path: filePath });

      } catch (error) {
        console.error("[PROTOCOL ERROR]", error);
        callback({ error: -6 });
      }
    });
    
    console.log('[ELECTRON] ✓ App protocol registered successfully');
    
    // Test if protocol is actually registered
    const isRegistered = protocol.isProtocolRegistered('app');
    console.log(`[ELECTRON] Protocol 'app' is registered: ${isRegistered}`);
    
    if (!isRegistered) {
      console.error('[ELECTRON] ⚠️ WARNING: Protocol registration failed!');
    }
  }
  
  // Register keyboard shortcut to toggle DevTools (F12 or Ctrl+Shift+I)
  globalShortcut.register('F12', () => {
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
  
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
  
  const licensed = await ensureLicensed();
  if (!licensed) return app.quit();

  // CRITICAL: Start backend and wait for it to be fully ready
  // This blocks until backend is ready or throws an error
  try {
    await startBackend();
    console.log('[ELECTRON] ✓ Backend is ready, proceeding to create window');
  } catch (error: any) {
    console.error('[ELECTRON] ✗ Backend startup failed, quitting application');
    // Error dialog already shown in startBackend()
    app.quit();
    return;
  }
  
  // Only create window after backend is confirmed ready
  await createWindow();
});

// ======================================================================
// ACTIVATE HANDLER (macOS)
// ======================================================================
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

// ======================================================================
// CLEAN SHUTDOWN
// ======================================================================
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Kill backend if we started it ourselves
    if (backendProcess && backendStartedByUs) {
      console.log('[BACKEND] Killing backend process (we started it)');
      backendProcess.kill();
      backendProcess = null;
      backendStartedByUs = false;
    }
    
    app.quit();
  }
});

// ======================================================================
// HELPER: Make HTTP request to backend
// ======================================================================
async function backendRequest<T>(
  method: string,
  path: string,
  body?: any,
): Promise<T> {
  const http = await import('http');
  
  return new Promise<T>((resolve, reject) => {
    const url = new URL(path, BACKEND_URL);
    const data = body ? JSON.stringify(body) : undefined;
    
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port || 3333,
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data ? Buffer.byteLength(data) : 0,
        },
        timeout: 10000,
      },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(responseData ? JSON.parse(responseData) : ({} as T));
            } catch (e) {
              resolve(responseData as T);
            }
          } else {
            reject(new Error(`Backend request failed: ${res.statusCode} ${responseData}`));
          }
        });
      },
    );

    req.on('error', (err) => {
      reject(err);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Backend request timeout'));
    });

    if (data) {
      req.write(data);
    }
    req.end();
  });
}

// ======================================================================
// HELPER: Get printer settings for a specific printer type
// ======================================================================
async function getPrinterSettings(
  kitchenId: number | null,
  printerType: 'kitchen' | 'customer',
): Promise<{ printer_ip: string | null; printer_port: number } | null> {
  try {
    const settings = await backendRequest<Array<{
      id: number;
      kitchen_id: number | null;
      printer_ip: string | null;
      printer_port: number;
      printer_type: 'kitchen' | 'customer';
      is_active: boolean;
    }>>('GET', '/printers/settings');
    
    const setting = settings.find(
      (s) => s.kitchen_id === kitchenId && s.printer_type === printerType && s.is_active,
    );
    
    if (setting && setting.printer_ip) {
      return {
        printer_ip: setting.printer_ip,
        printer_port: setting.printer_port || 9100,
      };
    }
    
    return null;
  } catch (err: any) {
    console.error('[PRINTERS] Error getting settings:', err);
    return null;
  }
}

// ======================================================================
// IPC HANDLERS
// ======================================================================
// ORDER PRINTING
ipcMain.handle('print:order', async (_event, orderData: any, kitchenId?: number | null) => {
  try {
    console.log('[PRINT] Rendering order PNG...');
    const png = await renderOrderToPng(orderData);

    // Get printer settings for this kitchen
    const settings = await getPrinterSettings(kitchenId ?? null, 'kitchen');
    if (!settings || !settings.printer_ip) {
      return { success: false, error: 'No printer configured for this kitchen' };
    }

    const success = await printPngToPrinter(png, settings.printer_ip, settings.printer_port);
    return { success };
  } catch (err: any) {
    console.error('[PRINT ERROR]', err);
    return { success: false, error: err.message };
  }
});

// RECEIPT PRINTING
ipcMain.handle('print:receipt', async (_event, receiptData: any) => {
  try {
    console.log('[PRINT] Rendering receipt PNG...');
    const png = await renderReceiptToPng(receiptData);

    // Get printer settings for customer receipt printer
    const settings = await getPrinterSettings(null, 'customer');
    if (!settings || !settings.printer_ip) {
      return { success: false, error: 'No customer receipt printer configured' };
    }

    const success = await printPngToPrinter(png, settings.printer_ip, settings.printer_port);
    return { success };
  } catch (err: any) {
    console.error('[PRINT ERROR]', err);
    return { success: false, error: err.message };
  }
});

// GET PRINTER LIST (returns empty - LAN printers are configured by IP)
ipcMain.handle('print:getPrinters', async () => {
  try {
    return await getAvailablePrinters();
  } catch (err) {
    console.error('[PRINTERS] Error:', err);
    return [];
  }
});

// GET PRINTER SETTINGS
ipcMain.handle('printers:getSettings', async () => {
  try {
    const settings = await backendRequest<Array<{
      id: number;
      kitchen_id: number | null;
      printer_ip: string | null;
      printer_port: number;
      printer_type: 'kitchen' | 'customer';
      is_active: boolean;
    }>>('GET', '/printers/settings');
    return settings;
  } catch (err: any) {
    console.error('[PRINTERS] Error getting settings:', err);
    return [];
  }
});

// SAVE PRINTER SETTINGS
ipcMain.handle('printers:saveSettings', async (_event, data: {
  kitchen_id: number | null;
  printer_ip: string | null;
  printer_port?: number;
}) => {
  try {
    const result = await backendRequest('POST', '/printers/settings', data);
    return result;
  } catch (err: any) {
    console.error('[PRINTERS] Error saving settings:', err);
    throw err;
  }
});

// TEST PRINTER
ipcMain.handle('printers:test', async (_event, data: {
  printer_ip: string;
  printer_port?: number;
}) => {
  try {
    console.log('[TEST PRINT] Starting test print...');
    
    if (!data || !data.printer_ip || data.printer_ip.trim() === '') {
      return { success: false, error: 'Printer IP address is required' };
    }

    // Generate a simple test receipt - ALWAYS works even with minimal data
    const testData = {
      orderId: 999,
      table: 1,
      hall: 'اختبار',
      items: [
        {
          id: 1,
          item_name: 'طباعة تجريبية - SUFRA LITE',
          quantity: 1,
          price: 0,
        },
      ],
      totals: {
        total: 0,
      },
      timestamp: new Date().toISOString(),
      restaurantName: 'سفرة لايت',
    };

    console.log('[TEST PRINT] Rendering test PNG...');
    const png = await renderOrderToPng(testData);
    
    console.log(`[TEST PRINT] PNG generated: ${png.length} bytes`);
    
    if (!png || png.length < 100) {
      console.error('[TEST PRINT] ✕ PNG generation failed or too small');
      return { success: false, error: 'Failed to generate test PNG' };
    }
    
    const port = data.printer_port || 9100;
    console.log(`[TEST PRINT] Sending to printer ${data.printer_ip}:${port}...`);
    const success = await printPngToPrinter(png, data.printer_ip, port);
    
    if (success) {
      console.log('[TEST PRINT] ✓ Test print sent successfully');
      return { success: true, message: 'Test print sent successfully' };
    } else {
      console.error('[TEST PRINT] ✕ Failed to send test print');
      return { success: false, error: 'Failed to send test print to printer' };
    }
  } catch (err: any) {
    console.error('[TEST PRINT] ✕ Test print error:', err);
    console.error('[TEST PRINT] Error stack:', err.stack);
    return { success: false, error: err.message || 'Unknown error during test print' };
  }
});
