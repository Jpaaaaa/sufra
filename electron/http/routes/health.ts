/**
 * Health check HTTP routes.
 */
import { app as electronApp } from 'electron';
import { getBackendApp } from '../../state';
import { getService } from '../../init/backend-loader';
import { HealthController } from '../../init/backend-loader';
import type { RouteContext } from '../types';

function getElectronServerMeta() {
  let multerResolvable = false;
  try {
    require.resolve('multer');
    multerResolvable = true;
  } catch {
    multerResolvable = false;
  }
  return {
    packaged: electronApp.isPackaged,
    runtime: electronApp.isPackaged ? ('packaged' as const) : ('development' as const),
    version: electronApp.getVersion(),
    multerResolvable,
    appPath: electronApp.getAppPath(),
  };
}

export function registerHealthRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/api/health', asyncHandler(async (req, res) => {
    const electron = getElectronServerMeta();
    try {
      if (!getBackendApp()) {
        return res.status(503).json({
          status: 'error',
          message: 'Backend not initialized',
          backendReady: false,
          electron,
        });
      }
      const healthController = getService(HealthController);
      const health = await healthController.getHealth();
      res.json({ ...health, backendReady: true, electron });
    } catch (error: any) {
      res.status(500).json({
        status: 'error',
        message: error.message || 'Health check failed',
        backendReady: false,
        electron,
      });
    }
  }));

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      server: 'running',
      backendReady: !!getBackendApp(),
      timestamp: new Date().toISOString(),
      electron: getElectronServerMeta(),
    });
  });
}
