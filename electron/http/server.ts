/**
 * HTTP server for LAN browser clients - Express + Socket.IO.
 */
import { app as electronApp } from 'electron';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { getBackendApp } from '../state';
import { getStaticFrontendPath } from '../init/paths';
import { extractUserFromToken, createAsyncHandler } from './middleware';
import { registerAllRoutes } from './routes';

let httpServer: any = null;
let io: SocketIOServer | null = null;

export function emitOrderEvent(
  eventType: 'created' | 'updated' | 'deleted',
  orderType: 'dine-in' | 'pickup' | 'delivery',
  order: any
) {
  if (!io) {
    console.warn('[SOCKET] Cannot emit event: Socket.IO server not initialized');
    return;
  }
  const connectedCount = io.sockets.sockets.size;
  const eventName = `order:${orderType}:${eventType}`;
  console.log(`[SOCKET] Emitting event: ${eventName}`, {
    orderId: order?.id,
    tableId: order?.table_id,
    hallId: order?.hall_id,
    connectedClients: connectedCount,
  });
  if (connectedCount === 0) {
    console.warn('[SOCKET] ⚠️ No clients connected! Event will not be received by any client.');
  }
  io.emit(eventName, { orderType, order, timestamp: new Date().toISOString() });
  io.emit('order:updated', { orderType, eventType, order, timestamp: new Date().toISOString() });
}

export function setupHttpServer() {
  console.log('[HTTP] Setting up HTTP server for browser clients...');

  if (!getBackendApp()) {
    console.error('[HTTP] ✗ Backend not initialized, cannot start HTTP server');
    return;
  }

  const app = express();
  const PORT = 3333;
  const asyncHandler = createAsyncHandler();

  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.log(`[HTTP] ${req.method} ${req.path}`);
    if (req.path === '/auth/login' && req.method === 'POST') {
      console.log('[HTTP] Login request headers:', JSON.stringify(req.headers, null, 2));
      console.log('[HTTP] Login request content-type:', req.headers['content-type']);
    }
    next();
  });

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  const uploadsPath = path.join(electronApp.getPath('userData'), 'uploads');
  if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsPath));
  console.log('[HTTP] ✓ Uploads static serving from:', uploadsPath);

  const ctx = {
    app,
    asyncHandler,
    extractUserFromToken,
    emitOrderEvent,
  };
  registerAllRoutes(ctx);

  const staticPath = getStaticFrontendPath();
  const dataEndpoints = ['/halls', '/floors', '/tables', '/items', '/categories', '/kitchens', '/orders', '/reports', '/finance', '/shifts', '/shelves', '/offers', '/auth'];

  if (fs.existsSync(staticPath)) {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      const isDataEndpoint = dataEndpoints.some((ep) => req.path === ep || req.path.startsWith(ep + '/'));
      if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/auth/') || isDataEndpoint) {
        return next();
      }
      next();
    });

    app.use(express.static(staticPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
          res.setHeader('Content-Type', 'application/javascript');
        } else if (filePath.endsWith('.css')) {
          res.setHeader('Content-Type', 'text/css');
        }
      },
    }));

    app.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const isDataEndpoint = dataEndpoints.some((ep) => req.path === ep || req.path.startsWith(ep + '/'));
      if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || isDataEndpoint) {
        return next();
      }
      const assetExtensions = ['.js', '.mjs', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.json', '.map'];
      const hasAssetExtension = assetExtensions.some((ext) => req.path.toLowerCase().endsWith(ext));
      if (hasAssetExtension) {
        return res.status(404).json({ error: 'Asset not found', path: req.path });
      }
      const indexHtml = path.join(staticPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).json({ error: 'Frontend not found' });
      }
    });
    console.log('[HTTP] ✓ Static files serving from:', staticPath);
  } else {
    console.warn('[HTTP] ⚠️ Static frontend path not found:', staticPath);
  }

  app.use((req: express.Request, res: express.Response) => {
    console.log(`[HTTP] 404 - Unhandled route: ${req.method} ${req.path}`);
    res.status(404).json({ error: 'Route not found', path: req.path, method: req.method });
  });

  httpServer = createServer(app);
  io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true, methods: ['GET', 'POST'] },
    connectTimeout: 60000,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    const connectedCount = io!.sockets.sockets.size;
    console.log(`[SOCKET] ✓ Client connected: ${socket.id} (Total connected: ${connectedCount})`);
    socket.on('disconnect', () => {
      const remainingCount = io!.sockets.sockets.size;
      console.log(`[SOCKET] ✗ Client disconnected: ${socket.id} (Remaining: ${remainingCount})`);
    });
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[HTTP] ✓ HTTP server started on http://0.0.0.0:${PORT}`);
    console.log(`[HTTP] ✓ Socket.IO server initialized`);
    console.log(`[HTTP] ✓ Server accessible on LAN at http://<your-ip>:${PORT}`);
  });

  httpServer.on('error', (error: any) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[HTTP] ✗ Port ${PORT} is already in use`);
    } else {
      console.error('[HTTP] ✗ HTTP server error:', error);
    }
  });
}

export async function shutdownHttpServer(): Promise<void> {
  if (httpServer) {
    console.log('[HTTP] Shutting down HTTP server...');
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        console.log('[HTTP] ✓ HTTP server shut down');
        httpServer = null;
        resolve();
      });
      setTimeout(() => {
        if (httpServer) {
          console.log('[HTTP] ⚠️ Force closing HTTP server');
          httpServer.close();
          httpServer = null;
        }
        resolve();
      }, 5000);
    });
  }
}
