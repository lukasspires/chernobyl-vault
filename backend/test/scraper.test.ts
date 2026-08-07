import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { MangaScraperService, type RemoteChapter, type RemoteManga, type ScraperService } from '../src/services/scraper.js';
import { createTestDatabase } from './helpers.js';

const MANGA_ID = '11111111-1111-4111-8111-111111111111';
const CHAPTER_ID = '22222222-2222-4222-8222-222222222222';

const manga: RemoteManga = {
  source: 'mangadex', sourceId: MANGA_ID, sourceUrl: `https://mangadex.org/title/${MANGA_ID}`,
  title: 'Test Remote Manga', description: 'Remote description', altTitles: [], authors: ['Author'], artists: [], tags: ['Action'],
  year: 2025, status: 'ongoing', demographic: 'shounen', contentRating: 'safe', originalLanguage: 'ja',
  availableLanguages: ['pt-br'], coverUrl: null, thumbnailUrl: null,
};
const chapter: RemoteChapter = {
  source: 'mangadex', sourceId: CHAPTER_ID, title: 'Capítulo 1 [pt-br]', url: `https://mangadex.org/chapter/${CHAPTER_ID}`,
  language: 'pt-br', group: 'Test Group', number: 1,
};

class FakeScraperService implements ScraperService {
  async searchManga() { return { items: [manga], total: 1 }; }
  async listTags() { return [{ id: 'tag-1', name: 'Ação' }]; }
  async getManga() { return manga; }
  async getMangaChapters() { return { chapters: [chapter], total: 1 }; }
  async analyzeUrl() { return { manga: { ...manga, source: 'html' as const }, chapters: [{ ...chapter, source: 'html' as const }] }; }
  async downloadChapter(_chapter: RemoteChapter, destination: string, options: { onProgress?: (page: number, total: number, skipped: boolean) => void }) {
    const folder = path.join(destination, 'Capítulo 1');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, '001.png'), Buffer.from('image'));
    options.onProgress?.(1, 1, false);
    return { folder, pageCount: 1, downloaded: 1, skipped: 0 };
  }
  async downloadCover() { return Buffer.from('cover'); }
}

async function waitForJob(app: Awaited<ReturnType<typeof buildApp>>, id: string) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = await app.inject({ method: 'GET', url: `/api/scraper/downloads/${id}` });
    const job = response.json();
    if (!['queued', 'running'].includes(job.status)) return job;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error('Download job did not finish');
}

test('scraper routes search, validate and import a completed download', async (t) => {
  const fixture = createTestDatabase();
  t.after(fixture.cleanup);
  const app = await buildApp({
    db: fixture.db, coversDir: path.join(fixture.dataDir, 'covers'), downloadsDir: path.join(fixture.dataDir, 'downloads'),
    scraperService: new FakeScraperService(), serveFrontend: false, logger: false,
  });
  t.after(() => app.close());

  const search = await app.inject({ method: 'GET', url: '/api/scraper/search?q=test&limit=20&offset=0' });
  assert.equal(search.statusCode, 200);
  assert.equal(search.json().items[0].title, manga.title);
  assert.equal((await app.inject({ method: 'GET', url: '/api/scraper/manga/not-a-uuid/chapters?languages=pt-br' })).statusCode, 400);
  assert.equal((await app.inject({ method: 'POST', url: '/api/scraper/downloads', payload: { manga, chapters: [], dataSaver: false } })).statusCode, 400);

  const started = await app.inject({ method: 'POST', url: '/api/scraper/downloads', payload: { manga, chapters: [chapter], dataSaver: true } });
  assert.equal(started.statusCode, 202);
  const job = await waitForJob(app, started.json().id);
  assert.equal(job.status, 'completed');
  assert.equal(job.downloadedPages, 1);
  const imported = fixture.db.prepare(`SELECT s.title AS series_title, c.title, c.page_count
    FROM chapters c JOIN series s ON s.id = c.series_id`).get() as { series_title: string; title: string; page_count: number };
  assert.deepEqual(imported, { series_title: manga.title, title: chapter.title, page_count: 1 });
});

test('download job fails cleanly when its destination cannot be created', async (t) => {
  const fixture = createTestDatabase();
  t.after(fixture.cleanup);
  const blockedParent = path.join(fixture.dataDir, 'blocked');
  fs.writeFileSync(blockedParent, 'not a directory');
  const app = await buildApp({
    db: fixture.db, coversDir: path.join(fixture.dataDir, 'covers'), downloadsDir: path.join(blockedParent, 'downloads'),
    scraperService: new FakeScraperService(), serveFrontend: false, logger: false,
  });
  t.after(() => app.close());

  const started = await app.inject({ method: 'POST', url: '/api/scraper/downloads', payload: { manga, chapters: [chapter], dataSaver: false } });
  assert.equal(started.statusCode, 202);
  const job = await waitForJob(app, started.json().id);

  assert.equal(job.status, 'failed');
  assert.equal(job.finishedAt !== null, true);
  assert.equal(job.errors.length, 1);
});

test('generic reader analysis rejects loopback addresses before fetching', async () => {
  let fetched = false;
  const service = new MangaScraperService({
    fetchImpl: (async () => { fetched = true; return new Response('<html></html>', { headers: { 'content-type': 'text/html' } }); }) as typeof fetch,
    resolveHostname: async () => ['127.0.0.1'],
  });
  await assert.rejects(service.analyzeUrl('http://127.0.0.1/chapter/1'), /privado/);
  assert.equal(fetched, false);
});

test('generic reader pins the validated public address in its dispatcher', async () => {
  let resolutions = 0;
  let receivedDispatcher = false;
  const service = new MangaScraperService({
    resolveHostname: async () => { resolutions++; return ['93.184.216.34']; },
    fetchImpl: (async (_input: RequestInfo | URL, init?: RequestInit & { dispatcher?: unknown }) => {
      receivedDispatcher = init?.dispatcher !== undefined;
      return new Response('<html><head><title>Example Manga</title></head></html>', { headers: { 'content-type': 'text/html' } });
    }) as typeof fetch,
  });

  await service.analyzeUrl('https://example.com/manga');

  assert.equal(resolutions, 1);
  assert.equal(receivedDispatcher, true);
});

test('generic HTML readers expose chapters and download lazy-loaded images', async (t) => {
  const fixture = createTestDatabase();
  t.after(fixture.cleanup);
  const service = new MangaScraperService({
    resolveHostname: async () => ['93.184.216.34'],
    fetchImpl: (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/manga')) return new Response(`
        <html><head><title>Example Manga | Reader</title></head><body>
          <h1 class="entry-title">Example Manga</h1>
          <div class="wp-manga-chapter"><a href="/chapter/1">Capítulo 1</a></div>
        </body></html>`, { headers: { 'content-type': 'text/html; charset=utf-8' } });
      if (url.endsWith('/chapter/1')) return new Response('<div class="reading-content"><img data-src="/pages/001.webp"></div>', { headers: { 'content-type': 'text/html' } });
      if (url.endsWith('/pages/001.webp')) return new Response(Buffer.from('image'), { headers: { 'content-type': 'image/webp' } });
      throw new Error(`Unexpected URL: ${url}`);
    }) as typeof fetch,
  });

  const analyzed = await service.analyzeUrl('https://example.com/manga');
  assert.equal(analyzed.manga.title, 'Example Manga');
  assert.equal(analyzed.chapters.length, 1);
  const downloaded = await service.downloadChapter(analyzed.chapters[0], fixture.dataDir, { dataSaver: false });
  assert.equal(downloaded.pageCount, 1);
  assert.equal(fs.readFileSync(path.join(downloaded.folder, '001.webp'), 'utf8'), 'image');
});
