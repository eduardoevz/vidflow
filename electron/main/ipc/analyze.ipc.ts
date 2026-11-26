import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';

const urlSchema = z.string().url();
const optionsSchema = z
  .object({
    referer: z.string().url().optional(),
  })
  .optional();

export function registerAnalyzeIpc(ctx: IpcContext): void {
  ipcMain.handle(IPC_CHANNELS.analyzeUrl, async (_event, rawUrl: unknown, rawOptions?: unknown) => {
    const parsed = urlSchema.safeParse(rawUrl);
    if (!parsed.success) {
      return { ok: false, error: { code: 'invalid_url', message: 'La URL no es válida.' } };
    }
    const parsedOptions = optionsSchema.safeParse(rawOptions);
    const result = await ctx.mediaAnalyzer.analyze(
      parsed.data,
      parsedOptions.success ? parsedOptions.data : undefined,
    );
    if (result.ok) {
      ctx.lastAnalyzedMedia.set(parsed.data, result.data);
    }
    return result;
  });
}
