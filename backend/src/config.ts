import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

function loadDotEnv() {
  const envPath = path.join(rootDir, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    let value = trimmed.slice(equalIndex + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    if (typeof process.env[key] === 'undefined') {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

export const DATA_DIR = process.env.DATA_DIR ?? path.join(rootDir, 'data');
export const DB_PATH = path.join(DATA_DIR, 'manga-reader.db');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const COVERS_DIR = path.join(DATA_DIR, 'cache', 'covers');
export const PAGES_CACHE_DIR = path.join(DATA_DIR, 'cache', 'pages');
export const PORT = Number(process.env.PORT ?? 3001);
export const HOST = process.env.HOST ?? '0.0.0.0';
export const LIBRARY_PATH = process.env.LIBRARY_PATH;

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
export const ARCHIVE_EXTENSIONS = new Set(['.cbz', '.cbr', '.pdf']);
