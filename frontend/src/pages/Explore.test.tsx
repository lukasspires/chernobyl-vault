import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExplorePage } from './Explore';
import { renderWithProviders } from '../test/render';

const manga = {
  source: 'mangadex', sourceId: '11111111-1111-4111-8111-111111111111', sourceUrl: 'https://mangadex.org/title/test',
  title: 'Manga Remoto', description: 'Descrição', altTitles: [], authors: ['Autora'], artists: [], tags: [], year: 2025,
  status: 'ongoing', demographic: 'shounen', contentRating: 'safe', originalLanguage: 'ja', availableLanguages: ['pt-br'],
  coverUrl: null, thumbnailUrl: null,
};
const chapter = {
  source: 'mangadex', sourceId: '22222222-2222-4222-8222-222222222222', title: 'Capítulo 1 [pt-br]',
  url: 'https://mangadex.org/chapter/test', language: 'pt-br', group: 'Equipe', number: 1,
};

afterEach(() => vi.restoreAllMocks());

describe('ExplorePage', () => {
  it('selects a remote chapter and starts a library download', async () => {
    const requests: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, init });
      if (url.startsWith('/api/scraper/search')) return new Response(JSON.stringify({ items: [manga], total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url === '/api/scraper/downloads' && init?.method === 'POST') return new Response(JSON.stringify({ id: 'job-1', status: 'queued' }), { status: 202, headers: { 'content-type': 'application/json' } });
      if (url === '/api/scraper/downloads') return new Response(JSON.stringify([]), { status: 200, headers: { 'content-type': 'application/json' } });
      if (url.includes('/chapters?')) return new Response(JSON.stringify({ chapters: [chapter], total: 1 }), { status: 200, headers: { 'content-type': 'application/json' } });
      throw new Error(`Unexpected request: ${url}`);
    }));
    const user = userEvent.setup();
    renderWithProviders(<ExplorePage />);

    await user.click(await screen.findByRole('button', { name: /Manga Remoto/ }));
    await user.click(await screen.findByLabelText(/Capítulo 1/));
    await user.click(screen.getByRole('button', { name: /Baixar e adicionar/ }));

    await waitFor(() => expect(requests.some((request) => request.url === '/api/scraper/downloads' && request.init?.method === 'POST')).toBe(true));
    const started = requests.find((request) => request.url === '/api/scraper/downloads' && request.init?.method === 'POST');
    expect(JSON.parse(String(started?.init?.body)).chapters).toHaveLength(1);
  });
});
