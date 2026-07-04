import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * Get the path to the static frontend build (Vite dist output).
 * Used for loading the frontend in production mode.
 */
export function getStaticFrontendPath(): string {
  if (!app.isPackaged) {
    const devPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
    console.log('[FRONTEND] DEV STATIC PATH:', devPath);
    return devPath;
  }

  const pathsToTry = [
    path.join(process.resourcesPath, 'frontend', 'dist'),
    path.join(app.getAppPath(), 'frontend', 'dist'),
    path.join(process.resourcesPath, '..', 'frontend', 'dist'),
  ];

  for (const tryPath of pathsToTry) {
    if (fs.existsSync(tryPath)) {
      console.log('[FRONTEND] PROD STATIC PATH (found):', tryPath);
      return tryPath;
    }
  }

  const defaultPath = path.join(process.resourcesPath, 'frontend', 'dist');
  console.log('[FRONTEND] PROD STATIC PATH (default, may not exist):', defaultPath);
  return defaultPath;
}
