import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { DATA_DIR, DB_FILENAME, LEGACY_DB_FILENAME, LIBRARY_PATH } from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface InitDbOptions {
  dataDir?: string;
  dbPath?: string;
  libraryPath?: string;
}

function ensureDirs(dataDir: string) {
  for (const dir of [dataDir, path.join(dataDir, 'cache'), path.join(dataDir, 'cache', 'covers'), path.join(dataDir, 'cache', 'pages')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseLibraryPaths(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

type RenameFile = (oldPath: fs.PathLike, newPath: fs.PathLike) => void;

export function resolveDefaultDbPath(dataDir: string, renameFile: RenameFile = fs.renameSync): string {
  const currentPath = path.join(dataDir, DB_FILENAME);
  const legacyPath = path.join(dataDir, LEGACY_DB_FILENAME);
  if (fs.existsSync(currentPath) || !fs.existsSync(legacyPath)) return currentPath;

  let legacyDb: Database.Database | undefined;
  try {
    legacyDb = new Database(legacyPath);
    legacyDb.pragma('wal_checkpoint(TRUNCATE)');
    legacyDb.close();
    legacyDb = undefined;
    renameFile(legacyPath, currentPath);
    return currentPath;
  } catch {
    if (legacyDb?.open) legacyDb.close();
    console.warn('Could not migrate the legacy database filename; continuing with the existing database');
    return legacyPath;
  }
}

export function initDb(options: InitDbOptions = {}) {
  const dataDir = options.dataDir ?? DATA_DIR;
  const dbPath = options.dbPath ?? resolveDefaultDbPath(dataDir);
  const libraryPath = options.libraryPath ?? LIBRARY_PATH;
  ensureDirs(dataDir);
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get('library_paths') as { value: string } | undefined;
  const envPaths = libraryPath && fs.existsSync(libraryPath) ? [libraryPath] : [];

  if (!existing) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('library_paths', JSON.stringify(envPaths));
  } else {
    const storedPaths = parseLibraryPaths(existing.value);
    const hasAccessibleStoredPath = storedPaths.some((storedPath) => fs.existsSync(storedPath));
    if (!hasAccessibleStoredPath && envPaths.length > 0) {
      db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(JSON.stringify(envPaths), 'library_paths');
    }
  }

  const theme = db.prepare('SELECT value FROM settings WHERE key = ?').get('theme');
  if (!theme) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('theme', 'system');
  }

  return db;
}

export type Db = Database.Database;
