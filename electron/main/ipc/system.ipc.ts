import { ipcMain, shell, clipboard } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from './channels';
import type { IpcContext } from './context';
import { isHttpUrl } from '../security/paths';

const pathSchema = z.string().min(1);

export function registerSystemIpc(_ctx: IpcContext): void {
  ipcMain.handle(IPC_CHANNELS.openInFolder, (_event, rawPath: unknown) => {
    shell.showItemInFolder(pathSchema.parse(rawPath));
  });

  ipcMain.handle(IPC_CHANNELS.openFile, async (_event, rawPath: unknown) => {
    const filePath = pathSchema.parse(rawPath);
    const error = await shell.openPath(filePath);
    if (error) throw new Error(error);
  });

  ipcMain.handle(IPC_CHANNELS.openExternal, async (_event, rawUrl: unknown) => {
    const url = pathSchema.parse(rawUrl);
    if (!isHttpUrl(url)) throw new Error('Solo se permiten URLs http(s).');
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.copyToClipboard, (_event, rawText: unknown) => {
    clipboard.writeText(z.string().parse(rawText));
  });

  ipcMain.handle(IPC_CHANNELS.readClipboard, () => clipboard.readText());
}
