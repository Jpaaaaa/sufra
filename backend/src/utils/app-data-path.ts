import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the application data directory path
 * In production (Electron), ALWAYS uses ELECTRON_USER_DATA env var (required)
 * In dev, uses process.cwd()/data
 * 
 * CRITICAL: In production, this MUST use Electron's userData directory.
 * Never uses __dirname, process.cwd(), or relative paths in production.
 */
export function getAppDataPath(...paths: string[]): string {
  // Check if running in Electron (production)
  const electronUserData = process.env.ELECTRON_USER_DATA;
  
  // Detect if we're in production (packaged Electron app)
  // In production, ELECTRON_USER_DATA MUST be set
  const isProduction = process.env.NODE_ENV === 'production' || 
                       process.env.ELECTRON_IS_DEV === '0' ||
                       (typeof process !== 'undefined' && process.versions && process.versions.electron);
  
  if (isProduction) {
    // Production mode: ELECTRON_USER_DATA is REQUIRED
    if (!electronUserData) {
      const error = new Error(
        'CRITICAL: ELECTRON_USER_DATA environment variable is not set in production mode. ' +
        'Database cannot be stored in a persistent location. ' +
        'This should be set by Electron main process before initializing the backend.'
      );
      console.error('[APP-DATA-PATH] ✗✗✗', error.message);
      throw error;
    }
    
    // Validate that the path is absolute and not a relative path
    if (!path.isAbsolute(electronUserData)) {
      const error = new Error(
        `CRITICAL: ELECTRON_USER_DATA must be an absolute path, but got: ${electronUserData}. ` +
        'Relative paths are not allowed in production.'
      );
      console.error('[APP-DATA-PATH] ✗✗✗', error.message);
      throw error;
    }
    
    // Ensure it's not using __dirname or process.cwd() (these are temporary in production)
    const normalizedUserData = path.normalize(electronUserData);
    const normalizedCwd = path.normalize(process.cwd());
    const normalizedDirname = path.normalize(__dirname);
    
    if (normalizedUserData === normalizedCwd || normalizedUserData.startsWith(normalizedCwd + path.sep)) {
      const error = new Error(
        `CRITICAL: ELECTRON_USER_DATA appears to be using process.cwd() (${normalizedCwd}), ` +
        'which is a temporary location in production. Database will be lost on restart. ' +
        'Must use Electron app.getPath("userData") instead.'
      );
      console.error('[APP-DATA-PATH] ✗✗✗', error.message);
      throw error;
    }
    
    if (normalizedUserData === normalizedDirname || normalizedUserData.startsWith(normalizedDirname + path.sep)) {
      const error = new Error(
        `CRITICAL: ELECTRON_USER_DATA appears to be using __dirname (${normalizedDirname}), ` +
        'which is a temporary location in production. Database will be lost on restart. ' +
        'Must use Electron app.getPath("userData") instead.'
      );
      console.error('[APP-DATA-PATH] ✗✗✗', error.message);
      throw error;
    }
    
    const fullPath = path.join(electronUserData, ...paths);
    console.log('[APP-DATA-PATH] Using Electron userData directory:', fullPath);
    return fullPath;
  }
  
  // Dev mode: use local data directory (fallback to process.cwd()/data)
  const dataDir = path.join(process.cwd(), 'data');
  const devPath = path.join(dataDir, ...paths);
  console.log('[APP-DATA-PATH] Dev mode: using local data directory:', devPath);
  return devPath;
}

/**
 * Ensure a directory exists, creating it recursively if needed
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

