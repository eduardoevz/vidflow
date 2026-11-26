import http from 'node:http';
import { describe, expect, it } from 'vitest';
import { ManifestProbe, parseHlsVariants } from '../../electron/main/extraction/manifestProbe';

describe('parseHlsVariants', () => {
  it('parses master playlist variants', () => {
    const playlist = [
      '#EXTM3U',
      '#EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720',
      '720p/index.m3u8',
    ].join('\n');

    const formats = parseHlsVariants(playlist, 'https://cdn.example.com/video/master.m3u8');
    expect(formats).toHaveLength(1);
    expect(formats[0]).toMatchObject({
      protocol: 'hls',
      resolutionLabel: '720p',
      bitrateKbps: 2500,
      url: 'https://cdn.example.com/video/720p/index.m3u8',
    });
  });
});

describe('ManifestProbe', () => {
  it('supports simple HLS media playlists with #EXTINF and no #EXT-X-STREAM-INF', async () => {
    const simplePlaylist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:10',
      '#EXTINF:10.0,',
      'seg0.ts',
      '#EXT-X-ENDLIST',
    ].join('\n');

    const server = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl' });
      res.end(simplePlaylist);
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP address');

    try {
      const probe = new ManifestProbe();
      const info = await probe.analyze(`http://127.0.0.1:${address.port}/playlist.m3u8`);
      expect(info.formats).toHaveLength(1);
      expect(info.formats[0]?.formatId).toBe('hls-media-0');
      expect(info.formats[0]?.protocol).toBe('hls');
      expect(info.isLive).toBe(false);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
