import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

export async function progressRoutes(app: FastifyInstance, db: Database.Database) {
  app.get('/api/progress/:chapterId', async (request, reply) => {
    const { chapterId } = request.params as { chapterId: string };
    const row = db.prepare('SELECT page, updated_at FROM reading_progress WHERE chapter_id = ?').get(Number(chapterId));
    if (!row) return { page: 0 };
    return row;
  });

  app.put('/api/progress/:chapterId', async (request, reply) => {
    const { chapterId } = request.params as { chapterId: string };
    const { page } = request.body as { page?: number };
    if (page === undefined || page < 0) {
      return reply.status(400).send({ error: 'page inválido' });
    }

    const chapter = db.prepare('SELECT id, page_count FROM chapters WHERE id = ?').get(Number(chapterId));
    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });

    db.prepare(`
      INSERT INTO reading_progress (chapter_id, page, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(chapter_id) DO UPDATE SET page = excluded.page, updated_at = excluded.updated_at
    `).run(Number(chapterId), page);

    db.prepare('INSERT INTO history (chapter_id, page) VALUES (?, ?)').run(Number(chapterId), page);

    return { ok: true, page };
  });

  app.post('/api/progress/:chapterId/complete', async (request, reply) => {
    const { chapterId } = request.params as { chapterId: string };
    const chapter = db.prepare('SELECT id, page_count FROM chapters WHERE id = ?').get(Number(chapterId)) as { id: number; page_count: number } | undefined;
    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });

    const lastPage = Math.max(0, chapter.page_count - 1);
    db.prepare(`
      INSERT INTO reading_progress (chapter_id, page, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(chapter_id) DO UPDATE SET page = excluded.page, updated_at = excluded.updated_at
    `).run(chapter.id, lastPage);

    db.prepare('INSERT INTO history (chapter_id, page) VALUES (?, ?)').run(chapter.id, lastPage);
    return { ok: true };
  });

  app.get('/api/history', async () => {
    return db.prepare(`
      SELECT h.id, h.page, h.read_at,
        c.id AS chapter_id, c.title AS chapter_title, c.page_count,
        s.id AS series_id, s.title AS series_title, s.type
      FROM history h
      JOIN chapters c ON c.id = h.chapter_id
      JOIN series s ON s.id = c.series_id
      ORDER BY h.read_at DESC
      LIMIT 50
    `).all();
  });
}
