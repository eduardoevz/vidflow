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
  { preset: 'best_1080p', label: 'Mejor calidad hasta 1080p' },
  { preset: 'best_720p', label: 'Mejor calidad hasta 720p' },
  { preset: 'smallest', label: 'Menor tamaño' },
  { preset: 'audio_only', label: 'Solo audio' },
];

function formatLabel(format: MediaFormat): string {
  if (format.kind === 'video') {
    return [format.resolutionLabel, format.fps ? `${format.fps} FPS` : undefined, format.extension.toUpperCase()]
      .filter(Boolean)
      .join('  ');
  }
  return [format.audioCodec?.toUpperCase(), format.bitrateKbps ? `${Math.round(format.bitrateKbps)} kbps` : undefined]
    .filter(Boolean)
    .join('  ');
}

export function FormatList({ media, onSelectFormat, onSelectPreset, busy }: FormatListProps): JSX.Element {
  const videoFormats = media.formats
    .filter((f) => f.kind === 'video')
    .sort((a, b) => (b.kind === 'video' && a.kind === 'video' ? (b.height ?? 0) - (a.height ?? 0) : 0));
  const audioFormats = media.formats.filter((f) => f.kind === 'audio');

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button key={p.preset} variant="secondary" disabled={busy} onClick={() => onSelectPreset(p.preset)}>
            {p.label}
          </Button>
        ))}
      </div>

      {videoFormats.length > 0 && (
        <div className="flex flex-col divide-y divide-border rounded-card border border-border">
          {videoFormats.map((format) => (
            <button
              key={format.formatId}
              disabled={busy}
              onClick={() => onSelectFormat(format.formatId)}
              className="focus-ring flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-surface-sunken disabled:opacity-50"
            >
              <span className="text-content">{formatLabel(format)}</span>
              <span className="text-content-muted">{formatBytes(format.filesizeBytes, format.filesizeIsEstimate)}</span>
            </button>
          ))}
        </div>
      )}

      {audioFormats.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-content-muted">Audio</p>
          <div className="flex flex-col divide-y divide-border rounded-card border border-border">
            {audioFormats.map((format) => (
              <button
                key={format.formatId}
                disabled={busy}
                onClick={() => onSelectFormat(format.formatId)}
                className="focus-ring flex items-center justify-between px-4 py-3 text-left text-sm hover:bg-surface-sunken disabled:opacity-50"
              >
                <span className="text-content">{formatLabel(format)}</span>
                <span className="text-content-muted">
                  {formatBytes(format.filesizeBytes, format.filesizeIsEstimate)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
