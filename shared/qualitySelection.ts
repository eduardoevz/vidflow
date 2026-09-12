import type { MediaFormat, MediaInfo, QualityPreset, VideoFormat } from './media-types';

function isVideo(f: MediaFormat): f is VideoFormat {
  return f.kind === 'video';
}

function bestAudio(formats: MediaFormat[]): MediaFormat | undefined {
  return formats
    .filter((f) => f.kind === 'audio')
    .sort((a, b) => (b.bitrateKbps ?? 0) - (a.bitrateKbps ?? 0))[0];
}

/** Picks the concrete format(s) for one of the quick "smart selection" presets. */
export function selectFormatForPreset(
  media: MediaInfo,
  preset: QualityPreset,
): { video?: MediaFormat; audio?: MediaFormat } {
  const videos = media.formats.filter(isVideo);

  if (preset === 'audio_only') {
    return { audio: bestAudio(media.formats) };
  }

  const maxHeight =
    preset === 'best_1080p' ? 1080 : preset === 'best_720p' ? 720 : Number.POSITIVE_INFINITY;

  const candidates = videos.filter((v) => (v.height ?? 0) <= maxHeight);
  const pool = candidates.length > 0 ? candidates : videos;

  let chosen: VideoFormat | undefined;
  if (preset === 'smallest') {
    chosen = [...pool].sort((a, b) => (a.filesizeBytes ?? Infinity) - (b.filesizeBytes ?? Infinity))[0];
  } else {
    chosen = [...pool].sort((a, b) => (b.height ?? 0) - (a.height ?? 0))[0];
  }

  if (!chosen) return {};
  if (chosen.hasAudio) return { video: chosen };
  return { video: chosen, audio: bestAudio(media.formats) };
}
