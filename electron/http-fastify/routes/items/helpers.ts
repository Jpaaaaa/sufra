/** Shared helpers for items/categories Fastify routes. */
import { itemsFindAll, offersEnrichItemsWithOffers } from '../../../init/backend-loader';

export function parseId(value: string): number {
  return parseInt(value, 10);
}

const IMAGE_MIME = /\/(jpg|jpeg|png|gif|webp)$/;

export function isAllowedImageMime(mimetype: string | undefined): boolean {
  return !!mimetype && IMAGE_MIME.test(mimetype);
}

/** Shape expected by saveFile (Express.Multer.File subset). */
export function toUploadFile(originalname: string, buffer: Buffer) {
  return { originalname, buffer };
}

export async function listItemsWithOffers(kitchenId?: number) {
  const items = await itemsFindAll(kitchenId);
  return offersEnrichItemsWithOffers(items);
}
