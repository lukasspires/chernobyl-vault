import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { buildApp } from '../src/app.js';
import { createTestDatabase, seedChapter } from './helpers.js';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('health, validation, progress history and page MIME work through the API', async (t) => {
  const fixture = createTestDatabase();
  t.after(fixture.cleanup);
  const chapterDir = path.join(fixture.dataDir, 'chapter');
  fs.mkdirSync(chapterDir);
  fs.writeFileSync(path.join(chapterDir, '001.png'), PNG_1X1);
  const { chapterId } = seedChapter(fixture.db, chapterDir, 'folder', 1);
  const app = await buildApp({ db: fixture.db, coversDir: path.join(fixture.dataDir, 'covers'), serveFrontend: false, logger: false });
  t.after(() => app.close());

  assert.deepEqual((await app.inject({ method: 'GET', url: '/api/health' })).json(), { ok: true });
  assert.equal((await app.inject({ method: 'GET', url: '/api/chapters/nope' })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/progress/${chapterId}`, payload: { page: 1 } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/progress/${chapterId}`, payload: { page: '0' } })).statusCode, 400);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/progress/${chapterId}`, payload: { page: 0 } })).statusCode, 200);
  assert.equal((await app.inject({ method: 'PUT', url: `/api/progress/${chapterId}`, payload: { page: 0 } })).statusCode, 200);
  assert.equal((fixture.db.prepare('SELECT COUNT(*) AS count FROM history').get() as { count: number }).count, 1);

  const page = await app.inject({ method: 'GET', url: `/api/chapters/${chapterId}/pages/0` });
  assert.equal(page.statusCode, 200);
  assert.match(page.headers['content-type'] ?? '', /^image\/png/);
  assert.equal((await app.inject({ method: 'PUT', url: '/api/settings', payload: { theme: 'neon' } })).statusCode, 400);
});
