import type { BrowserWindow } from 'electron';
import type { MediaAnalyzer } from '../extraction/mediaAnalyzer';
import type { DownloadManager } from '../downloads/downloadManager';
import type { DownloadsRepo } from '../database/downloadsRepo';
import type { HistoryRepo } from '../database/historyRepo';
import type { SettingsService } from '../services/settingsService';
import type { HistoryFileService } from '../services/historyFileService';
import type { EngineManager } from '../engines/engineManager';

export interface IpcContext {
  mainWindow: BrowserWindow;
  mediaAnalyzer: MediaAnalyzer;
  downloadManager: DownloadManager;
  downloadsRepo: DownloadsRepo;
  historyRepo: HistoryRepo;
  settingsService: SettingsService;
  historyFileService: HistoryFileService;
  engineManager: EngineManager;
  lastAnalyzedMedia: Map<string, import('../../../shared/media-types').MediaInfo>;
}
