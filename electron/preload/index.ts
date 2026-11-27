import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import type { VidFlowApi } from '../../shared/ipc-contract';

const api: VidFlowApi = {
  analyzeUrl: (url, options) => ipcRenderer.invoke(IPC_CHANNELS.analyzeUrl, url, options),
  analyzePlaylist: (url, options) => ipcRenderer.invoke(IPC_CHANNELS.analyzePlaylist, url, options),

  startDownload: (request) => ipcRenderer.invoke(IPC_CHANNELS.startDownload, request),
  pauseDownload: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.pauseDownload, taskId),
  resumeDownload: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.resumeDownload, taskId),
  cancelDownload: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.cancelDownload, taskId),
  retryDownload: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.retryDownload, taskId),
  dismissDownload: (taskId) => ipcRenderer.invoke(IPC_CHANNELS.dismissDownload, taskId),
  listDownloads: () => ipcRenderer.invoke(IPC_CHANNELS.listDownloads),
  onDownloadProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: Parameters<typeof callback>[0]) =>
      callback(progress);
    ipcRenderer.on(IPC_CHANNELS.downloadProgress, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.downloadProgress, listener);
  },

  listHistory: (filter) => ipcRenderer.invoke(IPC_CHANNELS.listHistory, filter),
  removeFromHistory: (id) => ipcRenderer.invoke(IPC_CHANNELS.removeFromHistory, id),
  deleteHistoryFile: (id) => ipcRenderer.invoke(IPC_CHANNELS.deleteHistoryFile, id),
  clearHistory: () => ipcRenderer.invoke(IPC_CHANNELS.clearHistory),
  convertHistoryFile: (id, profile) => ipcRenderer.invoke(IPC_CHANNELS.convertHistoryFile, id, profile),
  openInFolder: (path) => ipcRenderer.invoke(IPC_CHANNELS.openInFolder, path),
  openFile: (path) => ipcRenderer.invoke(IPC_CHANNELS.openFile, path),
  openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.openExternal, url),
  copyToClipboard: (text) => ipcRenderer.invoke(IPC_CHANNELS.copyToClipboard, text),
  readClipboard: () => ipcRenderer.invoke(IPC_CHANNELS.readClipboard),

  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  updateSettings: (patch) => ipcRenderer.invoke(IPC_CHANNELS.updateSettings, patch),
  pickDownloadsDirectory: () => ipcRenderer.invoke(IPC_CHANNELS.pickDownloadsDirectory),

  getEngineVersions: () => ipcRenderer.invoke(IPC_CHANNELS.getEngineVersions),
  checkForEngineUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.checkForEngineUpdates),
  updateYtDlp: () => ipcRenderer.invoke(IPC_CHANNELS.updateYtDlp),
  checkAppUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.checkAppUpdate),
  installWhisper: () => ipcRenderer.invoke(IPC_CHANNELS.installWhisper),
  transcribeHistoryFile: (id) => ipcRenderer.invoke(IPC_CHANNELS.transcribeHistoryFile, id),

  listSubscriptions: () => ipcRenderer.invoke(IPC_CHANNELS.listSubscriptions),
  addSubscription: (url, preset) => ipcRenderer.invoke(IPC_CHANNELS.addSubscription, url, preset),
  removeSubscription: (id) => ipcRenderer.invoke(IPC_CHANNELS.removeSubscription, id),
  toggleSubscription: (id, enabled) => ipcRenderer.invoke(IPC_CHANNELS.toggleSubscription, id, enabled),
  checkSubscriptionsNow: () => ipcRenderer.invoke(IPC_CHANNELS.checkSubscriptionsNow),

  browserNavigate: (url) => ipcRenderer.invoke(IPC_CHANNELS.browserNavigate, url),
  browserBack: () => ipcRenderer.invoke(IPC_CHANNELS.browserBack),
  browserForward: () => ipcRenderer.invoke(IPC_CHANNELS.browserForward),
  browserReload: () => ipcRenderer.invoke(IPC_CHANNELS.browserReload),
  browserSetBounds: (bounds) => ipcRenderer.invoke(IPC_CHANNELS.browserSetBounds, bounds),
  browserSetVisible: (visible) => ipcRenderer.invoke(IPC_CHANNELS.browserSetVisible, visible),
  browserCreateTab: (url) => ipcRenderer.invoke(IPC_CHANNELS.browserCreateTab, url),
  browserSwitchTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.browserSwitchTab, tabId),
  browserCloseTab: (tabId) => ipcRenderer.invoke(IPC_CHANNELS.browserCloseTab, tabId),
  browserUpdateAdBlockLists: () => ipcRenderer.invoke(IPC_CHANNELS.browserUpdateAdBlockLists),
  onBrowserNavigationState: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, state: Parameters<typeof callback>[0]) =>
      callback(state);
    ipcRenderer.on(IPC_CHANNELS.browserNavigationState, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.browserNavigationState, listener);
  },
  browserGetDetectedMedia: () => ipcRenderer.invoke(IPC_CHANNELS.browserGetDetectedMedia),
  browserClearDetectedMedia: () => ipcRenderer.invoke(IPC_CHANNELS.browserClearDetectedMedia),
  onBrowserMediaDetected: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, items: Parameters<typeof callback>[0]) =>
      callback(items);
    ipcRenderer.on(IPC_CHANNELS.browserMediaDetected, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.browserMediaDetected, listener);
  },
  onExtensionMediaCaptured: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, item: Parameters<typeof callback>[0]) =>
      callback(item);
    ipcRenderer.on(IPC_CHANNELS.extensionMediaCaptured, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.extensionMediaCaptured, listener);
  },

  confirmQuit: () => ipcRenderer.invoke(IPC_CHANNELS.confirmQuit),
  minimizeToTray: () => ipcRenderer.invoke(IPC_CHANNELS.minimizeToTray),
  onRequestCloseConfirmation: (callback) => {
    const listener = () => callback();
    ipcRenderer.on(IPC_CHANNELS.requestCloseConfirmation, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.requestCloseConfirmation, listener);
  },
};

contextBridge.exposeInMainWorld('vidflow', api);
