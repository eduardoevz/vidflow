import type Database from 'better-sqlite3';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../shared/settings-types';

export class SettingsRepo {
  constructor(private readonly db: Database.Database) {}

  getAll(): AppSettings {
    const rows = this.db.prepare('SELECT key, value FROM settings').all() as {
      key: string;
      value: string;
    }[];
    const stored: Record<string, unknown> = {};
    for (const row of rows) {
      try {
        stored[row.key] = JSON.parse(row.value);
      } catch {
        // ignore corrupt entries, fall back to default for that key
      }
    }
    return { ...DEFAULT_SETTINGS, ...stored };
  }

  update(patch: Partial<AppSettings>): AppSettings {
    const upsert = this.db.prepare(
      `INSERT INTO settings (key, value) VALUES (@key, @value)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    );
    const applyAll = this.db.transaction((entries: [string, unknown][]) => {
      for (const [key, value] of entries) {
        upsert.run({ key, value: JSON.stringify(value) });
      }
    });
    applyAll(Object.entries(patch));
    return this.getAll();
  }
}
