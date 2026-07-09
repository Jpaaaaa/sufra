import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getAppDataPath, ensureDirectoryExists } from '../../utils/app-data-path';

class UploadService {
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = getAppDataPath('uploads', 'items');
    ensureDirectoryExists(this.uploadDir);
    console.log('[UPLOAD] Upload directory:', this.uploadDir);
  }

  async saveFile(file: Express.Multer.File): Promise<string> {
    const ext = path.extname(file.originalname);
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const filename = `${timestamp}-${randomBytes}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    fs.writeFileSync(filepath, file.buffer);

    return `/uploads/items/${filename}`;
  }

  deleteFile(imageUrl: string): void {
    try {
      const filename = path.basename(imageUrl);
      const filepath = path.join(this.uploadDir, filename);

      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  getUploadDir(): string {
    return this.uploadDir;
  }
}

let uploadInstance: UploadService | null = null;

export function initializeUpload(): void {
  uploadInstance = new UploadService();
}

function requireUpload(): UploadService {
  if (!uploadInstance) {
    throw new Error('Upload not initialized');
  }
  return uploadInstance;
}

export function saveFile(
  ...args: Parameters<UploadService['saveFile']>
): ReturnType<UploadService['saveFile']> {
  return requireUpload().saveFile(...args);
}

export function deleteFile(
  ...args: Parameters<UploadService['deleteFile']>
): ReturnType<UploadService['deleteFile']> {
  return requireUpload().deleteFile(...args);
}

export function getUploadDir(): ReturnType<UploadService['getUploadDir']> {
  return requireUpload().getUploadDir();
}
