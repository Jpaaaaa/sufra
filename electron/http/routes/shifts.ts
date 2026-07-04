/**
 * Shifts HTTP routes.
 */
import { getService } from '../../init/backend-loader';
import { ShiftsService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerShiftsRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/api/shifts', asyncHandler(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    res.json(await getService(ShiftsService).getAllShifts(limit));
  }));
  app.get('/api/shifts/current', asyncHandler(async (req, res) => {
    res.json(await getService(ShiftsService).getActiveShift());
  }));
  app.get('/api/shifts/:id', asyncHandler(async (req, res) => {
    res.json(await getService(ShiftsService).getShiftById(parseInt(req.params.id)));
  }));
  app.post('/api/shifts/start', asyncHandler(async (req, res) => {
    const userId = req.body?.userId || req.body?.user_id || req.body;
    if (typeof userId !== 'number') {
      return res.status(400).json({ error: 'userId (number) required' });
    }
    res.json(await getService(ShiftsService).startShift(userId));
  }));
  app.post('/api/shifts/end', asyncHandler(async (req, res) => {
    const userId = req.body?.userId || req.body?.user_id || req.body;
    if (typeof userId !== 'number') {
      return res.status(400).json({ error: 'userId (number) required' });
    }
    res.json(await getService(ShiftsService).finishShift(userId));
  }));
}
