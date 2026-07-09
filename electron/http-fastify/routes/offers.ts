/**
 * Offers routes — migrated from electron/http/routes/offers.ts
 */
import {
  offersGetAllDailyDeals,
  offersCreateDailyDeal,
  offersUpdateDailyDeal,
  offersDeleteDailyDeal,
  offersGetAllCombos,
  offersCreateCombo,
  offersUpdateCombo,
  offersDeleteCombo,
  offersGetAllScheduledOffers,
  offersCreateScheduledOffer,
  offersUpdateScheduledOffer,
  offersDeleteScheduledOffer,
  offersGetAllHappyHours,
  offersCreateHappyHour,
  offersUpdateHappyHour,
  offersDeleteHappyHour,
  offersGetAllFeaturedItems,
  offersSetFeatured,
} from '../../init/backend-loader';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';

function parseId(value: string): number {
  return parseInt(value, 10);
}

export function registerOffersRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.get('/offers/daily-deals', async (request, reply) => {
    try {
      return await offersGetAllDailyDeals();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/offers/combos', async (request, reply) => {
    try {
      return await offersGetAllCombos();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/offers/featured-items', async (request, reply) => {
    try {
      return await offersGetAllFeaturedItems();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/offers/scheduled-offers', async (request, reply) => {
    try {
      return await offersGetAllScheduledOffers();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/offers/happy-hour', async (request, reply) => {
    try {
      return await offersGetAllHappyHours();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.get('/api/offers/daily-deals', async (request, reply) => {
    try {
      return await offersGetAllDailyDeals();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/offers/daily-deals', async (request, reply) => {
    try {
      return await offersCreateDailyDeal(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(
    '/api/offers/daily-deals/:id',
    async (request, reply) => {
      try {
        return await offersUpdateDailyDeal(parseId(request.params.id), request.body);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.put<{ Params: { id: string } }>(
    '/offers/daily-deals/:id',
    async (request, reply) => {
      try {
        return await offersUpdateDailyDeal(parseId(request.params.id), request.body);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/offers/daily-deals/:id',
    async (request, reply) => {
      try {
        await offersDeleteDailyDeal(parseId(request.params.id));
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get('/api/offers/combos', async (request, reply) => {
    try {
      return await offersGetAllCombos();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/offers/combos', async (request, reply) => {
    try {
      return await offersCreateCombo(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>('/api/offers/combos/:id', async (request, reply) => {
    try {
      return await offersUpdateCombo(parseId(request.params.id), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete<{ Params: { id: string } }>(
    '/api/offers/combos/:id',
    async (request, reply) => {
      try {
        await offersDeleteCombo(parseId(request.params.id));
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get('/api/offers/scheduled', async (request, reply) => {
    try {
      return await offersGetAllScheduledOffers();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/offers/scheduled', async (request, reply) => {
    try {
      return await offersCreateScheduledOffer(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(
    '/api/offers/scheduled/:id',
    async (request, reply) => {
      try {
        return await offersUpdateScheduledOffer(parseId(request.params.id), request.body);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/offers/scheduled/:id',
    async (request, reply) => {
      try {
        await offersDeleteScheduledOffer(parseId(request.params.id));
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get('/api/offers/happy-hour', async (request, reply) => {
    try {
      return await offersGetAllHappyHours();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post('/api/offers/happy-hour', async (request, reply) => {
    try {
      return await offersCreateHappyHour(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(
    '/api/offers/happy-hour/:id',
    async (request, reply) => {
      try {
        return await offersUpdateHappyHour(parseId(request.params.id), request.body);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.delete<{ Params: { id: string } }>(
    '/api/offers/happy-hour/:id',
    async (request, reply) => {
      try {
        await offersDeleteHappyHour(parseId(request.params.id));
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.get('/api/offers/featured', async (request, reply) => {
    try {
      return await offersGetAllFeaturedItems();
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.post<{ Body: { product_id?: number; productId?: number } }>(
    '/api/offers/featured',
    async (request, reply) => {
      try {
        const productId = request.body?.product_id ?? request.body?.productId;
        return await offersSetFeatured(productId!, true);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );
}
