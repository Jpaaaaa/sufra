import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getServerUrl, testServerConnection } from '../lib/server-config';

export type OrderType = 'dine-in' | 'pickup' | 'delivery';
export type OrderEventType = 'created' | 'updated' | 'deleted';

export interface OrderEvent {
  orderType: OrderType;
  eventType: OrderEventType;
  order: any;
  timestamp: string;
}

interface PendingSubscription {
  callback: (event: OrderEvent) => void;
  orderTypes?: OrderType[];
  cancelRef: {
    canceled: boolean;
    unsubscribe?: () => void;
  };
}

/**
 * Hook to manage Socket.IO connection for real-time order updates
 */
export function useOrderSocket() {
  const socketRef = useRef<Socket | null>(null);
  const isConnectedRef = useRef(false);
  const pendingSubscriptions = useRef<PendingSubscription[]>([]);

  // Initialize Socket.IO connection
  useEffect(() => {
    const serverUrl = getServerUrl();
    console.log('[SOCKET] Connecting to Socket.IO server at:', serverUrl);

    // Test server connection first (optional, but helps with debugging)
    testServerConnection(serverUrl).then((result) => {
      if (!result.success) {
        console.warn('[SOCKET] Server health check failed:', result.error, 'Will still attempt socket connection');
      } else {
        console.log('[SOCKET] Server health check passed, proceeding with socket connection');
      }
    }).catch((err) => {
      console.warn('[SOCKET] Health check error (non-blocking):', err);
    });

    // Create Socket.IO connection
    // Use polling first for better reliability on LAN connections, then upgrade to websocket
    const socket = io(serverUrl, {
      transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 10000, // 10 seconds connection timeout (reduced from 20)
      forceNew: false, // Reuse existing connection if available
      upgrade: true, // Allow transport upgrades from polling to websocket
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('[SOCKET] ✓ Connected to server:', serverUrl, 'Socket ID:', socket.id);
      isConnectedRef.current = true;
      
      // Attach any pending subscriptions when socket connects
      if (pendingSubscriptions.current.length > 0) {
        const pending = [...pendingSubscriptions.current];
        pendingSubscriptions.current = [];
        pending.forEach((entry) => {
          if (entry.cancelRef.canceled) {
            return;
          }
          entry.cancelRef.unsubscribe = attachSubscription(socket, entry.callback, entry.orderTypes);
        });
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log('[SOCKET] ✗ Disconnected from server:', reason, 'Server URL:', serverUrl);
      isConnectedRef.current = false;
    });

    socket.on('connect_error', (error: Error) => {
      console.error('[SOCKET] Connection error:', error, 'Server URL:', serverUrl);
      console.error('[SOCKET] Error details:', {
        message: error.message,
        type: error.name,
        serverUrl,
        socketConnected: socket.connected,
        socketId: socket.id,
      });
      
      // If WebSocket fails, try forcing polling transport
      if (!socket.connected && socket.io.opts.transports?.[0] === 'websocket') {
        console.log('[SOCKET] WebSocket failed, will retry with polling fallback');
      }
    });

    // Log when events are received for debugging
    socket.onAny((eventName, ...args) => {
      if (eventName.startsWith('order:')) {
        console.log('[SOCKET] Received event:', eventName, args);
      }
    });

    // Attach any pending subscriptions once socket is initialized
    if (pendingSubscriptions.current.length > 0) {
      const pending = [...pendingSubscriptions.current];
      pendingSubscriptions.current = [];
      pending.forEach((entry) => {
        if (entry.cancelRef.canceled) {
          return;
        }
        entry.cancelRef.unsubscribe = attachSubscription(socket, entry.callback, entry.orderTypes);
      });
    }

    // Cleanup on unmount
    return () => {
      console.log('[SOCKET] Cleaning up Socket.IO connection');
      socket.disconnect();
      socketRef.current = null;
      isConnectedRef.current = false;
    };
  }, []);

  const attachSubscription = useCallback(
    (socket: Socket, callback: (event: OrderEvent) => void, orderTypes?: OrderType[]) => {
      console.log('[SOCKET] Attaching subscription for order types:', orderTypes || 'all', 'Socket connected:', socket.connected);
      
      // Listen to generic order:updated event
      const handler = (data: OrderEvent) => {
        console.log('[SOCKET] Received order:updated event:', data);
        // Filter by order types if specified
        if (orderTypes && orderTypes.length > 0 && !orderTypes.includes(data.orderType)) {
          return;
        }
        callback(data);
      };

      socket.on('order:updated', handler);

      // Also listen to specific events for each order type
      const specificHandlers: Array<{ event: string; handler: (data: any) => void }> = [];

      const types: OrderType[] = orderTypes || ['dine-in', 'pickup', 'delivery'];
      types.forEach((orderType) => {
        // Listen to created events
        const createdHandler = (data: any) => {
          console.log(`[SOCKET] Received order:${orderType}:created event:`, data);
          callback({
            orderType,
            eventType: 'created',
            order: data.order,
            timestamp: data.timestamp,
          });
        };
        socket.on(`order:${orderType}:created`, createdHandler);
        specificHandlers.push({ event: `order:${orderType}:created`, handler: createdHandler });

        // Listen to updated events
        const updatedHandler = (data: any) => {
          console.log(`[SOCKET] Received order:${orderType}:updated event:`, data);
          callback({
            orderType,
            eventType: 'updated',
            order: data.order,
            timestamp: data.timestamp,
          });
        };
        socket.on(`order:${orderType}:updated`, updatedHandler);
        specificHandlers.push({ event: `order:${orderType}:updated`, handler: updatedHandler });
      });

      // Return unsubscribe function
      return () => {
        socket.off('order:updated', handler);
        specificHandlers.forEach(({ event, handler }) => {
          socket.off(event, handler);
        });
      };
    },
    []
  );

  /**
   * Subscribe to order events
   * @param callback - Function to call when an order event is received
   * @param orderTypes - Optional array of order types to filter (if not provided, listens to all)
   * @returns Unsubscribe function
   */
  const subscribeToOrders = useCallback(
    (
      callback: (event: OrderEvent) => void,
      orderTypes?: OrderType[]
    ): (() => void) => {
      const socket = socketRef.current;
      if (socket) {
        return attachSubscription(socket, callback, orderTypes);
      }

      const cancelRef = { canceled: false } as PendingSubscription['cancelRef'];
      pendingSubscriptions.current.push({ callback, orderTypes, cancelRef });
      return () => {
        cancelRef.canceled = true;
        if (cancelRef.unsubscribe) {
          cancelRef.unsubscribe();
        }
      };
    },
    [attachSubscription]
  );

  /**
   * Check if Socket.IO is connected
   */
  const isConnected = useCallback(() => {
    return isConnectedRef.current && socketRef.current?.connected === true;
  }, []);

  return {
    subscribeToOrders,
    isConnected,
  };
}
