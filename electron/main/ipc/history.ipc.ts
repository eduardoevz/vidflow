import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';

const historyFilterSchema = z
  .object({
    search: z.string().optional(),
    source: z.string().optional(),
    format: z.string().optional(),
    resolution: z.string().optional(),
    sortBy: z.enum(['date', 'size']).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
  })
  .optional();

const idSchema = z.number().int().positive();

export function registerHistoryIpc(ctx: IpcContext): void {
  ipcMain.handle(IPC_CHANNELS.listHistory, (_event, rawFilter: unknown) => {
    const filter = historyFilterSchema.parse(rawFilter);
    return ctx.historyRepo.list(filter);
  });

  ipcMain.handle(IPC_CHANNELS.removeFromHistory, (_event, rawId: unknown) => {
    ctx.historyFileService.removeFromHistory(idSchema.parse(rawId));
  });

  ipcMain.handle(IPC_CHANNELS.deleteHistoryFile, async (_event, rawId: unknown) => {
    await ctx.historyFileService.deleteFile(idSchema.parse(rawId));
  });

  ipcMain.handle(IPC_CHANNELS.clearHistory, () => {
    ctx.historyFileService.clearAll();
  });
}
