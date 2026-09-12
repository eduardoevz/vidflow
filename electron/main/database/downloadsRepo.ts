import type Database from 'better-sqlite3';
import type { DownloadRecord, DownloadStatus } from '../../../shared/download-types';

interface DownloadJoinRow {
  id: number;
  media_item_id: number;
  format_id: string;
  resolution: string | null;
  format: string;
  filesize: number | null;
  filesize_is_estimate: number;
  destination_path: string | null;
  status: DownloadStatus;
  progress_percent: number;
  error_message: string | null;
  downloaded_at: string | null;
  created_at: string;
  updated_at: string;
  title: string;
  source: string;
  thumbnail_path: string | null;
  original_url: string;
}

function toDownloadRecord(row: DownloadJoinRow): DownloadRecord {
  return {
    id: row.id,
    mediaItemId: row.media_item_id,
    formatId: row.format_id,
    resolution: row.resolution ?? undefined,
    format: row.format,
    filesizeBytes: row.filesize ?? undefined,
    filesizeIsEstimate: Boolean(row.filesize_is_estimate),
    destinationPath: row.destination_path ?? undefined,
    status: row.status,
    progressPercent: row.progress_percent,
    errorMessage: row.error_message ?? undefined,
    downloadedAt: row.downloaded_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    title: row.title,
    source: row.source,
    thumbnailPath: row.thumbnail_path ?? undefined,
    originalUrl: row.original_url,
  };
}

const JOIN_SELECT = `
  SELECT d.*, m.title, m.source, m.thumbnail_path, m.original_url
  FROM downloads d
  JOIN media_items m ON m.id = d.media_item_id
`;

export interface NewDownload {
  mediaItemId: number;
  formatId: string;
  resolution?: string;
  format: string;
  filesizeBytes?: number;
  filesizeIsEstimate: boolean;
  destinationPath?: string;
}

export class DownloadsRepo {
  constructor(private readonly db: Database.Database) {}

  insert(download: NewDownload): number {
    const result = this.db
      .prepare(
        `INSERT INTO downloads
          (media_item_id, format_id, resolution, format, filesize, filesize_is_estimate, destination_path, status)
         VALUES (@mediaItemId, @formatId, @resolution, @format, @filesize, @filesizeIsEstimate, @destinationPath, 'queued')`,
      )
      .run({
        mediaItemId: download.mediaItemId,
        formatId: download.formatId,
        resolution: download.resolution ?? null,
        format: download.format,
        filesize: download.filesizeBytes ?? null,
        filesizeIsEstimate: download.filesizeIsEstimate ? 1 : 0,
        destinationPath: download.destinationPath ?? null,
      });
    return Number(result.lastInsertRowid);
  }

  updateProgress(id: number, status: DownloadStatus, progressPercent: number): void {
    this.db
      .prepare(
        `UPDATE downloads SET status = ?, progress_percent = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(status, progressPercent, id);
  }

  markFailed(id: number, errorMessage: string): void {
    this.db
      .prepare(
        `UPDATE downloads SET status = 'failed', error_message = ?, updated_at = datetime('now') WHERE id = ?`,
      )
      .run(errorMessage, id);
  }

  markCompleted(id: number, destinationPath: string): void {
    this.db
      .prepare(
        `UPDATE downloads
         SET status = 'completed', progress_percent = 100, destination_path = ?,
             downloaded_at = datetime('now'), updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(destinationPath, id);
  }

  findById(id: number): DownloadRecord | undefined {
    const row = this.db.prepare(`${JOIN_SELECT} WHERE d.id = ?`).get(id) as
      | DownloadJoinRow
      | undefined;
    return row ? toDownloadRecord(row) : undefined;
  }

  listActive(): DownloadRecord[] {
    const rows = this.db
      .prepare(
        `${JOIN_SELECT} WHERE d.status IN ('queued','analyzing','downloading','paused','merging','processing') ORDER BY d.created_at ASC`,
      )
      .all() as DownloadJoinRow[];
    return rows.map(toDownloadRecord);
  }

  listAll(): DownloadRecord[] {
    const rows = this.db.prepare(`${JOIN_SELECT} ORDER BY d.created_at DESC`).all() as DownloadJoinRow[];
    return rows.map(toDownloadRecord);
  }
}
