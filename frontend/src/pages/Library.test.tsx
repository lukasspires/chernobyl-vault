import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { api } from '../api';
import { renderWithProviders } from '../test/render';
import { Library } from './Library';

vi.mock('../api', () => ({
  api: {
    getLibrary: vi.fn(),
    getTags: vi.fn(),
    scanLibrary: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(api.getLibrary).mockResolvedValue([]);
  vi.mocked(api.getTags).mockResolvedValue([]);
});

it('reports partial scanner failures', async () => {
  vi.mocked(api.scanLibrary).mockResolvedValue({
    ok: true, seriesAdded: 1, chaptersAdded: 2, chaptersUpdated: 0, chaptersRemoved: 0,
    seriesRemoved: 0, filesFailed: 1, missingPaths: 1,
  });
  renderWithProviders(<Library />);
  fireEvent.click(await screen.findByRole('button', { name: 'Reescanear' }));
  expect(await screen.findByText(/1 arquivo\(s\) falharam/)).toBeInTheDocument();
  expect(screen.getByText(/1 caminho\(s\) estão indisponíveis/)).toBeInTheDocument();
});
