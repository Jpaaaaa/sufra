/**
 * Types for HTTP route registration.
 */
import express from 'express';

export type EmitOrderEventFn = (
  eventType: 'created' | 'updated' | 'deleted',
  orderType: 'dine-in' | 'pickup' | 'delivery',
  order: any
) => void;

export interface RouteContext {
  app: express.Express;
  asyncHandler: (fn: (req: express.Request, res: express.Response) => Promise<any>) => express.RequestHandler;
  extractUserFromToken: (req: express.Request) => Promise<number | null>;
  emitOrderEvent?: EmitOrderEventFn;
  ipcMain?: any;
}
