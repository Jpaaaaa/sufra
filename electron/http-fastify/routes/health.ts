/**
 * Health check routes — migrated from electron/http/routes/health.ts
 */
import { app as electronApp } from 'electron';
import { getBackendApp } from '../../state';
import { healthGetHealth } from '../../init/backend-loader';
import type { FastifyRouteContext } from '../types';

function getElectronServerMeta() {
  let uploadReady = false;
  try {
    require.resolve('@fastify/multipart');
    uploadReady = true;
  } catch {
    uploadReady = false;
  }
  return {
    packaged: electronApp.isPackaged,
    runtime: electronApp.isPackaged ? ('packaged' as const) : ('development' as const),
    version: electronApp.getVersion(),
    uploadReady,
    appPath: electronApp.getAppPath(),
  };
}

export function registerHealthRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.get('/api/health', async (request, reply) => {
    const electron = getElectronServerMeta();
    try {
      if (!getBackendApp()) {
        return reply.status(503).send({
          status: 'error',
          message: 'Backend not initialized',
          backendReady: false,
          electron,
        });
      }
      const health = await healthGetHealth();
      return { ...health, backendReady: true, electron };
    } catch (error) {
      return reply.status(500).send({
        status: 'error',
        message: error instanceof Error ? error.message : 'Health check failed',
        backendReady: false,
        electron,
      });
    }
  });

  app.get('/health', async () => ({
    status: 'ok',
    server: 'fastify',
    backendReady: !!getBackendApp(),
    timestamp: new Date().toISOString(),
    electron: getElectronServerMeta(),
  }));
}
