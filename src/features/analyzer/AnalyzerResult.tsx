import { useEffect, useRef, useState } from 'react';
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
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | undefined>(undefined);
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
    try {
      const request = buildDownloadRequest({ media, filenameTemplate, formatId, preset });
      await window.vidflow.startDownload(request);
      onDownloadStarted();
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-[320px_1fr]">
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
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-content">{media.metadata.title}</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-content-muted">
            {media.metadata.author && <span>{media.metadata.author}</span>}
            <span>{media.metadata.siteName}</span>
            {!media.isLive && <span>{formatDuration(media.metadata.durationSeconds)}</span>}
            {media.isLive && <span className="font-medium text-red-500">En vivo</span>}
          </div>
        </div>
      </div>

      {downloadError && (
        <p className="rounded-card border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">
          {downloadError}
        </p>
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
