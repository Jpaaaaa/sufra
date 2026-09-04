/**
 * Static file serving on Fastify — uploads and production SPA fallback.
 */
import fs from 'fs';
import path from 'path';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import { getStaticFrontendPath } from '../init/paths';
import { ensureUploadsDirectory } from '../http-shared/uploads-path';

const DATA_ENDPOINT_PREFIXES = [
  '/halls',
  '/floors',
  '/tables',
  '/items',
  '/categories',
  '/kitchens',
  '/orders',
  '/reports',
  '/finance',
  '/business-day',
  '/shifts',
  '/shelves',
  '/offers',
  '/auth',
  '/printers',
  '/print',
  '/uploads',
];

const ASSET_EXTENSIONS = [
  '.js',
  '.mjs',
  '.css',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.json',
  '.map',
];

function requestPath(request: FastifyRequest): string {
  return request.url.split('?')[0] ?? request.url;
}

function isDataEndpoint(urlPath: string): boolean {
  return DATA_ENDPOINT_PREFIXES.some(
    (ep) => urlPath === ep || urlPath.startsWith(`${ep}/`),
  );
}

function isAssetPath(urlPath: string): boolean {
  const lower = urlPath.toLowerCase();
  return ASSET_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function registerFastifyStaticRoutes(
  app: FastifyInstance,
): Promise<string | null> {
  const uploadsPath = ensureUploadsDirectory();
  await app.register(fastifyStatic, {
    root: uploadsPath,
    prefix: '/uploads/',
    decorateReply: false,
  });
  console.log('[FASTIFY] ✓ Uploads static serving from:', uploadsPath);

  const staticPath = getStaticFrontendPath();
  if (!fs.existsSync(staticPath)) {
    console.warn('[FASTIFY] ⚠️ Static frontend path not found:', staticPath);
    return null;
  }

  await app.register(fastifyStatic, {
    root: staticPath,
    prefix: '/',
    decorateReply: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    },
  });
  console.log('[FASTIFY] ✓ Static frontend serving from:', staticPath);
  return staticPath;
}

export function sendSpaFallback(
  request: FastifyRequest,
  reply: FastifyReply,
  staticPath: string,
): boolean {
  if (request.method !== 'GET') {
    return false;
  }

  const urlPath = requestPath(request);
  if (
    urlPath.startsWith('/api/') ||
    urlPath.startsWith('/auth/') ||
    isDataEndpoint(urlPath)
  ) {
    return false;
  }

  if (isAssetPath(urlPath)) {
    void reply.status(404).send({ error: 'Asset not found', path: urlPath });
    return true;
  }

  const indexHtml = path.join(staticPath, 'index.html');
  if (fs.existsSync(indexHtml)) {
    void reply.type('text/html').send(fs.readFileSync(indexHtml));
    return true;
  }

  void reply.status(404).send({ error: 'Frontend not found' });
  return true;
}
