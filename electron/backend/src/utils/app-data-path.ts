import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the application data directory path
 * In production (Electron), uses ELECTRON_USER_DATA env var
 * In dev, uses process.cwd()/data
 */
export function getAppDataPath(...paths: string[]): string {
  // Check if running in Electron (production)
  const electronUserData = process.env.ELECTRON_USER_DATA;
  if (electronUserData) {
    // Production: use Electron's userData directory
    return path.join(electronUserData, ...paths);
  }
  
  // Dev mode: use local data directory
  const dataDir = path.join(process.cwd(), 'data');
  return path.join(dataDir, ...paths);
}

/**
 * Ensure a directory exists, creating it recursively if needed
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

