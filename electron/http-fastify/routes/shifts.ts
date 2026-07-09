/**
 * Shifts routes
 */
import {
  shiftsGetAllShifts,
  shiftsGetActiveShift,
  shiftsGetShiftById,
  shiftsStartShift,
  shiftsFinishShift,
} from '../../init/backend-loader';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

function parseId(value: string): number {
  return parseInt(value, 10);
}

function parseUserId(body: unknown): number | null {
  const record = body as { userId?: number; user_id?: number } | number;
  if (typeof record === 'number') {
    return record;
  }
  const userId = record?.userId ?? record?.user_id;
  return typeof userId === 'number' ? userId : null;
}

export function registerShiftsRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.get<{ Querystring: { limit?: string } }>(
    '/api/shifts',
    async (request, reply) => {
      try {
        const limit = request.query.limit
          ? parseInt(request.query.limit, 10)
          : undefined;
        return await shiftsGetAllShifts(limit);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get('/api/shifts/current', async (request, reply) => {
    try {
      return await shiftsGetActiveShift();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { id: string } }>(
    '/api/shifts/:id',
    async (request, reply) => {
      try {
        return await shiftsGetShiftById(parseId(request.params.id));
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post('/api/shifts/start', async (request, reply) => {
    try {
      const userId = parseUserId(request.body);
      if (userId === null) {
        return reply.status(400).send({ error: 'userId (number) required' });
      }
      return await shiftsStartShift(userId);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/shifts/end', async (request, reply) => {
    try {
      const userId = parseUserId(request.body);
      if (userId === null) {
        return reply.status(400).send({ error: 'userId (number) required' });
      }
      return await shiftsFinishShift(userId);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}
