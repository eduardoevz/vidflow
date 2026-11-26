import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import gsap from 'gsap';
import type { MediaInfo, QualityPreset } from '../../../shared/media-types';
import { buildDownloadRequest } from '../../../shared/downloadRequestBuilder';
import { formatDuration } from '../../utils/format';
import { FormatList } from './FormatList';
import { VideoPlayer } from '../player/VideoPlayer';
import { useSettingsStore } from '../../stores/settingsStore';

interface AnalyzerResultProps {
  media: MediaInfo;
  onDownloadStarted: () => void;
}

export function AnalyzerResult({ media, onDownloadStarted }: AnalyzerResultProps): JSX.Element {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | undefined>(undefined);
  const [downloadStartedNotice, setDownloadStartedNotice] = useState(false);
  const filenameTemplate = useSettingsStore((s) => s.settings.filenameTemplate);
  const previewFormat = media.formats.find((f) => f.kind === 'video') ?? media.formats[0];

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' });
  }, [media]);

  async function download(formatId?: string, preset?: QualityPreset) {
    setBusy(true);
    setDownloadError(undefined);
    setDownloadStartedNotice(false);
    try {
      const request = buildDownloadRequest({ media, filenameTemplate, formatId, preset });
      await window.vidflow.startDownload(request);
      setDownloadStartedNotice(true);
      onDownloadStarted();
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-5 rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3">
          {previewFormat && !media.isLive ? (
            <VideoPlayer src={previewFormat.url} protocol={previewFormat.protocol} poster={media.metadata.thumbnailUrl} />
          ) : media.metadata.thumbnailUrl ? (
            <img
              src={media.metadata.thumbnailUrl}
              alt={media.metadata.title}
              className="aspect-video w-full rounded-card object-cover"
            />
          ) : (
            <div className="aspect-video w-full rounded-card bg-surface-sunken" />
          )}
        </div>
        <div className="flex flex-col justify-center gap-2.5">
          <h2 className="text-lg font-semibold leading-snug text-content">{media.metadata.title}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-content-muted">
            {media.metadata.author && (
              <span className="rounded-md bg-surface-sunken px-2 py-1 font-medium text-content">
                {media.metadata.author}
              </span>
            )}
            <span className="rounded-md bg-surface-sunken px-2 py-1">{media.metadata.siteName}</span>
            {!media.isLive && (
              <span className="rounded-md bg-surface-sunken px-2 py-1">
                {formatDuration(media.metadata.durationSeconds)}
              </span>
            )}
            {media.isLive && (
              <span className="rounded-md bg-red-500/15 px-2 py-1 font-semibold text-red-500">En vivo</span>
            )}
          </div>
        </div>
      </div>

      {downloadError && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-500">
          {downloadError}
        </p>
      )}

      {downloadStartedNotice && (
        <div className="flex items-center justify-between gap-3 rounded-card border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-500">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            Descarga iniciada correctamente.
          </span>
          <button
            type="button"
            onClick={() => void navigate('/downloads')}
            className="inline-flex items-center gap-1 font-semibold underline hover:no-underline"
          >
            Ver en Descargas
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      <FormatList
        media={media}
        busy={busy}
        onSelectFormat={(formatId) => void download(formatId)}
        onSelectPreset={(preset) => void download(undefined, preset)}
      />
    </div>
  );
}
