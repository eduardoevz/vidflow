export type Theme = 'light' | 'dark' | 'system';
export type CloseBehavior = 'ask' | 'minimize' | 'quit';
export type DownloadEngine = 'ytdlp' | 'aria2';

export interface AppSettings {
  theme: Theme;
  startMinimized: boolean;
  downloadsDirectory: string;
  detectClipboard: boolean;
  notificationsEnabled: boolean;

  concurrentDownloads: number;
  preferredResolution: string; // e.g. "1080p", "best"
  preferredFormat: string; // e.g. "mp4"
  preferAudioOnly: boolean;
  downloadEngine: DownloadEngine;
  connectionsPerDownload: number;
  filenameTemplate: string;

  adBlockEnabled: boolean;
  trackerBlockEnabled: boolean;
  popupBlockEnabled: boolean;

  sponsorBlockEnabled: boolean;
  sponsorBlockCategories: string[];

  extensionBridgeEnabled: boolean;
  extensionBridgePort: number;
  extensionBridgeToken: string;

  closeBehavior: CloseBehavior;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  startMinimized: false,
  downloadsDirectory: '',
  detectClipboard: true,
  notificationsEnabled: true,

  concurrentDownloads: 3,
  preferredResolution: 'best',
  preferredFormat: 'mp4',
  preferAudioOnly: false,
  downloadEngine: 'ytdlp',
  connectionsPerDownload: 4,
  filenameTemplate: '{title}',

  adBlockEnabled: true,
  trackerBlockEnabled: true,
  popupBlockEnabled: true,

  sponsorBlockEnabled: false,
  sponsorBlockCategories: ['sponsor', 'selfpromo'],

  extensionBridgeEnabled: true,
  extensionBridgePort: 47832,
  extensionBridgeToken: '',

  closeBehavior: 'ask',
};
