import { Controller, Get, HttpStatus, HttpException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { getAppDataPath } from '../../utils/app-data-path';
import * as fs from 'fs';
import * as path from 'path';

@Controller('health')
export class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async getHealth() {
    try {
      // Check 1: Database is initialized and ready
      if (!this.db.isReady()) {
        throw new HttpException(
          { status: 'error', message: 'Database not initialized' },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      // Check 2: Database connection works (simple query)
      try {
        await this.db.get('SELECT 1 as test');
      } catch (dbError) {
        throw new HttpException(
          { status: 'error', message: 'Database connection failed', error: dbError instanceof Error ? dbError.message : 'Unknown error' },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      // Check 3: Required directories exist
      const userDataPath = process.env.ELECTRON_USER_DATA || getAppDataPath();
      const requiredDirs = [
        userDataPath,
        path.join(userDataPath, 'uploads'),
      ];

      for (const dir of requiredDirs) {
        try {
          if (!fs.existsSync(dir)) {
            // Try to create it
            fs.mkdirSync(dir, { recursive: true });
          }
        } catch (dirError) {
          // Log but don't fail - directories will be created on first use
          console.warn(`[HEALTH] Directory check warning for ${dir}:`, dirError);
        }
      }

      // All checks passed
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'ready',
        app: 'ready',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      // Unexpected error
      throw new HttpException(
        { status: 'error', message: 'Health check failed', error: error instanceof Error ? error.message : 'Unknown error' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

