import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type FitMode = 'fit-width' | 'fit-height' | 'original';
export type ReadingDirection = 'ltr' | 'rtl';

interface AppState {
  theme: Theme;
  fitMode: FitMode;
  readingDirection: ReadingDirection;
  setTheme: (theme: Theme) => void;
  setFitMode: (mode: FitMode) => void;
  setReadingDirection: (dir: ReadingDirection) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'system',
      fitMode: 'fit-width',
      readingDirection: 'ltr',
      setTheme: (theme) => set({ theme }),
      setFitMode: (fitMode) => set({ fitMode }),
      setReadingDirection: (readingDirection) => set({ readingDirection }),
    }),
    { name: 'manga-reader-settings' },
  ),
);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'system') {
    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', dark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}
