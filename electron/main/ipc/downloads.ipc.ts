import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';

const downloadRequestSchema = z.object({
  originalUrl: z.string().url(),
  title: z.string().min(1),
  source: z.string(),
  thumbnailUrl: z.string().url().optional(),
  durationSeconds: z.number().optional(),
  formatId: z.string().min(1),
  audioFormatId: z.string().optional(),
  extension: z.string().min(1),
  resolutionLabel: z.string().optional(),
  filesizeBytes: z.number().optional(),
  filesizeIsEstimate: z.boolean(),
  filenameTemplate: z.string().min(1),
  useYtDlp: z.boolean(),
  downloadUrl: z.string().url().optional(),
  audioOnly: z.boolean(),
});

const taskIdSchema = z.string().regex(/^\d+$/, 'taskId debe ser el id numérico de la descarga');

export function registerDownloadsIpc(ctx: IpcContext): void {
  ipcMain.handle(IPC_CHANNELS.startDownload, (_event, rawRequest: unknown) => {
    const parsed = downloadRequestSchema.parse(rawRequest);
    const taskId = ctx.downloadManager.start(parsed);
    return { taskId };
  });

  ipcMain.handle(IPC_CHANNELS.pauseDownload, (_event, taskId: unknown) => {
    ctx.downloadManager.pause(taskIdSchema.parse(taskId));
  });

  ipcMain.handle(IPC_CHANNELS.resumeDownload, (_event, taskId: unknown) => {
    ctx.downloadManager.resume(taskIdSchema.parse(taskId));
  });

  ipcMain.handle(IPC_CHANNELS.cancelDownload, (_event, taskId: unknown) => {
    ctx.downloadManager.cancel(taskIdSchema.parse(taskId));
  });

  ipcMain.handle(IPC_CHANNELS.retryDownload, (_event, taskId: unknown) => {
    ctx.downloadManager.retry(taskIdSchema.parse(taskId));
  });

  ipcMain.handle(IPC_CHANNELS.listDownloads, () => ctx.downloadManager.listAll());
}
