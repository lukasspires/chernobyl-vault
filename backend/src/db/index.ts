import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { CACHE_DIR, COVERS_DIR, DATA_DIR, DB_PATH, PAGES_CACHE_DIR } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureDirs() {
  for (const dir of [DATA_DIR, CACHE_DIR, COVERS_DIR, PAGES_CACHE_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function initDb() {
  ensureDirs();
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('library_paths');
  const envPaths = process.env.LIBRARY_PATH ? JSON.stringify([process.env.LIBRARY_PATH]) : null;

  if (!existing) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('library_paths', envPaths ?? '[]');
  } else if (existing.value === '[]' && envPaths) {
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(envPaths, 'library_paths');
  }

  const theme = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme');
  if (!theme) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('theme', 'system');
  }

  return db;
}

export type Db = Database.Database;
