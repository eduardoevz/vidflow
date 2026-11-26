import type { MediaFormat, MediaInfo, QualityPreset } from './media-types';
import type { DownloadRequest } from './download-types';
import { selectFormatForPreset, bestAudio } from './qualitySelection';

export interface BuildDownloadRequestInput {
  media: MediaInfo;
  filenameTemplate: string;
  /** explicit manual formatId, or a smart preset — exactly one is provided */
  formatId?: string;
  audioFormatId?: string;
  preset?: QualityPreset;
}

export function buildDownloadRequest(input: BuildDownloadRequestInput): DownloadRequest {
  const { media } = input;
  let video: MediaFormat | undefined;
  let audio: MediaFormat | undefined;

  if (input.preset) {
    const picked = selectFormatForPreset(media, input.preset);
    video = picked.video;
    audio = picked.audio;
  } else if (input.formatId) {
    const selected = media.formats.find((f) => f.formatId === input.formatId);
    if (selected?.kind === 'video') {
      video = selected;
      // A manually-picked video-only stream (the common case above the
      // lowest quality on most sites) needs an audio stream paired in, the
      // same way the smart presets already do via selectFormatForPreset —
      // otherwise the download silently has no audio.
      audio = input.audioFormatId
        ? media.formats.find((f) => f.formatId === input.audioFormatId)
        : video.hasAudio
          ? undefined
          : bestAudio(media.formats);
    } else {
      audio = selected;
    }
  }

  const primary = video ?? audio;
  if (!primary) {
    throw new Error('No se encontró un formato válido para la descarga.');
  }

  const audioOnly = !video && Boolean(audio);

  return {
    originalUrl: media.metadata.originalUrl,
    title: media.metadata.title,
    source: media.metadata.siteName,
    thumbnailUrl: media.metadata.thumbnailUrl,
    durationSeconds: media.metadata.durationSeconds,
    formatId: primary.formatId,
    audioFormatId: video && audio && video !== audio ? audio.formatId : undefined,
    extension: audioOnly ? 'm4a' : primary.extension,
    resolutionLabel: video?.kind === 'video' ? video.resolutionLabel : undefined,
    filesizeBytes: primary.filesizeBytes,
    filesizeIsEstimate: primary.filesizeIsEstimate,
    filenameTemplate: input.filenameTemplate,
    useYtDlp: media.extractor === 'yt-dlp',
    downloadUrl: media.extractor === 'yt-dlp' ? undefined : primary.url,
    protocol: primary.protocol,
    referer: media.metadata.referer,
    audioOnly,
  };
}
