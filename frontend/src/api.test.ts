import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';

describe('API request headers', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not send a JSON content type for bodyless scan requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ok: true,
      seriesAdded: 0,
      chaptersAdded: 0,
      chaptersUpdated: 0,
      chaptersRemoved: 0,
      seriesRemoved: 0,
      filesFailed: 0,
      missingPaths: 0,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    await api.scanLibrary();

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe('POST');
    expect(new Headers(options.headers).has('Content-Type')).toBe(false);
  });

  it('adds a JSON content type when a request has a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await api.saveSettings({ theme: 'dark' });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(new Headers(options.headers).get('Content-Type')).toBe('application/json');
  });
});
