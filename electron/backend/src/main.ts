import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getAppDataPath, ensureDirectoryExists } from './utils/app-data-path';
import { INestApplication } from '@nestjs/common';

/**
 * Initialize NestJS backend as a library (no HTTP server)
 * This function creates the NestJS app and initializes all modules/services
 * but does NOT start an HTTP server. Services can be accessed directly.
 */
export async function initializeBackend(userDataPath?: string): Promise<INestApplication> {
  try {
    console.log('[BACKEND] Initializing backend as library...');
    
    // Set user data path if provided
    if (userDataPath) {
      process.env.ELECTRON_USER_DATA = userDataPath;
    }
    
    console.log('[BACKEND] ELECTRON_USER_DATA:', process.env.ELECTRON_USER_DATA || 'not set (dev mode)');
    
    // Create NestJS app without starting HTTP server
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false, // Disable default logger to avoid console spam
    });
    
    // Initialize static assets path (for file uploads)
    const uploadsPath = getAppDataPath('uploads');
    ensureDirectoryExists(uploadsPath);
    console.log('[BACKEND] Uploads directory:', uploadsPath);
    
    // Note: Static assets are not needed in library mode (no HTTP server)
    // File uploads are handled directly via services
    
    // Initialize the app (triggers OnModuleInit hooks, including database initialization)
    await app.init();
    
    console.log('[BACKEND] ✓ Backend initialized as library (no HTTP server)');
    return app;
  } catch (error: any) {
    console.error('[BACKEND] ✗ Failed to initialize backend:', error);
    console.error('[BACKEND] Error stack:', error.stack);
    throw error;
  }
}

// Only run bootstrap if this file is executed directly (for backward compatibility in dev)
// In production, initializeBackend() will be called from Electron main process
if (require.main === module) {
  async function bootstrap() {
    try {
      const app = await initializeBackend();
      // In dev mode, we might still want HTTP server for testing
      // But for production, we don't start HTTP server
      if (process.env.START_HTTP_SERVER === 'true') {
        const expressApp = app as NestExpressApplication;
        expressApp.enableCors({
          origin: true,
          credentials: true,
        });
        
        const uploadsPath = getAppDataPath('uploads');
        ensureDirectoryExists(uploadsPath);
        expressApp.useStaticAssets(uploadsPath, {
          prefix: '/uploads/',
        });
        
        const port = process.env.PORT || 3333;
        await app.listen(port, '0.0.0.0');
        console.log(`[MAIN] ✓ Backend is running on http://0.0.0.0:${port}`);
      } else {
        console.log('[MAIN] Backend initialized without HTTP server (library mode)');
        // Keep process alive
        process.on('SIGTERM', async () => {
          await app.close();
          process.exit(0);
        });
      }
    } catch (error: any) {
      console.error('[MAIN] ✗ Failed to start backend:', error);
      console.error('[MAIN] Error stack:', error.stack);
      process.exit(1);
    }
  }

  bootstrap().catch((error) => {
    console.error('[MAIN] ✗ Unhandled error in bootstrap:', error);
    process.exit(1);
  });
}


