import { describe, expect, it } from 'vitest';
import { selectFormatForPreset } from '../../shared/qualitySelection';
import { buildDownloadRequest } from '../../shared/downloadRequestBuilder';
import type { MediaInfo, VideoFormat, AudioFormat } from '../../shared/media-types';

function videoFormat(overrides: Partial<VideoFormat>): VideoFormat {
  return {
    kind: 'video',
    formatId: 'v',
    extension: 'mp4',
    protocol: 'https',
    url: 'https://example.com/v',
    filesizeIsEstimate: false,
    audioOnly: false,
    videoOnly: true,
    hasAudio: false,
    hasVideo: true,
    ...overrides,
  };
}

function audioFormat(overrides: Partial<AudioFormat>): AudioFormat {
  return {
    kind: 'audio',
    formatId: 'a',
    extension: 'm4a',
    protocol: 'https',
    url: 'https://example.com/a',
    filesizeIsEstimate: false,
    audioOnly: true,
    videoOnly: false,
    hasAudio: true,
    hasVideo: false,
    ...overrides,
  };
}

const sampleMedia: MediaInfo = {
  metadata: {
    title: 'Sample',
    siteName: 'youtube',
    originalUrl: 'https://youtube.com/watch?v=abc',
  },
  formats: [
    videoFormat({ formatId: '2160', height: 2160, filesizeBytes: 2_000_000_000 }),
    videoFormat({ formatId: '1080', height: 1080, filesizeBytes: 500_000_000 }),
    videoFormat({ formatId: '720', height: 720, filesizeBytes: 200_000_000 }),
    videoFormat({ formatId: '360', height: 360, filesizeBytes: 50_000_000 }),
    audioFormat({ formatId: 'audio-high', bitrateKbps: 160, filesizeBytes: 15_000_000 }),
    audioFormat({ formatId: 'audio-low', bitrateKbps: 64, filesizeBytes: 6_000_000 }),
  ],
  subtitles: [],
  isLive: false,
  extractor: 'yt-dlp',
};

describe('selectFormatForPreset', () => {
  it('best picks the highest resolution', () => {
    const { video } = selectFormatForPreset(sampleMedia, 'best');
    expect(video?.formatId).toBe('2160');
  });

  it('best_1080p caps at 1080p or below', () => {
    const { video } = selectFormatForPreset(sampleMedia, 'best_1080p');
    expect(video?.formatId).toBe('1080');
  });

  it('best_720p caps at 720p or below', () => {
    const { video } = selectFormatForPreset(sampleMedia, 'best_720p');
    expect(video?.formatId).toBe('720');
  });

  it('smallest picks the lowest filesize video', () => {
    const { video } = selectFormatForPreset(sampleMedia, 'smallest');
    expect(video?.formatId).toBe('360');
  });

  it('audio_only picks the highest-bitrate audio format', () => {
    const { audio, video } = selectFormatForPreset(sampleMedia, 'audio_only');
    expect(audio?.formatId).toBe('audio-high');
    expect(video).toBeUndefined();
  });

  it('pairs a video-only format with the best available audio', () => {
    const { video, audio } = selectFormatForPreset(sampleMedia, 'best');
    expect(video?.videoOnly).toBe(true);
    expect(audio?.formatId).toBe('audio-high');
  });
});

describe('buildDownloadRequest', () => {
  it('builds a merge request when video is videoOnly', () => {
    const request = buildDownloadRequest({
      media: sampleMedia,
      filenameTemplate: '{title}',
      preset: 'best_1080p',
    });
    expect(request.formatId).toBe('1080');
    expect(request.audioFormatId).toBe('audio-high');
    expect(request.audioOnly).toBe(false);
    expect(request.useYtDlp).toBe(true);
  });

  it('marks audioOnly requests correctly and defaults extension to m4a', () => {
    const request = buildDownloadRequest({
      media: sampleMedia,
      filenameTemplate: '{title}',
      preset: 'audio_only',
    });
    expect(request.audioOnly).toBe(true);
    expect(request.extension).toBe('m4a');
    expect(request.audioFormatId).toBeUndefined();
  });

  it('throws when no matching format exists', () => {
    expect(() =>
      buildDownloadRequest({ media: sampleMedia, filenameTemplate: '{title}', formatId: 'missing' }),
    ).toThrow();
  });

  it('pairs a manually-selected video-only format with the best audio (regression: audio was missing)', () => {
    const request = buildDownloadRequest({
      media: sampleMedia,
      filenameTemplate: '{title}',
      formatId: '1080', // videoOnly per the fixture above
    });
    expect(request.formatId).toBe('1080');
    expect(request.audioFormatId).toBe('audio-high');
  });

  it('does not attach an audio format when manually selecting one that already has audio', () => {
    const withAudio = {
      ...sampleMedia,
      formats: [...sampleMedia.formats, videoFormat({ formatId: 'muxed', height: 480, hasAudio: true, videoOnly: false })],
    };
    const request = buildDownloadRequest({ media: withAudio, filenameTemplate: '{title}', formatId: 'muxed' });
    expect(request.audioFormatId).toBeUndefined();
  });

  it('manually selecting an audio-only format works without a preset', () => {
    const request = buildDownloadRequest({
      media: sampleMedia,
      filenameTemplate: '{title}',
      formatId: 'audio-low',
    });
    expect(request.audioOnly).toBe(true);
    expect(request.formatId).toBe('audio-low');
  });
});
