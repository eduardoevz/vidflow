import type Database from 'better-sqlite3';
import type { HistoryFilter, HistoryRecord } from '../../../shared/ipc-contract';

interface HistoryJoinRow {
  id: number;
  media_item_id: number;
  download_id: number | null;
  local_path: string;
  resolution: string | null;
  format: string;
  filesize: number | null;
  downloaded_at: string;
  title: string;
  source: string;
  thumbnail_path: string | null;
  original_url: string;
}

function toHistoryRecord(row: HistoryJoinRow): HistoryRecord {
  return {
    id: row.id,
    mediaItemId: row.media_item_id,
    downloadId: row.download_id ?? undefined,
    localPath: row.local_path,
    resolution: row.resolution ?? undefined,
    format: row.format,
    filesizeBytes: row.filesize ?? undefined,
    downloadedAt: row.downloaded_at,
    title: row.title,
    source: row.source,
    thumbnailPath: row.thumbnail_path ?? undefined,
    originalUrl: row.original_url,
  };
}

export interface NewHistoryEntry {
  mediaItemId: number;
  downloadId?: number;
  localPath: string;
  resolution?: string;
  format: string;
  filesizeBytes?: number;
}

export class HistoryRepo {
  constructor(private readonly db: Database.Database) {}

  insert(entry: NewHistoryEntry): number {
    const result = this.db
      .prepare(
        `INSERT INTO history (media_item_id, download_id, local_path, resolution, format, filesize)
         VALUES (@mediaItemId, @downloadId, @localPath, @resolution, @format, @filesize)`,
      )
      .run({
        mediaItemId: entry.mediaItemId,
        downloadId: entry.downloadId ?? null,
        localPath: entry.localPath,
        resolution: entry.resolution ?? null,
        format: entry.format,
        filesize: entry.filesizeBytes ?? null,
      });
    return Number(result.lastInsertRowid);
  }

  findById(id: number): HistoryRecord | undefined {
    const row = this.db
      .prepare(
        `SELECT h.*, m.title, m.source, m.thumbnail_path, m.original_url
         FROM history h JOIN media_items m ON m.id = h.media_item_id WHERE h.id = ?`,
      )
      .get(id) as HistoryJoinRow | undefined;
    return row ? toHistoryRecord(row) : undefined;
  }

  list(filter: HistoryFilter = {}): HistoryRecord[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter.search) {
      clauses.push('m.title LIKE @search');
      params.search = `%${filter.search}%`;
    }
    if (filter.source) {
      clauses.push('m.source = @source');
      params.source = filter.source;
    }
    if (filter.format) {
      clauses.push('h.format = @format');
      params.format = filter.format;
    }
    if (filter.resolution) {
      clauses.push('h.resolution = @resolution');
      params.resolution = filter.resolution;
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const sortColumn = filter.sortBy === 'size' ? 'h.filesize' : 'h.downloaded_at';
    const sortDir = filter.sortDir === 'asc' ? 'ASC' : 'DESC';

    const rows = this.db
      .prepare(
        `SELECT h.*, m.title, m.source, m.thumbnail_path, m.original_url
         FROM history h JOIN media_items m ON m.id = h.media_item_id
         ${where}
         ORDER BY ${sortColumn} ${sortDir}`,
      )
      .all(params) as HistoryJoinRow[];
    return rows.map(toHistoryRecord);
  }

  delete(id: number): void {
    this.db.prepare('DELETE FROM history WHERE id = ?').run(id);
  }

  clear(): void {
    this.db.prepare('DELETE FROM history').run();
  }
}
