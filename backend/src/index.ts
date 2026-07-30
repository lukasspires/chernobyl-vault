import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { HOST, PORT } from './config.js';
import { initDb } from './db/index.js';
import { libraryRoutes } from './routes/library.js';
import { seriesRoutes } from './routes/series.js';
import { readerRoutes } from './routes/reader.js';
import { progressRoutes } from './routes/progress.js';
import { metadataRoutes } from './routes/metadata.js';
import { settingsRoutes } from './routes/settings.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

const app = Fastify({ logger: true });
const db = initDb();

await app.register(cors, { origin: true });

await libraryRoutes(app, db);
await seriesRoutes(app, db);
await readerRoutes(app, db);
await progressRoutes(app, db);
await metadataRoutes(app, db);
await settingsRoutes(app, db);

try {
  await app.register(fastifyStatic, {
    root: frontendDist,
    prefix: '/',
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) {
      return reply.status(404).send({ error: 'Not found' });
    }
    return reply.sendFile('index.html');
  });
} catch {
  app.log.warn('Frontend dist not found — API only mode');
}

app.get('/api/health', async () => ({ ok: true }));

await app.listen({ port: PORT, host: HOST });
console.log(`Manga Reader API running at http://${HOST}:${PORT}`);
