const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Erro na requisição');
  }
  return res.json();
}

export interface Series {
  id: number;
  title: string;
  type: 'manga' | 'comic';
  cover_path: string | null;
  description: string | null;
  is_favorite: number;
  chapter_count: number;
  last_chapter_id: number | null;
  last_page: number | null;
}

export interface Chapter {
  id: number;
  series_id: number;
  title: string;
  file_path: string;
  format: string;
  page_count: number;
  sort_order: number;
  progress_page?: number;
  is_read?: number;
}

export interface SeriesDetail extends Series {
  chapters: Chapter[];
  tags: { id: number; name: string }[];
}

export interface HistoryEntry {
  id: number;
  page: number;
  read_at: string;
  chapter_id: number;
  chapter_title: string;
  page_count: number;
  series_id: number;
  series_title: string;
  type: string;
}

export interface MetadataResult {
  id: number;
  title: string;
  synopsis?: string;
  description?: string;
  imageUrl: string | null;
}

export interface ScanResult {
  ok: boolean;
  seriesAdded: number;
  chaptersAdded: number;
  chaptersUpdated: number;
  chaptersRemoved: number;
  seriesRemoved: number;
  filesFailed: number;
  missingPaths: number;
}

export const api = {
  getLibrary: (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    return request<Series[]>(`/library${qs ? `?${qs}` : ''}`);
  },
  scanLibrary: () => request<ScanResult>('/library/scan', { method: 'POST' }),
  getSeries: (id: number) => request<SeriesDetail>(`/series/${id}`),
  toggleFavorite: (id: number) => request<{ favorite: boolean }>(`/series/${id}/favorite`, { method: 'POST' }),
  addTag: (id: number, tagName: string) => request(`/series/${id}/tags`, { method: 'POST', body: JSON.stringify({ tagName }) }),
  removeTag: (id: number, tagId: number) => request(`/series/${id}/tags/${tagId}`, { method: 'DELETE' }),
  getChapter: (id: number) => request<Chapter & { progress_page: number }>(`/chapters/${id}`),
  pageUrl: (chapterId: number, page: number) => `${BASE}/chapters/${chapterId}/pages/${page}`,
  coverUrl: (seriesId: number) => `${BASE}/covers/${seriesId}`,
  getProgress: (chapterId: number) => request<{ page: number }>(`/progress/${chapterId}`),
  saveProgress: (chapterId: number, page: number) =>
    request(`/progress/${chapterId}`, { method: 'PUT', body: JSON.stringify({ page }) }),
  completeChapter: (chapterId: number) => request(`/progress/${chapterId}/complete`, { method: 'POST' }),
  getHistory: () => request<HistoryEntry[]>('/history'),
  getSettings: () => request<Record<string, unknown>>('/settings'),
  saveSettings: (settings: Record<string, unknown>) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),
  getTags: () => request<{ id: number; name: string; count: number }[]>('/tags'),
  searchMetadata: (q: string, source: 'mal' | 'comicvine') =>
    request<MetadataResult[]>(`/metadata/search?q=${encodeURIComponent(q)}&source=${source}`),
  applyMetadata: (seriesId: number, source: 'mal' | 'comicvine', externalId: number) =>
    request(`/series/${seriesId}/metadata`, { method: 'POST', body: JSON.stringify({ source, externalId }) }),
};
