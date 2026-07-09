import path from 'path';
import fs from 'fs';
import { app as electronApp } from 'electron';

export function getUploadsPath(): string {
  return path.join(electronApp.getPath('userData'), 'uploads');
}

export function ensureUploadsDirectory(): string {
  const uploadsPath = getUploadsPath();
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  return uploadsPath;
}
