/**
 * Shared application state for Electron main process.
 * Centralizes mutable state used across init, windows, IPC, and HTTP modules.
 */
import type { BrowserWindow } from 'electron';

let mainWindow: BrowserWindow | null = null;
let backendApp: any = null;
let isQuitting = false;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win;
}

export function getBackendApp(): any {
  return backendApp;
}

export function setBackendApp(app: any): void {
  backendApp = app;
}

export function getIsQuitting(): boolean {
  return isQuitting;
}

export function setIsQuitting(value: boolean): void {
  isQuitting = value;
}
