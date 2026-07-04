import path from 'path';
import fs from 'fs';
import { app } from 'electron';

/**
 * Get the base path where backend modules are located
 * In dev: dist/backend/dist (copied by copy-assets.js)
 * In production: resources/backend/dist (from extraResources)
 */
function getBackendBasePath(): string {
  if (!app.isPackaged) {
    // Dev mode: backend is copied to dist/backend/dist by copy-assets.js
    const devPath = path.join(__dirname, '..', 'backend', 'dist');
    if (fs.existsSync(devPath)) {
      return devPath;
    }
    // Fallback to backend/dist relative to electron root
    const fallbackPath = path.join(__dirname, '..', '..', 'backend', 'dist');
    return fallbackPath;
  } else {
    // Production: backend is in extraResources at resources/backend/dist
    const prodPath = path.join(process.resourcesPath, 'backend', 'dist');
    console.log('[BACKEND-LOADER] Production backend path:', prodPath);
    return prodPath;
  }
}

/**
 * Get the backend node_modules path
 * In dev: backend/node_modules
 * In production: resources/backend/node_modules
 */
function getBackendNodeModulesPath(): string {
  if (!app.isPackaged) {
    const devPath = path.join(__dirname, '..', 'backend', 'node_modules');
    if (fs.existsSync(devPath)) {
      return devPath;
    }
    return path.join(__dirname, '..', '..', 'backend', 'node_modules');
  } else {
    return path.join(process.resourcesPath, 'backend', 'node_modules');
  }
}

/**
 * Add backend node_modules to Node's module resolution paths
 * This ensures backend dependencies can be resolved
 */
export function setupBackendModuleResolution(): void {
  const backendNodeModules = getBackendNodeModulesPath();
  
  if (fs.existsSync(backendNodeModules)) {
    // Add to the beginning of module.paths so it's checked first
    if (!module.paths.includes(backendNodeModules)) {
      module.paths.unshift(backendNodeModules);
      console.log('[BACKEND-LOADER] Added backend node_modules to module resolution:', backendNodeModules);
    }
  } else {
    console.warn('[BACKEND-LOADER] Backend node_modules not found at:', backendNodeModules);
  }
}

/**
 * Require a backend module dynamically
 * @param modulePath - Path relative to backend/dist (e.g., 'main' or 'modules/users/users.service')
 * @returns The required module
 */
export function requireBackendModule(modulePath: string): any {
  const backendBase = getBackendBasePath();
  
  // Remove .js extension if present, we'll add it back
  const cleanPath = modulePath.replace(/\.js$/, '');
  const fullPath = path.join(backendBase, cleanPath);
  
  // Try .js extension first (required for require() to work)
  const jsPath = fullPath + '.js';
  const normalizedPath = path.normalize(jsPath);
  
  console.log('[BACKEND-LOADER] Requiring backend module:', normalizedPath);
  console.log('[BACKEND-LOADER] Backend base path:', backendBase);
  
  if (!fs.existsSync(normalizedPath)) {
    // Try without extension as fallback
    if (fs.existsSync(fullPath)) {
      return require(fullPath);
    }
    throw new Error(`Backend module not found: ${normalizedPath} (also tried: ${fullPath})`);
  }
  
  return require(normalizedPath);
}

// Setup module resolution when this module is first loaded
setupBackendModuleResolution();

