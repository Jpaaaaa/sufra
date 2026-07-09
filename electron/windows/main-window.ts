import path from 'path';
import fs from 'fs';
import { app, BrowserWindow, dialog } from 'electron';
import { getMainWindow, setMainWindow, getBackendApp, getIsQuitting, setIsQuitting } from '../state';
import { getStaticFrontendPath } from '../init/paths';
import { loadDev } from '../loaders/devLoader';
import { applyWindowsTaskbarIcon, resolveAppIcon } from './resolve-app-icon';

const SPLASH_MIN_MS = 1200;

function createSplashWindow(appIcon: ReturnType<typeof resolveAppIcon>): BrowserWindow | null {
  const splashPath = path.join(__dirname, '..', 'splash.html');
  if (!fs.existsSync(splashPath)) return null;
  const splash = new BrowserWindow({
    width: 420,
    height: 380,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    backgroundColor: '#F4F6FA',
    show: false,
    ...(appIcon && { icon: appIcon.image }),
  });
  if (appIcon) applyWindowsTaskbarIcon(splash, appIcon);
  const normalizedPath = splashPath.replace(/\\/g, '/');
  const fileUrl = normalizedPath.startsWith('/') ? `file://${normalizedPath}` : `file:///${normalizedPath}`;
  splash.loadURL(fileUrl);
  splash.once('ready-to-show', () => splash.show());
  return splash;
}

export async function createWindow(): Promise<void> {
  console.log('[WINDOW] createWindow() called');

  try {
    if (getMainWindow() !== null) {
      console.log('[WINDOW] Window already exists, returning early');
      return;
    }

    const splashStart = Date.now();
    const appIcon = resolveAppIcon();
    if (appIcon) {
      console.log('[WINDOW] ✓ App icon:', appIcon.icoPath);
    } else {
      console.warn('[WINDOW] ⚠️ No icon.ico found — taskbar may show default Electron icon');
    }

    const splash = createSplashWindow(appIcon);

    console.log('[WINDOW] Creating new BrowserWindow...');

    const preloadPath = path.join(__dirname, '..', 'preload.js');
    if (!fs.existsSync(preloadPath)) {
      console.warn('[WINDOW] ⚠️ Preload not found, creating window without preload');
    } else {
      console.log('[WINDOW] ✓ Using preload path:', preloadPath);
    }

    let mainWindow: BrowserWindow;
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      backgroundColor: '#f5f5f5',
      ...(appIcon && { icon: appIcon.image }),
      webPreferences: {
        preload: fs.existsSync(preloadPath) ? preloadPath : undefined,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: app.isPackaged ? true : false,
        devTools: true,
        backgroundThrottling: false,
      },
    });

    setMainWindow(mainWindow);
    console.log('[WINDOW] ✓ BrowserWindow created successfully');

    if (appIcon) {
      applyWindowsTaskbarIcon(mainWindow, appIcon);
      mainWindow.once('ready-to-show', () => applyWindowsTaskbarIcon(mainWindow, appIcon));
      mainWindow.once('show', () => applyWindowsTaskbarIcon(mainWindow, appIcon));
    }

    mainWindow.webContents.setWindowOpenHandler(() => {
      console.log('[ELECTRON] Blocked new window/tab request');
      return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if (parsedUrl.protocol === 'app:' || parsedUrl.protocol === 'file:') return;
      const isDev = !app.isPackaged;
      if (isDev && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1')) {
        if (parsedUrl.port === '3000' || parsedUrl.port === '') return;
      }
      console.log('[ELECTRON] Blocked navigation to external URL:', navigationUrl);
      event.preventDefault();
    });

    const showMainAndCloseSplash = () => {
      const elapsed = Date.now() - splashStart;
      const remaining = splash ? Math.max(0, SPLASH_MIN_MS - elapsed) : 0;
      setTimeout(() => {
        if (splash && !splash.isDestroyed()) splash.destroy();
        if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
          mainWindow.show();
          mainWindow.focus();
        }
        console.log('[WINDOW] ✓ Splash closed, main window shown');
      }, remaining);
    };

    if (!app.isPackaged) {
      console.log('[WINDOW] Dev mode: Loading from Vite dev server...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        loadDev(mainWindow).catch((err) => console.error('[WINDOW] loadDev error:', err));
        mainWindow.webContents.once('did-finish-load', () => {
          console.log('[WINDOW] ✓ Window load completed');
          showMainAndCloseSplash();
        });
        await new Promise((r) => setTimeout(r, 100));
      }
    } else {
      const staticPath = getStaticFrontendPath();
      const indexHtml = path.join(staticPath, 'index.html');

      if (!fs.existsSync(indexHtml)) {
        const errorHtml = `<html><body style="font-family:Arial;padding:40px;background:#1e1e1e;color:#fff;text-align:center">
          <h1 style="color:#ff6b6b">[!] Frontend Not Found</h1>
          <p>Static frontend files not found at:</p>
          <code style="background:#2d2d2d;padding:15px;display:block;margin:20px auto">${indexHtml}</code>
          <p>Please rebuild: <code>cd frontend && npm run build</code></p>
        </body></html>`;
        mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
        mainWindow.show();
        return;
      }

      let fileUrl: string;
      if (process.platform === 'win32') {
        const normalizedPath = indexHtml.replace(/\\/g, '/');
        fileUrl = normalizedPath.startsWith('/') ? `file://${normalizedPath}` : `file:///${normalizedPath}`;
      } else {
        fileUrl = `file://${indexHtml}`;
      }

      mainWindow.loadURL(fileUrl);

      await new Promise<void>((resolve) => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          resolve();
          return;
        }
        let resolved = false;
        const onComplete = () => {
          if (!resolved) {
            resolved = true;
            showMainAndCloseSplash();
            resolve();
          }
        };
        mainWindow!.webContents.once('did-finish-load', onComplete);
        mainWindow!.webContents.once('did-fail-load', onComplete);
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            showMainAndCloseSplash();
            resolve();
          }
        }, 5000);
      });

      mainWindow.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
        if (isMainFrame && code !== -3 && mainWindow && !mainWindow.isDestroyed()) {
          const errorHtml = `<html><body style="font-family:Arial;padding:40px;background:#1e1e1e;color:#fff">
            <h1 style="color:#ff6b6b">[!] Failed to Load Frontend</h1>
            <p>Error: ${desc}</p>
            <p>URL: ${url}</p>
          </body></html>`;
          mainWindow.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
        }
      });
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.on('close', (event) => {
        if (!getBackendApp()) {
          event.preventDefault();
          return;
        }
        if (getBackendApp() && !getIsQuitting()) {
          setIsQuitting(true);
        }
      });

      mainWindow.on('closed', () => {
        setMainWindow(null);
      });

      if (!mainWindow.isVisible() && !splash) mainWindow.show();
      console.log('[WINDOW] ✓ Window setup complete');
    } else {
      throw new Error('Window creation failed - window is null or destroyed');
    }
  } catch (error: any) {
    console.error('[WINDOW] ✗✗✗ ERROR IN createWindow() ✗✗✗', error);
    try {
      dialog.showErrorBox('Window Creation Error', `Failed to create window:\n\n${error?.message || String(error)}`);
    } catch (e) {
      console.error('[WINDOW] Failed to show error dialog:', e);
    }
    throw error;
  }
}
