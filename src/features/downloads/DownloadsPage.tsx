import { useEffect } from 'react';
import { DownloadCloud } from 'lucide-react';
import { useDownloadsStore } from '../../stores/downloadsStore';
import { DownloadItemCard } from './DownloadItemCard';
import { EmptyState } from '../../components/EmptyState';

export function DownloadsPage(): JSX.Element {
  const { records, liveProgress, refresh, subscribe } = useDownloadsStore();

  useEffect(() => {
    void refresh();
    const unsubscribe = subscribe();
    return unsubscribe;
  }, [refresh, subscribe]);

  const sorted = [...records].sort((a, b) => {
    const activeStatuses = ['queued', 'analyzing', 'downloading', 'paused', 'merging', 'processing'];
    return Number(activeStatuses.includes(b.status)) - Number(activeStatuses.includes(a.status));
  });

  if (sorted.length === 0) {
    return (
      <EmptyState
        icon={<DownloadCloud size={28} />}
        title="No hay descargas todavía"
        description="Las descargas que inicies desde Inicio o el Navegador aparecerán aquí."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-xl font-semibold text-content">Descargas</h1>
      {sorted.map((record) => {
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
          />
        );
      })}
    </div>
  );
}
