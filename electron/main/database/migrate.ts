import fs from 'node:fs';
import path from 'node:path';
import type Database from 'better-sqlite3';

interface MigrationFile {
  version: number;
  name: string;
  fullPath: string;
}

function loadMigrationFiles(migrationsDir: string): MigrationFile[] {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  return files.map((file) => {
    const match = /^(\d+)_(.+)\.sql$/.exec(file);
    if (!match) {
      throw new Error(`Migration file "${file}" does not match "<version>_<name>.sql"`);
    }
    return {
      version: Number(match[1]),
      name: match[2] ?? file,
      fullPath: path.join(migrationsDir, file),
    };
  });
}

export function runMigrations(db: Database.Database, migrationsDir: string): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version),
  );

  const migrations = loadMigrationFiles(migrationsDir).sort((a, b) => a.version - b.version);

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;
    const sql = fs.readFileSync(migration.fullPath, 'utf-8');
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name,
      );
    });
    applyMigration();
  }
}
