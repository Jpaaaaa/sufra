/**
 * Item image upload — migrated from electron/http/routes/items.ts (multer → @fastify/multipart)
 */
import { uploadSaveFile } from '../../../init/backend-loader';
import type { FastifyRouteContext } from '../../types';
import { sendRouteError } from '../../errors';
import { isAllowedImageMime, toUploadFile } from './helpers';

export function registerItemUploadRoutes(ctx: FastifyRouteContext): void {
  const { app } = ctx;

  app.post('/items/upload', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }
      if (!isAllowedImageMime(data.mimetype)) {
        return reply.status(400).send({ error: 'Only image files are allowed' });
      }
      const buffer = await data.toBuffer();
      const imageUrl = await uploadSaveFile(
        toUploadFile(data.filename, buffer) as never,
      );
      return { imageUrl };
    } catch (error) {
      console.error('[FASTIFY] Upload error:', error);
      const message =
        error instanceof Error ? error.message : 'فشل رفع الصورة';
      if (!reply.sent) {
        return reply.status(400).send({ error: message });
      }
      sendRouteError(reply, error, `${request.method} ${request.url}`);
    }
  });
}
