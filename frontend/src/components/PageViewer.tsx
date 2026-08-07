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
  const [verticalPageErrors, setVerticalPageErrors] = useState<Set<number>>(() => new Set());
  const fitMode = useAppStore((s) => s.fitMode);
  const setFitMode = useAppStore((s) => s.setFitMode);
  const readingDirection = useAppStore((s) => s.readingDirection);
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLImageElement | null)[]>([]);
  const touchStart = useRef<number | null>(null);
  const vertical = readingDirection === 'vertical';

  const goTo = useCallback((next: number) => {
    if (pageCount <= 0) return;
    const clamped = Math.max(0, Math.min(pageCount - 1, next));
    if (clamped === page) return;
    setPage(clamped);
    setPageError(false);
    onPageChange?.(clamped);
  }, [page, pageCount, onPageChange]);

  const moveTo = useCallback((target: number) => {
    const clamped = Math.max(0, Math.min(pageCount - 1, target));
    goTo(clamped);
    if (vertical) pageRefs.current[clamped]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [goTo, pageCount, vertical]);

  const prev = useCallback(() => moveTo(readingDirection === 'rtl' ? page + 1 : page - 1), [moveTo, readingDirection, page]);
  const next = useCallback(() => moveTo(readingDirection === 'rtl' ? page - 1 : page + 1), [moveTo, readingDirection, page]);

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
      if (vertical && e.key === 'ArrowUp') prev();
      if (vertical && e.key === 'ArrowDown') next();
      if (e.key === 'f' || e.key === 'F') toggleFullscreen();
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, toggleFullscreen, onClose, vertical]);

  useEffect(() => {
    if (!vertical || initialPage <= 0) return;
    pageRefs.current[initialPage]?.scrollIntoView({ block: 'start' });
  }, [initialPage, vertical]);

  const fitClass = (mode: FitMode) => {
    switch (mode) {
      case 'fit-width': return 'w-full h-auto max-h-[calc(100vh-8rem)] object-contain';
      case 'fit-height': return 'h-[calc(100vh-8rem)] w-auto object-contain';
      default: return 'max-w-none';
    }
  };

  const verticalFitClass = (mode: FitMode) => {
    switch (mode) {
      case 'fit-width': return 'w-full h-auto max-h-none';
      case 'fit-height': return 'h-[calc(100vh-8rem)] w-auto max-w-full object-contain';
      default: return 'max-w-none';
    }
  };

  const progress = pageCount > 0 ? ((page + 1) / pageCount) * 100 : 0;

  const updateVerticalProgress = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const viewerRect = viewer.getBoundingClientRect();
    const center = viewerRect.top + viewer.clientHeight / 2;
    let closestPage = page;
    let closestDistance = Number.POSITIVE_INFINITY;
    pageRefs.current.forEach((image, index) => {
      if (!image) return;
      const rect = image.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = index;
      }
    });
    goTo(closestPage);
  }, [goTo, page]);

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
        ref={viewerRef}
        className={`flex-1 overflow-auto relative select-none ${vertical ? 'bg-black' : 'flex items-center justify-center'}`}
        onScroll={vertical ? updateVerticalProgress : undefined}
        onClick={(e) => {
          if (vertical) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const x = e.clientX - rect.left;
          x < rect.width / 2 ? prev() : next();
        }}
        onTouchStart={(e) => { if (!vertical) touchStart.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          if (vertical) {
            touchStart.current = null;
            return;
          }
          if (touchStart.current == null) return;
          const diff = e.changedTouches[0].clientX - touchStart.current;
          if (Math.abs(diff) > 50) diff > 0 ? prev() : next();
          touchStart.current = null;
        }}
      >
        {vertical ? (
          <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
            {Array.from({ length: pageCount }, (_, index) => (
              verticalPageErrors.has(index) ? (
                <div key={index} role="alert" className="flex min-h-64 w-full flex-col items-center justify-center gap-3 text-white">
                  <p>Não foi possível carregar a página {index + 1}.</p>
                  <button
                    type="button"
                    className="rounded bg-violet-600 px-4 py-2"
                    onClick={() => setVerticalPageErrors((current) => {
                      const nextErrors = new Set(current);
                      nextErrors.delete(index);
                      return nextErrors;
                    })}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : (
                <img
                  key={index}
                  ref={(element) => { pageRefs.current[index] = element; }}
                  src={api.pageUrl(chapterId, index)}
                  alt={`Página ${index + 1}`}
                  className={`${verticalFitClass(fitMode)} block shrink-0`}
                  style={{ transform: fitMode === 'original' ? `scale(${zoom})` : undefined }}
                  draggable={false}
                  loading={index > initialPage + 1 ? 'lazy' : 'eager'}
                  onError={() => setVerticalPageErrors((current) => new Set(current).add(index))}
                />
              )
            ))}
          </div>
        ) : pageError ? (
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
        {!vertical ? (
          <>
            <button type="button" aria-label="Página à esquerda" className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white" onClick={(e) => { e.stopPropagation(); prev(); }}>
              <ChevronLeft className="w-8 h-8" />
            </button>
            <button type="button" aria-label="Página à direita" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white" onClick={(e) => { e.stopPropagation(); next(); }}>
              <ChevronRight className="w-8 h-8" />
            </button>
          </>
        ) : null}
      </div>

      <div className="h-1.5 bg-zinc-800">
        <div className="h-full bg-violet-600 transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
