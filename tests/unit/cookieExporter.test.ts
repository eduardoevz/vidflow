import { describe, expect, it } from 'vitest';
import { formatNetscapeCookies } from '../../electron/main/browser/cookieExporter';

describe('formatNetscapeCookies', () => {
  it('formats cookies in Netscape HTTP Cookie File format', () => {
    const out = formatNetscapeCookies([
      {
        domain: '.example.com',
        path: '/',
        secure: true,
        expirationDate: 1800000000.9,
        name: 'session_id',
        value: 'abc123',
      },
      {
        domain: 'video.test',
        name: 'token',
        value: 'xyz\n\t',
      },
    ]);

    const lines = out.trim().split('\n');
    expect(lines[0]).toBe('# Netscape HTTP Cookie File');
    expect(lines[1]).toBe('.example.com\tTRUE\t/\tTRUE\t1800000000\tsession_id\tabc123');
    expect(lines[2]).toBe('video.test\tFALSE\t/\tFALSE\t0\ttoken\txyz');
  });
});
