import { useEffect } from 'react';
import { DownloadCloud, Trash2 } from 'lucide-react';
import { useDownloadsStore } from '../../stores/downloadsStore';
import { DownloadItemCard } from './DownloadItemCard';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { UrlAnalyzerSection } from '../analyzer/UrlAnalyzerSection';

export function DownloadsPage(): JSX.Element {
  const { records, liveProgress, refresh, subscribe } = useDownloadsStore();

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
