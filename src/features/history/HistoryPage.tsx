import { useEffect, useState } from 'react';
import { History as HistoryIcon, FolderOpen, Play, Link as LinkIcon, Copy, Trash2 } from 'lucide-react';
import type { HistoryFilter, HistoryRecord } from '../../../shared/ipc-contract';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { formatBytes } from '../../utils/format';

export function HistoryPage(): JSX.Element {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'size'>('date');
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);

  async function load(filter: HistoryFilter = {}): Promise<void> {
    setRecords(await window.vidflow.listHistory(filter));
  }

  useEffect(() => {
    void load({ search: search || undefined, sortBy });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, sortBy]);

  if (records.length === 0 && !search) {
    return (
      <EmptyState
        icon={<HistoryIcon size={28} />}
        title="El historial está vacío"
        description="Los videos que descargues aparecerán aquí para que puedas volver a ellos fácilmente."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-content">Historial</h1>
        <Button variant="danger" onClick={() => setConfirmClear(true)}>
          Vaciar historial
        </Button>
      </div>

      <div className="flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título..."
          className="focus-ring flex-1 rounded-card border border-border bg-surface-raised px-4 py-2 text-sm text-content placeholder:text-content-muted"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'size')}
          className="focus-ring rounded-card border border-border bg-surface-raised px-3 py-2 text-sm text-content"
        >
          <option value="date">Más reciente</option>
          <option value="size">Tamaño</option>
        </select>
      </div>

      <div className="flex flex-col gap-2">
        {records.map((record) => (
          <div key={record.id} className="flex items-center gap-4 rounded-card border border-border bg-surface-raised p-3">
            {record.thumbnailPath ? (
              <img src={record.thumbnailPath} alt="" className="h-14 w-24 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-14 w-24 shrink-0 rounded bg-surface-sunken" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-content">{record.title}</p>
              <p className="text-xs text-content-muted">
                {[record.source, record.resolution, record.format, formatBytes(record.filesizeBytes)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" title="Reproducir" onClick={() => void window.vidflow.openFile(record.localPath)}>
                <Play size={16} />
              </Button>
              <Button
                variant="ghost"
                title="Mostrar en carpeta"
                onClick={() => void window.vidflow.openInFolder(record.localPath)}
              >
                <FolderOpen size={16} />
              </Button>
              <Button
                variant="ghost"
                title="Abrir enlace original"
                onClick={() => void window.vidflow.openExternal(record.originalUrl)}
              >
                <LinkIcon size={16} />
              </Button>
              <Button
                variant="ghost"
                title="Copiar URL"
                onClick={() => void window.vidflow.copyToClipboard(record.originalUrl)}
              >
                <Copy size={16} />
              </Button>
              <Button variant="ghost" title="Eliminar" onClick={() => setConfirmDeleteId(record.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {confirmDeleteId !== undefined && (
        <ConfirmDeleteDialog
          onClose={() => setConfirmDeleteId(undefined)}
          onRemoveFromHistory={() => {
            void (async () => {
              await window.vidflow.removeFromHistory(confirmDeleteId);
              setConfirmDeleteId(undefined);
              void load({ search: search || undefined, sortBy });
            })();
          }}
          onDeleteFile={() => {
            void (async () => {
              await window.vidflow.deleteHistoryFile(confirmDeleteId);
              setConfirmDeleteId(undefined);
              void load({ search: search || undefined, sortBy });
            })();
          }}
        />
      )}

      {confirmClear && (
        <ConfirmDialog
          title="¿Vaciar todo el historial?"
          description="Esta acción elimina las entradas del historial, pero no borra los archivos descargados."
          onCancel={() => setConfirmClear(false)}
          onConfirm={() => {
            void (async () => {
              await window.vidflow.clearHistory();
              setConfirmClear(false);
              void load();
            })();
          }}
        />
      )}
    </div>
  );
}

function ConfirmDeleteDialog({
  onClose,
  onRemoveFromHistory,
  onDeleteFile,
}: {
  onClose: () => void;
  onRemoveFromHistory: () => void;
  onDeleteFile: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-border bg-surface-raised p-5">
        <p className="text-sm font-semibold text-content">¿Qué deseas eliminar?</p>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" onClick={() => void onRemoveFromHistory()}>
            Eliminar del historial
          </Button>
          <Button variant="danger" onClick={() => void onDeleteFile()}>
            Eliminar archivo del equipo
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  description,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-card border border-border bg-surface-raised p-5">
        <p className="text-sm font-semibold text-content">{title}</p>
        <p className="text-sm text-content-muted">{description}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={() => void onConfirm()}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
