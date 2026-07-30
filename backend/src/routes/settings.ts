import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

const ALLOWED_KEYS = new Set([
  'library_paths',
  'theme',
  'reading_direction',
  'mal_client_id',
  'comicvine_api_key',
]);

export async function settingsRoutes(app: FastifyInstance, db: Database.Database) {
  app.get('/api/settings', async () => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      if (row.key === 'library_paths') {
        try {
          settings[row.key] = JSON.parse(row.value);
        } catch {
          settings[row.key] = [];
        }
      } else {
        settings[row.key] = row.value;
      }
    }
    return settings;
  });

  app.put('/api/settings', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.has(key)) continue;
      const stored = key === 'library_paths' ? JSON.stringify(value) : String(value ?? '');
      upsert.run(key, stored);
    }

    return { ok: true };
  });

  app.get('/api/tags', async () => {
    return db.prepare(`
      SELECT t.id, t.name, COUNT(st.series_id) AS count
      FROM tags t
      LEFT JOIN series_tags st ON st.tag_id = t.id
      GROUP BY t.id
      ORDER BY t.name
    `).all();
  });
}
