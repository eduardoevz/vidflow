import { Tray, Menu, nativeImage, app, type BrowserWindow } from 'electron';
import path from 'node:path';

export class TrayController {
  private tray: Tray | undefined;

  constructor(private readonly mainWindow: BrowserWindow) {}

  init(iconPath: string): void {
    const image = nativeImage.createFromPath(iconPath);
    this.tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
    this.tray.setToolTip('VidFlow');
    this.tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          label: 'Abrir VidFlow',
          click: () => {
            this.mainWindow.show();
            this.mainWindow.focus();
          },
        },
        { type: 'separator' },
        {
          label: 'Salir',
          click: () => {
            app.exit(0);
          },
        },
      ]),
    );
    this.tray.on('click', () => {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.show();
      }
    });
  }

  destroy(): void {
    this.tray?.destroy();
  }
}

export function defaultTrayIconPath(): string {
  return path.join(app.getAppPath(), 'assets', 'tray-icon.png');
}
