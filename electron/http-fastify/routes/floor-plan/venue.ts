/**
 * Venue routes (halls, floors, kitchens) — migrated from electron/http/routes/venue.ts
 */
import {
  hallsFindAll,
  hallsFindOne,
  hallsCreate,
  hallsUpdate,
  hallsRemove,
  floorsFindAll,
  floorsFindOne,
  floorsCreate,
  floorsUpdate,
  floorsRemove,
  kitchensFindAll,
  kitchensFindOne,
  kitchensCreate,
  kitchensUpdate,
  kitchensRemove,
} from '../../../init/backend-loader';
import type { FastifyRouteContext } from '../../types';
import { registerCrudRoutes } from './crud';
import type { CrudService } from './helpers';

function halls(): CrudService {
  return {
    findAll: hallsFindAll,
    findOne: hallsFindOne,
    create: hallsCreate,
    update: hallsUpdate,
    remove: hallsRemove,
  };
}

function floors(): CrudService {
  return {
    findAll: floorsFindAll,
    findOne: floorsFindOne,
    create: floorsCreate,
    update: floorsUpdate,
    remove: floorsRemove,
  };
}

function kitchens(): CrudService {
  return {
    findAll: kitchensFindAll,
    findOne: kitchensFindOne,
    create: kitchensCreate,
    update: kitchensUpdate,
    remove: kitchensRemove,
  };
}

export function registerVenueRoutes(ctx: FastifyRouteContext): void {
  for (const prefix of ['/halls', '/api/halls']) {
    registerCrudRoutes(ctx, prefix, halls);
  }
  for (const prefix of ['/floors', '/api/floors']) {
    registerCrudRoutes(ctx, prefix, floors);
  }
  for (const prefix of ['/kitchens', '/api/kitchens']) {
    registerCrudRoutes(ctx, prefix, kitchens);
  }
}
