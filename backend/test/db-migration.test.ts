import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import { resolveDefaultDbPath } from '../src/db/index.js';

function temporaryDataDir(t: test.TestContext): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chernobyl-vault-migration-'));
  t.after(() => fs.rmSync(dataDir, { recursive: true, force: true }));
  return dataDir;
}

function createDatabase(filePath: string, value: string): void {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.exec('CREATE TABLE marker (value TEXT NOT NULL)');
  db.prepare('INSERT INTO marker (value) VALUES (?)').run(value);
  db.close();
}

test('legacy database is checkpointed and renamed without losing data', (t) => {
  const dataDir = temporaryDataDir(t);
  const legacyPath = path.join(dataDir, 'manga-reader.db');
  const currentPath = path.join(dataDir, 'chernobyl-vault.db');
  createDatabase(legacyPath, 'legacy');

  assert.equal(resolveDefaultDbPath(dataDir), currentPath);
  assert.equal(fs.existsSync(legacyPath), false);
  const migrated = new Database(currentPath, { readonly: true });
  assert.equal((migrated.prepare('SELECT value FROM marker').get() as { value: string }).value, 'legacy');
  migrated.close();
});

test('current database wins when both filenames exist', (t) => {
  const dataDir = temporaryDataDir(t);
  const legacyPath = path.join(dataDir, 'manga-reader.db');
  const currentPath = path.join(dataDir, 'chernobyl-vault.db');
  createDatabase(legacyPath, 'legacy');
  createDatabase(currentPath, 'current');

  assert.equal(resolveDefaultDbPath(dataDir), currentPath);
  assert.equal(fs.existsSync(legacyPath), true);
});

test('new installations select the Chernobyl Vault database filename', (t) => {
  const dataDir = temporaryDataDir(t);
  assert.equal(resolveDefaultDbPath(dataDir), path.join(dataDir, 'chernobyl-vault.db'));
});

test('rename failure falls back to the usable legacy database', (t) => {
  const dataDir = temporaryDataDir(t);
  const legacyPath = path.join(dataDir, 'manga-reader.db');
  createDatabase(legacyPath, 'legacy');

  const resolved = resolveDefaultDbPath(dataDir, () => { throw new Error('rename denied'); });

  assert.equal(resolved, legacyPath);
  const legacy = new Database(resolved, { readonly: true });
  assert.equal((legacy.prepare('SELECT value FROM marker').get() as { value: string }).value, 'legacy');
  legacy.close();
});
