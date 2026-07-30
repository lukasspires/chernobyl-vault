import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { extractPage } from '../services/parser.js';
import type { FileFormat } from '../services/parser.js';

export async function readerRoutes(app: FastifyInstance, db: Database.Database) {
  app.get('/api/chapters/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(id));
    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });

    const progress = db.prepare('SELECT page FROM reading_progress WHERE chapter_id = ?').get(Number(id)) as { page: number } | undefined;
    return { ...chapter, progress_page: progress?.page ?? 0 };
  });

  app.get('/api/chapters/:id/pages/:page', async (request, reply) => {
    const { id, page } = request.params as { id: string; page: string };
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(Number(id)) as {
      file_path: string;
      format: FileFormat;
      page_count: number;
    } | undefined;

    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });

    const pageNum = Number(page);
    if (pageNum < 0 || pageNum >= chapter.page_count) {
      return reply.status(404).send({ error: 'Página não encontrada' });
    }

    try {
      const buffer = await extractPage(chapter.file_path, chapter.format, pageNum);
      reply.header('Content-Type', 'image/jpeg');
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(buffer);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'Erro ao extrair página' });
    }
  });

  app.get('/api/covers/:seriesId', async (request, reply) => {
    const { seriesId } = request.params as { seriesId: string };
    const series = db.prepare('SELECT cover_path FROM series WHERE id = ?').get(Number(seriesId)) as { cover_path: string | null } | undefined;
    if (!series?.cover_path || !fs.existsSync(series.cover_path)) {
      return reply.status(404).send({ error: 'Capa não encontrada' });
    }
    reply.header('Content-Type', 'image/jpeg');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(fs.readFileSync(series.cover_path));
  });
}
