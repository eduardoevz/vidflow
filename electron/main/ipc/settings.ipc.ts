import { ipcMain, dialog } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';

const settingsPatchSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    startMinimized: z.boolean().optional(),
    downloadsDirectory: z.string().optional(),
    detectClipboard: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
    concurrentDownloads: z.number().int().min(1).max(5).optional(),
    preferredResolution: z.string().optional(),
    preferredFormat: z.string().optional(),
    preferAudioOnly: z.boolean().optional(),
    downloadEngine: z.enum(['ytdlp', 'aria2']).optional(),
    connectionsPerDownload: z.number().int().min(1).max(16).optional(),
    filenameTemplate: z.string().optional(),
    adBlockEnabled: z.boolean().optional(),
    trackerBlockEnabled: z.boolean().optional(),
    popupBlockEnabled: z.boolean().optional(),
    sponsorBlockEnabled: z.boolean().optional(),
    sponsorBlockCategories: z.array(z.string().min(1)).optional(),
    extensionBridgeEnabled: z.boolean().optional(),
    extensionBridgePort: z.number().int().min(1024).max(65535).optional(),
    extensionBridgeToken: z.string().optional(),
    maxDownloadSpeedKbps: z.number().int().min(0).max(10_000_000).optional(),
    postQueueAction: z.enum(['none', 'sleep', 'shutdown']).optional(),
    adBlockWhitelist: z.array(z.string().min(1)).optional(),
    browserBookmarks: z
      .array(
        z.object({
          title: z.string().min(1),
          url: z.string().url(),
        }),
      )
      .optional(),
    closeBehavior: z.enum(['ask', 'minimize', 'quit']).optional(),
  })
  .strict();

export function registerSettingsIpc(ctx: IpcContext): void {
  ipcMain.handle(IPC_CHANNELS.getSettings, () => ctx.settingsService.getAll());

  ipcMain.handle(IPC_CHANNELS.updateSettings, (_event, rawPatch: unknown) => {
    const patch = settingsPatchSchema.parse(rawPatch);
    return ctx.settingsService.update(patch);
  });

  ipcMain.handle(IPC_CHANNELS.pickDownloadsDirectory, async () => {
    const result = await dialog.showOpenDialog(ctx.mainWindow, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
