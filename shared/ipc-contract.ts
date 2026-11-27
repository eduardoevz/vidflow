import type { MediaInfo, PlaylistInfo, AnalysisError, AnalysisOptions } from './media-types';
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

export interface BrowserTabInfo {
  id: string;
  title: string;
  url: string;
  isLoading: boolean;
}

export interface BrowserNavigationState {
  url: string;
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  blockedCount?: number;
  activeTabId?: string;
  tabs?: BrowserTabInfo[];
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

export interface ExtensionCapturedMedia {
  url: string;
  pageUrl?: string;
  title?: string;
  referer?: string;
}

/** Single source of truth for every channel exposed on window.vidflow. */
export type ConvertProfile = 'mp3' | 'mp4_compact' | 'gif';

export interface SubscriptionItem {
  id: number;
  url: string;
  title: string;
  preset: string;
  seenUrls: string[];
  enabled: boolean;
  lastCheckedAt?: string;
  createdAt: string;
}

export interface AppUpdateInfo {
  updateAvailable: boolean;
  latestVersion?: string;
  releaseUrl?: string;
}

export interface VidFlowApi {
  analyzeUrl(
    url: string,
    options?: AnalysisOptions,
  ): Promise<{ ok: true; data: MediaInfo } | { ok: false; error: AnalysisError }>;
  analyzePlaylist(
    url: string,
    options?: AnalysisOptions,
  ): Promise<{ ok: true; data: PlaylistInfo } | { ok: false; error: AnalysisError }>;

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
  convertHistoryFile(id: number, profile: ConvertProfile): Promise<{ outputPath: string }>;
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
  checkAppUpdate(): Promise<AppUpdateInfo>;
  installWhisper(): Promise<{ installed: boolean }>;
  transcribeHistoryFile(id: number): Promise<{ srtPath: string }>;

  listSubscriptions(): Promise<SubscriptionItem[]>;
  addSubscription(url: string, preset?: string): Promise<SubscriptionItem>;
  removeSubscription(id: number): Promise<void>;
  toggleSubscription(id: number, enabled: boolean): Promise<void>;
  checkSubscriptionsNow(): Promise<{ checked: number; queued: number }>;

  browserNavigate(url: string): Promise<void>;
  browserBack(): Promise<void>;
  browserForward(): Promise<void>;
  browserReload(): Promise<void>;
  browserSetBounds(bounds: BrowserBounds): Promise<void>;
  browserSetVisible(visible: boolean): Promise<void>;
  browserCreateTab(url?: string): Promise<string>;
  browserSwitchTab(tabId: string): Promise<void>;
  browserCloseTab(tabId: string): Promise<void>;
  browserUpdateAdBlockLists(): Promise<{ count: number }>;
  onBrowserNavigationState(callback: (state: BrowserNavigationState) => void): () => void;
  browserGetDetectedMedia(): Promise<DetectedBrowserMedia[]>;
  browserClearDetectedMedia(): Promise<void>;
  onBrowserMediaDetected(callback: (items: DetectedBrowserMedia[]) => void): () => void;
  onExtensionMediaCaptured(callback: (item: ExtensionCapturedMedia) => void): () => void;

  confirmQuit(): Promise<void>;
  minimizeToTray(): Promise<void>;
  onRequestCloseConfirmation(callback: () => void): () => void;
}
