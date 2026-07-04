import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getAppDataPath, ensureDirectoryExists } from './utils/app-data-path';

/**
 * Initialize backend as a library (no HTTP server)
 * Used by Electron to run backend in-process
 */
export async function initializeBackend(userDataPath?: string) {
  try {
    console.log('[BACKEND] Initializing backend as library...');
    if (userDataPath) {
      process.env.ELECTRON_USER_DATA = userDataPath;
    }
    console.log('[BACKEND] ELECTRON_USER_DATA:', process.env.ELECTRON_USER_DATA || 'not set (dev mode)');
    
    const app = await NestFactory.create(AppModule, {
      logger: false, // Disable NestJS logger in library mode
    });
    
    // Setup uploads directory (for file serving via IPC)
    const uploadsPath = getAppDataPath('uploads');
    ensureDirectoryExists(uploadsPath);
    console.log('[BACKEND] Uploads directory:', uploadsPath);
    
    // Initialize the app (triggers OnModuleInit hooks, but doesn't start HTTP server)
    await app.init();
    console.log('[BACKEND] ✓ Backend initialized as library (no HTTP server)');
    return app;
  } catch (error: any) {
    console.error('[BACKEND] ✗ Failed to initialize backend:', error);
    console.error('[BACKEND] Error stack:', error.stack);
    throw error;
  }
}

/**
 * Bootstrap function for standalone HTTP server mode
 * Only used when running backend as a standalone server (not in Electron)
 */
async function bootstrap() {
  try {
    console.log('[MAIN] Starting backend as HTTP server...');
    console.log('[MAIN] ELECTRON_USER_DATA:', process.env.ELECTRON_USER_DATA || 'not set (dev mode)');
    
    const app = await NestFactory.create<NestExpressApplication>(AppModule);
    app.enableCors({
      origin: true,
      credentials: true,
    });
    
    // Serve static files from app data directory (Electron userData in production)
    const uploadsPath = getAppDataPath('uploads');
    ensureDirectoryExists(uploadsPath);
    console.log('[MAIN] Serving static files from:', uploadsPath);
    app.useStaticAssets(uploadsPath, {
      prefix: '/uploads/',
    });
    
    const port = process.env.PORT || 3333;
    await app.listen(port, '0.0.0.0');
    console.log(`[MAIN] ✓ Backend is running on http://0.0.0.0:${port}`);
    console.log(`[MAIN] ✓ Backend is accessible on LAN at http://<your-ip>:${port}`);
  } catch (error: any) {
    console.error('[MAIN] ✗ Failed to start backend:', error);
    console.error('[MAIN] Error stack:', error.stack);
    process.exit(1);
  }
}

// Only run bootstrap if this file is executed directly (not imported)
if (require.main === module) {
  bootstrap().catch((error) => {
    console.error('[MAIN] ✗ Unhandled error in bootstrap:', error);
    process.exit(1);
  });
}


