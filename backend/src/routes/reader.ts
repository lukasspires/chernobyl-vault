import fs from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';
import { extractPage } from '../services/parser.js';
import type { FileFormat } from '../services/parser.js';

export async function readerRoutes(app: FastifyInstance, db: Database.Database) {
  app.get('/api/chapters/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const chapterId = Number(id);
    if (!Number.isInteger(chapterId) || chapterId <= 0) {
      return reply.status(400).send({ error: 'id inválido' });
    }
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId);
    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });

    const progress = db.prepare('SELECT page FROM reading_progress WHERE chapter_id = ?').get(chapterId) as { page: number } | undefined;
    return { ...chapter, progress_page: progress?.page ?? 0 };
  });

  app.get('/api/chapters/:id/pages/:page', async (request, reply) => {
    const { id, page } = request.params as { id: string; page: string };
    const chapterId = Number(id);
    const pageNum = Number(page);
    if (!Number.isInteger(chapterId) || chapterId <= 0 || !Number.isInteger(pageNum) || pageNum < 0) {
      return reply.status(400).send({ error: 'Parâmetros inválidos' });
    }
    const chapter = db.prepare('SELECT * FROM chapters WHERE id = ?').get(chapterId) as {
      file_path: string;
      format: FileFormat;
      page_count: number;
    } | undefined;

    if (!chapter) return reply.status(404).send({ error: 'Capítulo não encontrado' });

    if (pageNum >= chapter.page_count) {
      return reply.status(404).send({ error: 'Página não encontrada' });
    }

    try {
      const extracted = await extractPage(chapter.file_path, chapter.format, pageNum);
      reply.header('Content-Type', extracted.mimeType);
      reply.header('Cache-Control', 'public, max-age=86400');
      return reply.send(extracted.buffer);
    } catch (err) {
      app.log.error(err);
      return reply.status(500).send({ error: 'Erro ao extrair página' });
    }
  });

  app.get('/api/covers/:seriesId', async (request, reply) => {
    const { seriesId } = request.params as { seriesId: string };
    const numericSeriesId = Number(seriesId);
    if (!Number.isInteger(numericSeriesId) || numericSeriesId <= 0) {
      return reply.status(400).send({ error: 'id inválido' });
    }
    const series = db.prepare('SELECT cover_path FROM series WHERE id = ?').get(numericSeriesId) as { cover_path: string | null } | undefined;
    if (!series?.cover_path || !fs.existsSync(series.cover_path)) {
      return reply.status(404).send({ error: 'Capa não encontrada' });
    }
    reply.header('Content-Type', 'image/jpeg');
    reply.header('Cache-Control', 'public, max-age=86400');
    return reply.send(fs.readFileSync(series.cover_path));
  });
}
