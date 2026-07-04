/**
 * IPC handlers: offers.
 */
import { ipcMain } from 'electron';
import { getService, OffersService } from '../../init/backend-loader';

export function registerOffersHandlers() {
  ipcMain.handle('offers:dailyDeals', async () => getService(OffersService).getAllDailyDeals());
  ipcMain.handle('offers:createDailyDeal', async (_, data: any) => getService(OffersService).createDailyDeal(data));
  ipcMain.handle('offers:updateDailyDeal', async (_, id: number, data: any) =>
    getService(OffersService).updateDailyDeal(id, data),
  );
  ipcMain.handle('offers:deleteDailyDeal', async (_, id: number) => getService(OffersService).deleteDailyDeal(id));
  ipcMain.handle('offers:combos', async () => getService(OffersService).getAllCombos());
  ipcMain.handle('offers:createCombo', async (_, data: any) => getService(OffersService).createCombo(data));
  ipcMain.handle('offers:updateCombo', async (_, id: number, data: any) => getService(OffersService).updateCombo(id, data));
  ipcMain.handle('offers:deleteCombo', async (_, id: number) => getService(OffersService).deleteCombo(id));
  ipcMain.handle('offers:scheduledOffers', async () => getService(OffersService).getAllScheduledOffers());
  ipcMain.handle('offers:createScheduledOffer', async (_, data: any) => getService(OffersService).createScheduledOffer(data));
  ipcMain.handle('offers:updateScheduledOffer', async (_, id: number, data: any) => getService(OffersService).updateScheduledOffer(id, data));
  ipcMain.handle('offers:deleteScheduledOffer', async (_, id: number) => getService(OffersService).deleteScheduledOffer(id));
  ipcMain.handle('offers:happyHour', async () => getService(OffersService).getAllHappyHours());
  ipcMain.handle('offers:createHappyHour', async (_, data: any) => getService(OffersService).createHappyHour(data));
  ipcMain.handle('offers:updateHappyHour', async (_, id: number, data: any) => getService(OffersService).updateHappyHour(id, data));
  ipcMain.handle('offers:deleteHappyHour', async (_, id: number) => getService(OffersService).deleteHappyHour(id));
  ipcMain.handle('offers:featuredItems', async () => getService(OffersService).getAllFeaturedItems());
  ipcMain.handle('offers:createFeaturedItem', async (_, data: any) => {
    const productId = data.product_id ?? data.productId;
    const featured = data.featured === false ? false : true;
    return await getService(OffersService).setFeatured(productId, featured);
  });
  ipcMain.handle('offers:setFeatured', async (_, productId: number, featured: boolean) => {
    return await getService(OffersService).setFeatured(productId, featured);
  });
  ipcMain.handle('offers:deleteFeaturedItem', async () => {
    throw new Error('deleteFeaturedItem requires product_id. Use setFeatured(product_id, false) instead.');
  });
}
