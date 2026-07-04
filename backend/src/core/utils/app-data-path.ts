// Utility for resolving app data paths
import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the application data directory path
 * In production: Uses ELECTRON_USER_DATA env var (set by Electron)
 * In development: Uses ./backend/data relative to project root
 */
export function getAppDataPath(subPath?: string): string {
  const baseDataPath = process.env.ELECTRON_USER_DATA || path.join(process.cwd(), 'data');
  
  if (subPath) {
    return path.join(baseDataPath, subPath);
  }
  
  return baseDataPath;
}

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

