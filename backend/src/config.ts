import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../..');

export const DATA_DIR = process.env.DATA_DIR ?? path.join(rootDir, 'data');
export const DB_PATH = path.join(DATA_DIR, 'manga-reader.db');
export const CACHE_DIR = path.join(DATA_DIR, 'cache');
export const COVERS_DIR = path.join(CACHE_DIR, 'covers');
export const PAGES_CACHE_DIR = path.join(CACHE_DIR, 'pages');
export const PORT = Number(process.env.PORT ?? 3001);
export const HOST = process.env.HOST ?? '0.0.0.0';

export const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);
export const ARCHIVE_EXTENSIONS = new Set(['.cbz', '.cbr', '.pdf']);
