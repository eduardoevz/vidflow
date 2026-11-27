import { useEffect } from 'react';
import { DownloadCloud, Gauge, Power, Trash2 } from 'lucide-react';
import { useDownloadsStore } from '../../stores/downloadsStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { DownloadItemCard } from './DownloadItemCard';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { UrlAnalyzerSection } from '../analyzer/UrlAnalyzerSection';
import type { PostQueueAction } from '../../../shared/settings-types';

const SPEED_LIMIT_OPTIONS = [
  { value: 0, label: 'Velocidad: Ilimitada' },
  { value: 512, label: 'Límite: 512 KB/s' },
  { value: 1024, label: 'Límite: 1 MB/s' },
  { value: 2048, label: 'Límite: 2 MB/s' },
  { value: 5120, label: 'Límite: 5 MB/s' },
  { value: 10240, label: 'Límite: 10 MB/s' },
];

export function DownloadsPage(): JSX.Element {
  const { records, liveProgress, refresh, subscribe } = useDownloadsStore();
  const { settings, update } = useSettingsStore();

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribe();
    return unsubscribe;
  }, [refresh, subscribe]);

  // The store already reflects only active + failed downloads (listActive()
  // on the main process side) — just put failed ones last so in-progress
  // downloads stay at the top.
  const sorted = [...records].sort((a, b) => Number(a.status === 'failed') - Number(b.status === 'failed'));
  const failedRecords = sorted.filter((r) => r.status === 'failed');

  return (
    <div className="flex flex-col gap-6">
      <UrlAnalyzerSection
        title="Descargar por enlace"
        onDownloadStarted={() => {
          void refresh();
        }}
      />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-content">Descargas activas</h1>
            {sorted.length > 0 && (
              <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-semibold text-content-muted">
                {sorted.length}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface-raised px-2.5 py-1 text-xs text-content-muted">
              <Gauge size={13} className="text-accent" />
              <select
                value={settings.maxDownloadSpeedKbps}
                onChange={(e) => void update({ maxDownloadSpeedKbps: Number(e.target.value) })}
                className="bg-transparent text-xs text-content focus:outline-none"
              >
                {SPEED_LIMIT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 rounded-card border border-border bg-surface-raised px-2.5 py-1 text-xs text-content-muted">
              <Power size={13} className="text-accent" />
              <select
                value={settings.postQueueAction}
                onChange={(e) => void update({ postQueueAction: e.target.value as PostQueueAction })}
                className="bg-transparent text-xs text-content focus:outline-none"
              >
                <option value="none">Al terminar: Nada</option>
                <option value="sleep">Al terminar: Suspender PC</option>
                <option value="shutdown">Al terminar: Apagar PC</option>
              </select>
            </label>
            {failedRecords.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  void Promise.all(
                    failedRecords.map((r) => window.vidflow.dismissDownload(String(r.id))),
                  ).then(() => void refresh());
                }}
                className="text-xs"
              >
                <Trash2 size={14} />
                Limpiar fallidas
              </Button>
            )}
          </div>
        </div>

        {sorted.length === 0 ? (
          <EmptyState
            icon={<DownloadCloud size={26} />}
            title="No hay descargas activas"
            description="Pega un enlace arriba para elegir la calidad y tamaño, o inicia una descarga desde Inicio o el Navegador."
          />
        ) : (
          sorted.map((record) => {
            const taskId = String(record.id);
            const live = liveProgress[taskId];
            return (
              <DownloadItemCard
                key={record.id}
                record={record}
                live={live}
                onPause={() => void window.vidflow.pauseDownload(taskId)}
                onResume={() => void window.vidflow.resumeDownload(taskId)}
                onCancel={() => void window.vidflow.cancelDownload(taskId)}
                onRetry={() => void window.vidflow.retryDownload(taskId)}
                onDismiss={() => {
                  void window.vidflow.dismissDownload(taskId).then(() => void refresh());
                }}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
