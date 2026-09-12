import { app, BrowserWindow, session, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { initLogger, getLogger } from './logging/logger';
import { initDatabase } from './database/client';
import { DownloadsRepo } from './database/downloadsRepo';
import { HistoryRepo } from './database/historyRepo';
import { MediaItemsRepo } from './database/mediaItemsRepo';
import { SettingsRepo } from './database/settingsRepo';
import { SettingsService } from './services/settingsService';
import { HistoryFileService } from './services/historyFileService';
import { MediaAnalyzer } from './extraction/mediaAnalyzer';
import { YtDlpAdapter } from './extraction/ytDlpAdapter';
import { GenericMediaDetector } from './extraction/genericMediaDetector';
import { ManifestProbe } from './extraction/manifestProbe';
import { DownloadManager } from './downloads/downloadManager';
import { EngineManager } from './engines/engineManager';
import { registerAllIpcHandlers } from './ipc';
import { IPC_CHANNELS } from './ipc/channels';
import type { IpcContext } from './ipc/context';
import { APP_CSP } from './security/csp';
import { BrowserViewController } from './browser/browserViewController';
import { TrayController, defaultTrayIconPath } from './tray/trayController';
import { notifyDownloadCompleted, notifyDownloadFailed } from './notifications/notify';
import type { CloseBehavior } from '../../shared/settings-types';

const isDev = !app.isPackaged;

// app.getAppPath() is the project root in dev, and the packaged app root
// (inside app.asar, which Electron's fs shims read from transparently) once
// built — both layouts include database/migrations via the "files" entry in
// package.json's build config, so this one path works in both cases.
function resourcesMigrationsDir(): string {
  return path.join(app.getAppPath(), 'database', 'migrations');
}

async function createMainWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: '#0b0d12',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
    },
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [APP_CSP],
      },
    });
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    await win.loadFile(path.join(__dirname, '..', '..', '..', 'dist', 'index.html'));
  }

  win.once('ready-to-show', () => win.show());
  return win;
}

async function main(): Promise<void> {
  await app.whenReady();

  const userDataDir = app.getPath('userData');
  initLogger(path.join(userDataDir, 'logs'));
  const logger = getLogger();
  logger.info('main', 'App starting', { version: app.getVersion() });

  const migrationsDir = resourcesMigrationsDir();
  const db = initDatabase(userDataDir, migrationsDir);

  const downloadsRepo = new DownloadsRepo(db);
  const historyRepo = new HistoryRepo(db);
  const mediaItemsRepo = new MediaItemsRepo(db);
  const settingsRepo = new SettingsRepo(db);
  const settingsService = new SettingsService(settingsRepo);
  const historyFileService = new HistoryFileService(historyRepo, mediaItemsRepo);

  const engineManager = new EngineManager(userDataDir, app.getVersion());
  try {
    await engineManager.ensureYtDlp();
  } catch (err) {
    logger.error('main', 'Failed to ensure yt-dlp is installed', { error: (err as Error).message });
  }
  try {
    // First run only: downloads a managed FFmpeg build if none is found on
    // PATH — without this, yt-dlp silently leaves video/audio unmerged
    // (it exits 0 even when merging was impossible) rather than failing
    // loudly, so this must complete before any download can be trusted.
    await engineManager.ensureFfmpeg();
  } catch (err) {
    logger.error('main', 'Failed to ensure FFmpeg is installed', { error: (err as Error).message });
  }

  const mediaAnalyzer = new MediaAnalyzer([
    new YtDlpAdapter(engineManager.resolvedYtDlpPath()),
    new GenericMediaDetector(),
    new ManifestProbe(),
  ]);

  const mainWindow = await createMainWindow();

  const downloadManager = new DownloadManager({
    downloadsRepo,
    historyRepo,
    mediaItemsRepo,
    getDownloadsDirectory: () => {
      const dir = settingsService.getAll().downloadsDirectory;
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    },
    getConcurrency: () => settingsService.getAll().concurrentDownloads,
    getYtDlpPath: () => engineManager.resolvedYtDlpPath(),
    getFfmpegPath: () => engineManager.resolvedFfmpegPath(),
    onProgress: (progress) => {
      mainWindow.webContents.send(IPC_CHANNELS.downloadProgress, progress);
      if (!settingsService.getAll().notificationsEnabled) return;
      if (progress.status === 'completed') {
        notifyDownloadCompleted(
          progress.title,
          progress.resolutionLabel,
          progress.totalBytes ? `${Math.round(progress.totalBytes / 1024 / 1024)} MB` : '',
        );
      } else if (progress.status === 'failed') {
        notifyDownloadFailed(progress.title, progress.errorMessage ?? 'Error desconocido');
      }
    },
  });

  const browserController = new BrowserViewController(
    mainWindow,
    (state) => mainWindow.webContents.send(IPC_CHANNELS.browserNavigationState, state),
    () => {
      const s = settingsService.getAll();
      return { adBlockEnabled: s.adBlockEnabled, trackerBlockEnabled: s.trackerBlockEnabled };
    },
  );

  const ipcContext: IpcContext = {
    mainWindow,
    mediaAnalyzer,
    downloadManager,
    downloadsRepo,
    historyRepo,
    settingsService,
    historyFileService,
    engineManager,
    lastAnalyzedMedia: new Map(),
  };

  registerAllIpcHandlers(ipcContext, browserController);

  const tray = new TrayController(mainWindow);
  tray.init(defaultTrayIconPath());

  let allowQuit = false;
  app.on('before-quit', () => {
    allowQuit = true;
  });

  mainWindow.on('close', (event) => {
    if (allowQuit) return;
    const behavior: CloseBehavior = settingsService.getAll().closeBehavior;
    if (behavior === 'quit') return;
    event.preventDefault();
    if (behavior === 'minimize') {
      mainWindow.hide();
      return;
    }
    // 'ask' — let the renderer show a confirm dialog; it calls confirmQuit()
    // if the user picks "close the app" (spec §34).
    mainWindow.webContents.send(IPC_CHANNELS.requestCloseConfirmation);
  });

  ipcMain.handle(IPC_CHANNELS.confirmQuit, () => {
    allowQuit = true;
    app.quit();
  });

  ipcMain.handle(IPC_CHANNELS.minimizeToTray, () => {
    mainWindow.hide();
  });

  logger.info('main', 'App ready');
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

void main();
