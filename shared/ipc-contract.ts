import type { MediaInfo, AnalysisError, AnalysisOptions } from './media-types';
import type { DownloadProgress, DownloadRecord, DownloadRequest } from './download-types';
import type { AppSettings } from './settings-types';

export interface HistoryFilter {
  search?: string;
  source?: string;
  format?: string;
  resolution?: string;
  sortBy?: 'date' | 'size';
  sortDir?: 'asc' | 'desc';
}

export interface HistoryRecord {
  id: number;
  mediaItemId: number;
  downloadId?: number;
  localPath: string;
  resolution?: string;
  format: string;
  filesizeBytes?: number;
  downloadedAt: string;
  title: string;
  source: string;
  thumbnailPath?: string;
  originalUrl: string;
}

export interface EngineVersions {
  app: string;
  ytDlp?: string;
  ffmpeg?: string;
  aria2?: string;
}

export interface BrowserNavigationState {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
}

export interface BrowserBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedBrowserMedia {
  url: string;
  type: 'hls' | 'dash' | 'video';
  mimeType?: string;
  sizeBytes?: number;
  referer?: string;
  pageTitle?: string;
  detectedAt: number;
}

/** Single source of truth for every channel exposed on window.vidflow. */
export interface VidFlowApi {
  analyzeUrl(
    url: string,
    options?: AnalysisOptions,
  ): Promise<{ ok: true; data: MediaInfo } | { ok: false; error: AnalysisError }>;

  startDownload(request: DownloadRequest): Promise<{ taskId: string }>;
  pauseDownload(taskId: string): Promise<void>;
  resumeDownload(taskId: string): Promise<void>;
  cancelDownload(taskId: string): Promise<void>;
  retryDownload(taskId: string): Promise<void>;
  dismissDownload(taskId: string): Promise<void>;
  listDownloads(): Promise<DownloadRecord[]>;
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void;

  listHistory(filter?: HistoryFilter): Promise<HistoryRecord[]>;
  removeFromHistory(id: number): Promise<void>;
  deleteHistoryFile(id: number): Promise<void>;
  clearHistory(): Promise<void>;
  openInFolder(path: string): Promise<void>;
  openFile(path: string): Promise<void>;
  openExternal(url: string): Promise<void>;
  copyToClipboard(text: string): Promise<void>;
  readClipboard(): Promise<string>;

  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  pickDownloadsDirectory(): Promise<string | null>;

  getEngineVersions(): Promise<EngineVersions>;
  checkForEngineUpdates(): Promise<{ ytDlpUpdateAvailable: boolean }>;
  updateYtDlp(): Promise<void>;

  browserNavigate(url: string): Promise<void>;
  browserBack(): Promise<void>;
  browserForward(): Promise<void>;
  browserReload(): Promise<void>;
  browserSetBounds(bounds: BrowserBounds): Promise<void>;
  browserSetVisible(visible: boolean): Promise<void>;
  onBrowserNavigationState(callback: (state: BrowserNavigationState) => void): () => void;
  browserGetDetectedMedia(): Promise<DetectedBrowserMedia[]>;
  browserClearDetectedMedia(): Promise<void>;
  onBrowserMediaDetected(callback: (items: DetectedBrowserMedia[]) => void): () => void;

  confirmQuit(): Promise<void>;
  minimizeToTray(): Promise<void>;
  onRequestCloseConfirmation(callback: () => void): () => void;
}
