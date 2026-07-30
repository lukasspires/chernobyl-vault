import { initDb } from './db/index.js';
import { scanLibrary } from './services/scanner.js';

async function main() {
  const db = initDb();
  try {
    const result = await scanLibrary(db, 'C:/Users/Administrator/Projects/manga-reader/data/cache/covers');
    console.log('scan result', result);
  } catch (err) {
    console.error('scan error', err);
    process.exit(1);
  }
}

main();
