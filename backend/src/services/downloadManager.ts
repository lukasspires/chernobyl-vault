import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import sharp from 'sharp';
import type { RemoteChapter, RemoteManga, ScraperService } from './scraper.js';

export type DownloadStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface DownloadJob {
  id: string;
  status: DownloadStatus;
  manga: Pick<RemoteManga, 'source' | 'sourceId' | 'title' | 'coverUrl'>;
  chapterCount: number;
  completedChapters: number;
  failedChapters: number;
  currentChapter: string | null;
  currentPage: number;
  totalPages: number;
  downloadedPages: number;
  skippedPages: number;
  errors: { chapter: string; error: string }[];
  createdAt: string;
  finishedAt: string | null;
}

interface InternalJob extends DownloadJob {
  controller: AbortController;
}

function cleanName(value: string, fallback = 'sem-nome'): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().replace(/[ .-]+$/g, '').replace(/\s+/g, ' ');
  return cleaned.slice(0, 140) || fallback;
}

function publicJob(job: InternalJob): DownloadJob {
  const { controller: _controller, ...snapshot } = job;
  return structuredClone(snapshot);
}

export class DownloadManager {
  private readonly jobs = new Map<string, InternalJob>();

  constructor(
    private readonly service: ScraperService,
    private readonly db: Database.Database,
    private readonly downloadsDir: string,
    private readonly coversDir: string,
  ) {}

  start(manga: RemoteManga, chapters: RemoteChapter[], dataSaver: boolean): DownloadJob {
    if (chapters.length < 1 || chapters.length > 100) throw new Error('Selecione entre 1 e 100 capítulos por download');
    if (chapters.some((chapter) => chapter.source !== manga.source)) throw new Error('Capítulos não pertencem à fonte selecionada');
    const id = crypto.randomUUID();
    const job: InternalJob = {
      id, status: 'queued', manga: { source: manga.source, sourceId: manga.sourceId, title: manga.title, coverUrl: manga.coverUrl },
      chapterCount: chapters.length, completedChapters: 0, failedChapters: 0, currentChapter: null,
      currentPage: 0, totalPages: 0, downloadedPages: 0, skippedPages: 0, errors: [],
      createdAt: new Date().toISOString(), finishedAt: null, controller: new AbortController(),
    };
    this.jobs.set(id, job);
    queueMicrotask(() => void this.run(job, manga, chapters, dataSaver));
    return publicJob(job);
  }

  list(): DownloadJob[] {
    return [...this.jobs.values()].map(publicJob).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  get(id: string): DownloadJob | null {
    const job = this.jobs.get(id);
    return job ? publicJob(job) : null;
  }

  cancel(id: string): DownloadJob | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (job.status === 'queued' || job.status === 'running') job.controller.abort(new Error('Download cancelado'));
    return publicJob(job);
  }

  cancelAll(): void {
    for (const job of this.jobs.values()) if (job.status === 'queued' || job.status === 'running') job.controller.abort();
  }

  private async run(job: InternalJob, manga: RemoteManga, chapters: RemoteChapter[], dataSaver: boolean): Promise<void> {
    job.status = 'running';
    try {
      const mangaDir = path.join(this.downloadsDir, cleanName(manga.title, 'Mangá'));
      fs.mkdirSync(mangaDir, { recursive: true });
      await this.saveMangaMetadata(manga, mangaDir, job.controller.signal);
      for (const chapter of chapters) {
        if (job.controller.signal.aborted) throw job.controller.signal.reason;
        job.currentChapter = chapter.title;
        job.currentPage = 0;
        job.totalPages = 0;
        try {
          const result = await this.service.downloadChapter(chapter, mangaDir, {
            dataSaver,
            signal: job.controller.signal,
            onProgress: (page, total, skipped) => {
              job.currentPage = page;
              job.totalPages = total;
              if (skipped) job.skippedPages++;
              else job.downloadedPages++;
            },
          });
          this.importChapter(manga, chapter, result.folder, result.pageCount);
          job.completedChapters++;
        } catch (error) {
          if (job.controller.signal.aborted) throw error;
          job.failedChapters++;
          job.errors.push({ chapter: chapter.title, error: error instanceof Error ? error.message : 'Falha desconhecida' });
        }
      }
      job.status = job.failedChapters === chapters.length ? 'failed' : 'completed';
    } catch (error) {
      if (job.controller.signal.aborted) job.status = 'cancelled';
      else {
        job.status = 'failed';
        job.errors.push({ chapter: job.currentChapter ?? manga.title, error: error instanceof Error ? error.message : 'Falha desconhecida' });
      }
    } finally {
      job.currentChapter = null;
      job.finishedAt = new Date().toISOString();
    }
  }

  private async saveMangaMetadata(manga: RemoteManga, mangaDir: string, signal: AbortSignal): Promise<void> {
    const target = path.join(mangaDir, 'manga.json');
    const temporary = `${target}.part`;
    fs.writeFileSync(temporary, JSON.stringify(manga, null, 2), 'utf8');
    fs.renameSync(temporary, target);
    if (!manga.coverUrl) return;
    try {
      const original = await this.service.downloadCover(manga.coverUrl, signal);
      const cover = await sharp(original).resize(300, 450, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
      fs.writeFileSync(path.join(mangaDir, 'cover.jpg.part'), cover);
      fs.renameSync(path.join(mangaDir, 'cover.jpg.part'), path.join(mangaDir, 'cover.jpg'));
    } catch (error) {
      if (signal.aborted) throw error;
      // A capa é opcional; um erro nela não deve impedir o download dos capítulos.
    }
  }

  private importChapter(manga: RemoteManga, chapter: RemoteChapter, folder: string, pageCount: number): void {
    const transaction = this.db.transaction(() => {
      let series = this.db.prepare('SELECT id FROM series WHERE title = ? COLLATE NOCASE').get(manga.title) as { id: number } | undefined;
      if (!series) {
        const result = this.db.prepare('INSERT INTO series (title, type, description) VALUES (?, ?, ?)').run(manga.title, 'manga', manga.description || null);
        series = { id: Number(result.lastInsertRowid) };
      } else if (manga.description) {
        this.db.prepare('UPDATE series SET description = COALESCE(description, ?) WHERE id = ?').run(manga.description, series.id);
      }
      const existing = this.db.prepare('SELECT id FROM chapters WHERE file_path = ?').get(folder) as { id: number } | undefined;
      if (existing) {
        this.db.prepare('UPDATE chapters SET series_id = ?, title = ?, format = ?, page_count = ? WHERE id = ?')
          .run(series.id, chapter.title, 'folder', pageCount, existing.id);
      } else {
        const order = (this.db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM chapters WHERE series_id = ?').get(series.id) as { value: number }).value;
        this.db.prepare(`INSERT INTO chapters (series_id, title, file_path, format, page_count, sort_order)
          VALUES (?, ?, ?, 'folder', ?, ?)`
        ).run(series.id, chapter.title, folder, pageCount, order);
      }
      const downloadedCover = path.join(path.dirname(folder), 'cover.jpg');
      if (fs.existsSync(downloadedCover)) {
        fs.mkdirSync(this.coversDir, { recursive: true });
        const coverPath = path.join(this.coversDir, `${series.id}.jpg`);
        fs.copyFileSync(downloadedCover, coverPath);
        this.db.prepare('UPDATE series SET cover_path = ? WHERE id = ?').run(coverPath, series.id);
      }
      const insertTag = this.db.prepare('INSERT INTO tags (name) VALUES (?) ON CONFLICT(name) DO NOTHING');
      const findTag = this.db.prepare('SELECT id FROM tags WHERE name = ?');
      const linkTag = this.db.prepare('INSERT OR IGNORE INTO series_tags (series_id, tag_id) VALUES (?, ?)');
      for (const tag of manga.tags.slice(0, 50)) {
        insertTag.run(tag);
        const row = findTag.get(tag) as { id: number } | undefined;
        if (row) linkTag.run(series.id, row.id);
      }
    });
    transaction();
  }
}
