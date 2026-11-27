import { describe, it, expect } from 'vitest';
import { parsePlaylistJson } from '../../electron/main/extraction/ytDlpAdapter';

describe('parsePlaylistJson', () => {
  it('normalizes playlist entries and resolves relative video ids', () => {
    const result = parsePlaylistJson(
      {
        id: 'PL123',
        title: 'Mi Playlist',
        uploader: 'Canal Prueba',
        entries: [
          { id: 'vid1', title: 'Video Uno', url: 'vid1', duration: 125 },
          null,
          { id: 'vid2', title: 'Video Dos', webpage_url: 'https://vimeo.com/999', duration: 60 },
          { id: 'broken' }, // no url or webpage_url -> skipped
        ],
      },
      'https://www.youtube.com/playlist?list=PL123',
    );

    expect(result.title).toBe('Mi Playlist');
    expect(result.author).toBe('Canal Prueba');
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].url).toBe('https://www.youtube.com/watch?v=vid1');
    expect(result.entries[0].durationSeconds).toBe(125);
    expect(result.entries[1].url).toBe('https://vimeo.com/999');
  });
});
