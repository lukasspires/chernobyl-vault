import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark' | 'system';
export type FitMode = 'fit-width' | 'fit-height' | 'original';
export type ReadingDirection = 'ltr' | 'rtl' | 'vertical';

export const SETTINGS_STORAGE_KEY = 'chernobyl-vault-settings';
export const LEGACY_SETTINGS_STORAGE_KEY = 'manga-reader-settings';

type SettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function migrateLegacySettings(storage: SettingsStorage): boolean {
  try {
    if (storage.getItem(SETTINGS_STORAGE_KEY) !== null) return false;
    const legacy = storage.getItem(LEGACY_SETTINGS_STORAGE_KEY);
    if (legacy === null) return false;
    const parsed: unknown = JSON.parse(legacy);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    const state = (parsed as Record<string, unknown>).state;
    if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
    storage.setItem(SETTINGS_STORAGE_KEY, legacy);
    if (storage.getItem(SETTINGS_STORAGE_KEY) !== legacy) return false;
    storage.removeItem(LEGACY_SETTINGS_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

if (typeof window !== 'undefined') migrateLegacySettings(window.localStorage);

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
      readingDirection: 'vertical',
      setTheme: (theme) => set({ theme }),
      setFitMode: (fitMode) => set({ fitMode }),
      setReadingDirection: (readingDirection) => set({ readingDirection }),
    }),
    { name: SETTINGS_STORAGE_KEY },
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
