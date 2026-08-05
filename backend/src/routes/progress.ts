import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

function parsePositiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function recordHistory(db: Database.Database, chapterId: number, page: number) {
  const updated = db.prepare(`
    UPDATE history SET page = ?, read_at = datetime('now')
    WHERE id = (SELECT id FROM history WHERE chapter_id = ? ORDER BY read_at DESC, id DESC LIMIT 1)
  `).run(page, chapterId);
  if (updated.changes === 0) {
    db.prepare('INSERT INTO history (chapter_id, page) VALUES (?, ?)').run(chapterId, page);
  }
}

export async function progressRoutes(app: FastifyInstance, db: Database.Database) {
  app.get('/api/progress/:chapterId', async (request, reply) => {
    const { chapterId } = request.params as { chapterId: string };
    const id = parsePositiveInteger(chapterId);
    if (id === null) return reply.status(400).send({ error: 'chapterId inválido' });
    const chapter = db.prepare('SELECT id FROM chapters WHERE id = ?').get(id);
    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });
    const row = db.prepare('SELECT page, updated_at FROM reading_progress WHERE chapter_id = ?').get(id);
    return row ?? { page: 0 };
  });

  app.put('/api/progress/:chapterId', async (request, reply) => {
    const { chapterId } = request.params as { chapterId: string };
    const id = parsePositiveInteger(chapterId);
    if (id === null) return reply.status(400).send({ error: 'chapterId inválido' });
    const body = request.body as { page?: unknown };
    const chapter = db.prepare('SELECT id, page_count FROM chapters WHERE id = ?').get(id) as { id: number; page_count: number } | undefined;
    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });
    if (!Number.isInteger(body?.page) || (body.page as number) < 0 || (body.page as number) >= chapter.page_count) {
      return reply.status(400).send({ error: 'page inválido' });
    }
    const page = body.page as number;

    db.transaction(() => {
      db.prepare(`
        INSERT INTO reading_progress (chapter_id, page, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(chapter_id) DO UPDATE SET page = excluded.page, updated_at = excluded.updated_at
      `).run(id, page);
      recordHistory(db, id, page);
    })();

    return { ok: true, page };
  });

  app.post('/api/progress/:chapterId/complete', async (request, reply) => {
    const { chapterId } = request.params as { chapterId: string };
    const id = parsePositiveInteger(chapterId);
    if (id === null) return reply.status(400).send({ error: 'chapterId inválido' });
    const chapter = db.prepare('SELECT id, page_count FROM chapters WHERE id = ?').get(id) as { id: number; page_count: number } | undefined;
    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });
    if (chapter.page_count <= 0) return reply.status(400).send({ error: 'Capítulo sem páginas' });

    const lastPage = chapter.page_count - 1;
    db.transaction(() => {
      db.prepare(`
        INSERT INTO reading_progress (chapter_id, page, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(chapter_id) DO UPDATE SET page = excluded.page, updated_at = excluded.updated_at
      `).run(chapter.id, lastPage);
      recordHistory(db, chapter.id, lastPage);
    })();
    return { ok: true };
  });

  app.get('/api/history', async () => db.prepare(`
    SELECT h.id, h.page, h.read_at,
      c.id AS chapter_id, c.title AS chapter_title, c.page_count,
      s.id AS series_id, s.title AS series_title, s.type
    FROM history h
    JOIN chapters c ON c.id = h.chapter_id
    JOIN series s ON s.id = c.series_id
    ORDER BY h.read_at DESC
    LIMIT 50
  `).all());
}
