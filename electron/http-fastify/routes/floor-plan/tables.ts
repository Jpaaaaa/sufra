/**
 * Tables routes — migrated from electron/http/routes/tables.ts
 * Linked to halls via /halls/:id/tables and /api/tables/by-hall/:hallId
 */
import {
  tablesFindAll,
  tablesFindByHall,
  tablesFindOne,
  tablesCreate,
  tablesUpdate,
  tablesRemove,
} from '../../../init/backend-loader';
import type { FastifyRouteContext } from '../../types';
import { sendRouteError } from '../../errors';
import { parseId } from './helpers';

function serializeTablesForHall(tables: Array<Record<string, unknown>>) {
  return tables.map((t) => ({
    id: t.id,
    number: t.number,
    name: t.name,
    hall_id: t.hall_id,
    created_at: t.created_at,
    updated_at: t.updated_at,
  }));
}

export function registerTablesRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.get('/api/tables', async (request, reply) => {
    try {
      return await tablesFindAll();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { hallId: string } }>(
    '/api/tables/by-hall/:hallId',
    async (request, reply) => {
      try {
        const hallId = parseId(request.params.hallId);
        if (!hallId || isNaN(hallId) || hallId <= 0) {
          return reply.status(400).send({ error: 'Invalid hallId' });
        }
        const tables = await tablesFindByHall(hallId);
        return serializeTablesForHall(tables as Array<Record<string, unknown>>);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get<{ Params: { id: string } }>('/api/tables/:id', async (request, reply) => {
    try {
      return await tablesFindOne(parseId(request.params.id));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/tables', async (request, reply) => {
    try {
      const table = await tablesCreate(request.body);
      return JSON.parse(JSON.stringify(table));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>('/api/tables/:id', async (request, reply) => {
    try {
      return await tablesUpdate(parseId(request.params.id), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete<{ Params: { id: string } }>('/api/tables/:id', async (request, reply) => {
    try {
      await tablesRemove(parseId(request.params.id));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { id: string } }>('/halls/:id/tables', async (request, reply) => {
    try {
      return await tablesFindByHall(parseId(request.params.id));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Params: { id: string } }>('/halls/:id/tables', async (request, reply) => {
    try {
      const hallId = parseId(request.params.id);
      const table = await tablesCreate({
        ...(request.body as object),
        hall_id: hallId,
      });
      return JSON.parse(JSON.stringify(table));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}
