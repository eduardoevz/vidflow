import { describe, expect, it } from 'vitest';
import { resolveWithinDirectory, sanitizeFilename, isHttpUrl } from '../../electron/main/security/paths';

describe('sanitizeFilename', () => {
  it('strips characters invalid on Windows', () => {
    expect(sanitizeFilename('a<b>c:d"e/f\\g|h?i*j')).toBe('a_b_c_d_e_f_g_h_i_j');
  });

  it('rejects Windows reserved device names', () => {
    expect(sanitizeFilename('CON')).toBe('_CON');
    expect(sanitizeFilename('con.mp4')).toBe('_con.mp4');
  });

  it('falls back to "untitled" for an empty/whitespace-only name', () => {
    expect(sanitizeFilename('   ')).toBe('untitled');
  });

  it('trims trailing dots and spaces', () => {
    expect(sanitizeFilename('My Video.  ')).toBe('My Video');
  });
});

describe('resolveWithinDirectory', () => {
  it('resolves a normal relative candidate', () => {
    expect(resolveWithinDirectory('C:/Downloads', 'video.mp4')).toBe('C:\\Downloads\\video.mp4');
  });

  it('rejects path traversal attempts', () => {
    expect(() => resolveWithinDirectory('C:/Downloads', '../../evil.exe')).toThrow(/traversal/);
  });
});

describe('isHttpUrl', () => {
  it('accepts http/https URLs', () => {
    expect(isHttpUrl('https://example.com/video.mp4')).toBe(true);
    expect(isHttpUrl('http://example.com')).toBe(true);
  });

  it('rejects other protocols and invalid URLs', () => {
    expect(isHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isHttpUrl('not a url')).toBe(false);
  });
});
