/**
 * Canonical list of IPC channels. Lives in shared/ (not electron/main) so the
 * preload script — which Electron's sandbox restricts to requiring only
 * 'electron' and Node builtins, never arbitrary local files — can bundle it
 * directly instead of doing a runtime require() across files.
 */
export const IPC_CHANNELS = {
  analyzeUrl: 'vidflow:analyzeUrl',
  startDownload: 'vidflow:startDownload',
  pauseDownload: 'vidflow:pauseDownload',
  resumeDownload: 'vidflow:resumeDownload',
  cancelDownload: 'vidflow:cancelDownload',
  retryDownload: 'vidflow:retryDownload',
  listDownloads: 'vidflow:listDownloads',
  downloadProgress: 'vidflow:downloadProgress',

  listHistory: 'vidflow:listHistory',
  removeFromHistory: 'vidflow:removeFromHistory',
  deleteHistoryFile: 'vidflow:deleteHistoryFile',
  clearHistory: 'vidflow:clearHistory',
  openInFolder: 'vidflow:openInFolder',
  openFile: 'vidflow:openFile',
  openExternal: 'vidflow:openExternal',
  copyToClipboard: 'vidflow:copyToClipboard',
  readClipboard: 'vidflow:readClipboard',

  getSettings: 'vidflow:getSettings',
  updateSettings: 'vidflow:updateSettings',
  pickDownloadsDirectory: 'vidflow:pickDownloadsDirectory',

  getEngineVersions: 'vidflow:getEngineVersions',
  checkForEngineUpdates: 'vidflow:checkForEngineUpdates',
  updateYtDlp: 'vidflow:updateYtDlp',

  browserNavigate: 'vidflow:browserNavigate',
  browserBack: 'vidflow:browserBack',
  browserForward: 'vidflow:browserForward',
  browserReload: 'vidflow:browserReload',
  browserSetBounds: 'vidflow:browserSetBounds',
  browserSetVisible: 'vidflow:browserSetVisible',
  browserNavigationState: 'vidflow:browserNavigationState',

  confirmQuit: 'vidflow:confirmQuit',
  requestCloseConfirmation: 'vidflow:requestCloseConfirmation',
  minimizeToTray: 'vidflow:minimizeToTray',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
