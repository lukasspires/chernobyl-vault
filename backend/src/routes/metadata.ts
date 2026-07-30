import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { COVERS_DIR } from '../config.js';
import { applyMetadata, searchComicVine, searchMal } from '../services/metadata.js';

export async function metadataRoutes(app: FastifyInstance, db: Database.Database) {
  app.get('/api/metadata/search', async (request, reply) => {
    const q = request.query as { q?: string; source?: string };
    if (!q.q?.trim()) return reply.status(400).send({ error: 'q obrigatório' });

    try {
      if (q.source === 'comicvine') {
        return await searchComicVine(db, q.q.trim());
      }
      return await searchMal(db, q.q.trim());
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Erro na busca' });
    }
  });

  app.post('/api/series/:id/metadata', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { source, externalId } = request.body as { source?: string; externalId?: number };
    if (!source || !externalId) {
      return reply.status(400).send({ error: 'source e externalId obrigatórios' });
    }
    if (source !== 'mal' && source !== 'comicvine') {
      return reply.status(400).send({ error: 'source inválido' });
    }

    try {
      await applyMetadata(db, Number(id), source, externalId, COVERS_DIR);
      return { ok: true };
    } catch (err) {
      return reply.status(400).send({ error: err instanceof Error ? err.message : 'Erro ao aplicar metadados' });
    }
  });
}
