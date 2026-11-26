import { describe, expect, it, vi } from 'vitest';
import { classifyMediaResponse, MediaSniffer } from '../../electron/main/browser/mediaSniffer';

describe('classifyMediaResponse', () => {
  it('detects HLS manifests by extension and content-type', () => {
    expect(classifyMediaResponse('https://cdn.example.com/live/master.m3u8?token=abc', 200)).toEqual({
      type: 'hls',
      mimeType: undefined,
      sizeBytes: undefined,
    });
    expect(
      classifyMediaResponse('https://cdn.example.com/stream', 200, {
        'Content-Type': ['application/vnd.apple.mpegurl; charset=utf-8'],
      }),
    ).toEqual({
      type: 'hls',
      mimeType: 'application/vnd.apple.mpegurl',
      sizeBytes: undefined,
    });
  });

  it('detects DASH manifests and direct video files', () => {
    expect(classifyMediaResponse('https://cdn.example.com/video.mpd', 200)).toEqual({
      type: 'dash',
      mimeType: undefined,
      sizeBytes: undefined,
    });
    expect(
      classifyMediaResponse('https://cdn.example.com/play', 206, {
        'content-type': ['video/mp4'],
        'content-length': ['1048576'],
      }),
    ).toEqual({
      type: 'video',
      mimeType: 'video/mp4',
      sizeBytes: 1048576,
    });
  });

  it('ignores segments, error responses, and non-media responses', () => {
    expect(classifyMediaResponse('https://cdn.example.com/seg-1.ts', 200)).toBeNull();
    expect(classifyMediaResponse('https://cdn.example.com/seg-1.m4s', 200)).toBeNull();
    expect(
      classifyMediaResponse('https://cdn.example.com/chunk', 200, { 'content-type': ['video/mp2t'] }),
    ).toBeNull();
    expect(classifyMediaResponse('https://cdn.example.com/video.mp4', 403)).toBeNull();
    expect(
      classifyMediaResponse('https://cdn.example.com/index.html', 200, { 'content-type': ['text/html'] }),
    ).toBeNull();
  });
});

describe('MediaSniffer', () => {
  it('deduplicates by URL and clears on reset', () => {
    const onChanged = vi.fn();
    const sniffer = new MediaSniffer(onChanged);

    sniffer.record(
      'https://cdn.example.com/master.m3u8',
      200,
      { 'content-type': ['application/vnd.apple.mpegurl'] },
      { referer: 'https://example.com/watch', pageTitle: 'Demo Video' },
    );
    sniffer.record(
      'https://cdn.example.com/master.m3u8',
      200,
      { 'content-type': ['application/vnd.apple.mpegurl'] },
      { referer: 'https://example.com/watch', pageTitle: 'Demo Video' },
    );

    expect(sniffer.list()).toHaveLength(1);
    expect(sniffer.list()[0]?.referer).toBe('https://example.com/watch');

    sniffer.clear();
    expect(sniffer.list()).toHaveLength(0);
    expect(onChanged).toHaveBeenLastCalledWith([]);
  });
});
