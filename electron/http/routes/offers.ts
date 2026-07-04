/**
 * Offers HTTP routes.
 */
import { getService } from '../../init/backend-loader';
import { OffersService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerOffersRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.get('/offers/daily-deals', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllDailyDeals());
  }));
  app.get('/offers/combos', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllCombos());
  }));
  app.get('/offers/featured-items', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllFeaturedItems());
  }));
  app.get('/offers/scheduled-offers', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllScheduledOffers());
  }));
  app.get('/offers/happy-hour', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllHappyHours());
  }));

  app.get('/api/offers/daily-deals', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllDailyDeals());
  }));
  app.post('/api/offers/daily-deals', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).createDailyDeal(req.body));
  }));
  app.put('/api/offers/daily-deals/:id', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).updateDailyDeal(parseInt(req.params.id), req.body));
  }));
  app.put('/offers/daily-deals/:id', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).updateDailyDeal(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/offers/daily-deals/:id', asyncHandler(async (req, res) => {
    await getService(OffersService).deleteDailyDeal(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.get('/api/offers/combos', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllCombos());
  }));
  app.post('/api/offers/combos', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).createCombo(req.body));
  }));
  app.put('/api/offers/combos/:id', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).updateCombo(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/offers/combos/:id', asyncHandler(async (req, res) => {
    await getService(OffersService).deleteCombo(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.get('/api/offers/scheduled', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllScheduledOffers());
  }));
  app.post('/api/offers/scheduled', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).createScheduledOffer(req.body));
  }));
  app.put('/api/offers/scheduled/:id', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).updateScheduledOffer(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/offers/scheduled/:id', asyncHandler(async (req, res) => {
    await getService(OffersService).deleteScheduledOffer(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.get('/api/offers/happy-hour', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllHappyHours());
  }));
  app.post('/api/offers/happy-hour', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).createHappyHour(req.body));
  }));
  app.put('/api/offers/happy-hour/:id', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).updateHappyHour(parseInt(req.params.id), req.body));
  }));
  app.delete('/api/offers/happy-hour/:id', asyncHandler(async (req, res) => {
    await getService(OffersService).deleteHappyHour(parseInt(req.params.id));
    res.json({ success: true });
  }));
  app.get('/api/offers/featured', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).getAllFeaturedItems());
  }));
  app.post('/api/offers/featured', asyncHandler(async (req, res) => {
    res.json(await getService(OffersService).setFeatured(req.body.product_id || req.body.productId, true));
  }));
}
