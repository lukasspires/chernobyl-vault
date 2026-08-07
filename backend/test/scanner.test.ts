import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import AdmZip from 'adm-zip';
import { initDb } from '../src/db/index.js';
import { scanLibrary } from '../src/services/scanner.js';
import { createTestDatabase } from './helpers.js';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

test('scanner recognizes regular ZIP comic archives', async (t) => {
  const fixture = createTestDatabase();
  t.after(fixture.cleanup);
  const library = path.join(fixture.dataDir, 'library');
  const series = path.join(library, 'New Series');
  fs.mkdirSync(series, { recursive: true });
  const archive = new AdmZip();
  archive.addFile('001.png', PNG_1X1);
  archive.writeZip(path.join(series, 'Chapter 1.zip'));
  fixture.db.prepare("UPDATE settings SET value = ? WHERE key = 'library_paths'").run(JSON.stringify([library]));

  const result = await scanLibrary(fixture.db, path.join(fixture.dataDir, 'covers'));

  assert.equal(result.seriesAdded, 1);
  assert.equal(result.chaptersAdded, 1);
  assert.deepEqual(
    fixture.db.prepare('SELECT title, format, page_count FROM chapters').get(),
    { title: 'Chapter 1', format: 'cbz', page_count: 1 },
  );
});

test('scanner continues after a corrupt archive and removes a vanished folder chapter', async (t) => {
  const fixture = createTestDatabase();
  t.after(fixture.cleanup);
  const library = path.join(fixture.dataDir, 'library');
  const chapter = path.join(library, 'Series', 'Chapter 1');
  fs.mkdirSync(chapter, { recursive: true });
  fs.writeFileSync(path.join(chapter, '001.png'), PNG_1X1);
  fs.writeFileSync(path.join(library, 'broken.cbz'), 'not a zip');
  fixture.db.prepare("UPDATE settings SET value = ? WHERE key = 'library_paths'").run(JSON.stringify([library]));

  const first = await scanLibrary(fixture.db, path.join(fixture.dataDir, 'covers'));
  assert.equal(first.chaptersAdded, 1);
  assert.equal(first.filesFailed, 1);
  assert.equal((fixture.db.prepare('SELECT COUNT(*) AS count FROM chapters').get() as { count: number }).count, 1);

  fs.rmSync(path.join(chapter, '001.png'));
  const second = await scanLibrary(fixture.db, path.join(fixture.dataDir, 'covers'));
  assert.equal(second.chaptersRemoved, 1);
  assert.ok(second.seriesRemoved >= 1);
});

test('scanner reports unavailable library paths without deleting their chapters', async (t) => {
  const fixture = createTestDatabase();
  t.after(fixture.cleanup);
  const missing = path.join(fixture.dataDir, 'missing');
  fixture.db.prepare("UPDATE settings SET value = ? WHERE key = 'library_paths'").run(JSON.stringify([missing]));
  const result = await scanLibrary(fixture.db, path.join(fixture.dataDir, 'covers'));
  assert.equal(result.missingPaths, 1);
});

test('environment library path replaces only inaccessible stored paths', (t) => {
  const fixture = createTestDatabase();
  t.after(fixture.cleanup);
  const stored = path.join(fixture.dataDir, 'stored');
  const fallback = path.join(fixture.dataDir, 'fallback');
  fs.mkdirSync(stored);
  fs.mkdirSync(fallback);
  fixture.db.prepare("UPDATE settings SET value = ? WHERE key = 'library_paths'").run(JSON.stringify([stored]));
  fixture.db.close();

  let db = initDb({ dataDir: fixture.dataDir, dbPath: path.join(fixture.dataDir, 'test.db'), libraryPath: fallback });
  assert.deepEqual(JSON.parse((db.prepare("SELECT value FROM settings WHERE key = 'library_paths'").get() as { value: string }).value), [stored]);
  db.close();
  fs.rmSync(stored, { recursive: true });
  db = initDb({ dataDir: fixture.dataDir, dbPath: path.join(fixture.dataDir, 'test.db'), libraryPath: fallback });
  assert.deepEqual(JSON.parse((db.prepare("SELECT value FROM settings WHERE key = 'library_paths'").get() as { value: string }).value), [fallback]);
  db.close();
});
