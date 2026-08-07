import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyServerOptions } from 'fastify';
import { CORS_ORIGINS, COVERS_DIR, DOWNLOADS_DIR, NODE_ENV } from './config.js';
import { initDb, type Db } from './db/index.js';
import { libraryRoutes } from './routes/library.js';
import { metadataRoutes } from './routes/metadata.js';
import { progressRoutes } from './routes/progress.js';
import { readerRoutes } from './routes/reader.js';
import { seriesRoutes } from './routes/series.js';
import { settingsRoutes } from './routes/settings.js';
import { scraperRoutes } from './routes/scraper.js';
import { MangaScraperService, type ScraperService } from './services/scraper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BuildAppOptions {
  db?: Db;
  coversDir?: string;
  frontendDist?: string;
  serveFrontend?: boolean;
  logger?: FastifyServerOptions['logger'];
  downloadsDir?: string;
  scraperService?: ScraperService;
}

export async function buildApp(options: BuildAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const db = options.db ?? initDb();
  const ownsDb = !options.db;
  const coversDir = options.coversDir ?? COVERS_DIR;

  if (ownsDb) app.addHook('onClose', async () => db.close());

  if (NODE_ENV !== 'production') {
    await app.register(cors, { origin: CORS_ORIGINS });
  }

  app.get('/api/health', async () => ({ ok: true }));
  await libraryRoutes(app, db, coversDir);
  await seriesRoutes(app, db);
  await readerRoutes(app, db);
  await progressRoutes(app, db);
  await metadataRoutes(app, db, coversDir);
  await settingsRoutes(app, db);
  await scraperRoutes(app, db, options.scraperService ?? new MangaScraperService(), options.downloadsDir ?? DOWNLOADS_DIR, coversDir);

  const frontendDist = options.frontendDist ?? path.resolve(__dirname, '../../frontend/dist');
  if (options.serveFrontend !== false && fs.existsSync(frontendDist)) {
    await app.register(fastifyStatic, { root: frontendDist, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.url.startsWith('/api/')) return reply.status(404).send({ error: 'Not found' });
      return reply.sendFile('index.html');
    });
  } else if (options.serveFrontend !== false) {
    app.log.warn('Frontend dist not found — API only mode');
  }

  return app;
}
