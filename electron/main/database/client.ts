import Database from 'better-sqlite3';
import path from 'node:path';
import { runMigrations } from './migrate';

let db: Database.Database | undefined;

export function initDatabase(userDataDir: string, migrationsDir: string): Database.Database {
  const dbPath = path.join(userDataDir, 'vidflow.db');
  const instance = new Database(dbPath);
  instance.pragma('journal_mode = WAL');
  instance.pragma('foreign_keys = ON');
  runMigrations(instance, migrationsDir);
  db = instance;
  return instance;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized — call initDatabase() first');
  }
  return db;
}
