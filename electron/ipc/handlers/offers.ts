/**
 * IPC handlers: offers (RBAC on mutate).
 * Archive/duplicate go through backend-loader (same initialized OffersService instance).
 */
import { ipcMain, type IpcMainInvokeEvent } from 'electron';
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
import {
  requireOffersManager,
  stripActorArgs,
  type SufraActor,
} from '../../shared/offers/offers-rbac';

type EventWithActor = IpcMainInvokeEvent & { __sufraActor?: SufraActor | null };

/**
 * Actor is appended by preload, then usually stripped by patchIpcMainHandleForActivityLogging
 * onto event.__sufraActor — so we must read both places.
 */
function resolveActor(event: IpcMainInvokeEvent, args: unknown[]): {
  clean: unknown[];
  actor: SufraActor | null;
} {
  const { clean, actor: fromArgs } = stripActorArgs(args);
  if (fromArgs) return { clean, actor: fromArgs };
  const fromEvent = (event as EventWithActor).__sufraActor;
  if (fromEvent && typeof fromEvent === 'object') {
    return {
      clean,
      actor: {
        __sufraActor: true,
        id: fromEvent.id,
        username: fromEvent.username,
        role: fromEvent.role,
      },
    };
  }
  return { clean, actor: null };
}

function withManagerMutate(handler: (actor: SufraActor, ...clean: any[]) => Promise<any>) {
  return async (event: IpcMainInvokeEvent, ...args: any[]) => {
    const { clean, actor } = resolveActor(event, args);
    const mgr = requireOffersManager(actor);
    return handler(mgr, ...clean);
  };
}

export function registerOffersHandlers() {
  ipcMain.handle('offers:dailyDeals', async () => offersGetAllDailyDeals());
  ipcMain.handle(
    'offers:createDailyDeal',
    withManagerMutate(async (_actor, data) => offersCreateDailyDeal(data)),
  );
  ipcMain.handle(
    'offers:updateDailyDeal',
    withManagerMutate(async (_actor, id, data) => offersUpdateDailyDeal(id, data)),
  );
  ipcMain.handle(
    'offers:deleteDailyDeal',
    withManagerMutate(async (actor, id) => offersArchiveDailyDeal(id, actor)),
  );
  ipcMain.handle(
    'offers:archiveDailyDeal',
    withManagerMutate(async (actor, id) => offersArchiveDailyDeal(id, actor)),
  );
  ipcMain.handle(
    'offers:duplicateDailyDeal',
    withManagerMutate(async (actor, id) => offersDuplicateDailyDeal(id, actor)),
  );

  ipcMain.handle('offers:combos', async () => offersGetAllCombos());
  ipcMain.handle(
    'offers:createCombo',
    withManagerMutate(async (_actor, data) => offersCreateCombo(data)),
  );
  ipcMain.handle(
    'offers:updateCombo',
    withManagerMutate(async (_actor, id, data) => offersUpdateCombo(id, data)),
  );
  ipcMain.handle(
    'offers:deleteCombo',
    withManagerMutate(async (actor, id) => offersArchiveCombo(id, actor)),
  );
  ipcMain.handle(
    'offers:archiveCombo',
    withManagerMutate(async (actor, id) => offersArchiveCombo(id, actor)),
  );
  ipcMain.handle(
    'offers:duplicateCombo',
    withManagerMutate(async (actor, id) => offersDuplicateCombo(id, actor)),
  );

  ipcMain.handle('offers:scheduledOffers', async () => offersGetAllScheduledOffers());
  ipcMain.handle(
    'offers:createScheduledOffer',
    withManagerMutate(async (_actor, data) => offersCreateScheduledOffer(data)),
  );
  ipcMain.handle(
    'offers:updateScheduledOffer',
    withManagerMutate(async (_actor, id, data) => offersUpdateScheduledOffer(id, data)),
  );
  ipcMain.handle(
    'offers:deleteScheduledOffer',
    withManagerMutate(async (actor, id) => offersArchiveScheduledOffer(id, actor)),
  );
  ipcMain.handle(
    'offers:archiveScheduledOffer',
    withManagerMutate(async (actor, id) => offersArchiveScheduledOffer(id, actor)),
  );
  ipcMain.handle(
    'offers:duplicateScheduledOffer',
    withManagerMutate(async (actor, id) => offersDuplicateScheduledOffer(id, actor)),
  );

  ipcMain.handle('offers:happyHour', async () => offersGetAllHappyHours());
  ipcMain.handle(
    'offers:createHappyHour',
    withManagerMutate(async (_actor, data) => offersCreateHappyHour(data)),
  );
  ipcMain.handle(
    'offers:updateHappyHour',
    withManagerMutate(async (_actor, id, data) => offersUpdateHappyHour(id, data)),
  );
  ipcMain.handle(
    'offers:deleteHappyHour',
    withManagerMutate(async (actor, id) => offersArchiveHappyHour(id, actor)),
  );
  ipcMain.handle(
    'offers:archiveHappyHour',
    withManagerMutate(async (actor, id) => offersArchiveHappyHour(id, actor)),
  );
  ipcMain.handle(
    'offers:duplicateHappyHour',
    withManagerMutate(async (actor, id) => offersDuplicateHappyHour(id, actor)),
  );

  ipcMain.handle('offers:featuredItems', async () => offersGetAllFeaturedItems());
  ipcMain.handle(
    'offers:createFeaturedItem',
    withManagerMutate(async (_actor, data) => {
      const productId = data.product_id ?? data.productId;
      const featured = data.featured === false ? false : true;
      return offersSetFeatured(productId, featured);
    }),
  );
  ipcMain.handle(
    'offers:setFeatured',
    withManagerMutate(async (_actor, productId, featured) => offersSetFeatured(productId, featured)),
  );
  ipcMain.handle('offers:deleteFeaturedItem', async () => {
    throw new Error('deleteFeaturedItem requires product_id. Use setFeatured(product_id, false) instead.');
  });
}
