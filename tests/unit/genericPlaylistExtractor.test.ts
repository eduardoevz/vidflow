import { describe, it, expect } from 'vitest';
import { extractPlaylistFromHtml } from '../../electron/main/extraction/genericPlaylistExtractor';

describe('extractPlaylistFromHtml', () => {
  it('extracts and deduplicates same-origin video links and direct media URLs', () => {
    const html = `
      <html>
        <head><title>Mi Playlist Demo - Tube</title></head>
        <body>
          <a href="/video-abc123/primer-video/" title="Primer Video">Thumb</a>
          <a href="/video-abc123/primer-video/#comments">Comentarios</a>
          <a href="https://www.example.com/video-xyz999/segundo-video/">Segundo Video HD</a>
          <a href="https://cdn.example.com/clip.mp4">Direct MP4</a>
          <a href="/about">Acerca de</a>
        </body>
      </html>
    `;

    const result = extractPlaylistFromHtml(
      html,
      'https://www.example.com/profile/user/playlist/123/demo/',
    );

    expect(result.title).toBe('Mi Playlist Demo - Tube');
    expect(result.entries).toHaveLength(3);
    expect(result.entries[0]).toEqual({
      id: 'https://www.example.com/video-abc123/primer-video/',
      title: 'Primer Video',
      url: 'https://www.example.com/video-abc123/primer-video/',
    });
    expect(result.entries[1]?.title).toBe('Segundo Video HD');
    expect(result.entries[2]?.url).toBe('https://cdn.example.com/clip.mp4');
  });
});
