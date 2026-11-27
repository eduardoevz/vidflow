import { ipcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';

export function registerSubscriptionsIpc(ctx: IpcContext): void {
  ipcMain.handle(IPC_CHANNELS.listSubscriptions, () => ctx.subscriptionsRepo.list());

  ipcMain.handle(
    IPC_CHANNELS.addSubscription,
    async (_event, rawUrl: unknown, rawPreset?: unknown) => {
      const url = z.string().url().parse(rawUrl);
      const preset = rawPreset ? z.string().min(1).parse(rawPreset) : 'best_1080p';
      return ctx.subscriptionService.add(url, preset);
    },
  );

  ipcMain.handle(IPC_CHANNELS.removeSubscription, (_event, rawId: unknown) => {
    ctx.subscriptionsRepo.remove(z.number().int().positive().parse(rawId));
  });

  ipcMain.handle(IPC_CHANNELS.toggleSubscription, (_event, rawId: unknown, rawEnabled: unknown) => {
    ctx.subscriptionsRepo.setEnabled(
      z.number().int().positive().parse(rawId),
      z.boolean().parse(rawEnabled),
    );
  });

  ipcMain.handle(IPC_CHANNELS.checkSubscriptionsNow, () => ctx.subscriptionService.checkAll());
}
