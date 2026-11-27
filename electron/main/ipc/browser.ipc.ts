import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { BrowserViewController } from '../browser/browserViewController';

const boundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export function registerBrowserIpc(browser: BrowserViewController): void {
  ipcMain.handle(IPC_CHANNELS.browserNavigate, (_event, rawUrl: unknown) => {
    browser.navigate(z.string().url().parse(rawUrl));
  });
  ipcMain.handle(IPC_CHANNELS.browserBack, () => browser.goBack());
  ipcMain.handle(IPC_CHANNELS.browserForward, () => browser.goForward());
  ipcMain.handle(IPC_CHANNELS.browserReload, () => browser.reload());
  ipcMain.handle(IPC_CHANNELS.browserSetBounds, (_event, rawBounds: unknown) => {
    browser.setBounds(boundsSchema.parse(rawBounds));
  });
  ipcMain.handle(IPC_CHANNELS.browserSetVisible, (_event, rawVisible: unknown) => {
    const visible = z.boolean().parse(rawVisible);
    if (visible) browser.show();
    else browser.hide();
  });
  ipcMain.handle(IPC_CHANNELS.browserCreateTab, (_event, rawUrl?: unknown) => {
    const url = rawUrl ? z.string().url().parse(rawUrl) : undefined;
    return browser.createTab(url);
  });
  ipcMain.handle(IPC_CHANNELS.browserSwitchTab, (_event, rawId: unknown) => {
    browser.switchTab(z.string().min(1).parse(rawId));
  });
  ipcMain.handle(IPC_CHANNELS.browserCloseTab, (_event, rawId: unknown) => {
    browser.closeTab(z.string().min(1).parse(rawId));
  });
  ipcMain.handle(IPC_CHANNELS.browserUpdateAdBlockLists, async () => {
    const count = await browser.updateFilterLists();
    return { count };
  });
  ipcMain.handle(IPC_CHANNELS.browserGetDetectedMedia, () => browser.getDetectedMedia());
  ipcMain.handle(IPC_CHANNELS.browserClearDetectedMedia, () => browser.clearDetectedMedia());
}
