/**
 * Shelves HTTP routes.
 */
import { getService } from '../../init/backend-loader';
import { ShelvesService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerShelvesRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/shelves', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).findAll());
  }));
  app.get('/shelves/barcode/:barcode', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).findOneByBarcode(req.params.barcode));
  }));
  app.post('/shelves', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).create(req.body));
  }));
  app.put('/shelves/:id', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).update(parseInt(req.params.id), req.body));
  }));
  app.get('/shelves/:id', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).findOneById(parseInt(req.params.id)));
  }));
  app.delete('/shelves/:id', asyncHandler(async (req, res) => {
    await getService(ShelvesService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.post('/shelves/sell', asyncHandler(async (req, res) => {
    const { barcode, quantity } = req.body;
    res.json(await getService(ShelvesService).sell(barcode, quantity || 1));
  }));

  app.get('/api/shelves', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).findAll());
  }));
  app.get('/api/shelves/barcode/:barcode', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).findOneByBarcode(req.params.barcode));
  }));
  app.get('/api/shelves/:id', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).findOneById(parseInt(req.params.id)));
  }));
  app.post('/api/shelves', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).create(req.body));
  }));
  app.put('/api/shelves/:id', asyncHandler(async (req, res) => {
    res.json(await getService(ShelvesService).update(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/shelves/:id', asyncHandler(async (req, res) => {
    await getService(ShelvesService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.post('/api/shelves/sell', asyncHandler(async (req, res) => {
    const { barcode, quantity } = req.body;
    res.json(await getService(ShelvesService).sell(barcode, quantity || 1));
  }));
}
