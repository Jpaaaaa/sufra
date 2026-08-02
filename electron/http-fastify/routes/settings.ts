/**
 * App settings routes (shift mode, definitions).
 */
import {
  settingsGetShiftHours,
  settingsUpdateShiftHours,
  settingsGetShiftDefinitions,
  settingsCreateShiftDefinition,
  settingsUpdateShiftDefinition,
  settingsRemoveShiftDefinition,
  settingsReplaceShiftDefinitions,
} from '../../init/backend-loader';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

type ShiftHoursBody = {
  shift_mode?: 'single' | 'multi';
  business_day_start_time?: string;
  shift_start_time?: string;
  shift_end_time?: string;
};

export function registerSettingsRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  const registerGetHours = (path: string) => {
    app.get(path, async (_request, reply) => {
      try {
        return await settingsGetShiftHours();
      } catch (error) {
        sendRouteError(reply, error, 'GET shift-hours');
      }
    });
  };

  const registerPutHours = (path: string) => {
    app.put<{ Body: ShiftHoursBody }>(path, async (request, reply) => {
      try {
        return await settingsUpdateShiftHours(request.body);
      } catch (error) {
        sendRouteError(reply, error, 'PUT shift-hours');
      }
    });
  };

  registerGetHours('/api/settings/shift-hours');
  registerPutHours('/api/settings/shift-hours');
  registerGetHours('/settings/shift-hours');
  registerPutHours('/settings/shift-hours');

  app.get('/api/settings/shift-definitions', async (_request, reply) => {
    try {
      return await settingsGetShiftDefinitions();
    } catch (error) {
      sendRouteError(reply, error, 'GET shift-definitions');
    }
  });

  app.post('/api/settings/shift-definitions', async (request, reply) => {
    try {
      return await settingsCreateShiftDefinition(request.body as {
        name: string;
        start_time: string;
        end_time: string;
        sort_order?: number;
      });
    } catch (error) {
      sendRouteError(reply, error, 'POST shift-definitions');
    }
  });

  const registerBulkShifts = (path: string) => {
    app.put<{ Body: { shifts: Array<{ id?: number; name: string; start_time: string; end_time: string; sort_order?: number }> } }>(
      path,
      async (request, reply) => {
        try {
          const body = request.body as { shifts?: unknown };
          const shifts = Array.isArray(body?.shifts) ? body.shifts : [];
          return await settingsReplaceShiftDefinitions(shifts);
        } catch (error) {
          sendRouteError(reply, error, 'PUT shift-definitions/bulk');
        }
      },
    );
  };

  registerBulkShifts('/api/settings/shift-definitions/bulk');
  registerBulkShifts('/settings/shift-definitions/bulk');

  app.put<{ Params: { id: string } }>('/api/settings/shift-definitions/:id', async (request, reply) => {
    try {
      return await settingsUpdateShiftDefinition(parseInt(request.params.id, 10), request.body as {
        name?: string;
        start_time?: string;
        end_time?: string;
        sort_order?: number;
        is_active?: boolean;
      });
    } catch (error) {
      sendRouteError(reply, error, 'PUT shift-definitions');
    }
  });

  app.delete<{ Params: { id: string } }>('/api/settings/shift-definitions/:id', async (request, reply) => {
    try {
      await settingsRemoveShiftDefinition(parseInt(request.params.id, 10));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, 'DELETE shift-definitions');
    }
  });

  app.get('/settings/shift-definitions', async (_request, reply) => {
    try {
      return await settingsGetShiftDefinitions();
    } catch (error) {
      sendRouteError(reply, error, 'GET shift-definitions');
    }
  });

  app.post('/settings/shift-definitions', async (request, reply) => {
    try {
      return await settingsCreateShiftDefinition(request.body as {
        name: string;
        start_time: string;
        end_time: string;
        sort_order?: number;
      });
    } catch (error) {
      sendRouteError(reply, error, 'POST shift-definitions');
    }
  });

  app.put<{ Params: { id: string } }>('/settings/shift-definitions/:id', async (request, reply) => {
    try {
      return await settingsUpdateShiftDefinition(parseInt(request.params.id, 10), request.body as {
        name?: string;
        start_time?: string;
        end_time?: string;
        sort_order?: number;
        is_active?: boolean;
      });
    } catch (error) {
      sendRouteError(reply, error, 'PUT shift-definitions');
    }
  });

  app.delete<{ Params: { id: string } }>('/settings/shift-definitions/:id', async (request, reply) => {
    try {
      await settingsRemoveShiftDefinition(parseInt(request.params.id, 10));
      return { success: true };
    } catch (error) {
      sendRouteError(reply, error, 'DELETE shift-definitions');
    }
  });
}
