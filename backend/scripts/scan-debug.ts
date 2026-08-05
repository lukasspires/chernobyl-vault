import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDb } from '../src/db/index.js';
import { scanLibrary } from '../src/services/scanner.js';

const libraryPath = process.argv[2];
if (!libraryPath) {
  console.error('Usage: npm run debug:scan -- <library-path>');
  process.exit(1);
}

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptsDir, '..');
const dataDir = path.resolve(backendDir, '..', 'data');
const db = initDb({ dataDir, libraryPath: path.resolve(libraryPath) });

try {
  const result = await scanLibrary(db, path.join(dataDir, 'cache', 'covers'));
  console.log(result);
} finally {
  db.close();
}
