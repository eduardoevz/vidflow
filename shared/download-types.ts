import type { MediaProtocol } from './media-types';

export type DownloadStatus =
  | 'queued'
  | 'analyzing'
  | 'downloading'
  | 'paused'
  | 'merging'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadProgress {
  taskId: string;
  title: string;
  resolutionLabel?: string;
  status: DownloadStatus;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  errorMessage?: string;
}

export interface DownloadRequest {
  originalUrl: string;
  title: string;
  source: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  formatId: string;
  /** set when video+audio must be merged: the paired audio format id */
  audioFormatId?: string;
  extension: string;
  resolutionLabel?: string;
  filesizeBytes?: number;
  filesizeIsEstimate: boolean;
  filenameTemplate: string;
  /** true when this came from the yt-dlp strategy (download goes through yt-dlp itself) */
  useYtDlp: boolean;
  /** direct media URL, required when useYtDlp is false (generic/manifest sources) */
  downloadUrl?: string;
  /** protocol of the selected format (e.g. 'hls', 'dash', 'direct') */
  protocol?: MediaProtocol;
  /** optional Referer header to pass when fetching protected streams */
  referer?: string;
  audioOnly: boolean;
}

export interface DownloadRecord {
  id: number;
  mediaItemId: number;
  formatId: string;
  resolution?: string;
  format: string;
  filesizeBytes?: number;
  filesizeIsEstimate: boolean;
  destinationPath?: string;
  status: DownloadStatus;
  progressPercent: number;
  errorMessage?: string;
  downloadedAt?: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  source: string;
  thumbnailPath?: string;
  originalUrl: string;
}
