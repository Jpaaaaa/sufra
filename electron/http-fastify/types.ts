import type { FastifyInstance } from 'fastify';

export type EmitOrderEventFn = (
  eventType: 'created' | 'updated' | 'deleted',
  orderType: 'dine-in' | 'pickup' | 'delivery',
  order: unknown,
) => void;

export interface FastifyRouteContext {
  app: FastifyInstance;
  /** Wired when order routes migrate; Socket.IO stays on Express until then. */
  emitOrderEvent?: EmitOrderEventFn;
}
