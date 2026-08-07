import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initDb, type Db } from '../src/db/index.js';

export interface TestDatabase {
  db: Db;
  dataDir: string;
  cleanup: () => void;
}

export function createTestDatabase(libraryPath?: string): TestDatabase {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chernobyl-vault-test-'));
  const db = initDb({ dataDir, dbPath: path.join(dataDir, 'test.db'), libraryPath });
  return {
    db,
    dataDir,
    cleanup: () => {
      if (db.open) db.close();
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export function seedChapter(db: Db, filePath: string, format: string, pageCount: number) {
  const seriesResult = db.prepare('INSERT INTO series (title, type) VALUES (?, ?)').run('Test Series', 'manga');
  const seriesId = Number(seriesResult.lastInsertRowid);
  const chapterResult = db.prepare(`
    INSERT INTO chapters (series_id, title, file_path, format, page_count, sort_order)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(seriesId, 'Chapter 1', filePath, format, pageCount);
  return { seriesId, chapterId: Number(chapterResult.lastInsertRowid) };
}
