import { DatabaseService } from './database/database.service';
import { getAppDataPath, ensureDirectoryExists } from './utils/app-data-path';
import { initializeAllServices } from './backend-init';

export interface BackendHandle {
  db: DatabaseService;
}

let backendHandle: BackendHandle | null = null;

export async function initializeBackend(userDataPath?: string): Promise<BackendHandle> {
  try {
    console.log('[BACKEND] Initializing backend as library...');

    if (userDataPath) {
      process.env.ELECTRON_USER_DATA = userDataPath;
    }
    console.log('[BACKEND] ELECTRON_USER_DATA:', process.env.ELECTRON_USER_DATA || 'not set (dev mode)');

    const uploadsPath = getAppDataPath('uploads');
    ensureDirectoryExists(uploadsPath);
    console.log('[BACKEND] Uploads directory:', uploadsPath);

    const db = new DatabaseService();
    await db.initialize();
    initializeAllServices(db);

    backendHandle = { db };
    console.log('[BACKEND] ✓ Backend initialized as library (no HTTP server)');
    return backendHandle;
  } catch (error: any) {
    console.error('[BACKEND] ✗ Failed to initialize backend:', error);
    console.error('[BACKEND] Error stack:', error.stack);
    throw error;
  }
}

export async function shutdownBackend(): Promise<void> {
  const handle = backendHandle;
  backendHandle = null;
  if (handle?.db) {
    console.log('[BACKEND] Requesting graceful shutdown (will save database)...');
    await handle.db.shutdown();
    console.log('[BACKEND] ✓ Backend shut down gracefully, database saved');
  }
}
