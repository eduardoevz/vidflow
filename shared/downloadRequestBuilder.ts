import type { MediaFormat, MediaInfo, QualityPreset } from './media-types';
import type { DownloadRequest } from './download-types';
import { selectFormatForPreset } from './qualitySelection';

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
    video = media.formats.find((f) => f.formatId === input.formatId);
    audio = input.audioFormatId
      ? media.formats.find((f) => f.formatId === input.audioFormatId)
      : undefined;
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
    audioOnly,
  };
}
