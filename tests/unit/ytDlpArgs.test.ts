import { describe, it, expect } from 'vitest';
import { buildYtDlpDownloadArgs } from '../../electron/main/downloads/ytDlpDownloadBackend';

const BASE_OPTS = {
  ytDlpPath: 'yt-dlp',
  ffmpegPath: 'ffmpeg',
  url: 'https://www.youtube.com/watch?v=abc123',
  formatSelector: '137+140',
  outputTemplate: 'C:/Downloads/video.mp4',
  mergeOutputFormat: 'mp4',
  concurrentFragments: 4,
  extractAudioOnly: false,
};

describe('buildYtDlpDownloadArgs', () => {
  it('adds subtitle flags and --embed-subs when requested for video', () => {
    const args = buildYtDlpDownloadArgs({
      ...BASE_OPTS,
      subtitleLanguages: ['es', 'en'],
      embedSubtitles: true,
      writeSubtitles: true,
    });
    expect(args).toContain('--write-subs');
    expect(args).toContain('--write-auto-subs');
    expect(args).toContain('--sub-langs');
    expect(args[args.indexOf('--sub-langs') + 1]).toBe('es,en');
    expect(args).toContain('--embed-subs');
  });

  it('does not add --embed-subs for audio-only downloads', () => {
    const args = buildYtDlpDownloadArgs({
      ...BASE_OPTS,
      extractAudioOnly: true,
      audioFormat: 'm4a',
      subtitleLanguages: ['es'],
      embedSubtitles: true,
    });
    expect(args).not.toContain('--embed-subs');
  });

  it('adds --download-sections and --force-keyframes-at-cuts for clipRange', () => {
    const args = buildYtDlpDownloadArgs({
      ...BASE_OPTS,
      clipRange: { startSeconds: 12, endSeconds: 45 },
    });
    expect(args).toContain('--download-sections');
    expect(args[args.indexOf('--download-sections') + 1]).toBe('*12-45');
    expect(args).toContain('--force-keyframes-at-cuts');
  });

  it('adds --sponsorblock-remove when categories are provided', () => {
    const args = buildYtDlpDownloadArgs({
      ...BASE_OPTS,
      sponsorBlockCategories: ['sponsor', 'selfpromo'],
    });
    expect(args).toContain('--sponsorblock-remove');
    expect(args[args.indexOf('--sponsorblock-remove') + 1]).toBe('sponsor,selfpromo');
  });
});
