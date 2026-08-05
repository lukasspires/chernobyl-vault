import type { FastifyInstance } from 'fastify';
import type Database from 'better-sqlite3';

const ALLOWED_KEYS = new Set(['library_paths', 'theme', 'reading_direction', 'mal_client_id', 'comicvine_api_key']);
const THEMES = new Set(['system', 'light', 'dark']);
const READING_DIRECTIONS = new Set(['ltr', 'rtl']);

function validateSetting(key: string, value: unknown): string | null {
  if (key === 'library_paths') {
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
      return 'library_paths deve ser uma lista de caminhos não vazios';
    }
  } else if (key === 'theme' && (typeof value !== 'string' || !THEMES.has(value))) {
    return 'theme inválido';
  } else if (key === 'reading_direction' && (typeof value !== 'string' || !READING_DIRECTIONS.has(value))) {
    return 'reading_direction inválido';
  } else if ((key === 'mal_client_id' || key === 'comicvine_api_key') && typeof value !== 'string') {
    return `${key} deve ser uma string`;
  }
  return null;
}

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
    if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
      return reply.status(400).send({ error: 'Configurações inválidas' });
    }
    const body = request.body as Record<string, unknown>;
    const entries = Object.entries(body).filter(([key]) => ALLOWED_KEYS.has(key));
    for (const [key, value] of entries) {
      const error = validateSetting(key, value);
      if (error) return reply.status(400).send({ error });
    }

    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    db.transaction(() => {
      for (const [key, value] of entries) {
        const stored = key === 'library_paths'
          ? JSON.stringify((value as string[]).map((item) => item.trim()))
          : value as string;
        upsert.run(key, stored);
      }
    })();
    return { ok: true };
  });

  app.get('/api/tags', async () => db.prepare(`
    SELECT t.id, t.name, COUNT(st.series_id) AS count
    FROM tags t
    LEFT JOIN series_tags st ON st.tag_id = t.id
    GROUP BY t.id
    ORDER BY t.name
  `).all());
}
