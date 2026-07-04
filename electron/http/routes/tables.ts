/**
 * Tables HTTP routes.
 */
import { getService } from '../../init/backend-loader';
import { TablesService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerTablesRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/api/tables', asyncHandler(async (req, res) => {
    const tablesService = getService(TablesService);
    const tables = await tablesService.findAll();
    res.json(tables);
  }));

  app.get('/api/tables/by-hall/:hallId', asyncHandler(async (req, res) => {
    const hallId = parseInt(req.params.hallId);
    if (!hallId || isNaN(hallId) || hallId <= 0) {
      return res.status(400).json({ error: 'Invalid hallId' });
    }
    const tablesService = getService(TablesService);
    const tables = await tablesService.findByHall(hallId);
    const serializable = tables.map((t: any) => ({
      id: t.id,
      number: t.number,
      name: t.name,
      hall_id: t.hall_id,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
    res.json(serializable);
  }));

  app.get('/api/tables/:id', asyncHandler(async (req, res) => {
    const tablesService = getService(TablesService);
    const table = await tablesService.findOne(parseInt(req.params.id));
    res.json(table);
  }));

  app.post('/api/tables', asyncHandler(async (req, res) => {
    const tablesService = getService(TablesService);
    const table = await tablesService.create(req.body);
    res.json(JSON.parse(JSON.stringify(table)));
  }));

  app.put('/api/tables/:id', asyncHandler(async (req, res) => {
    const tablesService = getService(TablesService);
    const table = await tablesService.update(parseInt(req.params.id), req.body);
    res.json(table);
  }));

  app.delete('/api/tables/:id', asyncHandler(async (req, res) => {
    const tablesService = getService(TablesService);
    await tablesService.remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/halls/:id/tables', asyncHandler(async (req, res) => {
    const tablesService = getService(TablesService);
    const tables = await tablesService.findByHall(parseInt(req.params.id));
    res.json(tables);
  }));

  app.post('/halls/:id/tables', asyncHandler(async (req, res) => {
    const hallId = parseInt(req.params.id);
    const tablesService = getService(TablesService);
    const tableData = { ...req.body, hall_id: hallId };
    const table = await tablesService.create(tableData);
    res.json(JSON.parse(JSON.stringify(table)));
  }));
}
