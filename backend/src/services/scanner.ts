import fs from 'node:fs';
import path from 'node:path';
import fg from 'fast-glob';
import type Database from 'better-sqlite3';
import { ARCHIVE_EXTENSIONS, IMAGE_EXTENSIONS } from '../config.js';
import { sortNaturally } from '../utils/naturalSort.js';
import { extractCover, getFormat, getPageCount, type FileFormat } from './parser.js';

export interface ScanResult {
  seriesAdded: number;
  chaptersAdded: number;
  chaptersUpdated: number;
  chaptersRemoved: number;
  seriesRemoved: number;
  filesFailed: number;
  missingPaths: number;
}

interface ChapterCandidate {
  title: string;
  filePath: string;
  format: FileFormat;
  sortKey: string;
}

function getLibraryPaths(db: Database.Database): string[] {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('library_paths') as { value: string } | undefined;
  if (!row) return [];
  try {
    return JSON.parse(row.value) as string[];
  } catch {
    return [];
  }
}

function isImageFolder(dir: string): boolean {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
  const files = fs.readdirSync(dir);
  return files.some((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()));
}

function detectType(seriesTitle: string, rootPath: string): 'manga' | 'comic' {
  const lower = `${seriesTitle} ${rootPath}`.toLowerCase();
  if (lower.includes('comic') || lower.includes('hq') || lower.includes('marvel') || lower.includes('dc')) {
    return 'comic';
  }
  return 'manga';
}

async function collectFromRoot(rootPath: string): Promise<Map<string, ChapterCandidate[]>> {
  const seriesMap = new Map<string, ChapterCandidate[]>();

  if (!fs.existsSync(rootPath)) return seriesMap;

  const archiveFiles = await fg(['**/*.{cbz,cbr,pdf}'], {
    cwd: rootPath,
    absolute: true,
    onlyFiles: true,
    caseSensitiveMatch: false,
  });

  for (const filePath of archiveFiles) {
    const rel = path.relative(rootPath, filePath);
    const parts = rel.split(path.sep);
    const fileName = parts.pop()!;
    const seriesTitle = parts.length > 0 ? parts[0] : path.basename(fileName, path.extname(fileName));
    const format = getFormat(filePath);
    if (!format) continue;

    const chapterTitle = parts.length > 1
      ? parts.slice(1).join(' / ') + ' / ' + path.basename(fileName, path.extname(fileName))
      : path.basename(fileName, path.extname(fileName));

    const list = seriesMap.get(seriesTitle) ?? [];
    list.push({ title: chapterTitle, filePath, format, sortKey: chapterTitle });
    seriesMap.set(seriesTitle, list);
  }

  const dirs = await fg(['**/*/'], {
    cwd: rootPath,
    absolute: true,
    onlyDirectories: true,
  });

  for (const dir of dirs) {
    if (!isImageFolder(dir)) continue;
    const rel = path.relative(rootPath, dir);
    const parts = rel.split(path.sep);
    const seriesTitle = parts[0];
    const chapterTitle = parts.length > 1 ? parts.slice(1).join(' / ') : path.basename(dir);

    const list = seriesMap.get(seriesTitle) ?? [];
    if (!list.some((c) => c.filePath === dir)) {
      list.push({ title: chapterTitle, filePath: dir, format: 'folder', sortKey: chapterTitle });
      seriesMap.set(seriesTitle, list);
    }
  }

  // Root-level image folders as single-chapter series
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(rootPath, entry.name);
    if (isImageFolder(full) && !seriesMap.has(entry.name)) {
      seriesMap.set(entry.name, [{
        title: entry.name,
        filePath: full,
        format: 'folder',
        sortKey: entry.name,
      }]);
    }
  }

  // Root-level archives as single-chapter series
  for (const entry of fs.readdirSync(rootPath, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!ARCHIVE_EXTENSIONS.has(ext)) continue;
    const full = path.join(rootPath, entry.name);
    const format = getFormat(full);
    if (!format) continue;
    const title = path.basename(entry.name, ext);
    if (!seriesMap.has(title)) {
      seriesMap.set(title, [{
        title,
        filePath: full,
        format,
        sortKey: title,
      }]);
    }
  }

  // If the configured library path itself is a folder of images, treat it as a single folder-based chapter.
  if (isImageFolder(rootPath)) {
    const title = path.basename(rootPath);
    if (!seriesMap.has(title)) {
      seriesMap.set(title, [{
        title,
        filePath: rootPath,
        format: 'folder',
        sortKey: title,
      }]);
    }
  }

  for (const [key, chapters] of seriesMap) {
    seriesMap.set(key, sortNaturally(chapters, (c) => c.sortKey));
  }

  return seriesMap;
}

export async function scanLibrary(db: Database.Database, coversDir: string): Promise<ScanResult> {
  const paths = getLibraryPaths(db);
  let seriesAdded = 0;
  let chaptersAdded = 0;
  let chaptersUpdated = 0;
  let chaptersRemoved = 0;
  let seriesRemoved = 0;
  let filesFailed = 0;
  let missingPaths = 0;

  const findSeries = db.prepare('SELECT id FROM series WHERE title = ?');
  const insertSeries = db.prepare('INSERT INTO series (title, type) VALUES (?, ?)');
  const updateCover = db.prepare('UPDATE series SET cover_path = ? WHERE id = ?');
  const findChapter = db.prepare('SELECT id, series_id, title, format, page_count, sort_order FROM chapters WHERE file_path = ?');
  const insertChapter = db.prepare(`
    INSERT INTO chapters (series_id, title, file_path, format, page_count, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const updateChapter = db.prepare(`
    UPDATE chapters SET series_id = ?, title = ?, format = ?, page_count = ?, sort_order = ? WHERE id = ?
  `);

  const seenPaths = new Set<string>();
  const accessibleRoots: string[] = [];

  for (const rootPath of paths) {
    if (!fs.existsSync(rootPath) || !fs.statSync(rootPath).isDirectory()) {
      missingPaths++;
      continue;
    }
    accessibleRoots.push(path.resolve(rootPath) + path.sep);

    let seriesMap: Map<string, ChapterCandidate[]>;
    try {
      seriesMap = await collectFromRoot(rootPath);
    } catch (error) {
      missingPaths++;
      console.warn(`Failed to scan library root ${path.basename(rootPath)}:`, error instanceof Error ? error.message : 'Unknown error');
      continue;
    }

    for (const [seriesTitle, chapters] of seriesMap) {
      let seriesRow = findSeries.get(seriesTitle) as { id: number } | undefined;
      if (!seriesRow) {
        const type = detectType(seriesTitle, rootPath);
        const result = insertSeries.run(seriesTitle, type);
        seriesRow = { id: Number(result.lastInsertRowid) };
        seriesAdded++;
      }

      const seriesId = seriesRow.id;
      let order = 0;

      for (const chapter of chapters) {
        seenPaths.add(chapter.filePath);
        let pageCount: number;
        try {
          pageCount = await getPageCount(chapter.filePath, chapter.format);
        } catch (error) {
          filesFailed++;
          console.warn(`Failed to inspect chapter ${path.basename(chapter.filePath)}:`, error instanceof Error ? error.message : 'Unknown error');
          continue;
        }
        const existing = findChapter.get(chapter.filePath) as {
          id: number;
          series_id: number;
          title: string;
          format: string;
          page_count: number;
          sort_order: number;
        } | undefined;

        if (existing) {
          const changed = existing.series_id !== seriesId
            || existing.title !== chapter.title
            || existing.format !== chapter.format
            || existing.page_count !== pageCount
            || existing.sort_order !== order;
          if (changed) {
            updateChapter.run(seriesId, chapter.title, chapter.format, pageCount, order, existing.id);
            chaptersUpdated++;
          }
        } else {
          insertChapter.run(seriesId, chapter.title, chapter.filePath, chapter.format, pageCount, order);
          chaptersAdded++;
        }
        order++;
      }

      const seriesInfo = db.prepare('SELECT cover_path FROM series WHERE id = ?').get(seriesId) as { cover_path: string | null };
      if (!seriesInfo.cover_path && chapters.length > 0) {
        const first = chapters[0];
        const cover = await extractCover(first.filePath, first.format);
        if (cover) {
          fs.mkdirSync(coversDir, { recursive: true });
          const coverPath = path.join(coversDir, `${seriesId}.jpg`);
          fs.writeFileSync(coverPath, cover);
          updateCover.run(coverPath, seriesId);
        }
      }
    }
  }

  // Remove chapters whose files no longer exist
  const allChapters = db.prepare('SELECT id, file_path FROM chapters').all() as { id: number; file_path: string }[];
  for (const ch of allChapters) {
    const resolvedChapterPath = path.resolve(ch.file_path);
    const belongsToScannedRoot = accessibleRoots.some((root) => resolvedChapterPath.startsWith(root));
    if (!seenPaths.has(ch.file_path) && (belongsToScannedRoot || !fs.existsSync(ch.file_path))) {
      db.prepare('DELETE FROM chapters WHERE id = ?').run(ch.id);
      chaptersRemoved++;
    }
  }

  const emptySeries = db.prepare(`
    SELECT id, cover_path FROM series s
    WHERE NOT EXISTS (SELECT 1 FROM chapters c WHERE c.series_id = s.id)
  `).all() as { id: number; cover_path: string | null }[];
  const resolvedCoversDir = path.resolve(coversDir) + path.sep;
  for (const series of emptySeries) {
    db.prepare('DELETE FROM series WHERE id = ?').run(series.id);
    seriesRemoved++;
    if (series.cover_path) {
      const resolvedCover = path.resolve(series.cover_path);
      if (resolvedCover.startsWith(resolvedCoversDir) && fs.existsSync(resolvedCover)) {
        fs.unlinkSync(resolvedCover);
      }
    }
  }

  return {
    seriesAdded,
    chaptersAdded,
    chaptersUpdated,
    chaptersRemoved,
    seriesRemoved,
    filesFailed,
    missingPaths,
  };
}

export function getSeriesList(db: Database.Database, filters: {
  search?: string;
  type?: string;
  tag?: string;
  favorite?: boolean;
}) {
  let query = `
    SELECT s.*,
      EXISTS(SELECT 1 FROM favorites f WHERE f.series_id = s.id) AS is_favorite,
      (SELECT COUNT(*) FROM chapters c WHERE c.series_id = s.id) AS chapter_count,
      (SELECT c.id FROM chapters c
        LEFT JOIN reading_progress rp ON rp.chapter_id = c.id
        WHERE c.series_id = s.id
        ORDER BY rp.updated_at DESC NULLS LAST, c.sort_order DESC
        LIMIT 1) AS last_chapter_id,
      (SELECT rp.page FROM chapters c
        JOIN reading_progress rp ON rp.chapter_id = c.id
        WHERE c.series_id = s.id
        ORDER BY rp.updated_at DESC
        LIMIT 1) AS last_page
    FROM series s
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (filters.search) {
    query += ` AND (s.title LIKE ? OR EXISTS (
      SELECT 1 FROM chapters c WHERE c.series_id = s.id AND c.title LIKE ?
    ))`;
    const term = `%${filters.search}%`;
    params.push(term, term);
  }

  if (filters.type) {
    query += ' AND s.type = ?';
    params.push(filters.type);
  }

  if (filters.favorite) {
    query += ' AND EXISTS (SELECT 1 FROM favorites f WHERE f.series_id = s.id)';
  }

  if (filters.tag) {
    query += ` AND EXISTS (
      SELECT 1 FROM series_tags st
      JOIN tags t ON t.id = st.tag_id
      WHERE st.series_id = s.id AND t.name = ?
    )`;
    params.push(filters.tag);
  }

  query += ' ORDER BY s.title COLLATE NOCASE';

  return db.prepare(query).all(...params);
}

export function getSeriesDetail(db: Database.Database, seriesId: number) {
  const series = db.prepare(`
    SELECT s.*,
      EXISTS(SELECT 1 FROM favorites f WHERE f.series_id = s.id) AS is_favorite
    FROM series s WHERE s.id = ?
  `).get(seriesId);

  if (!series) return null;

  const chapters = db.prepare(`
    SELECT c.*,
      rp.page AS progress_page,
      CASE WHEN rp.page IS NOT NULL AND c.page_count > 0 AND rp.page >= c.page_count - 1 THEN 1 ELSE 0 END AS is_read
    FROM chapters c
    LEFT JOIN reading_progress rp ON rp.chapter_id = c.id
    WHERE c.series_id = ?
    ORDER BY c.sort_order ASC
  `).all(seriesId);

  const tags = db.prepare(`
    SELECT t.id, t.name FROM tags t
    JOIN series_tags st ON st.tag_id = t.id
    WHERE st.series_id = ?
    ORDER BY t.name
  `).all(seriesId);

  return { ...series, chapters, tags };
}
