/**
 * Offers routes — Fastify. Reads open; mutate requires admin|manager via Bearer JWT.
 */
import {
  offersGetAllDailyDeals,
  offersCreateDailyDeal,
  offersUpdateDailyDeal,
  offersArchiveDailyDeal,
  offersDuplicateDailyDeal,
  offersGetAllCombos,
  offersCreateCombo,
  offersUpdateCombo,
  offersArchiveCombo,
  offersDuplicateCombo,
  offersGetAllScheduledOffers,
  offersCreateScheduledOffer,
  offersUpdateScheduledOffer,
  offersArchiveScheduledOffer,
  offersDuplicateScheduledOffer,
  offersGetAllHappyHours,
  offersCreateHappyHour,
  offersUpdateHappyHour,
  offersArchiveHappyHour,
  offersDuplicateHappyHour,
  offersGetAllFeaturedItems,
  offersSetFeatured,
} from '../../init/backend-loader';
import { requireOffersManager } from '../../shared/offers/offers-rbac';
import { extractActorFromAuthHeader } from '../../http-shared/extract-user-token';
import type { FastifyRouteContext } from '../types';
import { sendRouteError } from '../errors';
import type { FastifyRequest } from 'fastify';

function parseId(value: string): number {
  return parseInt(value, 10);
}

function requireMutateActor(request: FastifyRequest) {
  const auth = request.headers.authorization;
  const actor = extractActorFromAuthHeader(
    Array.isArray(auth) ? auth[0] : auth,
  );
  return requireOffersManager(actor);
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
      requireMutateActor(request);
      return await offersCreateDailyDeal(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(
    '/api/offers/daily-deals/:id',
    async (request, reply) => {
      try {
        requireMutateActor(request);
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
        requireMutateActor(request);
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
        const actor = requireMutateActor(request);
        await offersArchiveDailyDeal(parseId(request.params.id), actor);
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/offers/daily-deals/:id/archive',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        return await offersArchiveDailyDeal(parseId(request.params.id), actor);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/offers/daily-deals/:id/duplicate',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        return await offersDuplicateDailyDeal(parseId(request.params.id), actor);
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
      requireMutateActor(request);
      return await offersCreateCombo(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>('/api/offers/combos/:id', async (request, reply) => {
    try {
      requireMutateActor(request);
      return await offersUpdateCombo(parseId(request.params.id), request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.delete<{ Params: { id: string } }>(
    '/api/offers/combos/:id',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        await offersArchiveCombo(parseId(request.params.id), actor);
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/offers/combos/:id/archive',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        return await offersArchiveCombo(parseId(request.params.id), actor);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/offers/combos/:id/duplicate',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        return await offersDuplicateCombo(parseId(request.params.id), actor);
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
      requireMutateActor(request);
      return await offersCreateScheduledOffer(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(
    '/api/offers/scheduled/:id',
    async (request, reply) => {
      try {
        requireMutateActor(request);
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
        const actor = requireMutateActor(request);
        await offersArchiveScheduledOffer(parseId(request.params.id), actor);
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/offers/scheduled/:id/archive',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        return await offersArchiveScheduledOffer(parseId(request.params.id), actor);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/offers/scheduled/:id/duplicate',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        return await offersDuplicateScheduledOffer(parseId(request.params.id), actor);
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
      requireMutateActor(request);
      return await offersCreateHappyHour(request.body);
    } catch (error) {
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });

  app.put<{ Params: { id: string } }>(
    '/api/offers/happy-hour/:id',
    async (request, reply) => {
      try {
        requireMutateActor(request);
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
        const actor = requireMutateActor(request);
        await offersArchiveHappyHour(parseId(request.params.id), actor);
        return { success: true };
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/offers/happy-hour/:id/archive',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        return await offersArchiveHappyHour(parseId(request.params.id), actor);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    '/api/offers/happy-hour/:id/duplicate',
    async (request, reply) => {
      try {
        const actor = requireMutateActor(request);
        return await offersDuplicateHappyHour(parseId(request.params.id), actor);
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
        requireMutateActor(request);
        const productId = request.body?.product_id ?? request.body?.productId;
        return await offersSetFeatured(productId!, true);
      } catch (error) {
        sendRouteError(reply, error, `${request.method} ${request.url}`);
      }
    },
  );
}
