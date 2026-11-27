import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, Scissors, Subtitles, ShieldCheck } from 'lucide-react';
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

function parseTimeToSeconds(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return undefined;
  if (parts.length === 2) {
    const [m = 0, s = 0] = parts;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h = 0, m = 0, s = 0] = parts;
    return h * 3600 + m * 60 + s;
  }
  return undefined;
}

function formatSecondsInput(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function AnalyzerResult({ media, onDownloadStarted }: AnalyzerResultProps): JSX.Element {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [downloadError, setDownloadError] = useState<string | undefined>(undefined);
  const [downloadStartedNotice, setDownloadStartedNotice] = useState(false);
  const settings = useSettingsStore((s) => s.settings);
  const filenameTemplate = settings.filenameTemplate;
  const previewFormat = media.formats.find((f) => f.kind === 'video') ?? media.formats[0];

  const [currentPlayerTime, setCurrentPlayerTime] = useState(0);
  const [selectedSubs, setSelectedSubs] = useState<string[]>([]);
  const [embedSubs, setEmbedSubs] = useState(true);
  const [clipEnabled, setClipEnabled] = useState(false);
  const [clipStart, setClipStart] = useState('00:00');
  const [clipEnd, setClipEnd] = useState(
    media.metadata.durationSeconds ? formatSecondsInput(media.metadata.durationSeconds) : '00:30',
  );
  const [sponsorBlockEnabled, setSponsorBlockEnabled] = useState(settings.sponsorBlockEnabled);

  const uniqueSubtitles = useMemo(() => {
    const seen = new Set<string>();
    return media.subtitles.filter((sub) => {
      if (seen.has(sub.language)) return false;
      seen.add(sub.language);
      return true;
    });
  }, [media.subtitles]);

  useEffect(() => {
    setSelectedSubs([]);
    setClipEnabled(false);
    setClipStart('00:00');
    setClipEnd(media.metadata.durationSeconds ? formatSecondsInput(media.metadata.durationSeconds) : '00:30');
  }, [media]);

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
      let clipRange: { startSeconds: number; endSeconds: number } | undefined;
      if (clipEnabled) {
        const start = parseTimeToSeconds(clipStart);
        const end = parseTimeToSeconds(clipEnd);
        if (start === undefined || end === undefined || end <= start) {
          throw new Error('Rango de recorte inválido. El tiempo de fin debe ser mayor al de inicio.');
        }
        clipRange = { startSeconds: start, endSeconds: end };
      }

      const request = buildDownloadRequest({
        media,
        filenameTemplate,
        formatId,
        preset,
        subtitleLanguages: selectedSubs.length > 0 ? selectedSubs : undefined,
        embedSubtitles: selectedSubs.length > 0 ? embedSubs : undefined,
        writeSubtitles: selectedSubs.length > 0,
        clipRange,
        sponsorBlockCategories:
          sponsorBlockEnabled && media.extractor === 'yt-dlp'
            ? settings.sponsorBlockCategories
            : undefined,
      });
      await window.vidflow.startDownload(request);
      setDownloadStartedNotice(true);
      onDownloadStarted();
    } catch (err) {
      setDownloadError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggleSub(lang: string) {
    setSelectedSubs((prev) => (prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]));
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-5 rounded-xl border border-border bg-surface-raised p-5 shadow-sm">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3">
          {previewFormat && !media.isLive ? (
            <VideoPlayer
              src={previewFormat.url}
              protocol={previewFormat.protocol}
              poster={media.metadata.thumbnailUrl}
              onTimeUpdate={setCurrentPlayerTime}
            />
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

      {!media.isLive && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-3.5 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-content">
              <input
                type="checkbox"
                checked={clipEnabled}
                onChange={(e) => setClipEnabled(e.target.checked)}
                className="accent-accent"
              />
              <Scissors size={14} className="text-accent" />
              Recortar clip (Trim)
            </label>

            {media.extractor === 'yt-dlp' && (
              <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-content">
                <input
                  type="checkbox"
                  checked={sponsorBlockEnabled}
                  onChange={(e) => setSponsorBlockEnabled(e.target.checked)}
                  className="accent-accent"
                />
                <ShieldCheck size={14} className="text-accent" />
                SponsorBlock (saltar patrocinios)
              </label>
            )}
          </div>

          {clipEnabled && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-content-muted">Inicio:</span>
                <input
                  value={clipStart}
                  onChange={(e) => setClipStart(e.target.value)}
                  className="w-20 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-content"
                  placeholder="00:00"
                />
                <button
                  type="button"
                  onClick={() => setClipStart(formatSecondsInput(currentPlayerTime))}
                  className="rounded-md bg-surface-sunken px-2 py-1 text-[11px] text-content-muted hover:text-content"
                >
                  Usar actual
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-content-muted">Fin:</span>
                <input
                  value={clipEnd}
                  onChange={(e) => setClipEnd(e.target.value)}
                  className="w-20 rounded-md border border-border bg-surface-raised px-2 py-1 text-xs text-content"
                  placeholder="00:30"
                />
                <button
                  type="button"
                  onClick={() => setClipEnd(formatSecondsInput(currentPlayerTime))}
                  className="rounded-md bg-surface-sunken px-2 py-1 text-[11px] text-content-muted hover:text-content"
                >
                  Usar actual
                </button>
              </div>
            </div>
          )}

          {uniqueSubtitles.length > 0 && media.extractor === 'yt-dlp' && (
            <div className="flex flex-col gap-2 border-t border-border pt-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-content">
                  <Subtitles size={14} className="text-accent" />
                  Subtítulos ({uniqueSubtitles.length})
                </span>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-content-muted">
                  <input
                    type="checkbox"
                    checked={embedSubs}
                    onChange={(e) => setEmbedSubs(e.target.checked)}
                    className="accent-accent"
                  />
                  Incrustar en el video
                </label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {uniqueSubtitles.slice(0, 18).map((sub) => {
                  const active = selectedSubs.includes(sub.language);
                  return (
                    <button
                      key={sub.language}
                      type="button"
                      onClick={() => toggleSub(sub.language)}
                      className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                        active
                          ? 'border-accent bg-accent/15 font-semibold text-accent'
                          : 'border-border bg-surface-raised text-content-muted hover:text-content'
                      }`}
                    >
                      {sub.label || sub.language}
                      {sub.isAutoGenerated ? ' (auto)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
