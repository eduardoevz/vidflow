import { app, BrowserWindow, session, ipcMain, protocol, net } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { initLogger, getLogger } from './logging/logger';
import { initDatabase } from './database/client';
import { DownloadsRepo } from './database/downloadsRepo';
import { HistoryRepo } from './database/historyRepo';
import { MediaItemsRepo } from './database/mediaItemsRepo';
import { SettingsRepo } from './database/settingsRepo';
import { SubscriptionsRepo } from './database/subscriptionsRepo';
import { SettingsService } from './services/settingsService';
import { HistoryFileService } from './services/historyFileService';
import { SubscriptionService } from './services/subscriptionService';
import { UpdateService } from './updater/updateService';
import { spawnSafe } from './security/spawnSafe';
import { resolveWithinDirectory } from './security/paths';
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
import { BROWSER_PARTITION, BrowserViewController } from './browser/browserViewController';
import { exportSessionCookiesToNetscapeFile, getCookieHeaderForUrl } from './browser/cookieExporter';
import { TrayController, defaultTrayIconPath } from './tray/trayController';
import { notifyDownloadCompleted, notifyDownloadFailed } from './notifications/notify';
import { ExtensionBridgeServer, generateBridgeToken } from './bridge/extensionBridgeServer';
import type { CloseBehavior } from '../../shared/settings-types';

const isDev = !app.isPackaged && process.env.VIDFLOW_USE_DIST !== '1';

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
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'vidflow-media',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);

  await app.whenReady();

  const userDataDir = app.getPath('userData');
  initLogger(path.join(userDataDir, 'logs'));
  const logger = getLogger();
  logger.info('main', 'App starting', { version: app.getVersion() });

  const migrationsDir = resourcesMigrationsDir();
  const db = initDatabase(userDataDir, migrationsDir);

  const downloadsRepo = new DownloadsRepo(db);
  downloadsRepo.markStaleAsFailed();
  const historyRepo = new HistoryRepo(db);
  const mediaItemsRepo = new MediaItemsRepo(db);
  const settingsRepo = new SettingsRepo(db);
  const subscriptionsRepo = new SubscriptionsRepo(db);
  const settingsService = new SettingsService(settingsRepo);
  const historyFileService = new HistoryFileService(historyRepo, mediaItemsRepo);
  const updateService = new UpdateService('v3');

  protocol.handle('vidflow-media', (request) => {
    try {
      const parsed = new URL(request.url);
      const rawPath = parsed.searchParams.get('path');
      if (!rawPath) return new Response('Missing path', { status: 400 });
      const resolved = path.resolve(rawPath);
      const downloadsDir = settingsService.getAll().downloadsDirectory;
      const inHistory = historyRepo.list().some((h) => path.resolve(h.localPath) === resolved);
      if (!inHistory) {
        resolveWithinDirectory(downloadsDir, path.relative(downloadsDir, resolved));
      }
      return net.fetch(pathToFileURL(resolved).toString(), { headers: request.headers });
    } catch {
      return new Response('Forbidden', { status: 403 });
    }
  });

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
  try {
    // Provisioned eagerly (like yt-dlp/FFmpeg above) so switching to the
    // aria2 download engine in Ajustes works immediately — purely optional,
    // downloads still work fine via yt-dlp's native downloader without it.
    await engineManager.ensureAria2();
  } catch (err) {
    logger.error('main', 'Failed to ensure aria2 is installed', { error: (err as Error).message });
  }

  const browserSession = session.fromPartition(BROWSER_PARTITION);
  const mediaAnalyzer = new MediaAnalyzer(
    [
      new YtDlpAdapter(engineManager.resolvedYtDlpPath()),
      new GenericMediaDetector(),
      new ManifestProbe(),
    ],
    async () => {
      const exported = await exportSessionCookiesToNetscapeFile(browserSession);
      return {
        context: {
          cookiesFilePath: exported?.filePath,
          userAgent: browserSession.getUserAgent(),
          getCookieHeader: (targetUrl) => getCookieHeaderForUrl(browserSession, targetUrl),
        },
        cleanup: () => exported?.cleanup(),
      };
    },
  );

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
    getDownloadEngine: () => settingsService.getAll().downloadEngine,
    getConnectionsPerDownload: () => settingsService.getAll().connectionsPerDownload,
    getMaxDownloadSpeedKbps: () => settingsService.getAll().maxDownloadSpeedKbps,
    getAria2Path: () => engineManager.resolvedAria2Path(),
    reanalyzeUrl: async (originalUrl, referer) => {
      const res = await mediaAnalyzer.analyze(originalUrl, referer ? { referer } : undefined);
      if (!res.ok) return undefined;
      return res.data.formats[0]?.url;
    },
    onQueueCompleted: () => {
      const action = settingsService.getAll().postQueueAction;
      if (action === 'none') return;
      settingsService.update({ postQueueAction: 'none' });
      if (process.platform === 'win32') {
        if (action === 'sleep') {
          spawnSafe('rundll32.exe', ['powrprof.dll,SetSuspendState', '0,1,0']);
        } else if (action === 'shutdown') {
          spawnSafe('shutdown', ['/s', '/t', '30']);
        }
      }
    },
    prepareSessionContext: async (targetUrl) => {
      const [exported, cookieHeader] = await Promise.all([
        exportSessionCookiesToNetscapeFile(browserSession),
        getCookieHeaderForUrl(browserSession, targetUrl),
      ]);
      return {
        cookiesFilePath: exported?.filePath,
        cookieHeader,
        userAgent: browserSession.getUserAgent(),
        cleanup: () => exported?.cleanup(),
      };
    },
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
      return {
        adBlockEnabled: s.adBlockEnabled,
        trackerBlockEnabled: s.trackerBlockEnabled,
        popupBlockEnabled: s.popupBlockEnabled,
        whitelistedHosts: s.adBlockWhitelist,
      };
    },
    (items) => mainWindow.webContents.send(IPC_CHANNELS.browserMediaDetected, items),
  );

  const subscriptionService = new SubscriptionService(
    subscriptionsRepo,
    mediaAnalyzer,
    downloadManager,
    settingsService,
  );
  subscriptionService.startAutoCheck();

  const ipcContext: IpcContext = {
    mainWindow,
    mediaAnalyzer,
    downloadManager,
    downloadsRepo,
    historyRepo,
    settingsService,
    historyFileService,
    engineManager,
    subscriptionsRepo,
    subscriptionService,
    updateService,
    userDataDir,
    lastAnalyzedMedia: new Map(),
  };

  registerAllIpcHandlers(ipcContext, browserController);

  const tray = new TrayController(mainWindow);
  tray.init(defaultTrayIconPath());

  if (!settingsService.getAll().extensionBridgeToken) {
    settingsService.update({ extensionBridgeToken: generateBridgeToken() });
  }

  const bridgeServer = new ExtensionBridgeServer({
    port: settingsService.getAll().extensionBridgePort,
    getToken: () => settingsService.getAll().extensionBridgeToken,
    getAppVersion: () => app.getVersion(),
    onCapture: (payload) => {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      mainWindow.webContents.send(IPC_CHANNELS.extensionMediaCaptured, payload);
    },
  });

  if (settingsService.getAll().extensionBridgeEnabled) {
    bridgeServer.start().catch((err) => {
      logger.warn('main', 'Extension bridge failed to start', { error: (err as Error).message });
    });
  }

  let allowQuit = false;
  app.on('before-quit', () => {
    allowQuit = true;
    subscriptionService.stop();
    void bridgeServer.stop();
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
