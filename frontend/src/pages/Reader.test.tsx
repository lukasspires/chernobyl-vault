import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { Reader } from './Reader';

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const original = await importOriginal<typeof import('@tanstack/react-query')>();
  return { ...original, useQuery: vi.fn() };
});

describe('Reader', () => {
  beforeEach(() => vi.mocked(useQuery).mockReset());

  it('shows a request error instead of loading forever', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: { chapter: null, error: 'Capítulo não encontrado' },
      isLoading: false,
    } as ReturnType<typeof useQuery>);
    renderWithProviders(<Reader />, '/read/999', '/read/:chapterId');
    expect(screen.getByText('Capítulo não encontrado')).toBeInTheDocument();
  });

  it('shows an empty state for a chapter without pages', () => {
    vi.mocked(useQuery).mockReturnValue({
      data: {
        chapter: { id: 1, series_id: 1, title: 'Empty', file_path: '', format: 'folder', page_count: 0, sort_order: 0, progress_page: 0 },
        error: null,
      },
      isLoading: false,
    } as ReturnType<typeof useQuery>);
    renderWithProviders(<Reader />, '/read/1', '/read/:chapterId');
    expect(screen.getByText('Este capítulo não possui páginas disponíveis.')).toBeInTheDocument();
  });
});
