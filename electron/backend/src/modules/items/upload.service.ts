import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getAppDataPath, ensureDirectoryExists } from '../../utils/app-data-path';

@Injectable()
export class UploadService {
  private readonly uploadDir: string;

  constructor() {
    // Use Electron's userData directory in production, or local data in dev
    this.uploadDir = getAppDataPath('uploads', 'items');
    
    // Ensure directory exists
    ensureDirectoryExists(this.uploadDir);
    console.log('[UPLOAD] Upload directory:', this.uploadDir);
  }

  async saveFile(file: Express.Multer.File): Promise<string> {
    // Generate unique filename using timestamp + random
    const ext = path.extname(file.originalname);
    const randomBytes = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const filename = `${timestamp}-${randomBytes}${ext}`;
    const filepath = path.join(this.uploadDir, filename);

    // Write file
    fs.writeFileSync(filepath, file.buffer);

    // Return relative path that can be used as URL
    return `/uploads/items/${filename}`;
  }

  deleteFile(imageUrl: string): void {
    try {
      // Extract filename from URL
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

