import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';

const urlSchema = z.string().url();

export function registerAnalyzeIpc(ctx: IpcContext): void {
  ipcMain.handle(IPC_CHANNELS.analyzeUrl, async (_event, rawUrl: unknown) => {
    const parsed = urlSchema.safeParse(rawUrl);
    if (!parsed.success) {
      return { ok: false, error: { code: 'invalid_url', message: 'La URL no es válida.' } };
    }
    const result = await ctx.mediaAnalyzer.analyze(parsed.data);
    if (result.ok) {
      ctx.lastAnalyzedMedia.set(parsed.data, result.data);
    }
    return result;
  });
}
