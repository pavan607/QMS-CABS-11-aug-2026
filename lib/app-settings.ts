import { query } from '@/lib/db';

export async function ensureAppSettingsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT,
      category VARCHAR(50),
      description TEXT,
      updated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function getSetting(key: string): Promise<string | null> {
  await ensureAppSettingsTable();
  const result = await query(`SELECT value FROM settings WHERE key = $1`, [key]);
  const v = result.rows[0]?.value;
  return v == null ? null : String(v);
}

export async function upsertSetting(params: {
  key: string;
  value: string;
  category?: string;
  description?: string;
  updatedBy?: number | null;
}) {
  await ensureAppSettingsTable();
  await query(
    `INSERT INTO settings (key, value, category, description, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE SET
       value = EXCLUDED.value,
       category = COALESCE(EXCLUDED.category, settings.category),
       description = COALESCE(EXCLUDED.description, settings.description),
       updated_by = EXCLUDED.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    [
      params.key,
      params.value,
      params.category || null,
      params.description || null,
      params.updatedBy ?? null,
    ]
  );
}

export function parseBoolSetting(value: string | null, fallback = false): boolean {
  if (value == null) return fallback;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'on';
}
