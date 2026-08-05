import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { COVERS_DIR } from '../config.js';
import { getSeriesList, scanLibrary } from '../services/scanner.js';

export async function libraryRoutes(app: FastifyInstance, db: Database.Database, coversDir = COVERS_DIR) {
  app.get('/api/library', async (request) => {
    const q = request.query as {
      search?: string;
      type?: string;
      tag?: string;
      favorite?: string;
    };

    return getSeriesList(db, {
      search: q.search,
      type: q.type,
      tag: q.tag,
      favorite: q.favorite === 'true',
    });
  });

  app.post('/api/library/scan', async () => {
    const result = await scanLibrary(db, coversDir);
    return { ok: true, ...result };
  });
}
