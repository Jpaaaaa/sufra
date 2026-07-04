import { BrowserWindow } from 'electron';
import * as http from 'http';

// Check if frontend server is running
async function checkFrontendReady(url: string, maxRetries = 30, delay = 1000): Promise<boolean> {
  return new Promise((resolve) => {
    let retries = 0;
    
    const check = () => {
      const parsedUrl = new URL(url);
      const req = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 3000,
          path: '/',
          method: 'GET',
          timeout: 2000,
        },
        (res) => {
          console.log('[ELECTRON] ✓ Frontend server is ready');
          resolve(true);
        }
      );

      req.on('error', () => {
        retries++;
        if (retries >= maxRetries) {
          console.error('[ELECTRON] ✗ Frontend server not available after', maxRetries, 'retries');
          resolve(false);
        } else {
          setTimeout(check, delay);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        retries++;
        if (retries >= maxRetries) {
          console.error('[ELECTRON] ✗ Frontend server timeout');
          resolve(false);
        } else {
          setTimeout(check, delay);
        }
      });

      req.end();
    };

    check();
  });
}

export const loadDev = async (win: BrowserWindow) => {
  // Vite dev server runs on port 3000 by default
  const url = 'http://localhost:3000';
  
  console.log('[ELECTRON] Waiting for Vite dev server to be ready...');
  const isReady = await checkFrontendReady(url);
  
  if (!isReady) {
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
          <h1>[!] Vite Dev Server Not Running</h1>
          <div class="instructions">
            <p>Please start the Vite development server in a separate terminal:</p>
            <code>
              cd ../frontend<br>
              npm run dev
            </code>
            <p>Then restart Electron or wait a few seconds and refresh this window.</p>
          </div>
        </body>
      </html>
    `;
    win.webContents.loadURL(`data:text/html,${encodeURIComponent(errorHtml)}`);
    win.webContents.openDevTools();
    return;
  }
  
  // Add error handling
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[ELECTRON] Failed to load frontend:', errorCode, errorDescription);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('[ELECTRON] ✓ Frontend loaded successfully');
  });

  console.log('[ELECTRON] Loading frontend from Vite dev server:', url);
  win.loadURL(url);
  win.webContents.openDevTools();
};

