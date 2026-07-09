/**
 * IPC handlers: offers.
 */
import { ipcMain } from 'electron';
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

export function registerOffersHandlers() {
  ipcMain.handle('offers:dailyDeals', async () => offersGetAllDailyDeals());
  ipcMain.handle('offers:createDailyDeal', async (_, data: any) => offersCreateDailyDeal(data));
  ipcMain.handle('offers:updateDailyDeal', async (_, id: number, data: any) =>
    offersUpdateDailyDeal(id, data),
  );
  ipcMain.handle('offers:deleteDailyDeal', async (_, id: number) => offersDeleteDailyDeal(id));
  ipcMain.handle('offers:combos', async () => offersGetAllCombos());
  ipcMain.handle('offers:createCombo', async (_, data: any) => offersCreateCombo(data));
  ipcMain.handle('offers:updateCombo', async (_, id: number, data: any) =>
    offersUpdateCombo(id, data),
  );
  ipcMain.handle('offers:deleteCombo', async (_, id: number) => offersDeleteCombo(id));
  ipcMain.handle('offers:scheduledOffers', async () => offersGetAllScheduledOffers());
  ipcMain.handle('offers:createScheduledOffer', async (_, data: any) =>
    offersCreateScheduledOffer(data),
  );
  ipcMain.handle('offers:updateScheduledOffer', async (_, id: number, data: any) =>
    offersUpdateScheduledOffer(id, data),
  );
  ipcMain.handle('offers:deleteScheduledOffer', async (_, id: number) =>
    offersDeleteScheduledOffer(id),
  );
  ipcMain.handle('offers:happyHour', async () => offersGetAllHappyHours());
  ipcMain.handle('offers:createHappyHour', async (_, data: any) => offersCreateHappyHour(data));
  ipcMain.handle('offers:updateHappyHour', async (_, id: number, data: any) =>
    offersUpdateHappyHour(id, data),
  );
  ipcMain.handle('offers:deleteHappyHour', async (_, id: number) => offersDeleteHappyHour(id));
  ipcMain.handle('offers:featuredItems', async () => offersGetAllFeaturedItems());
  ipcMain.handle('offers:createFeaturedItem', async (_, data: any) => {
    const productId = data.product_id ?? data.productId;
    const featured = data.featured === false ? false : true;
    return offersSetFeatured(productId, featured);
  });
  ipcMain.handle('offers:setFeatured', async (_, productId: number, featured: boolean) =>
    offersSetFeatured(productId, featured),
  );
  ipcMain.handle('offers:deleteFeaturedItem', async () => {
    throw new Error('deleteFeaturedItem requires product_id. Use setFeatured(product_id, false) instead.');
  });
}
