import { describe, expect, it, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import path from 'node:path';
import { runMigrations } from '../../electron/main/database/migrate';
import { MediaItemsRepo } from '../../electron/main/database/mediaItemsRepo';
import { DownloadsRepo } from '../../electron/main/database/downloadsRepo';
import { HistoryRepo } from '../../electron/main/database/historyRepo';
import { SettingsRepo } from '../../electron/main/database/settingsRepo';

const migrationsDir = path.join(__dirname, '..', '..', 'database', 'migrations');

function createDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  runMigrations(db, migrationsDir);
  return db;
}

describe('database migrations', () => {
  it('creates all expected tables', () => {
    const db = createDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(
      expect.arrayContaining(['media_items', 'downloads', 'history', 'settings', 'schema_migrations']),
    );
  });

  it('is idempotent (running twice does not fail or duplicate)', () => {
    const db = createDb();
    expect(() => runMigrations(db, migrationsDir)).not.toThrow();
    const count = db.prepare('SELECT COUNT(*) as c FROM schema_migrations').get() as { c: number };
    expect(count.c).toBe(1);
  });
});

describe('repositories', () => {
  let db: Database.Database;
  let mediaItemsRepo: MediaItemsRepo;
  let downloadsRepo: DownloadsRepo;
  let historyRepo: HistoryRepo;
  let settingsRepo: SettingsRepo;

  beforeEach(() => {
    db = createDb();
    mediaItemsRepo = new MediaItemsRepo(db);
    downloadsRepo = new DownloadsRepo(db);
    historyRepo = new HistoryRepo(db);
    settingsRepo = new SettingsRepo(db);
  });

  it('inserts a media item and reads it back', () => {
    const id = mediaItemsRepo.insert({
      originalUrl: 'https://example.com/v',
      title: 'Test video',
      source: 'youtube',
    });
    const row = mediaItemsRepo.findById(id);
    expect(row?.title).toBe('Test video');
  });

  it('creates a download joined with its media item', () => {
    const mediaItemId = mediaItemsRepo.insert({
      originalUrl: 'https://example.com/v',
      title: 'Test video',
      source: 'youtube',
    });
    const downloadId = downloadsRepo.insert({
      mediaItemId,
      formatId: '137',
      format: 'mp4',
      filesizeIsEstimate: false,
      resolution: '1080p',
    });
    const record = downloadsRepo.findById(downloadId);
    expect(record?.title).toBe('Test video');
    expect(record?.status).toBe('queued');
  });

  it('marks a download completed and moves it out of listActive', () => {
    const mediaItemId = mediaItemsRepo.insert({ originalUrl: 'u', title: 't', source: 's' });
    const downloadId = downloadsRepo.insert({
      mediaItemId,
      formatId: 'f',
      format: 'mp4',
      filesizeIsEstimate: false,
    });
    expect(downloadsRepo.listActive()).toHaveLength(1);
    downloadsRepo.markCompleted(downloadId, 'C:/downloads/video.mp4');
    expect(downloadsRepo.listActive()).toHaveLength(0);
    expect(downloadsRepo.findById(downloadId)?.status).toBe('completed');
  });

  it('keeps failed downloads in listActive until explicitly deleted', () => {
    const mediaItemId = mediaItemsRepo.insert({ originalUrl: 'u', title: 't', source: 's' });
    const downloadId = downloadsRepo.insert({
      mediaItemId,
      formatId: 'f',
      format: 'mp4',
      filesizeIsEstimate: false,
    });
    downloadsRepo.markFailed(downloadId, 'Network error');
    const active = downloadsRepo.listActive();
    expect(active).toHaveLength(1);
    expect(active[0].status).toBe('failed');
    expect(active[0].errorMessage).toBe('Network error');

    downloadsRepo.delete(downloadId);
    expect(downloadsRepo.listActive()).toHaveLength(0);
    expect(downloadsRepo.findById(downloadId)).toBeUndefined();
  });

  it('markStaleAsFailed transitions non-terminal downloads to failed at startup', () => {
    const mediaItemId = mediaItemsRepo.insert({ originalUrl: 'u', title: 't', source: 's' });
    const downloadId = downloadsRepo.insert({
      mediaItemId,
      formatId: 'f',
      format: 'mp4',
      filesizeIsEstimate: false,
    });
    downloadsRepo.updateProgress(downloadId, 'downloading', 45);

    downloadsRepo.markStaleAsFailed();
    const record = downloadsRepo.findById(downloadId);
    expect(record?.status).toBe('failed');
    expect(record?.errorMessage).toBe('Interrumpida al cerrar la aplicación');
  });

  it('removing a history entry deletes the orphaned media item but not a referenced one', () => {
    const mediaItemId = mediaItemsRepo.insert({ originalUrl: 'u', title: 't', source: 's' });
    const historyId = historyRepo.insert({ mediaItemId, localPath: 'C:/x.mp4', format: 'mp4' });

    historyRepo.delete(historyId);
    mediaItemsRepo.deleteIfOrphaned(mediaItemId);
    expect(mediaItemsRepo.findById(mediaItemId)).toBeUndefined();
  });

  it('history filter matches by search/source/format/resolution', () => {
    const mediaItemId = mediaItemsRepo.insert({ originalUrl: 'u', title: 'Funny Cat Video', source: 'youtube' });
    historyRepo.insert({ mediaItemId, localPath: 'C:/cat.mp4', format: 'mp4', resolution: '1080p' });

    expect(historyRepo.list({ search: 'cat' })).toHaveLength(1);
    expect(historyRepo.list({ search: 'dog' })).toHaveLength(0);
    expect(historyRepo.list({ source: 'youtube' })).toHaveLength(1);
    expect(historyRepo.list({ resolution: '720p' })).toHaveLength(0);
  });

  it('settings repo merges patches over defaults', () => {
    expect(settingsRepo.getAll().concurrentDownloads).toBe(3);
    settingsRepo.update({ concurrentDownloads: 5 });
    expect(settingsRepo.getAll().concurrentDownloads).toBe(5);
    // unrelated defaults remain intact
    expect(settingsRepo.getAll().theme).toBe('system');
  });
});
