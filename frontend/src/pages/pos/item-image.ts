import type { Item } from '../../hooks/useItems';
import { getServerUrl } from '../../utils';

export function posItemImageSrc(item: Item): string | null {
  const url = item.image_url?.trim();
  if (!url) return null;
  return url.startsWith('/uploads/') ? `${getServerUrl()}${url}` : url;
}
