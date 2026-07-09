import { DatabaseService } from '../../database/database.service';
import { ServiceUnavailableException } from '../../utils/exceptions';
import { getAppDataPath } from '../../utils/app-data-path';
import * as fs from 'fs';
import * as path from 'path';

class HealthService {
  constructor(private readonly db: DatabaseService) {}

  async getHealth() {
    if (!this.db.isReady()) {
      throw new ServiceUnavailableException('Database not initialized');
    }

    try {
      await this.db.get('SELECT 1 as test');
    } catch (dbError) {
      throw new ServiceUnavailableException(
        dbError instanceof Error ? dbError.message : 'Database connection failed',
      );
    }

    const userDataPath = process.env.ELECTRON_USER_DATA || getAppDataPath();
    const requiredDirs = [userDataPath, path.join(userDataPath, 'uploads')];

    for (const dir of requiredDirs) {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      } catch (dirError) {
        console.warn(`[HEALTH] Directory check warning for ${dir}:`, dirError);
      }
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'ready',
      app: 'ready',
    };
  }
}

let healthInstance: HealthService | null = null;

export function initializeHealth(db: DatabaseService): void {
  healthInstance = new HealthService(db);
}

function requireHealth(): HealthService {
  if (!healthInstance) {
    throw new Error('Health not initialized');
  }
  return healthInstance;
}

export function getHealth(): ReturnType<HealthService['getHealth']> {
  return requireHealth().getHealth();
}
