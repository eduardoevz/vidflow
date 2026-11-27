import { useEffect, useState } from 'react';
import {
  History as HistoryIcon,
  FolderOpen,
  Play,
  Link as LinkIcon,
  Copy,
  Check,
  Trash2,
  Search,
  Subtitles,
  Wand2,
  X,
} from 'lucide-react';
import type { ConvertProfile, HistoryFilter, HistoryRecord } from '../../../shared/ipc-contract';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { VideoPlayer } from '../player/VideoPlayer';
import { formatBytes } from '../../utils/format';

export function HistoryPage(): JSX.Element {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'size'>('date');
  const [copiedId, setCopiedId] = useState<number | undefined>(undefined);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | undefined>(undefined);
  const [confirmClear, setConfirmClear] = useState(false);
  const [playingRecord, setPlayingRecord] = useState<HistoryRecord | undefined>(undefined);
  const [busyActionId, setBusyActionId] = useState<number | undefined>(undefined);
  const [actionNotice, setActionNotice] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);

  async function handleConvert(record: HistoryRecord, profile: ConvertProfile) {
    setBusyActionId(record.id);
    setActionNotice(undefined);
    setActionError(undefined);
    try {
      const res = await window.vidflow.convertHistoryFile(record.id, profile);
      setActionNotice(`Convertido correctamente: ${res.outputPath}`);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyActionId(undefined);
    }
  }

  async function handleTranscribe(record: HistoryRecord) {
    setBusyActionId(record.id);
    setActionNotice(undefined);
    setActionError(undefined);
    try {
      const res = await window.vidflow.transcribeHistoryFile(record.id);
      setActionNotice(`Subtítulos generados (Whisper): ${res.srtPath}`);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusyActionId(undefined);
    }
  }

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
        icon={<HistoryIcon size={26} />}
        title="El historial está vacío"
        description="Los videos que descargues aparecerán aquí para que puedas reproducirlos o abrir su carpeta fácilmente."
      />
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-content">Historial</h1>
          <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-semibold text-content-muted">
            {records.length}
          </span>
        </div>
        <Button variant="danger" onClick={() => setConfirmClear(true)}>
          Vaciar historial
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface-raised px-3.5 py-2 shadow-sm focus-within:border-accent/60">
          <Search size={15} className="text-content-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full bg-transparent text-sm text-content placeholder:text-content-muted focus:outline-none"
          />
        </div>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'date' | 'size')}
          className="focus-ring rounded-xl border border-border bg-surface-raised px-3.5 py-2 text-sm text-content shadow-sm"
        >
          <option value="date">Más reciente</option>
          <option value="size">Tamaño</option>
        </select>
      </div>

      {actionNotice && (
        <p className="rounded-card border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-500">
          {actionNotice}
        </p>
      )}
      {actionError && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-500">
          {actionError}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {records.map((record) => (
          <div
            key={record.id}
            className="flex items-center gap-4 rounded-xl border border-border bg-surface-raised p-3.5 shadow-sm transition-colors hover:border-accent/40"
          >
            {record.thumbnailPath ? (
              <img src={record.thumbnailPath} alt="" className="h-14 w-24 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-content-muted">
                <Play size={18} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-content">{record.title}</p>
              <p className="mt-0.5 text-xs text-content-muted">
                {[record.source, record.resolution, record.format?.toUpperCase(), formatBytes(record.filesizeBytes)]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-1">
              <Button variant="ghost" title="Reproducir en VidFlow" onClick={() => setPlayingRecord(record)}>
                <Play size={16} />
              </Button>
              <Button
                variant="ghost"
                disabled={busyActionId === record.id}
                title="Convertir a MP3"
                onClick={() => void handleConvert(record, 'mp3')}
                className="px-2 text-[11px]"
              >
                <Wand2 size={13} />
                MP3
              </Button>
              <Button
                variant="ghost"
                disabled={busyActionId === record.id}
                title="Comprimir MP4"
                onClick={() => void handleConvert(record, 'mp4_compact')}
                className="px-2 text-[11px]"
              >
                MP4
              </Button>
              <Button
                variant="ghost"
                disabled={busyActionId === record.id}
                title="Generar subtítulos .srt con Whisper offline"
                onClick={() => void handleTranscribe(record)}
                className="px-2 text-[11px]"
              >
                <Subtitles size={13} />
                SRT
              </Button>
              <Button
                variant="ghost"
                title="Abrir con reproductor externo"
                onClick={() => void window.vidflow.openFile(record.localPath)}
                className="px-2 text-[11px]"
              >
                Abrir
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
                onClick={() => {
                  void window.vidflow.copyToClipboard(record.originalUrl);
                  setCopiedId(record.id);
                  setTimeout(() => setCopiedId((curr) => (curr === record.id ? undefined : curr)), 1500);
                }}
              >
                {copiedId === record.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
              </Button>
              <Button variant="ghost" title="Eliminar" onClick={() => setConfirmDeleteId(record.id)}>
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {playingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-border bg-surface-raised p-4 shadow-xl">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm font-semibold text-content">{playingRecord.title}</p>
              <button
                type="button"
                onClick={() => setPlayingRecord(undefined)}
                className="rounded-md p-1 text-content-muted hover:bg-surface-sunken hover:text-content"
                title="Cerrar reproductor"
              >
                <X size={16} />
              </button>
            </div>
            <VideoPlayer
              src={`vidflow-media://local?path=${encodeURIComponent(playingRecord.localPath)}`}
              protocol="direct"
            />
          </div>
        </div>
      )}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface-raised p-5 shadow-lg">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border bg-surface-raised p-5 shadow-lg">
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
