import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { getSeriesDetail } from '../services/scanner.js';

export async function seriesRoutes(app: FastifyInstance, db: Database.Database) {
  app.get('/api/series/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const detail = getSeriesDetail(db, Number(id));
    if (!detail) return reply.status(404).send({ error: 'Série não encontrada' });
    return detail;
  });

  app.post('/api/series/:id/favorite', async (request) => {
    const { id } = request.params as { id: string };
    const seriesId = Number(id);
    const exists = db.prepare('SELECT 1 FROM favorites WHERE series_id = ?').get(seriesId);
    if (exists) {
      db.prepare('DELETE FROM favorites WHERE series_id = ?').run(seriesId);
      return { favorite: false };
    }
    db.prepare('INSERT INTO favorites (series_id) VALUES (?)').run(seriesId);
    return { favorite: true };
  });

  app.post('/api/series/:id/tags', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { tagName } = request.body as { tagName?: string };
    if (!tagName?.trim()) return reply.status(400).send({ error: 'tagName obrigatório' });

    const seriesId = Number(id);
    let tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName.trim()) as { id: number } | undefined;
    if (!tag) {
      const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(tagName.trim());
      tag = { id: Number(result.lastInsertRowid) };
    }
    db.prepare('INSERT OR IGNORE INTO series_tags (series_id, tag_id) VALUES (?, ?)').run(seriesId, tag.id);
    return { ok: true };
  });

  app.delete('/api/series/:id/tags/:tagId', async (request) => {
    const { id, tagId } = request.params as { id: string; tagId: string };
    db.prepare('DELETE FROM series_tags WHERE series_id = ? AND tag_id = ?').run(Number(id), Number(tagId));
    return { ok: true };
  });
}
