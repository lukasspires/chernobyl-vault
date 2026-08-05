import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../store';
import { PageViewer } from './PageViewer';

vi.mock('../api', () => ({ api: { pageUrl: () => '/page.png' } }));

describe('PageViewer navigation', () => {
  beforeEach(() => useAppStore.setState({ readingDirection: 'ltr', fitMode: 'fit-width' }));

  it('keeps LTR navigation within bounds', () => {
    const onPageChange = vi.fn();
    render(<PageViewer chapterId={1} pageCount={2} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Página à esquerda' }));
    expect(onPageChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Página à direita' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  it('reverses page controls in RTL mode', () => {
    useAppStore.setState({ readingDirection: 'rtl' });
    const onPageChange = vi.fn();
    render(<PageViewer chapterId={1} pageCount={2} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Página à direita' }));
    expect(onPageChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Página à esquerda' }));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });
});
