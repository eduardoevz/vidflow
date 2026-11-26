import { Download } from 'lucide-react';
import type { MediaFormat, MediaInfo, QualityPreset } from '../../../shared/media-types';
import { formatBytes } from '../../utils/format';
import { Button } from '../../components/Button';

interface FormatListProps {
  media: MediaInfo;
  onSelectFormat: (formatId: string) => void;
  onSelectPreset: (preset: QualityPreset) => void;
  busy: boolean;
}

const PRESETS: { preset: QualityPreset; label: string }[] = [
  { preset: 'best', label: 'Mejor calidad' },
  { preset: 'best_1080p', label: 'Hasta 1080p' },
  { preset: 'best_720p', label: 'Hasta 720p' },
  { preset: 'smallest', label: 'Menor tamaño' },
  { preset: 'audio_only', label: 'Solo audio' },
];

function formatLabel(format: MediaFormat): string {
  if (format.kind === 'video') {
    return [
      format.resolutionLabel ?? (format.bitrateKbps ? `${Math.round(format.bitrateKbps)} kbps` : 'Video'),
      format.fps ? `${format.fps} FPS` : undefined,
      format.extension.toUpperCase(),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    format.audioCodec?.toUpperCase() ?? format.extension.toUpperCase(),
    format.bitrateKbps ? `${Math.round(format.bitrateKbps)} kbps` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function FormatList({ media, onSelectFormat, onSelectPreset, busy }: FormatListProps): JSX.Element {
  const videoFormats = media.formats
    .filter((f) => f.kind === 'video')
    .sort((a, b) => (b.kind === 'video' && a.kind === 'video' ? (b.height ?? 0) - (a.height ?? 0) : 0));
  const audioFormats = media.formats.filter((f) => f.kind === 'audio');

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">Selección rápida</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.preset} variant="secondary" disabled={busy} onClick={() => onSelectPreset(p.preset)}>
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {videoFormats.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">
            Calidades disponibles ({videoFormats.length})
          </p>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {videoFormats.map((format) => (
              <button
                key={format.formatId}
                disabled={busy}
                onClick={() => onSelectFormat(format.formatId)}
                className="focus-ring group flex items-center justify-between gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/5 disabled:opacity-50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-content">{formatLabel(format)}</span>
                  {!format.hasAudio && (
                    <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-[11px] text-content-muted">
                      + Audio automático
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-content-muted">
                    {formatBytes(format.filesizeBytes, format.filesizeIsEstimate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-card bg-accent/12 px-3 py-1.5 text-xs font-semibold text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                    <Download size={13} />
                    Descargar
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {audioFormats.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-content-muted">
            Solo audio ({audioFormats.length})
          </p>
          <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {audioFormats.map((format) => (
              <button
                key={format.formatId}
                disabled={busy}
                onClick={() => onSelectFormat(format.formatId)}
                className="focus-ring group flex items-center justify-between gap-4 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/5 disabled:opacity-50"
              >
                <span className="font-medium text-content">{formatLabel(format)}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-content-muted">
                    {formatBytes(format.filesizeBytes, format.filesizeIsEstimate)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-card bg-accent/12 px-3 py-1.5 text-xs font-semibold text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                    <Download size={13} />
                    Descargar
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
