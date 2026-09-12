import { Notification } from 'electron';

export function notifyDownloadCompleted(title: string, resolutionLabel: string | undefined, sizeLabel: string): void {
  if (!Notification.isSupported()) return;
  new Notification({
    title: 'Descarga completada',
    body: [title, [resolutionLabel, sizeLabel].filter(Boolean).join(' · ')].join('\n'),
  }).show();
}

export function notifyDownloadFailed(title: string, reason: string): void {
  if (!Notification.isSupported()) return;
  new Notification({
    title: 'Descarga fallida',
    body: `${title}\n${reason}`,
  }).show();
}
