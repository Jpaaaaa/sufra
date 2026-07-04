/**
 * Venue HTTP routes (halls, floors, kitchens).
 */
import { getService } from '../../init/backend-loader';
import { HallsService, FloorsService, KitchensService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerVenueRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/halls', asyncHandler(async (req, res) => {
    const hallsService = getService(HallsService);
    res.json(await hallsService.findAll());
  }));
  app.get('/halls/:id', asyncHandler(async (req, res) => {
    const hallsService = getService(HallsService);
    res.json(await hallsService.findOne(parseInt(req.params.id)));
  }));
  app.post('/halls', asyncHandler(async (req, res) => {
    const hallsService = getService(HallsService);
    res.json(await hallsService.create(req.body));
  }));
  app.put('/halls/:id', asyncHandler(async (req, res) => {
    const hallsService = getService(HallsService);
    res.json(await hallsService.update(parseInt(req.params.id), req.body));
  }));
  app.delete('/halls/:id', asyncHandler(async (req, res) => {
    await getService(HallsService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/api/halls', asyncHandler(async (req, res) => {
    res.json(await getService(HallsService).findAll());
  }));
  app.get('/api/halls/:id', asyncHandler(async (req, res) => {
    res.json(await getService(HallsService).findOne(parseInt(req.params.id)));
  }));
  app.post('/api/halls', asyncHandler(async (req, res) => {
    res.json(await getService(HallsService).create(req.body));
  }));
  app.put('/api/halls/:id', asyncHandler(async (req, res) => {
    res.json(await getService(HallsService).update(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/halls/:id', asyncHandler(async (req, res) => {
    await getService(HallsService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/floors', asyncHandler(async (req, res) => {
    res.json(await getService(FloorsService).findAll());
  }));
  app.get('/floors/:id', asyncHandler(async (req, res) => {
    res.json(await getService(FloorsService).findOne(parseInt(req.params.id)));
  }));
  app.post('/floors', asyncHandler(async (req, res) => {
    res.json(await getService(FloorsService).create(req.body));
  }));
  app.put('/floors/:id', asyncHandler(async (req, res) => {
    res.json(await getService(FloorsService).update(parseInt(req.params.id), req.body));
  }));
  app.delete('/floors/:id', asyncHandler(async (req, res) => {
    await getService(FloorsService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/api/floors', asyncHandler(async (req, res) => {
    res.json(await getService(FloorsService).findAll());
  }));
  app.get('/api/floors/:id', asyncHandler(async (req, res) => {
    res.json(await getService(FloorsService).findOne(parseInt(req.params.id)));
  }));
  app.post('/api/floors', asyncHandler(async (req, res) => {
    res.json(await getService(FloorsService).create(req.body));
  }));
  app.put('/api/floors/:id', asyncHandler(async (req, res) => {
    res.json(await getService(FloorsService).update(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/floors/:id', asyncHandler(async (req, res) => {
    await getService(FloorsService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/kitchens', asyncHandler(async (req, res) => {
    res.json(await getService(KitchensService).findAll());
  }));
  app.get('/kitchens/:id', asyncHandler(async (req, res) => {
    res.json(await getService(KitchensService).findOne(parseInt(req.params.id)));
  }));
  app.post('/kitchens', asyncHandler(async (req, res) => {
    res.json(await getService(KitchensService).create(req.body));
  }));
  app.put('/kitchens/:id', asyncHandler(async (req, res) => {
    res.json(await getService(KitchensService).update(parseInt(req.params.id), req.body));
  }));
  app.delete('/kitchens/:id', asyncHandler(async (req, res) => {
    await getService(KitchensService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/api/kitchens', asyncHandler(async (req, res) => {
    res.json(await getService(KitchensService).findAll());
  }));
  app.get('/api/kitchens/:id', asyncHandler(async (req, res) => {
    res.json(await getService(KitchensService).findOne(parseInt(req.params.id)));
  }));
  app.post('/api/kitchens', asyncHandler(async (req, res) => {
    res.json(await getService(KitchensService).create(req.body));
  }));
  app.put('/api/kitchens/:id', asyncHandler(async (req, res) => {
    res.json(await getService(KitchensService).update(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/kitchens/:id', asyncHandler(async (req, res) => {
    await getService(KitchensService).remove(parseInt(req.params.id));
    res.json({ success: true });
  }));
}
