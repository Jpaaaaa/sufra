import * as path from 'path';
import * as fs from 'fs';

// Detect dev mode: check if app is packaged (will be set by main.ts)
// For now, use NODE_ENV and check if we're in a development environment
// main.ts will override isDev after app is available
let _isDev: boolean | null = null;

export function setIsDev(value: boolean) {
  _isDev = value;
}

export function getIsDev(): boolean {
  if (_isDev !== null) return _isDev;
  // Fallback: check NODE_ENV
  return process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
}

// Export getters that will be recalculated when needed
export const isDev = getIsDev();
export const BACKEND_URL = 'http://127.0.0.1:3333';
