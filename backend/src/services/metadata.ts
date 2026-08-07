import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';
import sharp from 'sharp';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_COVER_BYTES = 10 * 1024 * 1024;

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(input, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new Error('Tempo limite excedido ao acessar serviço externo');
    }
    throw error;
  }
}

export interface MalSearchResult {
  id: number;
  title: string;
  synopsis: string;
  imageUrl: string | null;
  type: string;
}

export interface ComicVineSearchResult {
  id: number;
  title: string;
  description: string;
  imageUrl: string | null;
  publisher: string | null;
  startYear: string | null;
}

function getSetting(db: Database.Database, key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export async function searchMal(db: Database.Database, query: string): Promise<MalSearchResult[]> {
  const clientId = getSetting(db, 'mal_client_id');
  if (!clientId) {
    throw new Error('Configure mal_client_id nas configurações para buscar no MyAnimeList');
  }

  const url = new URL('https://api.myanimelist.net/v2/anime');
  url.searchParams.set('q', query);
  url.searchParams.set('limit', '10');
  url.searchParams.set('fields', 'synopsis,main_picture');

  const res = await fetchWithTimeout(url.toString(), {
    headers: { 'X-MAL-CLIENT-ID': clientId },
  });

  if (!res.ok) {
    throw new Error(`MyAnimeList API error: ${res.status}`);
  }

  const data = await res.json() as {
    data: Array<{
      node: {
        id: number;
        title: string;
        synopsis?: string;
        main_picture?: { medium?: string; large?: string };
      };
    }>;
  };

  return data.data.map(({ node }) => ({
    id: node.id,
    title: node.title,
    synopsis: node.synopsis ?? '',
    imageUrl: node.main_picture?.large ?? node.main_picture?.medium ?? null,
    type: 'manga',
  }));
}

export async function searchComicVine(db: Database.Database, query: string): Promise<ComicVineSearchResult[]> {
  const apiKey = getSetting(db, 'comicvine_api_key');
  if (!apiKey) {
    throw new Error('Configure comicvine_api_key nas configurações para buscar no ComicVine');
  }

  const url = new URL('https://comicvine.gamespot.com/api/search/');
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('format', 'json');
  url.searchParams.set('query', query);
  url.searchParams.set('resources', 'volume');
  url.searchParams.set('field_list', 'id,name,description,image,publisher,start_year');
  url.searchParams.set('limit', '10');

  const res = await fetchWithTimeout(url.toString(), {
    headers: { 'User-Agent': 'ChernobylVault/1.0' },
  });

  if (!res.ok) {
    throw new Error(`ComicVine API error: ${res.status}`);
  }

  const data = await res.json() as {
    results: Array<{
      id: number;
      name: string;
      description?: string;
      image?: { medium_url?: string; super_url?: string };
      publisher?: { name?: string };
      start_year?: string;
    }>;
  };

  return data.results.map((item) => ({
    id: item.id,
    title: item.name,
    description: item.description?.replace(/<[^>]+>/g, '') ?? '',
    imageUrl: item.image?.super_url ?? item.image?.medium_url ?? null,
    publisher: item.publisher?.name ?? null,
    startYear: item.start_year ?? null,
  }));
}

export async function applyMetadata(
  db: Database.Database,
  seriesId: number,
  source: 'mal' | 'comicvine',
  externalId: number,
  coversDir: string,
): Promise<void> {
  if (source === 'mal') {
    const clientId = getSetting(db, 'mal_client_id');
    if (!clientId) throw new Error('mal_client_id não configurado');

    const url = `https://api.myanimelist.net/v2/anime/${externalId}?fields=synopsis,main_picture`;
    const res = await fetchWithTimeout(url, { headers: { 'X-MAL-CLIENT-ID': clientId } });
    if (!res.ok) throw new Error('Falha ao buscar detalhes MAL');

    const node = await res.json() as {
      title: string;
      synopsis?: string;
      main_picture?: { large?: string; medium?: string };
    };

    let coverPath: string | null = null;
    const imageUrl = node.main_picture?.large ?? node.main_picture?.medium;
    if (imageUrl) {
      coverPath = await downloadCover(imageUrl, coversDir, seriesId);
    }

    db.prepare(`
      UPDATE series SET title = ?, description = ?, mal_id = ?, type = 'manga', cover_path = COALESCE(?, cover_path)
      WHERE id = ?
    `).run(node.title, node.synopsis ?? '', externalId, coverPath, seriesId);
  } else {
    const apiKey = getSetting(db, 'comicvine_api_key');
    if (!apiKey) throw new Error('comicvine_api_key não configurado');

    const url = new URL(`https://comicvine.gamespot.com/api/volume/4050-${externalId}/`);
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('format', 'json');
    url.searchParams.set('field_list', 'name,description,image,publisher,start_year');

    const res = await fetchWithTimeout(url.toString(), { headers: { 'User-Agent': 'ChernobylVault/1.0' } });
    if (!res.ok) throw new Error('Falha ao buscar detalhes ComicVine');

    const data = await res.json() as {
      results: {
        name: string;
        description?: string;
        image?: { super_url?: string; medium_url?: string };
        publisher?: { name?: string };
        start_year?: string;
      };
    };

    const item = data.results;
    const desc = [
      item.description?.replace(/<[^>]+>/g, '') ?? '',
      item.publisher?.name ? `Editora: ${item.publisher.name}` : '',
      item.start_year ? `Ano: ${item.start_year}` : '',
    ].filter(Boolean).join('\n\n');

    let coverPath: string | null = null;
    const imageUrl = item.image?.super_url ?? item.image?.medium_url;
    if (imageUrl) {
      coverPath = await downloadCover(imageUrl, coversDir, seriesId);
    }

    db.prepare(`
      UPDATE series SET title = ?, description = ?, comicvine_id = ?, type = 'comic', cover_path = COALESCE(?, cover_path)
      WHERE id = ?
    `).run(item.name, desc, externalId, coverPath, seriesId);
  }
}

async function downloadCover(url: string, coversDir: string, seriesId: number): Promise<string> {
  fs.mkdirSync(coversDir, { recursive: true });
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error('Falha ao baixar capa');
  const contentType = res.headers.get('content-type')?.split(';')[0].trim() ?? '';
  if (!contentType.startsWith('image/')) throw new Error('A capa remota não é uma imagem válida');
  const declaredSize = Number(res.headers.get('content-length') ?? 0);
  if (declaredSize > MAX_COVER_BYTES) throw new Error('A capa remota excede o limite de 10 MB');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_COVER_BYTES) throw new Error('A capa remota excede o limite de 10 MB');
  const jpeg = await sharp(buffer).jpeg({ quality: 85 }).toBuffer();
  const coverPath = path.join(coversDir, `${seriesId}.jpg`);
  fs.writeFileSync(coverPath, jpeg);
  return coverPath;
}
