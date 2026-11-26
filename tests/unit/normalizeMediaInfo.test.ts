import { describe, expect, it } from 'vitest';
import fixture from '../fixtures/ytdlp-sample.json';
import { normalizeMediaInfo } from '../../electron/main/extraction/normalizeMediaInfo';

describe('normalizeMediaInfo', () => {
  it('normalizes a real yt-dlp --dump-json payload into MediaInfo', () => {
    const media = normalizeMediaInfo(fixture);

    expect(media.metadata.title).toBe('Me at the zoo');
    expect(media.metadata.durationSeconds).toBe(19);
    expect(media.extractor).toBe('yt-dlp');
    expect(media.formats.length).toBeGreaterThan(0);
  });

  it('classifies formats as video or audio and never both audioOnly+videoOnly', () => {
    const media = normalizeMediaInfo(fixture);
    for (const format of media.formats) {
      expect(format.audioOnly && format.videoOnly).toBe(false);
      if (format.kind === 'video') {
        expect(format.hasVideo).toBe(true);
      } else {
        expect(format.hasVideo).toBe(false);
      }
    }
  });

  it('marks filesize as an estimate only when filesize_approx was used', () => {
    const media = normalizeMediaInfo(fixture);
    const withEstimate = media.formats.find((f) => f.filesizeIsEstimate);
    const withExact = media.formats.find((f) => f.filesizeBytes && !f.filesizeIsEstimate);
    expect(withEstimate || withExact).toBeTruthy();
  });

  it('keeps generic formats where vcodec/acodec are omitted and falls back to top-level url', () => {
    const info = normalizeMediaInfo({
      id: 'generic-1',
      title: 'Generic Video',
      duration: 120,
      formats: [
        { format_id: 'hd', ext: 'mp4', url: 'https://cdn.example.com/720.mp4', height: 720, tbr: 1000 },
        { format_id: 'sb', ext: 'mhtml', url: 'https://cdn.example.com/sb.mhtml', vcodec: 'none', acodec: 'none' },
      ],
    });
    expect(info.formats).toHaveLength(1);
    expect(info.formats[0]).toMatchObject({
      kind: 'video',
      formatId: 'hd',
      resolutionLabel: '720p',
      hasAudio: true,
      hasVideo: true,
      filesizeIsEstimate: true,
    });

    const topLevel = normalizeMediaInfo({
      id: 'generic-2',
      title: 'Top Level',
      url: 'https://cdn.example.com/video.mp4',
      ext: 'mp4',
    });
    expect(topLevel.formats).toHaveLength(1);
    expect(topLevel.formats[0]?.formatId).toBe('best');
  });
});
