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
  onDismiss: () => void;
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

const STATUS_BADGE_CLASSES: Record<string, string> = {
  queued: 'bg-surface-sunken text-content-muted',
  analyzing: 'bg-accent/15 text-accent',
  downloading: 'bg-accent/15 text-accent',
  paused: 'bg-amber-500/15 text-amber-500',
  merging: 'bg-accent/15 text-accent',
  processing: 'bg-accent/15 text-accent',
  completed: 'bg-emerald-500/15 text-emerald-500',
  failed: 'bg-red-500/15 text-red-500',
  cancelled: 'bg-surface-sunken text-content-muted',
};

export function DownloadItemCard({
  record,
  live,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onDismiss,
}: DownloadItemCardProps): JSX.Element {
  const status = live?.status ?? record.status;
  const percent = Math.round(live?.progressPercent ?? record.progressPercent);
  const downloaded = live?.downloadedBytes;
  const total = live?.totalBytes ?? record.filesizeBytes;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-content">{record.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span
              className={[
                'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                STATUS_BADGE_CLASSES[status] ?? 'bg-surface-sunken text-content-muted',
              ].join(' ')}
            >
              {STATUS_LABELS[status] ?? status}
            </span>
            {record.resolution && (
              <span className="text-xs text-content-muted">{record.resolution}</span>
            )}
            <span className="text-xs uppercase text-content-muted">{record.format}</span>
          </div>
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
            <>
              <Button variant="secondary" onClick={onRetry}>
                Reintentar
              </Button>
              <Button variant="ghost" onClick={onDismiss}>
                Descartar
              </Button>
            </>
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
          className={[
            'h-full rounded-full transition-[width] duration-200',
            status === 'failed' ? 'bg-red-500' : status === 'paused' ? 'bg-amber-500' : 'bg-accent',
          ].join(' ')}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-content-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            {formatBytes(downloaded)} / {formatBytes(total, record.filesizeIsEstimate)}
          </span>
          {live?.speedBytesPerSec && <span>{formatSpeed(live.speedBytesPerSec)}</span>}
          {live?.etaSeconds !== undefined && <span>{formatEta(live.etaSeconds)}</span>}
        </div>
        <span className="font-semibold text-content">{percent}%</span>
      </div>

      {status === 'failed' && record.errorMessage && (
        <p className="rounded-card bg-red-500/10 px-3 py-2 text-xs text-red-500">{record.errorMessage}</p>
      )}
    </div>
  );
}
