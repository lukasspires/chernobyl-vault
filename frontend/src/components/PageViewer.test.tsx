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

  it('renders every page for continuous vertical reading', () => {
    useAppStore.setState({ readingDirection: 'vertical' });
    render(<PageViewer chapterId={1} pageCount={3} />);

    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getByRole('img', { name: 'Página 3' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página à esquerda' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Página à direita' })).not.toBeInTheDocument();
  });

  it('navigates between adjacent chapters and disables missing boundaries', () => {
    const onChapterChange = vi.fn();
    render(
      <PageViewer
        chapterId={2}
        chapterTitle="Capítulo 2"
        pageCount={3}
        previousChapter={{ id: 1, title: 'Capítulo 1' }}
        nextChapter={null}
        onChapterChange={onChapterChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Capítulo anterior: Capítulo 1' }));
    expect(onChapterChange).toHaveBeenCalledWith(1);
    expect(screen.getByRole('button', { name: 'Sem próximo capítulo' })).toBeDisabled();
    expect(screen.getByText('Capítulo 2')).toBeInTheDocument();
  });
});
