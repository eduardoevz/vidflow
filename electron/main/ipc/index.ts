import type { IpcContext } from './context';
import type { BrowserViewController } from '../browser/browserViewController';
import { registerAnalyzeIpc } from './analyze.ipc';
import { registerDownloadsIpc } from './downloads.ipc';
import { registerHistoryIpc } from './history.ipc';
import { registerSettingsIpc } from './settings.ipc';
import { registerSystemIpc } from './system.ipc';
import { registerEnginesIpc } from './engines.ipc';
import { registerBrowserIpc } from './browser.ipc';
import { registerSubscriptionsIpc } from './subscriptions.ipc';

export function registerAllIpcHandlers(ctx: IpcContext, browser: BrowserViewController): void {
  registerAnalyzeIpc(ctx);
  registerDownloadsIpc(ctx);
  registerHistoryIpc(ctx);
  registerSettingsIpc(ctx);
  registerSystemIpc(ctx);
  registerEnginesIpc(ctx);
  registerSubscriptionsIpc(ctx);
  registerBrowserIpc(browser);
}
