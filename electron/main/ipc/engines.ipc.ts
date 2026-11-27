import { ipcMain } from 'electron';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';
import { ensureWhisperInstalled } from '../engines/whisperDownloader';

export function registerEnginesIpc(ctx: IpcContext): void {
  ipcMain.handle(IPC_CHANNELS.getEngineVersions, () => ctx.engineManager.getVersions());
  ipcMain.handle(IPC_CHANNELS.checkForEngineUpdates, () => ctx.engineManager.checkForUpdates());
  ipcMain.handle(IPC_CHANNELS.updateYtDlp, () => ctx.engineManager.updateYtDlp());
  ipcMain.handle(IPC_CHANNELS.checkAppUpdate, () => ctx.updateService.checkForUpdates());
  ipcMain.handle(IPC_CHANNELS.installWhisper, async () => {
    await ensureWhisperInstalled(ctx.userDataDir);
    return { installed: true };
  });
}
