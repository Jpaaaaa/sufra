/**
 * Fastify LAN server — primary API, Socket.IO, uploads, and production SPA (port 3333).
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { getBackendApp } from '../state';
import {
  emitOrderEvent,
  setupOrderSocketIO,
  shutdownOrderSocketIO,
} from '../http-shared/socket-io';
import { LAN_API_PORT } from '../http-shared/lan-ports';
import { registerAllFastifyRoutes } from './routes';
import { registerFastifyStaticRoutes, sendSpaFallback } from './static-routes';
import { sendRouteError } from './errors';

export { emitOrderEvent };

let fastifyInstance: ReturnType<typeof Fastify> | null = null;
let listenPromise: Promise<void> | null = null;
let spaStaticPath: string | null = null;

export function getFastifyLanPort(): number {
  return LAN_API_PORT;
}

export function isFastifyLanRunning(): boolean {
  return fastifyInstance !== null;
}

export async function setupFastifyLanServer(): Promise<void> {
  if (listenPromise) {
    return listenPromise;
  }

  listenPromise = startFastifyLanServer();
  return listenPromise;
}

async function startFastifyLanServer(): Promise<void> {
  console.log('[FASTIFY] Setting up Fastify LAN server...');

  if (!getBackendApp()) {
    console.error('[FASTIFY] ✗ Backend not initialized, skipping Fastify LAN server');
    listenPromise = null;
    return;
  }

  if (fastifyInstance) {
    console.log('[FASTIFY] LAN server already running');
    return;
  }

  const app = Fastify({
    logger: false,
    bodyLimit: 10 * 1024 * 1024,
  });

  app.addHook('onRequest', async (request) => {
    console.log(`[FASTIFY] ${request.method} ${request.url}`);
  });

  app.setErrorHandler((error, request, reply) => {
    sendRouteError(reply, error, `${request.method} ${request.url}`);
  });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  registerAllFastifyRoutes({ app, emitOrderEvent });
  spaStaticPath = await registerFastifyStaticRoutes(app);

  app.setNotFoundHandler((request, reply) => {
    if (spaStaticPath && sendSpaFallback(request, reply, spaStaticPath)) {
      return;
    }
    reply.status(404).send({
      error: 'Route not found',
      path: request.url,
      method: request.method,
    });
  });

  try {
    const address = await app.listen({ port: LAN_API_PORT, host: '0.0.0.0' });
    fastifyInstance = app;
    setupOrderSocketIO(app.server);
    console.log(`[FASTIFY] ✓ LAN server started at ${address}`);
    console.log('[FASTIFY] ✓ Socket.IO attached to Fastify LAN server');
    console.log('[FASTIFY] Note: this server stops when the Electron app exits');
  } catch (error) {
    listenPromise = null;
    const err = error as NodeJS.ErrnoException;
    if (err.code === 'EADDRINUSE') {
      console.error(`[FASTIFY] ✗ Port ${LAN_API_PORT} is already in use`);
      console.error(
        '[FASTIFY] Another Electron instance may still be running with an older build.',
      );
      console.error(
        '[FASTIFY] Close all Electron windows, run: taskkill /F /IM electron.exe',
      );
      console.error('[FASTIFY] Then restart: cd electron && npm run dev');
    } else {
      console.error('[FASTIFY] ✗ Failed to start LAN server:', error);
    }
    throw error;
  }
}

export async function shutdownFastifyLanServer(): Promise<void> {
  await shutdownOrderSocketIO();

  if (!fastifyInstance) {
    listenPromise = null;
    return;
  }

  console.log('[FASTIFY] Shutting down Fastify LAN server...');
  try {
    await fastifyInstance.close();
    console.log('[FASTIFY] ✓ Fastify LAN server shut down');
  } catch (error) {
    console.error('[FASTIFY] Error during shutdown:', error);
  } finally {
    fastifyInstance = null;
    listenPromise = null;
    spaStaticPath = null;
  }
}
