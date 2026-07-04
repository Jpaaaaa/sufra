/**
 * Shared HTTP middleware and helpers for route handlers.
 */
import express from 'express';

export async function extractUserFromToken(req: express.Request): Promise<number | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    const token = authHeader.substring(7);
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload?.sub || null;
  } catch {
    return null;
  }
}

export type AsyncHandlerFn = (req: express.Request, res: express.Response) => Promise<any>;

export function createAsyncHandler() {
  return (fn: AsyncHandlerFn) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
      Promise.resolve(fn(req, res)).catch((error: any) => {
        console.error('[HTTP] ========== ASYNC HANDLER ERROR ==========');
        console.error('[HTTP] Route:', req.method, req.path);
        console.error('[HTTP] Error type:', error?.constructor?.name);
        console.error('[HTTP] Error message:', error?.message);
        console.error('[HTTP] Error stack:', error?.stack);
        if (error?.code) console.error('[HTTP] Error code:', error.code);
        if (error?.statusCode) console.error('[HTTP] Error statusCode:', error.statusCode);
        console.error('[HTTP] Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        console.error('[HTTP] Response headers sent:', res.headersSent);
        console.error('[HTTP] =========================================');

        if (!res.headersSent) {
          try {
            const statusCode = error?.status || error?.statusCode || error?.response?.statusCode || 500;
            const errorMessage = error?.response?.message || error?.message || 'Internal server error';
            res.status(statusCode).json({
              success: false,
              error: errorMessage,
              errorType: error?.constructor?.name || 'Unknown',
              details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            });
          } catch (sendError: any) {
            if (!res.headersSent) {
              try {
                res.status(500).send(`Internal Server Error: ${error.message || 'Unknown error'}`);
              } catch (e) {
                console.error('[HTTP] Failed to send any error response');
              }
            }
          }
        }
      });
    };
  };
}
