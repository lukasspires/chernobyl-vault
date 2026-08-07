import { describe, expect, it } from 'vitest';
import { LEGACY_SETTINGS_STORAGE_KEY, migrateLegacySettings, SETTINGS_STORAGE_KEY } from './store';

class MemoryStorage {
  readonly values = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('storage unavailable');
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

const legacyValue = JSON.stringify({ state: { theme: 'dark', fitMode: 'fit-width', readingDirection: 'rtl' }, version: 0 });

describe('settings storage migration', () => {
  it('moves valid legacy settings to the new key', () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_SETTINGS_STORAGE_KEY, legacyValue);

    expect(migrateLegacySettings(storage)).toBe(true);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBe(legacyValue);
    expect(storage.getItem(LEGACY_SETTINGS_STORAGE_KEY)).toBeNull();
  });

  it('keeps existing Chernobyl Vault settings', () => {
    const storage = new MemoryStorage();
    storage.values.set(SETTINGS_STORAGE_KEY, 'current');
    storage.values.set(LEGACY_SETTINGS_STORAGE_KEY, legacyValue);

    expect(migrateLegacySettings(storage)).toBe(false);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBe('current');
    expect(storage.getItem(LEGACY_SETTINGS_STORAGE_KEY)).toBe(legacyValue);
  });

  it('ignores malformed legacy settings', () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_SETTINGS_STORAGE_KEY, '{invalid');

    expect(migrateLegacySettings(storage)).toBe(false);
    expect(storage.getItem(SETTINGS_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_SETTINGS_STORAGE_KEY)).toBe('{invalid');
  });

  it('retains legacy settings when the new value cannot be written', () => {
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_SETTINGS_STORAGE_KEY, legacyValue);
    storage.failWrites = true;

    expect(migrateLegacySettings(storage)).toBe(false);
    expect(storage.getItem(LEGACY_SETTINGS_STORAGE_KEY)).toBe(legacyValue);
  });
});
