/**
 * Items and categories HTTP routes.
 */
import express from 'express';
import multer from 'multer';
import { getService } from '../../init/backend-loader';
import { ItemsService, OffersService, CategoriesService, UploadService } from '../../init/backend-loader';
import type { RouteContext } from '../types';

export function registerItemsRoutes(ctx: RouteContext) {
  const { app, asyncHandler } = ctx;

  app.post('/items/upload', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const upload = multer({
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req: any, file: any, cb: any) => {
        if (!file.mimetype || !file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          return cb(new Error('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    });
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        console.error('[HTTP] Upload error:', err);
        return res.status(400).json({ error: err.message || 'فشل رفع الصورة' });
      }
      next();
    });
  }, asyncHandler(async (req: express.Request, res: express.Response) => {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });
    const uploadService = getService(UploadService);
    const imageUrl = await uploadService.saveFile(file);
    res.json({ imageUrl });
  }));

  app.get('/items', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    const offersService = getService(OffersService);
    const kitchen_id = req.query.kitchen_id ? parseInt(req.query.kitchen_id as string) : undefined;
    const items = await itemsService.findAll(kitchen_id);
    const enriched = await offersService.enrichItemsWithOffers(items);
    res.json(enriched);
  }));

  app.get('/items/:id', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    const item = await itemsService.findOne(parseInt(req.params.id));
    res.json(item);
  }));

  app.post('/items', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    const item = await itemsService.create(req.body);
    res.json(item);
  }));

  app.put('/items/:id', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    const item = await itemsService.update(parseInt(req.params.id), req.body);
    res.json(item);
  }));

  app.delete('/items/:id', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    await itemsService.remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/api/items', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    const offersService = getService(OffersService);
    const kitchen_id = req.query.kitchen_id ? parseInt(req.query.kitchen_id as string) : undefined;
    const items = await itemsService.findAll(kitchen_id);
    const enriched = await offersService.enrichItemsWithOffers(items);
    res.json(enriched);
  }));

  app.get('/api/items/:id', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    const item = await itemsService.findOne(parseInt(req.params.id));
    res.json(item);
  }));

  app.post('/api/items', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    const item = await itemsService.create(req.body);
    res.json(item);
  }));

  app.put('/api/items/:id', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    const item = await itemsService.update(parseInt(req.params.id), req.body);
    res.json(item);
  }));

  app.delete('/api/items/:id', asyncHandler(async (req, res) => {
    const itemsService = getService(ItemsService);
    await itemsService.remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/categories', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    const categories = await categoriesService.findAll();
    res.json(categories);
  }));

  app.put('/categories/reorder', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    await categoriesService.reorder(req.body?.ids ?? []);
    res.json({ success: true });
  }));

  app.get('/categories/:id', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    const category = await categoriesService.findOne(parseInt(req.params.id));
    res.json(category);
  }));

  app.post('/categories', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    const category = await categoriesService.create(req.body);
    res.json(category);
  }));

  app.put('/categories/:id', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    const category = await categoriesService.update(parseInt(req.params.id), req.body);
    res.json(category);
  }));

  app.delete('/categories/:id', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    await categoriesService.remove(parseInt(req.params.id));
    res.json({ success: true });
  }));

  app.get('/api/categories', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    const categories = await categoriesService.findAll();
    res.json(categories);
  }));

  app.put('/api/categories/reorder', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    await categoriesService.reorder(req.body?.ids ?? []);
    res.json({ success: true });
  }));

  app.get('/api/categories/:id', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    const category = await categoriesService.findOne(parseInt(req.params.id));
    res.json(category);
  }));

  app.post('/api/categories', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    const category = await categoriesService.create(req.body);
    res.json(category);
  }));

  app.put('/api/categories/:id', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    const category = await categoriesService.update(parseInt(req.params.id), req.body);
    res.json(category);
  }));

  app.delete('/api/categories/:id', asyncHandler(async (req, res) => {
    const categoriesService = getService(CategoriesService);
    await categoriesService.remove(parseInt(req.params.id));
    res.json({ success: true });
  }));
}
