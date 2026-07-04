// ======================================================================
// TOP-LEVEL LOGGING - VERIFY FILE IS LOADING
// ======================================================================
// Force output to stderr (always visible) and stdout
process.stderr.write('\n[MAIN] ========================================\n');
process.stderr.write('[MAIN] Electron main process starting...\n');
process.stderr.write(`[MAIN] Node version: ${process.version}\n`);
process.stderr.write(`[MAIN] Platform: ${process.platform}\n`);
process.stderr.write('[MAIN] ========================================\n\n');

console.log('[MAIN] ========================================');
console.log('[MAIN] Electron main process starting...');
console.log('[MAIN] Node version:', process.version);
console.log('[MAIN] Platform:', process.platform);
console.log('[MAIN] ========================================');

import { app } from "electron";

process.stderr.write('[MAIN] ✓ Electron app imported\n');
console.log('[MAIN] ✓ Electron app imported');

// Must run BEFORE app.whenReady()
// Disable hardware acceleration for consistent rendering (no GPU blinks/flashes)
// Best practice for desktop POS - reliability > GPU performance
app.disableHardwareAcceleration();
console.log('[MAIN] ✓ Hardware acceleration disabled');

// Suppress CSP warnings in development (unsafe-eval is required for Vite HMR)
// In production, the CSP doesn't include unsafe-eval, so this warning won't appear
if (!app.isPackaged) {
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor');
  // Note: The CSP warning is informational and expected in dev mode
  // It will not appear in packaged builds where unsafe-eval is removed
  console.log('[MAIN] ✓ Development mode - CSP warning is expected (unsafe-eval needed for Vite HMR)');
}

// Windows taskbar icon: set AppUserModelId before app.whenReady()
if (process.platform === 'win32') {
  app.setAppUserModelId('com.sufra.lite.pos');
  console.log('[MAIN] ✓ AppUserModelId set for Windows taskbar');
}

import { BrowserWindow, ipcMain, dialog, protocol, globalShortcut, session, nativeImage } from 'electron';
import path from 'path';
import fs from 'fs';
import { setIsDev } from './electron-env';
import { loadDev } from './loaders/devLoader';
import { loadBackendModules, initializeBackendLibrary } from './init/backend-loader';
import { getStaticFrontendPath } from './init/paths';
import { createWindow } from './windows/main-window';
import { getMainWindow, setMainWindow, getBackendApp, setBackendApp, getIsQuitting, setIsQuitting } from './state';
import { setupIpcHandlers } from './ipc/handlers';
import { setupHttpServer, shutdownHttpServer } from './http/server';
import { registerLicenseIpc } from './license/register-license-ipc';
import { registerAutoUpdater } from './updater/register-auto-updater';

/** LAN HTTP server port (must match `http/server.ts`). */
const LAN_HTTP_PORT = 3333;

// Tell env whether dev or prod
const isDev = !app.isPackaged;
setIsDev(isDev);

// ======================================================================
// REGISTER CUSTOM PROTOCOL (MUST BE BEFORE APP READY)
// ======================================================================
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
// PROTOCOL REGISTRATION NOTES
// ======================================================================
// Note: protocol.interceptFileProtocol() must be called AFTER app.whenReady()
// (see app.whenReady() handler below). Only protocol.registerSchemesAsPrivileged() 
// must be called before app.whenReady().


// ======================================================================
// SINGLE INSTANCE LOCK
// ======================================================================
console.log('[MAIN] Requesting single instance lock...');
// In dev mode, allow multiple instances (useful for debugging)
// In production, enforce single instance
const gotLock = isDev ? true : app.requestSingleInstanceLock();

if (!gotLock) {
  console.log('[MAIN] ⚠️⚠️⚠️ Another instance is running, attempting to focus it...');
  console.log('[MAIN] This instance will exit. If you want to run a new instance,');
  console.log('[MAIN] please close the existing one first or kill it with: taskkill /F /IM electron.exe');
  console.log('[MAIN] Or wait a few seconds and try again - the lock may clear.');
  
  // In dev mode, just quit immediately (don't show dialog which might hang)
  // The launcher script will handle retrying
  setTimeout(() => {
    app.quit();
    process.exit(0);
  }, 100);
} else {
  if (isDev) {
    console.log('[MAIN] ✓ Dev mode: Single instance lock bypassed (multiple instances allowed)');
  } else {
    console.log('[MAIN] ✓ Single instance lock acquired');
  }
  
  app.on('second-instance', () => {
    console.log('[MAIN] Second instance detected, focusing existing window');
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
        console.log('[MAIN] Window restored from minimized state');
      }
      mainWindow.focus();
      mainWindow.show();
      console.log('[MAIN] Window focused and shown');
    } else {
      console.log('[MAIN] No window exists, creating new one...');
      // If window was closed, create a new one
      createWindow().catch(err => {
        console.error('[MAIN] Failed to create window on second instance:', err);
      });
    }
  });
}

registerLicenseIpc();
registerAutoUpdater();
ipcMain.removeHandler('amaan-get-api-port');
ipcMain.handle('amaan-get-api-port', () => LAN_HTTP_PORT);

// ======================================================================
// GLOBAL ERROR HANDLERS - COMPREHENSIVE ERROR CATCHING
// ======================================================================
process.on('uncaughtException', (err) => {
  console.error('[MAIN] ✗✗✗ UNCAUGHT EXCEPTION ✗✗✗');
  console.error('[MAIN] Error:', err);
  console.error('[MAIN] Message:', err.message);
  console.error('[MAIN] Stack:', err.stack);
  
  // Show error dialog
  try {
    dialog.showErrorBox(
      'Uncaught Exception - App Will Stay Open',
      `Error: ${err.message}\n\nStack:\n${err.stack}\n\nCheck console for details.`
    );
  } catch (e) {
    console.error('[MAIN] Failed to show error dialog:', e);
  }
  
  // Don't exit - keep window open for debugging
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    const errorHtml = `
      <html>
        <head>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 40px; 
              background: #1e1e1e;
              color: #fff;
            }
            h1 { color: #ff6b6b; }
            pre { background: #2d2d2d; padding: 20px; border-radius: 8px; overflow: auto; }
          </style>
        </head>
        <body>
          <h1>[!] Uncaught Exception</h1>
          <pre>${err.message}\n\n${err.stack}</pre>
        </body>
      </html>
    `;
    mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
    mainWindow.show();
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[MAIN] ✗✗✗ UNHANDLED REJECTION ✗✗✗');
  console.error('[MAIN] Reason:', reason);
  console.error('[MAIN] Promise:', promise);
  
  // Show error dialog
  try {
    const errorMsg = reason instanceof Error ? reason.message : String(reason);
    dialog.showErrorBox(
      'Unhandled Promise Rejection',
      `Reason: ${errorMsg}\n\nCheck console for details. App will stay open.`
    );
  } catch (e) {
    console.error('[MAIN] Failed to show error dialog:', e);
  }
  
  // Don't exit - keep window open
});

// Log when process is about to exit
process.on('beforeExit', (code) => {
  console.log('[MAIN] ⚠️⚠️⚠️ Process beforeExit event, code:', code);
  console.log('[MAIN] mainWindow exists:', getMainWindow() !== null);
  console.log('[MAIN] mainWindow isDestroyed:', getMainWindow()?.isDestroyed());
  console.log('[MAIN] backendApp exists:', getBackendApp() !== null);
  
  // Show dialog to prevent silent exit
  try {
    if (code === 0) {
      dialog.showMessageBox({
        type: 'info',
        title: 'App Exiting',
        message: `Process is about to exit with code ${code}`,
        detail: 'This should not happen during normal operation. Check console for details.'
      });
    }
  } catch (e) {
    console.error('[MAIN] Failed to show exit dialog:', e);
  }
});

process.on('exit', (code) => {
  console.log('[MAIN] ⚠️⚠️⚠️ Process exit event, code:', code);
  console.log('[MAIN] This is the last message before process terminates');
  
  // Write to stderr so it's definitely visible
  process.stderr.write(`\n[MAIN] PROCESS EXITING WITH CODE: ${code}\n`);
  process.stderr.write(`[MAIN] If this is unexpected, check the logs above\n\n`);
});

// ======================================================================
// APP READY
// ======================================================================
app.whenReady().then(async () => {
  console.log('[LIFECYCLE] ✓ app.whenReady() reached');
  
  // Register file protocol interceptor AFTER app.whenReady()
  // Protocol interceptors require the app to be ready (they access session internally)
  if (app.isPackaged) {
    console.log('[ELECTRON] Registering file protocol interceptor (AFTER app.whenReady)...');
    console.log('[ELECTRON] App is packaged:', app.isPackaged);
    console.log('[ELECTRON] Platform:', process.platform);
    
    protocol.interceptFileProtocol('file', (request, callback) => {
        try {
          const fileUrl = request.url;
          // Log ALL intercepted requests to verify the interceptor is working
          console.log("[PROTOCOL] ✓ Interceptor called - URL:", fileUrl);
          
          const urlObj = new URL(fileUrl);
          // Get static path dynamically (lazy evaluation)
          const staticPath = getStaticFrontendPath();
          
          // Vite uses /assets/ paths instead of /_next/
          // Handle both for compatibility
          const pathname = urlObj.pathname;
          
          // Check for Vite assets (assets/...)
          if (pathname.startsWith('/assets/')) {
            const assetPath = pathname.substring(1); // Remove leading /
            const mappedPath = path.join(staticPath, assetPath);
            console.log("[PROTOCOL] Mapping asset path:", pathname, "->", mappedPath, "exists:", fs.existsSync(mappedPath));
            
            if (fs.existsSync(mappedPath)) {
              callback({ path: mappedPath });
              return;
            } else {
              console.error("[PROTOCOL] Asset file not found:", mappedPath);
              callback({ error: -6 }); // FILE_NOT_FOUND
              return;
            }
          }
          
          // Generic public asset handling - check if path exists in static directory
          // This handles /logo/, /icons/, /fonts/, and any other public folder assets
          if (pathname.startsWith('/')) {
            const publicAssetPath = path.join(staticPath, pathname.substring(1));
            if (fs.existsSync(publicAssetPath) && fs.statSync(publicAssetPath).isFile()) {
              console.log("[PROTOCOL] Serving public asset:", pathname, "->", publicAssetPath);
              callback({ path: publicAssetPath });
              return;
            }
          }
          
          // Handle regular file paths
          let filePath = decodeURIComponent(urlObj.pathname);
          
          // On Windows, remove leading slash from path (file:///C:/... -> C:/...)
          if (process.platform === 'win32') {
            filePath = filePath.replace(/^\//, '').replace(/\//g, '\\');
          }
          
          const normalizedStaticPath = path.normalize(staticPath);
          const normalizedFilePath = path.normalize(filePath);
          
          // If file is in our static frontend directory, serve it
          if (normalizedFilePath.startsWith(normalizedStaticPath)) {
            console.log("[PROTOCOL] Serving frontend file:", normalizedFilePath);
            callback({ path: normalizedFilePath });
            return;
          }
          
          // For other files, use default file:// behavior (let Electron handle it)
          console.log("[PROTOCOL] Using default file handler for:", filePath);
          callback({ path: filePath });
          
        } catch (error) {
          console.error("[PROTOCOL ERROR]", error, "URL:", request.url);
          // Fallback to default file handling
          try {
            const urlObj = new URL(request.url);
            let filePath = decodeURIComponent(urlObj.pathname);
            if (process.platform === 'win32') {
              filePath = filePath.replace(/^\//, '').replace(/\//g, '\\');
            }
            callback({ path: filePath });
          } catch (e) {
            console.error("[PROTOCOL] Fallback error:", e);
            callback({ error: -6 });
          }
        }
      });
      
      console.log('[ELECTRON] ✓ File protocol interceptor registered successfully (AFTER app.whenReady)');
    }
  
  // Set Content Security Policy via session headers BEFORE creating any windows
  // This suppresses the Electron security warning and ensures CSP is applied to all requests
  const defaultSession = session.defaultSession;
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': app.isPackaged
          ? "default-src 'self' ws://*:* http://*:*; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: http://*:* https:; connect-src 'self' ws://*:* http://*:* https:;"
          : "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:* http://*:* ws://localhost:* ws://*:*; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:* http://*:*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: http://localhost:* http://127.0.0.1:* http://*:* https:; connect-src 'self' ws://localhost:* ws://*:* http://localhost:* http://127.0.0.1:* http://*:* https:;"
      }
    });
  });
  console.log('[CSP] ✓ Content Security Policy configured');
  
  console.log('[LIFECYCLE] Starting initialization sequence...');
  
  // CRITICAL: Register protocol interceptor BEFORE creating window in production
  // This ensures file:// protocol works when loading the frontend
  if (app.isPackaged) {
    console.log('[LIFECYCLE] Protocol interceptor already registered');
  }
  
  // Load backend modules first (must happen before backend initialization)
  console.log('[LIFECYCLE] Loading backend modules...');
  try {
    loadBackendModules();
    console.log('[LIFECYCLE] ✓ Backend modules loaded');
  } catch (error: any) {
    console.error('[LIFECYCLE] ✗ Failed to load backend modules:', error);
    const mainWindow = getMainWindow();
    if (mainWindow) {
      const errorHtml = `
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 40px; 
                background: #1e1e1e;
                color: #fff;
              }
              h1 { color: #ff6b6b; }
              pre { background: #2d2d2d; padding: 20px; border-radius: 8px; overflow: auto; }
            </style>
          </head>
          <body>
            <h1>[!] Backend Module Load Error</h1>
            <p>Failed to load backend modules:</p>
            <pre>${error?.message || String(error)}\n\n${error?.stack || ''}</pre>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
      mainWindow.show();
    }
    return; // Exit early if backend modules can't be loaded
  }
  
  try {
    // Register keyboard shortcuts
  globalShortcut.register('F12', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
  
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    const mainWindow = getMainWindow();
    if (mainWindow) {
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    }
  });
  
  // CRITICAL: Create window FIRST before any initialization that might fail
  // This ensures Electron stays alive even if backend initialization fails
  console.log('[LIFECYCLE] Creating window BEFORE backend initialization...');
  await createWindow();
  const mainWindow = getMainWindow();
  console.log('[LIFECYCLE] ✓ Window created, mainWindow exists:', mainWindow !== null);
  
  if (!mainWindow) {
    console.error('[LIFECYCLE] ✗ CRITICAL: Window creation failed! App will exit.');
    app.quit();
    return;
  }
  
  // CRITICAL FIX: Ensure window is shown and active BEFORE continuing
  // This is the key to preventing silent exit
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
      console.log('[LIFECYCLE] ✓ Window forced to be visible');
    }
    
    // Force window to stay alive by ensuring webContents is active
    const currentUrl = mainWindow.webContents.getURL();
    console.log('[LIFECYCLE] Window URL:', currentUrl || 'about:blank');
    console.log('[LIFECYCLE] Window isVisible:', mainWindow.isVisible());
    console.log('[LIFECYCLE] Window isDestroyed:', mainWindow.isDestroyed());
    
    // Small delay to ensure Electron has registered the window as active handle
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log('[LIFECYCLE] ✓ Window is registered as active handle - process will stay alive');
  } else {
    console.error('[LIFECYCLE] ✗ CRITICAL: Window is null or destroyed after creation!');
    app.quit();
    return;
  }

  // Initialize backend as library (no HTTP server)
  console.log('[LIFECYCLE] Initializing backend...');
  const backendReady = await initializeBackendLibrary();
  if (!backendReady) {
    console.error('[LIFECYCLE] ✗ Backend initialization failed');
    const mainWindow = getMainWindow();
    if (mainWindow) {
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
            </style>
          </head>
          <body>
            <h1>[!] Backend Initialization Failed</h1>
            <p>Check the console for details. The window will remain open for debugging.</p>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
      mainWindow.show();
    }
    // Don't quit - let user see the error and debug
    return;
  }
  console.log('[LIFECYCLE] ✓ Backend initialized successfully');
  
  // Setup IPC handlers (they will call backend services directly)
  console.log('[LIFECYCLE] Setting up IPC handlers...');
  setupIpcHandlers();
  console.log('[LIFECYCLE] ✓ IPC handlers registered');
  
  // Setup HTTP server for browser clients (LAN access)
  console.log('[LIFECYCLE] Setting up HTTP server...');
  setupHttpServer();
  console.log('[LIFECYCLE] ✓ HTTP server setup complete');

  console.log('[LIFECYCLE] ✓ Initialization complete. App is ready.');
  console.log('[LIFECYCLE] ✓✓✓ App is fully initialized and should stay alive ✓✓✓');
  
  // Final verification that window is alive
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('[LIFECYCLE] ✓ Window is alive and visible:', mainWindow.isVisible());
    console.log('[LIFECYCLE] ✓ Window URL:', mainWindow.webContents.getURL());
    
    // Ensure window stays visible
    if (!mainWindow.isVisible()) {
      console.log('[LIFECYCLE] ⚠️ Window not visible, showing it...');
      mainWindow.show();
    }
    
    // Add final keep-alive check
    setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        // Window is still alive - this interval keeps process alive
        if (!mainWindow.isVisible()) {
          console.log('[LIFECYCLE] ⚠️ Window became invisible, showing it...');
          mainWindow.show();
        }
      }
    }, 5000); // Check every 5 seconds
    
  } else {
    console.error('[LIFECYCLE] ✗✗✗ CRITICAL: Window is null or destroyed after initialization!');
    console.error('[LIFECYCLE] This will cause the app to exit!');
  }
  
  } catch (error: any) {
    console.error('[LIFECYCLE] ✗✗✗ CRITICAL ERROR IN INITIALIZATION ✗✗✗');
    console.error('[LIFECYCLE] Error:', error);
    console.error('[LIFECYCLE] Message:', error?.message);
    console.error('[LIFECYCLE] Stack:', error?.stack);
    
    // Show error dialog
    try {
      dialog.showErrorBox(
        'Initialization Error',
        `Error during app initialization:\n\n${error?.message || String(error)}\n\nCheck console for details.`
      );
    } catch (e) {
      console.error('[LIFECYCLE] Failed to show error dialog:', e);
    }
    
    // Ensure window is shown with error
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      const errorHtml = `
        <html>
          <head>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 40px; 
                background: #1e1e1e;
                color: #fff;
              }
              h1 { color: #ff6b6b; }
              pre { background: #2d2d2d; padding: 20px; border-radius: 8px; overflow: auto; }
            </style>
          </head>
          <body>
            <h1>[!] Initialization Error</h1>
            <pre>${error?.message || String(error)}\n\n${error?.stack || ''}</pre>
          </body>
        </html>
      `;
      mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
      mainWindow.show();
    } else {
      console.error('[LIFECYCLE] ✗ Window is null or destroyed, cannot show error');
    }
    
    // Don't exit - keep process alive for debugging
    console.log('[LIFECYCLE] App will stay open despite error for debugging');
  }
});

// ======================================================================
// ACTIVATE HANDLER (macOS)
// ======================================================================
app.on('activate', () => {
  if (getMainWindow() === null) createWindow();
});

// ======================================================================
// CLEAN SHUTDOWN
// ======================================================================
app.on('window-all-closed', async () => {
  const mainWindow = getMainWindow();
  const backendApp = getBackendApp();
  console.log('[LIFECYCLE] ⚠️⚠️⚠️ window-all-closed event fired ⚠️⚠️⚠️');
  console.log('[LIFECYCLE] mainWindow exists:', mainWindow !== null);
  console.log('[LIFECYCLE] mainWindow isDestroyed:', mainWindow?.isDestroyed());
  console.log('[LIFECYCLE] backendApp exists:', backendApp !== null);
  console.log('[LIFECYCLE] isQuitting:', getIsQuitting());
  
  // If user intentionally closed the window (isQuitting is true), prevent window recreation
  // but let the natural quit flow trigger before-quit event for proper cleanup
  if (getIsQuitting() && backendApp) {
    console.log('[LIFECYCLE] User intentionally closed window - will let before-quit handle cleanup');
    if (process.platform !== 'darwin') {
      // Don't call app.quit() here - just return to prevent window recreation
      // This allows before-quit event to fire and save the database
      return;
    }
    return;
  }
  
  // CRITICAL FIX: Don't quit if window was never created or if we're in the middle of initialization
  // This prevents silent exit during startup
  if (mainWindow === null) {
    console.log('[LIFECYCLE] ⚠️⚠️⚠️ CRITICAL: Window was never created, but window-all-closed fired!');
    console.log('[LIFECYCLE] This indicates a crash or initialization failure.');
    console.log('[LIFECYCLE] Attempting to create window to prevent exit...');
    try {
      await createWindow();
      const mainWindow = getMainWindow();
      if (mainWindow) {
        console.log('[LIFECYCLE] ✓ Window created, app will stay alive');
        return; // Don't quit
      } else {
        console.error('[LIFECYCLE] ✗ Failed to create window - window is still null');
        console.error('[LIFECYCLE] App will exit. Check logs above for initialization errors.');
      }
    } catch (err: any) {
      console.error('[LIFECYCLE] ✗✗✗ Exception creating window:', err);
      console.error('[LIFECYCLE] Stack:', err?.stack);
    }
  } else if (mainWindow && !mainWindow.isDestroyed()) {
    // Window exists but isn't destroyed - only recreate if backend isn't initialized (crash during startup)
    if (!backendApp) {
      console.log('[LIFECYCLE] ⚠️ Window exists but backend not initialized - might be crash during startup');
      console.log('[LIFECYCLE] Attempting to recreate window...');
      try {
        setMainWindow(null); // Clear reference
        await createWindow();
        const mainWindow = getMainWindow();
        if (mainWindow) {
          console.log('[LIFECYCLE] ✓ Window recreated, app will stay alive');
          return;
        }
      } catch (err: any) {
        console.error('[LIFECYCLE] ✗ Failed to recreate window:', err);
        console.error('[LIFECYCLE] Stack:', err?.stack);
      }
    } else {
      // Backend is initialized, window should be destroyed - allow normal quit
      console.log('[LIFECYCLE] Window exists but window-all-closed fired - backend is initialized');
      console.log('[LIFECYCLE] Allowing normal quit.');
    }
  }
  
  // Only quit on non-macOS if window was actually closed by user AND backend is initialized
  if (process.platform !== 'darwin') {
    if (getBackendApp()) {
      console.log('[LIFECYCLE] Backend was initialized - this looks like normal shutdown');
      console.log('[LIFECYCLE] Allowing natural quit flow (before-quit will handle cleanup)');
      // Don't call app.quit() directly - let before-quit event fire to save database
    } else {
      console.log('[LIFECYCLE] ⚠️ Backend was NOT initialized - this might be a crash!');
      console.log('[LIFECYCLE] Waiting 5 seconds before quitting to allow debugging...');
      setTimeout(() => {
        console.log('[LIFECYCLE] Quitting after delay...');
        app.quit();
      }, 5000);
      return; // Don't quit immediately
    }
  }
});

app.on('before-quit', async (event) => {
  console.log('[LIFECYCLE] before-quit event fired');
  
  // Always prevent default quit - we'll manually call app.quit() when ready
  event.preventDefault();
  
  setIsQuitting(true); // Mark that we're intentionally quitting
  
  try {
    // Gracefully shutdown HTTP server first
    await shutdownHttpServer();
    
    // Gracefully shutdown backend app (this saves the database)
    const backendApp = getBackendApp();
    if (backendApp) {
      console.log('[BACKEND] Requesting graceful shutdown (will save database)...');
      await backendApp.close();
      console.log('[BACKEND] ✓ Backend shut down gracefully, database saved');
      setBackendApp(null);
    }
    
  } catch (error: any) {
    console.error('[LIFECYCLE] Error during shutdown:', error);
  }
  
  // All cleanup complete, now it's safe to quit
  console.log('[LIFECYCLE] All cleanup complete, quitting now');
  app.quit();
});

