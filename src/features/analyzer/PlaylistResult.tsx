import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Download, ListVideo, Search } from 'lucide-react';
import type { MediaInfo, PlaylistInfo, QualityPreset } from '../../../shared/media-types';
import type { DownloadRequest } from '../../../shared/download-types';
import { buildDownloadRequest } from '../../../shared/downloadRequestBuilder';
import { selectFormatForPreset } from '../../../shared/qualitySelection';
import { formatBytes, formatDuration } from '../../utils/format';
import { Button } from '../../components/Button';
import { useSettingsStore } from '../../stores/settingsStore';

interface PlaylistResultProps {
  playlist: PlaylistInfo;
  onDownloadStarted?: () => void;
}

const PRESET_OPTIONS: { value: QualityPreset; label: string }[] = [
  { value: 'best', label: 'Mejor calidad' },
  { value: 'best_1080p', label: 'Hasta 1080p' },
  { value: 'best_720p', label: 'Hasta 720p' },
  { value: 'smallest', label: 'Menor tamaño' },
  { value: 'audio_only', label: 'Solo audio (M4A)' },
];

function presetToFormatSelector(preset: QualityPreset): string {
  switch (preset) {
    case 'best':
      return 'bestvideo+bestaudio/best';
    case 'best_1080p':
      return 'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best';
    case 'best_720p':
      return 'bestvideo[height<=720]+bestaudio/best[height<=720]/best';
    case 'smallest':
      return 'worstvideo+worstaudio/worst';
    case 'audio_only':
      return 'bestaudio/best';
  }
}

function getResolvedSummary(
  media: MediaInfo,
  preset: QualityPreset,
): { label: string; filesizeBytes?: number; isEstimate: boolean } {
  const picked = selectFormatForPreset(media, preset);
  if (preset === 'audio_only' || (!picked.video && picked.audio)) {
    const audio = picked.audio;
    return {
      label: audio?.audioCodec ? `Audio (${audio.audioCodec.toUpperCase()})` : 'Audio',
      filesizeBytes: audio?.filesizeBytes,
      isEstimate: audio?.filesizeIsEstimate ?? true,
    };
  }
  const video = picked.video;
  const audio = picked.audio;
  const totalBytes =
    video?.filesizeBytes !== undefined ? video.filesizeBytes + (audio?.filesizeBytes ?? 0) : undefined;
  return {
    label: (video?.kind === 'video' ? video.resolutionLabel : undefined) ?? 'Video',
    filesizeBytes: totalBytes,
    isEstimate: (video?.filesizeIsEstimate ?? true) || Boolean(audio?.filesizeIsEstimate),
  };
}

export function PlaylistResult({ playlist, onDownloadStarted }: PlaylistResultProps): JSX.Element {
  const navigate = useNavigate();
  const settings = useSettingsStore((s) => s.settings);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(playlist.entries.map((e) => e.id)),
  );
  const [filterText, setFilterText] = useState('');
  const [preset, setPreset] = useState<QualityPreset>('best');
  const [busy, setBusy] = useState(false);
  const [queuedCount, setQueuedCount] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const [resolvedMap, setResolvedMap] = useState<Record<string, MediaInfo>>({});
  const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(() => new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedIds(new Set(playlist.entries.map((e) => e.id)));
    setResolvedMap({});
    setAnalyzingIds(new Set());
    setFailedIds(new Set());
    setQueuedCount(undefined);
    setError(undefined);

    let cancelled = false;
    const queue = [...playlist.entries];
    const concurrency = Math.min(3, queue.length);

    async function worker() {
      while (!cancelled && queue.length > 0) {
        const entry = queue.shift();
        if (!entry) break;

        setAnalyzingIds((prev) => new Set(prev).add(entry.id));
        try {
          const res = await window.vidflow.analyzeUrl(entry.url);
          if (cancelled) return;
          if (res.ok) {
            setResolvedMap((prev) => ({ ...prev, [entry.id]: res.data }));
          } else {
            setFailedIds((prev) => new Set(prev).add(entry.id));
          }
        } catch {
          if (!cancelled) {
            setFailedIds((prev) => new Set(prev).add(entry.id));
          }
        } finally {
          if (!cancelled) {
            setAnalyzingIds((prev) => {
              const next = new Set(prev);
              next.delete(entry.id);
              return next;
            });
          }
        }
      }
    }

    for (let i = 0; i < concurrency; i++) {
      void worker();
    }

    return () => {
      cancelled = true;
    };
  }, [playlist]);

  const filteredEntries = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return playlist.entries;
    return playlist.entries.filter((e) => e.title.toLowerCase().includes(q));
  }, [playlist.entries, filterText]);

  const selectedTotalBytes = useMemo(() => {
    let sum = 0;
    let hasAny = false;
    for (const entry of playlist.entries) {
      if (!selectedIds.has(entry.id)) continue;
      const media = resolvedMap[entry.id];
      if (!media) continue;
      const summary = getResolvedSummary(media, preset);
      if (summary.filesizeBytes) {
        sum += summary.filesizeBytes;
        hasAny = true;
      }
    }
    return hasAny ? sum : undefined;
  }, [playlist.entries, selectedIds, resolvedMap, preset]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const e of filteredEntries) next.add(e.id);
      return next;
    });
  }

  function deselectAllFiltered() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const e of filteredEntries) next.delete(e.id);
      return next;
    });
  }

  async function enqueueSelected() {
    const targets = playlist.entries.filter((e) => selectedIds.has(e.id));
    if (targets.length === 0) return;

    setBusy(true);
    setError(undefined);
    setQueuedCount(undefined);
    try {
      const audioOnly = preset === 'audio_only';
      const formatSelector = presetToFormatSelector(preset);
      const sponsorBlockCategories = settings.sponsorBlockEnabled
        ? settings.sponsorBlockCategories
        : undefined;

      for (const entry of targets) {
        let media = resolvedMap[entry.id];
        if (!media && !failedIds.has(entry.id)) {
          try {
            const res = await window.vidflow.analyzeUrl(entry.url);
            if (res.ok) {
              media = res.data;
              setResolvedMap((prev) => ({ ...prev, [entry.id]: res.data }));
            }
          } catch {
            // fall back to generic selector below
          }
        }

        if (media) {
          const request = buildDownloadRequest({
            media,
            filenameTemplate: settings.filenameTemplate,
            preset,
            sponsorBlockCategories: media.extractor === 'yt-dlp' ? sponsorBlockCategories : undefined,
          });
          await window.vidflow.startDownload(request);
          continue;
        }

        let hostname = 'playlist';
        try {
          hostname = new URL(entry.url).hostname.replace(/^www\./, '');
        } catch {
          // keep fallback
        }
        const fallbackRequest: DownloadRequest = {
          originalUrl: entry.url,
          title: entry.title,
          source: hostname,
          thumbnailUrl: entry.thumbnailUrl,
          durationSeconds: entry.durationSeconds,
          formatId: formatSelector,
          extension: audioOnly ? 'm4a' : 'mp4',
          filesizeIsEstimate: true,
          filenameTemplate: settings.filenameTemplate,
          useYtDlp: true,
          audioOnly,
          sponsorBlockCategories,
        };
        await window.vidflow.startDownload(fallbackRequest);
      }

      setQueuedCount(targets.length);
      onDownloadStarted?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = playlist.entries.filter((e) => selectedIds.has(e.id)).length;
  const resolvedCount = Object.keys(resolvedMap).length;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 rounded-lg bg-accent/15 p-2 text-accent">
            <ListVideo size={20} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-content">{playlist.title}</h3>
            <p className="text-xs text-content-muted">
              {playlist.author ? `${playlist.author} · ` : ''}
              {playlist.entries.length} videos · {resolvedCount}/{playlist.entries.length} analizados
              {selectedTotalBytes ? ` · Total selecc.: ${formatBytes(selectedTotalBytes, true)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value as QualityPreset)}
            className="focus-ring rounded-card border border-border bg-surface px-2.5 py-1.5 text-xs text-content"
          >
            {PRESET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <Button onClick={() => void enqueueSelected()} disabled={busy || selectedCount === 0}>
            <Download size={14} />
            {busy ? 'Encolando...' : `Descargar seleccionados (${selectedCount})`}
          </Button>
        </div>
      </div>

      {error && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-500">{error}</p>
      )}

      {queuedCount !== undefined && (
        <div className="flex items-center justify-between gap-3 rounded-card border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-500">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={15} />
            {queuedCount} descargas añadidas a la cola.
          </span>
          <button
            type="button"
            onClick={() => void navigate('/downloads')}
            className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline"
          >
            Ver descargas
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1">
          <Search size={13} className="text-content-muted" />
          <input
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filtrar videos..."
            className="w-48 bg-transparent text-xs text-content placeholder:text-content-muted focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button type="button" onClick={selectAllFiltered} className="text-accent hover:underline">
            Seleccionar todos
          </button>
          <span className="text-content-muted">·</span>
          <button
            type="button"
            onClick={deselectAllFiltered}
            className="text-content-muted hover:text-content hover:underline"
          >
            Ninguno
          </button>
        </div>
      </div>

      <div className="flex max-h-80 flex-col divide-y divide-border overflow-y-auto rounded-xl border border-border bg-surface">
        {filteredEntries.map((entry, idx) => {
          const checked = selectedIds.has(entry.id);
          const media = resolvedMap[entry.id];
          const isAnalyzing = analyzingIds.has(entry.id);
          const summary = media ? getResolvedSummary(media, preset) : undefined;
          const displayTitle = media?.metadata.title || entry.title;
          const displayDuration = media?.metadata.durationSeconds ?? entry.durationSeconds;

          return (
            <label
              key={entry.id}
              className="flex cursor-pointer items-center justify-between gap-3 px-3.5 py-2.5 text-xs transition-colors hover:bg-accent/5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleOne(entry.id)}
                  className="accent-accent"
                />
                <span className="w-6 shrink-0 text-right text-[11px] text-content-muted">{idx + 1}.</span>
                <span className="truncate font-medium text-content">{displayTitle}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-[11px]">
                {isAnalyzing && (
                  <span className="rounded bg-surface-sunken px-1.5 py-0.5 text-content-muted">
                    Analizando...
                  </span>
                )}
                {summary && (
                  <>
                    <span className="rounded bg-accent/15 px-1.5 py-0.5 font-semibold text-accent">
                      {summary.label}
                    </span>
                    <span className="text-content-muted">
                      {formatBytes(summary.filesizeBytes, summary.isEstimate)}
                    </span>
                  </>
                )}
                <span className="w-12 text-right text-content-muted">
                  {displayDuration ? formatDuration(displayDuration) : '--:--'}
                </span>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
