export function formatBytes(bytes?: number, isEstimate = false): string {
  if (bytes === undefined) return 'Tamaño desconocido';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = `${value.toFixed(value < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
  return isEstimate ? `~${formatted} estimados` : formatted;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || Number.isNaN(seconds)) return '--:--';
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec) return '';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEta(seconds?: number): string {
  if (seconds === undefined) return '';
  return `${formatDuration(seconds)} restantes`;
}
