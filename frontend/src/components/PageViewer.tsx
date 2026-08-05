import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react';
import { api } from '../api';
import { useAppStore, type FitMode } from '../store';

interface Props {
  chapterId: number;
  pageCount: number;
  initialPage?: number;
  onPageChange?: (page: number) => void;
  onClose?: () => void;
}

export function PageViewer({ chapterId, pageCount, initialPage = 0, onPageChange, onClose }: Props) {
  const [page, setPage] = useState(initialPage);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [pageError, setPageError] = useState(false);
  const fitMode = useAppStore((s) => s.fitMode);
  const setFitMode = useAppStore((s) => s.setFitMode);
  const readingDirection = useAppStore((s) => s.readingDirection);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<number | null>(null);

  const goTo = useCallback((next: number) => {
    if (pageCount <= 0) return;
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    if (clamped === page) return;
    setPage(clamped);
    setPageError(false);
    onPageChange?.(clamped);
  }, [page, pageCount, onPageChange]);

  const prev = useCallback(() => goTo(readingDirection === 'rtl' ? page + 1 : page - 1), [goTo, readingDirection, page]);
  const next = useCallback(() => goTo(readingDirection === 'rtl' ? page - 1 : page + 1), [goTo, readingDirection, page]);

  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      await document.exitFullscreen();
      setFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') prev();
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') next();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, toggleFullscreen, onClose]);

  const fitClass = (mode: FitMode) => {
    switch (mode) {
      case 'fit-width': return 'w-full h-auto max-h-[calc(100vh-8rem)] object-contain';
      case 'fit-height': return 'h-[calc(100vh-8rem)] w-auto object-contain';
      default: return 'max-w-none';
    }
  };

  const progress = pageCount > 0 ? ((page + 1) / pageCount) * 100 : 0;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/90 text-white text-sm">
        <button type="button" onClick={onClose} className="hover:text-violet-400">← Voltar</button>
        <span>Página {page + 1} / {pageCount}</span>
        <div className="flex items-center gap-2">
          {(['fit-width', 'fit-height', 'original'] as FitMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFitMode(mode)}
              className={`px-2 py-1 rounded text-xs ${fitMode === mode ? 'bg-violet-600' : 'bg-zinc-800'}`}
            >
              {mode === 'fit-width' ? 'Largura' : mode === 'fit-height' ? 'Altura' : 'Original'}
            </button>
          ))}
          <button type="button" aria-label="Diminuir zoom" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}><ZoomOut className="w-4 h-4" /></button>
          <button type="button" aria-label="Aumentar zoom" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}><ZoomIn className="w-4 h-4" /></button>
          <button type="button" aria-label="Alternar tela cheia" onClick={toggleFullscreen}>
            {fullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div
        className="flex-1 flex items-center justify-center overflow-auto relative select-none"
        onClick={(e) => {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          x < rect.width / 2 ? prev() : next();
        }}
        onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (touchStart.current == null) return;
          const diff = e.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(diff) > 50) diff > 0 ? prev() : next();
          touchStart.current = null;
        }}
      >
        {pageError ? (
          <div role="alert" className="text-center text-white">
            <p>Não foi possível carregar esta página.</p>
            <button type="button" onClick={(event) => { event.stopPropagation(); setPageError(false); }} className="mt-3 rounded bg-violet-600 px-4 py-2">
              Tentar novamente
            </button>
          </div>
        ) : (
          <img
            src={api.pageUrl(chapterId, page)}
            alt={`Página ${page + 1}`}
            className={`${fitClass(fitMode)} transition-transform`}
            style={{ transform: fitMode === 'original' ? `scale(${zoom})` : undefined }}
            draggable={false}
            onError={() => setPageError(true)}
          />
        )}
        <button type="button" aria-label="Página à esquerda" className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white" onClick={(e) => { e.stopPropagation(); prev(); }}>
          <ChevronLeft className="w-8 h-8" />
        </button>
        <button type="button" aria-label="Página à direita" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white" onClick={(e) => { e.stopPropagation(); next(); }}>
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      <div className="h-1.5 bg-zinc-800">
        <div className="h-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
