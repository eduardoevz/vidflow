import type { DownloadProgress, DownloadRecord } from '../../../shared/download-types';
import { formatBytes, formatEta, formatSpeed } from '../../utils/format';
import { Button } from '../../components/Button';

interface DownloadItemCardProps {
  record: DownloadRecord;
  live?: DownloadProgress;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'En cola',
  analyzing: 'Analizando...',
  downloading: 'Descargando',
  paused: 'Pausado',
  merging: 'Procesando video y audio...',
  processing: 'Procesando...',
  completed: 'Completado',
  failed: 'Fallido',
  cancelled: 'Cancelado',
};

export function DownloadItemCard({ record, live, onPause, onResume, onCancel, onRetry }: DownloadItemCardProps): JSX.Element {
  const status = live?.status ?? record.status;
  const percent = Math.round(live?.progressPercent ?? record.progressPercent);
  const downloaded = live?.downloadedBytes;
  const total = live?.totalBytes ?? record.filesizeBytes;

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-raised p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-content">{record.title}</p>
          <p className="text-xs text-content-muted">{STATUS_LABELS[status] ?? status}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {status === 'downloading' && (
            <Button variant="secondary" onClick={onPause}>
              Pausar
            </Button>
          )}
          {status === 'paused' && (
            <Button variant="secondary" onClick={onResume}>
              Reanudar
            </Button>
          )}
          {status === 'failed' && (
            <Button variant="secondary" onClick={onRetry}>
              Reintentar
            </Button>
          )}
          {!['completed', 'cancelled', 'failed'].includes(status) && (
            <Button variant="danger" onClick={onCancel}>
              Cancelar
            </Button>
          )}
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-200"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-content-muted">
        <span>
          {formatBytes(downloaded)} / {formatBytes(total)}
        </span>
        {live?.speedBytesPerSec && <span>{formatSpeed(live.speedBytesPerSec)}</span>}
        {live?.etaSeconds !== undefined && <span>{formatEta(live.etaSeconds)}</span>}
      </div>

      {status === 'failed' && record.errorMessage && (
        <p className="text-xs text-red-500">{record.errorMessage}</p>
      )}
    </div>
  );
}
