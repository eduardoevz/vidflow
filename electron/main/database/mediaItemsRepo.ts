import type Database from 'better-sqlite3';

export interface MediaItemRow {
  id: number;
  original_url: string;
  title: string;
  source: string;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface NewMediaItem {
  originalUrl: string;
  title: string;
  source: string;
  thumbnailPath?: string;
  durationSeconds?: number;
}

export class MediaItemsRepo {
  constructor(private readonly db: Database.Database) {}

  insert(item: NewMediaItem): number {
    const result = this.db
      .prepare(
        `INSERT INTO media_items (original_url, title, source, thumbnail_path, duration_seconds)
         VALUES (@originalUrl, @title, @source, @thumbnailPath, @durationSeconds)`,
      )
      .run({
        originalUrl: item.originalUrl,
        title: item.title,
        source: item.source,
        thumbnailPath: item.thumbnailPath ?? null,
        durationSeconds: item.durationSeconds ?? null,
      });
    return Number(result.lastInsertRowid);
  }

  findById(id: number): MediaItemRow | undefined {
    return this.db.prepare('SELECT * FROM media_items WHERE id = ?').get(id) as
      | MediaItemRow
      | undefined;
  }

  /** Deletes the media item only if no downloads/history rows still reference it. */
  deleteIfOrphaned(id: number): void {
    const downloadCount = this.db
      .prepare('SELECT COUNT(*) as count FROM downloads WHERE media_item_id = ?')
      .get(id) as { count: number };
    const historyCount = this.db
      .prepare('SELECT COUNT(*) as count FROM history WHERE media_item_id = ?')
      .get(id) as { count: number };
    if (downloadCount.count === 0 && historyCount.count === 0) {
      this.db.prepare('DELETE FROM media_items WHERE id = ?').run(id);
    }
  }
}
