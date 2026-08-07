import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const MANGADEX_API = 'https://api.mangadex.org';
const MANGADEX_COVERS = 'https://uploads.mangadex.org/covers';
const USER_AGENT = 'MangaReader/1.0 (personal-use downloader)';
const MAX_JSON_BYTES = 5 * 1024 * 1024;
const MAX_HTML_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_BYTES = 40 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const MAX_ATTEMPTS = 3;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

export type ScraperSource = 'mangadex' | 'html';

export interface RemoteManga {
  source: ScraperSource;
  sourceId: string;
  sourceUrl: string;
  title: string;
  description: string;
  altTitles: string[];
  authors: string[];
  artists: string[];
  tags: string[];
  year: number | null;
  status: string | null;
  demographic: string | null;
  contentRating: string | null;
  originalLanguage: string | null;
  availableLanguages: string[];
  coverUrl: string | null;
  thumbnailUrl: string | null;
}

export interface RemoteChapter {
  source: ScraperSource;
  sourceId: string;
  title: string;
  url: string;
  language: string | null;
  group: string | null;
  number: number | null;
}

export interface SearchFilters {
  query?: string;
  limit?: number;
  offset?: number;
  includedTags?: string[];
  statuses?: string[];
  demographics?: string[];
  originalLanguages?: string[];
  contentRatings?: string[];
  year?: number;
  order?: string;
}

export interface ChapterPage {
  chapters: RemoteChapter[];
  total: number;
}

export interface DownloadedChapter {
  folder: string;
  pageCount: number;
  downloaded: number;
  skipped: number;
}

export interface DownloadProgress {
  (page: number, total: number, skipped: boolean): void;
}

export interface ScraperService {
  searchManga(filters: SearchFilters, signal?: AbortSignal): Promise<{ items: RemoteManga[]; total: number }>;
  listTags(signal?: AbortSignal): Promise<{ id: string; name: string }[]>;
  getManga(sourceId: string, preferredLanguages?: string[], signal?: AbortSignal): Promise<RemoteManga>;
  getMangaChapters(sourceId: string, languages: string[], page: number, limit: number, signal?: AbortSignal): Promise<ChapterPage>;
  analyzeUrl(url: string, signal?: AbortSignal): Promise<{ manga: RemoteManga; chapters: RemoteChapter[] }>;
  downloadChapter(chapter: RemoteChapter, destination: string, options: {
    dataSaver: boolean;
    signal?: AbortSignal;
    onProgress?: DownloadProgress;
  }): Promise<DownloadedChapter>;
  downloadCover(url: string, signal?: AbortSignal): Promise<Buffer>;
}

type FetchLike = typeof fetch;
type ResolveHostname = (hostname: string) => Promise<string[]>;

function cleanName(value: string, fallback = 'sem-nome'): string {
  const cleaned = value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim().replace(/[ .-]+$/g, '').replace(/\s+/g, ' ');
  return cleaned.slice(0, 140) || fallback;
}

function decodeHtml(value: string): string {
  const entities: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (_match, entity: string) => {
      if (entity[0] === '#') {
        const hex = entity[1]?.toLowerCase() === 'x';
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : '';
      }
      return entities[entity.toLowerCase()] ?? '';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

function localized(values: unknown, preferred: string[]): string {
  if (!values || typeof values !== 'object' || Array.isArray(values)) return '';
  const record = values as Record<string, unknown>;
  for (const language of [...preferred, 'pt-br', 'en', 'ja-ro', 'ja']) {
    if (typeof record[language] === 'string' && record[language]) return record[language].trim();
  }
  const first = Object.values(record).find((value) => typeof value === 'string' && value);
  return typeof first === 'string' ? first.trim() : '';
}

function isPrivateAddress(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^::ffff:/, '');
  if (net.isIPv4(normalized)) {
    const [a, b] = normalized.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168);
  }
  if (net.isIPv6(normalized)) {
    return normalized === '::' || normalized === '::1' || normalized.startsWith('fc')
      || normalized.startsWith('fd') || /^fe[89ab]/.test(normalized);
  }
  return true;
}

async function defaultResolveHostname(hostname: string): Promise<string[]> {
  const results = await dns.lookup(hostname, { all: true, verbatim: true });
  return results.map((result) => result.address);
}

class SafeHttpClient {
  constructor(
    private readonly fetchImpl: FetchLike,
    private readonly resolveHostname: ResolveHostname,
    private readonly timeoutMs = 30_000,
  ) {}

  private async validateUrl(value: string): Promise<URL> {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('URL inválida');
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Apenas URLs HTTP(S) públicas são permitidas');
    }
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('Endereço privado não permitido');
    const addresses = net.isIP(hostname) ? [hostname] : await this.resolveHostname(hostname);
    if (addresses.length === 0 || addresses.some(isPrivateAddress)) throw new Error('Endereço privado não permitido');
    return url;
  }

  async get(urlValue: string, options: { maxBytes: number; accept: string; signal?: AbortSignal }): Promise<{ url: string; contentType: string; body: Buffer }> {
    let current = urlValue;
    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
      const url = await this.validateUrl(current);
      let response: Response | null = null;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const timeout = AbortSignal.timeout(this.timeoutMs);
        const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
        try {
          response = await this.fetchImpl(url, {
            redirect: 'manual',
            signal,
            headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.7', Accept: options.accept },
          });
        } catch (error) {
          if (options.signal?.aborted || attempt === MAX_ATTEMPTS) throw error;
          await delay(250 * (2 ** (attempt - 1)), undefined, { signal: options.signal });
          continue;
        }
        if (![408, 425, 429, 500, 502, 503, 504].includes(response.status) || attempt === MAX_ATTEMPTS) break;
        const retryAfter = Number(response.headers.get('retry-after'));
        await response.body?.cancel();
        response = null;
        const waitMs = Number.isFinite(retryAfter) && retryAfter >= 0 ? Math.min(retryAfter * 1_000, 10_000) : 250 * (2 ** (attempt - 1));
        await delay(waitMs, undefined, { signal: options.signal });
      }
      if (!response) throw new Error('Serviço remoto indisponível');
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Redirecionamento remoto inválido');
        await response.body?.cancel();
        current = new URL(location, url).toString();
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new Error(`Serviço remoto respondeu com HTTP ${response.status}`);
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > options.maxBytes) throw new Error('Resposta remota excede o limite permitido');
      if (!response.body) return { url: response.url || url.toString(), contentType: response.headers.get('content-type') ?? '', body: Buffer.alloc(0) };
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > options.maxBytes) {
          await reader.cancel();
          throw new Error('Resposta remota excede o limite permitido');
        }
        chunks.push(Buffer.from(value));
      }
      return { url: response.url || url.toString(), contentType: response.headers.get('content-type') ?? '', body: Buffer.concat(chunks) };
    }
    throw new Error('Muitos redirecionamentos remotos');
  }

  async json(url: string, signal?: AbortSignal): Promise<Record<string, unknown>> {
    const response = await this.get(url, { maxBytes: MAX_JSON_BYTES, accept: 'application/json', signal });
    if (!response.contentType.toLowerCase().includes('json')) throw new Error('O serviço remoto não retornou JSON');
    try {
      const parsed: unknown = JSON.parse(response.body.toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      throw new Error('JSON remoto inválido');
    }
  }
}

function relationshipNames(item: Record<string, unknown>, type: string): string[] {
  const relationships = Array.isArray(item.relationships) ? item.relationships : [];
  const names = relationships.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const relation = raw as Record<string, unknown>;
    const attributes = relation.attributes as Record<string, unknown> | undefined;
    return relation.type === type && typeof attributes?.name === 'string' ? [attributes.name] : [];
  });
  return [...new Set(names)];
}

function parseManga(raw: unknown, preferred = ['pt-br', 'en']): RemoteManga {
  if (!raw || typeof raw !== 'object') throw new Error('Obra remota inválida');
  const item = raw as Record<string, unknown>;
  const attributes = (item.attributes ?? {}) as Record<string, unknown>;
  const id = String(item.id ?? '');
  if (!id) throw new Error('Obra remota sem ID');
  const relationships = Array.isArray(item.relationships) ? item.relationships : [];
  let coverFilename: string | null = null;
  for (const rawRelation of relationships) {
    if (!rawRelation || typeof rawRelation !== 'object') continue;
    const relation = rawRelation as Record<string, unknown>;
    const relationAttributes = relation.attributes as Record<string, unknown> | undefined;
    if (relation.type === 'cover_art' && typeof relationAttributes?.fileName === 'string') coverFilename = relationAttributes.fileName;
  }
  const altTitles = Array.isArray(attributes.altTitles)
    ? attributes.altTitles.map((value) => localized(value, preferred)).filter(Boolean)
    : [];
  const tags = Array.isArray(attributes.tags)
    ? attributes.tags.map((value) => localized((value as Record<string, unknown>)?.attributes && ((value as Record<string, unknown>).attributes as Record<string, unknown>).name, preferred)).filter(Boolean)
    : [];
  const availableLanguages = Array.isArray(attributes.availableTranslatedLanguages)
    ? attributes.availableTranslatedLanguages.filter((value): value is string => typeof value === 'string').sort()
    : [];
  const coverUrl = coverFilename ? `${MANGADEX_COVERS}/${id}/${coverFilename}` : null;
  return {
    source: 'mangadex', sourceId: id, sourceUrl: `https://mangadex.org/title/${id}`,
    title: localized(attributes.title, preferred) || 'Mangá',
    description: localized(attributes.description, preferred),
    altTitles: [...new Set(altTitles)], authors: relationshipNames(item, 'author'), artists: relationshipNames(item, 'artist'),
    tags: [...new Set(tags)], year: typeof attributes.year === 'number' ? attributes.year : null,
    status: typeof attributes.status === 'string' ? attributes.status : null,
    demographic: typeof attributes.publicationDemographic === 'string' ? attributes.publicationDemographic : null,
    contentRating: typeof attributes.contentRating === 'string' ? attributes.contentRating : null,
    originalLanguage: typeof attributes.originalLanguage === 'string' ? attributes.originalLanguage : null,
    availableLanguages, coverUrl, thumbnailUrl: coverUrl ? `${coverUrl}.256.jpg` : null,
  };
}

function parseChapter(raw: unknown): RemoteChapter {
  if (!raw || typeof raw !== 'object') throw new Error('Capítulo remoto inválido');
  const item = raw as Record<string, unknown>;
  const attributes = (item.attributes ?? {}) as Record<string, unknown>;
  const id = String(item.id ?? '');
  const numberText = typeof attributes.chapter === 'string' ? attributes.chapter : 'sem número';
  const volume = typeof attributes.volume === 'string' ? attributes.volume : '';
  const extraTitle = typeof attributes.title === 'string' ? attributes.title.trim() : '';
  const language = typeof attributes.translatedLanguage === 'string' ? attributes.translatedLanguage : null;
  const group = relationshipNames(item, 'scanlation_group').join(', ') || 'sem grupo';
  let label = `${volume ? `Volume ${volume} - ` : ''}Capítulo ${numberText}${extraTitle ? ` - ${extraTitle}` : ''}`;
  label += ` [${language ?? '-'}] [${group}] [${id.slice(0, 8)}]`;
  const number = /^\d+(?:[.,]\d+)?$/.test(numberText) ? Number(numberText.replace(',', '.')) : null;
  return { source: 'mangadex', sourceId: id, title: label, url: `https://mangadex.org/chapter/${id}`, language, group, number };
}

function addParams(base: string, entries: [string, string | number][]): string {
  const url = new URL(base);
  for (const [key, value] of entries) url.searchParams.append(key, String(value));
  return url.toString();
}

function extractHtmlTitle(html: string, url: string): string {
  for (const pattern of [/<h1[^>]*(?:entry-title|post-title|manga-title)[^>]*>([\s\S]*?)<\/h1>/i, /<h1[^>]*>([\s\S]*?)<\/h1>/i, /<title[^>]*>([\s\S]*?)<\/title>/i]) {
    const match = html.match(pattern);
    if (match && decodeHtml(match[1])) return cleanName(decodeHtml(match[1]).split(/\s[|–—]\s/)[0]);
  }
  return cleanName(decodeURIComponent(path.basename(new URL(url).pathname)), 'Mangá');
}

function extractHtmlChapters(html: string, baseUrl: string): RemoteChapter[] {
  const found = new Map<string, RemoteChapter>();
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const title = decodeHtml(match[2]);
    let url: URL;
    try { url = new URL(match[1], baseUrl); } catch { continue; }
    if (!/(?:cap[ií]tulo|cap\.?\s*\d|chapter|\d)/i.test(`${title} ${url.pathname}`)) continue;
    url.hash = '';
    const sourceId = url.toString();
    const numberMatch = `${title} ${url.pathname}`.match(/(?:cap[ií]tulo|chapter|cap\.?)\D*(\d+(?:[.,]\d+)?)/i);
    found.set(sourceId, { source: 'html', sourceId, title: cleanName(title || decodeURIComponent(path.basename(url.pathname)), 'Capítulo'), url: sourceId, language: null, group: null, number: numberMatch ? Number(numberMatch[1].replace(',', '.')) : null });
    if (found.size >= 500) break;
  }
  return [...found.values()].sort((a, b) => (a.number ?? Number.MAX_VALUE) - (b.number ?? Number.MAX_VALUE) || a.title.localeCompare(b.title, 'pt-BR', { numeric: true }));
}

function candidateImage(value: string, baseUrl: string): string | null {
  let cleaned = value.trim().replace(/^['"]|['"]$/g, '').replace(/\\\//g, '/').replace(/\\u0026/g, '&');
  if (!cleaned || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return null;
  if (cleaned.includes(',') || /\s+\d+[wx](?:\s|$)/.test(cleaned)) cleaned = cleaned.split(',').at(-1)!.trim().split(/\s+/)[0];
  try {
    const url = new URL(cleaned, baseUrl);
    return IMAGE_EXTENSIONS.has(path.extname(url.pathname).toLowerCase()) ? url.toString() : null;
  } catch { return null; }
}

function extractHtmlImages(html: string, baseUrl: string): string[] {
  const found: string[] = [];
  for (const image of html.matchAll(/<img\b[^>]*>/gi)) {
    for (const attribute of ['data-src', 'data-lazy-src', 'data-original', 'data-url', 'data-image', 'src', 'data-srcset', 'srcset']) {
      const value = image[0].match(new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1];
      const candidate = value ? candidateImage(value, baseUrl) : null;
      if (candidate) { found.push(candidate); break; }
    }
  }
  for (const pattern of [/['"](?:url|src|image)['"]\s*:\s*['"]([^'"]+\.(?:jpe?g|png|webp|gif|avif)(?:\?[^'"]*)?)['"]/gi, /['"](https?:\\?\/\\?\/[^'"]+\.(?:jpe?g|png|webp|gif|avif)(?:\?[^'"]*)?)['"]/gi]) {
    for (const match of html.matchAll(pattern)) {
      const candidate = candidateImage(match[1], baseUrl);
      if (candidate) found.push(candidate);
    }
  }
  return [...new Set(found)].filter((url) => !/(?:^|[/_.-])(?:logo|avatar|icon|emoji|banner|advert|ads?)(?:[/_.-]|$)/i.test(new URL(url).pathname)).slice(0, 1000);
}

export class MangaScraperService implements ScraperService {
  private readonly http: SafeHttpClient;

  constructor(options: { fetchImpl?: FetchLike; resolveHostname?: ResolveHostname; timeoutMs?: number } = {}) {
    this.http = new SafeHttpClient(options.fetchImpl ?? fetch, options.resolveHostname ?? defaultResolveHostname, options.timeoutMs);
  }

  async searchManga(filters: SearchFilters, signal?: AbortSignal) {
    const limit = Math.max(1, Math.min(filters.limit ?? 20, 100));
    const offset = Math.max(0, filters.offset ?? 0);
    const allowedOrders = new Set(['relevance', 'latestUploadedChapter', 'followedCount', 'createdAt', 'updatedAt', 'year', 'title']);
    let order = allowedOrders.has(filters.order ?? '') ? filters.order! : 'relevance';
    if (!filters.query?.trim() && order === 'relevance') order = 'followedCount';
    const entries: [string, string | number][] = [['limit', limit], ['offset', offset], [`order[${order}]`, order === 'title' ? 'asc' : 'desc']];
    if (filters.query?.trim()) entries.push(['title', filters.query.trim()]);
    if (filters.year) entries.push(['year', filters.year]);
    for (const [key, values] of [
      ['includedTags[]', filters.includedTags], ['status[]', filters.statuses],
      ['publicationDemographic[]', filters.demographics], ['originalLanguage[]', filters.originalLanguages],
      ['contentRating[]', filters.contentRatings?.length ? filters.contentRatings : ['safe', 'suggestive', 'erotica']],
    ] as [string, string[] | undefined][]) for (const value of values ?? []) entries.push([key, value]);
    for (const include of ['cover_art', 'author', 'artist']) entries.push(['includes[]', include]);
    const payload = await this.http.json(addParams(`${MANGADEX_API}/manga`, entries), signal);
    const data = Array.isArray(payload.data) ? payload.data : [];
    return { items: data.map((item) => parseManga(item)), total: typeof payload.total === 'number' ? payload.total : data.length };
  }

  async listTags(signal?: AbortSignal) {
    const payload = await this.http.json(`${MANGADEX_API}/manga/tag`, signal);
    const data = Array.isArray(payload.data) ? payload.data : [];
    return data.flatMap((raw) => {
      if (!raw || typeof raw !== 'object') return [];
      const item = raw as Record<string, unknown>;
      const name = localized(((item.attributes as Record<string, unknown> | undefined)?.name), ['pt-br', 'en']);
      return typeof item.id === 'string' && name ? [{ id: item.id, name }] : [];
    }).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async getManga(sourceId: string, preferredLanguages = ['pt-br', 'en'], signal?: AbortSignal) {
    const url = addParams(`${MANGADEX_API}/manga/${encodeURIComponent(sourceId)}`, ['cover_art', 'author', 'artist'].map((value) => ['includes[]', value]));
    const payload = await this.http.json(url, signal);
    return parseManga(payload.data, preferredLanguages);
  }

  async getMangaChapters(sourceId: string, languages: string[], page: number, limit: number, signal?: AbortSignal) {
    const boundedLimit = Math.max(1, Math.min(limit, 100));
    const entries: [string, string | number][] = [
      ['limit', boundedLimit], ['offset', Math.max(0, page - 1) * boundedLimit], ['includes[]', 'scanlation_group'],
      ['order[volume]', 'asc'], ['order[chapter]', 'asc'], ['contentRating[]', 'safe'], ['contentRating[]', 'suggestive'], ['contentRating[]', 'erotica'],
    ];
    for (const language of [...new Set(languages)]) entries.push(['translatedLanguage[]', language]);
    const payload = await this.http.json(addParams(`${MANGADEX_API}/manga/${encodeURIComponent(sourceId)}/feed`, entries), signal);
    const data = Array.isArray(payload.data) ? payload.data : [];
    return { chapters: data.map(parseChapter), total: typeof payload.total === 'number' ? payload.total : data.length };
  }

  async analyzeUrl(url: string, signal?: AbortSignal): Promise<{ manga: RemoteManga; chapters: RemoteChapter[] }> {
    const mangaDexMatch = new URL(url).pathname.match(/^\/title\/([0-9a-f-]{36})(?:\/|$)/i);
    if (['mangadex.org', 'www.mangadex.org'].includes(new URL(url).hostname.toLowerCase()) && mangaDexMatch) {
      const manga = await this.getManga(mangaDexMatch[1], ['pt-br', 'en'], signal);
      return { manga, chapters: [] };
    }
    const response = await this.http.get(url, { maxBytes: MAX_HTML_BYTES, accept: 'text/html,application/xhtml+xml', signal });
    if (!response.contentType.toLowerCase().includes('html')) throw new Error('A URL não retornou uma página HTML');
    const html = response.body.toString('utf8');
    const title = extractHtmlTitle(html, response.url);
    let chapters = extractHtmlChapters(html, response.url);
    if (chapters.length === 0) chapters = [{ source: 'html', sourceId: response.url, title, url: response.url, language: null, group: null, number: null }];
    const sourceUrl = response.url;
    const manga: RemoteManga = {
      source: 'html', sourceId: sourceUrl, sourceUrl, title, description: '', altTitles: [], authors: [], artists: [], tags: [],
      year: null, status: null, demographic: null, contentRating: null, originalLanguage: null, availableLanguages: [], coverUrl: null, thumbnailUrl: null,
    };
    return {
      manga,
      chapters,
    };
  }

  async downloadChapter(chapter: RemoteChapter, destination: string, options: { dataSaver: boolean; signal?: AbortSignal; onProgress?: DownloadProgress }) {
    let images: string[];
    if (chapter.source === 'mangadex') {
      const payload = await this.http.json(`${MANGADEX_API}/at-home/server/${encodeURIComponent(chapter.sourceId)}`, options.signal);
      const details = payload.chapter as Record<string, unknown> | undefined;
      const files = details?.[options.dataSaver ? 'dataSaver' : 'data'];
      if (!details || !Array.isArray(files) || typeof details.hash !== 'string' || typeof payload.baseUrl !== 'string') throw new Error('Manifesto de capítulo inválido');
      const route = options.dataSaver ? 'data-saver' : 'data';
      images = files.filter((name): name is string => typeof name === 'string').map((name) => `${payload.baseUrl}/${route}/${details.hash}/${name}`);
    } else {
      const response = await this.http.get(chapter.url, { maxBytes: MAX_HTML_BYTES, accept: 'text/html,application/xhtml+xml', signal: options.signal });
      if (!response.contentType.toLowerCase().includes('html')) throw new Error('O capítulo não retornou HTML');
      images = extractHtmlImages(response.body.toString('utf8'), response.url);
    }
    if (images.length === 0) throw new Error('Nenhuma página de imagem encontrada');
    if (images.length > 1000) throw new Error('O capítulo excede o limite de páginas');
    const folder = path.join(destination, cleanName(chapter.title, 'Capítulo'));
    fs.mkdirSync(folder, { recursive: true });
    const digits = Math.max(3, String(images.length).length);
    let downloaded = 0;
    let skipped = 0;
    for (let index = 0; index < images.length; index++) {
      if (options.signal?.aborted) throw options.signal.reason ?? new Error('Download cancelado');
      const imageUrl = images[index];
      const suffix = IMAGE_EXTENSIONS.has(path.extname(new URL(imageUrl).pathname).toLowerCase()) ? path.extname(new URL(imageUrl).pathname).toLowerCase() : '.jpg';
      const target = path.join(folder, `${String(index + 1).padStart(digits, '0')}${suffix}`);
      if (fs.existsSync(target) && fs.statSync(target).size > 0) {
        skipped++;
        options.onProgress?.(index + 1, images.length, true);
        continue;
      }
      const response = await this.http.get(imageUrl, { maxBytes: MAX_IMAGE_BYTES, accept: 'image/avif,image/webp,image/*', signal: options.signal });
      if (!response.contentType.toLowerCase().startsWith('image/')) throw new Error('Uma página remota não retornou uma imagem');
      const temporary = `${target}.part`;
      fs.writeFileSync(temporary, response.body);
      fs.renameSync(temporary, target);
      downloaded++;
      options.onProgress?.(index + 1, images.length, false);
      if (index < images.length - 1) await delay(250, undefined, { signal: options.signal });
    }
    const metadata = { title: chapter.title, url: chapter.url, language: chapter.language, group: chapter.group, images, dataSaver: options.dataSaver };
    fs.writeFileSync(path.join(folder, 'chapter.json.part'), JSON.stringify(metadata, null, 2), 'utf8');
    fs.renameSync(path.join(folder, 'chapter.json.part'), path.join(folder, 'chapter.json'));
    return { folder, pageCount: images.length, downloaded, skipped };
  }

  async downloadCover(url: string, signal?: AbortSignal): Promise<Buffer> {
    const response = await this.http.get(url, { maxBytes: MAX_IMAGE_BYTES, accept: 'image/*', signal });
    if (!response.contentType.toLowerCase().startsWith('image/')) throw new Error('A capa remota não retornou uma imagem');
    return response.body;
  }
}
