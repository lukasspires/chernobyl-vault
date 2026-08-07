import path from 'node:path';
import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { DownloadManager } from '../services/downloadManager.js';
import type { RemoteChapter, RemoteManga, ScraperService, SearchFilters } from '../services/scraper.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES = new Set(['mangadex', 'html']);

function strings(value: unknown, limit = 20): string[] {
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, limit);
  return [];
}

function number(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function validManga(value: unknown): value is RemoteManga {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const manga = value as Record<string, unknown>;
  return SOURCES.has(String(manga.source)) && typeof manga.sourceId === 'string' && manga.sourceId.length <= 2048
    && typeof manga.sourceUrl === 'string' && typeof manga.title === 'string' && manga.title.trim().length > 0 && manga.title.length <= 300
    && typeof manga.description === 'string' && manga.description.length <= 100_000
    && Array.isArray(manga.tags) && manga.tags.length <= 100 && manga.tags.every((tag) => typeof tag === 'string' && tag.length <= 200)
    && (manga.coverUrl === null || typeof manga.coverUrl === 'string');
}

function validChapter(value: unknown): value is RemoteChapter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const chapter = value as Record<string, unknown>;
  return SOURCES.has(String(chapter.source)) && typeof chapter.sourceId === 'string' && chapter.sourceId.length <= 2048
    && typeof chapter.title === 'string' && chapter.title.length > 0 && chapter.title.length <= 500
    && typeof chapter.url === 'string' && chapter.url.length <= 2048;
}

export async function scraperRoutes(
  app: FastifyInstance,
  db: Database.Database,
  service: ScraperService,
  downloadsDir: string,
  coversDir: string,
) {
  const manager = new DownloadManager(service, db, path.resolve(downloadsDir), coversDir);
  app.addHook('onClose', async () => manager.cancelAll());

  app.get('/api/scraper/search', async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const year = query.year === undefined ? undefined : number(query.year, Number.NaN);
    if (year !== undefined && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1)) {
      return reply.status(400).send({ error: 'Ano inválido' });
    }
    const filters: SearchFilters = {
      query: typeof query.q === 'string' ? query.q.slice(0, 200) : '', limit: number(query.limit, 20), offset: number(query.offset, 0), year,
      includedTags: strings(query.tags), statuses: strings(query.statuses), demographics: strings(query.demographics),
      originalLanguages: strings(query.originalLanguages), contentRatings: strings(query.contentRatings, 4),
      order: typeof query.order === 'string' ? query.order : undefined,
    };
    if (!Number.isInteger(filters.limit) || filters.limit! < 1 || filters.limit! > 100 || !Number.isInteger(filters.offset) || filters.offset! < 0) {
      return reply.status(400).send({ error: 'Paginação inválida' });
    }
    try { return await service.searchManga(filters, request.signal); }
    catch { request.log.warn('Remote manga search failed'); return reply.status(502).send({ error: 'Não foi possível consultar o catálogo remoto' }); }
  });

  app.get('/api/scraper/tags', async (request, reply) => {
    try { return await service.listTags(request.signal); }
    catch { request.log.warn('Remote manga tags failed'); return reply.status(502).send({ error: 'Não foi possível carregar as tags remotas' }); }
  });

  app.get('/api/scraper/manga/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!UUID.test(id)) return reply.status(400).send({ error: 'ID da obra inválido' });
    const preferred = strings((request.query as Record<string, unknown>).languages, 10);
    try { return await service.getManga(id, preferred, request.signal); }
    catch { request.log.warn('Remote manga details failed'); return reply.status(502).send({ error: 'Não foi possível carregar a obra remota' }); }
  });

  app.get('/api/scraper/manga/:id/chapters', async (request, reply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, unknown>;
    const languages = strings(query.languages, 10);
    const page = number(query.page, 1);
    const limit = number(query.limit, 50);
    if (!UUID.test(id) || languages.length === 0 || !Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
      return reply.status(400).send({ error: 'Parâmetros de capítulos inválidos' });
    }
    try { return await service.getMangaChapters(id, languages, page, limit, request.signal); }
    catch { request.log.warn('Remote manga chapters failed'); return reply.status(502).send({ error: 'Não foi possível carregar os capítulos remotos' }); }
  });

  app.post('/api/scraper/analyze', async (request, reply) => {
    const body = request.body as { url?: unknown } | null;
    if (!body || typeof body.url !== 'string' || body.url.length > 2048) return reply.status(400).send({ error: 'URL inválida' });
    try { return await service.analyzeUrl(body.url, request.signal); }
    catch (error) {
      request.log.warn('Remote reader analysis failed');
      const message = error instanceof Error && /privado|URL|HTTP\(S\)/i.test(error.message) ? error.message : 'Não foi possível analisar o leitor remoto';
      return reply.status(400).send({ error: message });
    }
  });

  app.post('/api/scraper/downloads', async (request, reply) => {
    const body = request.body as { manga?: unknown; chapters?: unknown; dataSaver?: unknown } | null;
    if (!body || !validManga(body.manga) || !Array.isArray(body.chapters) || !body.chapters.every(validChapter) || typeof body.dataSaver !== 'boolean') {
      return reply.status(400).send({ error: 'Download inválido' });
    }
    try { return reply.status(202).send(manager.start(body.manga, body.chapters, body.dataSaver)); }
    catch (error) { return reply.status(400).send({ error: error instanceof Error ? error.message : 'Download inválido' }); }
  });

  app.get('/api/scraper/downloads', async () => manager.list());

  app.get('/api/scraper/downloads/:id', async (request, reply) => {
    const job = manager.get((request.params as { id: string }).id);
    return job ?? reply.status(404).send({ error: 'Download não encontrado' });
  });

  app.delete('/api/scraper/downloads/:id', async (request, reply) => {
    const job = manager.cancel((request.params as { id: string }).id);
    return job ?? reply.status(404).send({ error: 'Download não encontrado' });
  });
}
