/**
 * Generic CRUD registrar for halls, floors, kitchens.
 */
import type { FastifyRouteContext } from '../../types';
import { sendRouteError } from '../../errors';
import { parseId, type CrudService } from './helpers';

export function registerCrudRoutes(
  ctx: FastifyRouteContext,
  prefix: string,
  getService: () => CrudService,
): void {
  const { app } = ctx;
  const byId = `${prefix}/:id`;

  app.get(prefix, async (request, reply) => {
    try {
      return await getService().findAll();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get<{ Params: { id: string } }>(byId, async (request, reply) => {
    try {
      return await getService().findOne(parseId(request.params.id));
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post(prefix, async (request, reply) => {
    try {
      return await getService().create(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(byId, async (request, reply) => {
    try {
      return await getService().update(parseId(request.params.id), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete<{ Params: { id: string } }>(byId, async (request, reply) => {
    try {
      await getService().remove(parseId(request.params.id));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}
