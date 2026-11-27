import path from 'node:path';
import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';
import { convertMediaFile } from '../downloads/ffmpegMerger';
import { resolveCollisionFreePath } from '../downloads/filenameTemplate';
import { ensureWhisperInstalled } from '../engines/whisperDownloader';
import { transcribeToSrt } from '../downloads/whisperTranscriber';

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

  ipcMain.handle(
    IPC_CHANNELS.convertHistoryFile,
    async (_event, rawId: unknown, rawProfile: unknown) => {
      const id = idSchema.parse(rawId);
      const profile = z.enum(['mp3', 'mp4_compact', 'gif']).parse(rawProfile);
      const record = ctx.historyRepo.list().find((r) => r.id === id);
      if (!record) throw new Error('Archivo no encontrado en el historial.');

      const ext = profile === 'mp3' ? 'mp3' : profile === 'gif' ? 'gif' : 'mp4';
      const suffix = profile === 'mp4_compact' ? ' (compact)' : '';
      const dir = path.dirname(record.localPath);
      const baseName = `${path.basename(record.localPath, path.extname(record.localPath))}${suffix}`;
      const outputPath = resolveCollisionFreePath(dir, baseName, ext);

      await convertMediaFile(ctx.engineManager.resolvedFfmpegPath(), record.localPath, outputPath, profile);
      return { outputPath };
    },
  );

  ipcMain.handle(IPC_CHANNELS.transcribeHistoryFile, async (_event, rawId: unknown) => {
    const id = idSchema.parse(rawId);
    const record = ctx.historyRepo.list().find((r) => r.id === id);
    if (!record) throw new Error('Archivo no encontrado en el historial.');

    const { binaryPath, modelPath } = await ensureWhisperInstalled(ctx.userDataDir);
    const dir = path.dirname(record.localPath);
    const baseName = path.basename(record.localPath, path.extname(record.localPath));
    const outputSrtPath = resolveCollisionFreePath(dir, baseName, 'srt');
    const srtPath = await transcribeToSrt(
      ctx.engineManager.resolvedFfmpegPath(),
      binaryPath,
      modelPath,
      record.localPath,
      outputSrtPath,
    );
    return { srtPath };
  });
}
