/**
 * Socket.IO for real-time order events on the LAN server.
 * Socket.IO for real-time order events on the LAN server (port 3333).
 */
import type { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

let io: SocketIOServer | null = null;

export function setupOrderSocketIO(httpServer: HttpServer): SocketIOServer {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: { origin: true, credentials: true, methods: ['GET', 'POST'] },
    connectTimeout: 60000,
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on('connection', (socket) => {
    const connectedCount = io!.sockets.sockets.size;
    console.log(
      `[SOCKET] ✓ Client connected: ${socket.id} (Total connected: ${connectedCount})`,
    );
    socket.on('disconnect', () => {
      const remainingCount = io!.sockets.sockets.size;
      console.log(
        `[SOCKET] ✗ Client disconnected: ${socket.id} (Remaining: ${remainingCount})`,
      );
    });
  });

  console.log('[SOCKET] ✓ Socket.IO server initialized');
  return io;
}

export function emitOrderEvent(
  eventType: 'created' | 'updated' | 'deleted',
  orderType: 'dine-in' | 'pickup' | 'delivery',
  order: unknown,
): void {
  if (!io) {
    console.warn('[SOCKET] Cannot emit event: Socket.IO server not initialized');
    return;
  }

  const connectedCount = io.sockets.sockets.size;
  const eventName = `order:${orderType}:${eventType}`;
  console.log(`[SOCKET] Emitting event: ${eventName}`, {
    orderId: (order as { id?: number })?.id,
    tableId: (order as { table_id?: number })?.table_id,
    hallId: (order as { hall_id?: number })?.hall_id,
    connectedClients: connectedCount,
  });

  if (connectedCount === 0) {
    console.warn(
      '[SOCKET] ⚠️ No clients connected! Event will not be received by any client.',
    );
  }

  io.emit(eventName, {
    orderType,
    order,
    timestamp: new Date().toISOString(),
  });
  io.emit('order:updated', {
    orderType,
    eventType,
    order,
    timestamp: new Date().toISOString(),
  });
}

export async function shutdownOrderSocketIO(): Promise<void> {
  if (!io) {
    return;
  }
  console.log('[SOCKET] Shutting down Socket.IO server...');
  await new Promise<void>((resolve) => {
    io!.close(() => {
      console.log('[SOCKET] ✓ Socket.IO server shut down');
      io = null;
      resolve();
    });
  });
}
