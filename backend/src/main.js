"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const app_data_path_1 = require("./utils/app-data-path");
async function bootstrap() {
    try {
        console.log('[MAIN] Starting backend...');
        console.log('[MAIN] ELECTRON_USER_DATA:', process.env.ELECTRON_USER_DATA || 'not set (dev mode)');
        const app = await core_1.NestFactory.create(app_module_1.AppModule);
        app.enableCors({
            origin: true,
            credentials: true,
        });
        // Serve static files from app data directory (Electron userData in production)
        const uploadsPath = (0, app_data_path_1.getAppDataPath)('uploads');
        (0, app_data_path_1.ensureDirectoryExists)(uploadsPath);
        console.log('[MAIN] Serving static files from:', uploadsPath);
        app.useStaticAssets(uploadsPath, {
            prefix: '/uploads/',
        });
        const port = process.env.PORT || 3333;
        await app.listen(port, '0.0.0.0');
        console.log(`[MAIN] ✓ Backend is running on http://0.0.0.0:${port}`);
        console.log(`[MAIN] ✓ Backend is accessible on LAN at http://<your-ip>:${port}`);
    }
    catch (error) {
        console.error('[MAIN] ✗ Failed to start backend:', error);
        console.error('[MAIN] Error stack:', error.stack);
        process.exit(1);
    }
}
bootstrap().catch((error) => {
    console.error('[MAIN] ✗ Unhandled error in bootstrap:', error);
    process.exit(1);
});
