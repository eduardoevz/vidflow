import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, it, expect } from 'vitest';
import { renderFilenameTemplate } from '../../electron/main/downloads/filenameTemplate';
import { parseReleaseNumber } from '../../electron/main/updater/updateService';
import { SubscriptionsRepo } from '../../electron/main/database/subscriptionsRepo';

describe('v2 features', () => {
  it('renders subfolder templates safely and neutralizes traversal', () => {
    const rendered = renderFilenameTemplate('{site}/{author}/{title}', {
      site: 'youtube.com',
      author: 'Canal/Test',
      title: 'Mi Video',
    });
    expect(rendered).toBe(path.join('youtube.com', 'Canal_Test', 'Mi Video'));

    const traversal = renderFilenameTemplate('../{title}', { title: 'Video' });
    expect(traversal).toBe(path.join('untitled', 'Video'));
  });

  it('parses incremental GitHub release numbers', () => {
    expect(parseReleaseNumber('v1')).toBe(1);
    expect(parseReleaseNumber('v2')).toBe(2);
    expect(parseReleaseNumber('v12')).toBe(12);
  });

  it('persists and updates subscriptions in SQLite', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        preset TEXT NOT NULL DEFAULT 'best_1080p',
        seen_urls_json TEXT NOT NULL DEFAULT '[]',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_checked_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    const repo = new SubscriptionsRepo(db);
    const created = repo.insert({
      url: 'https://www.youtube.com/@test/videos',
      title: 'Test Channel',
      preset: 'best_1080p',
      seenUrls: ['https://www.youtube.com/watch?v=1'],
    });
    expect(created.title).toBe('Test Channel');
    expect(created.seenUrls).toHaveLength(1);

    repo.setEnabled(created.id, false);
    expect(repo.list()[0]?.enabled).toBe(false);
    repo.remove(created.id);
    expect(repo.list()).toHaveLength(0);
    db.close();
  });
});
