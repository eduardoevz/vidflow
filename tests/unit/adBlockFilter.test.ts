import { describe, it, expect } from 'vitest';
import { isBlockedHost, shouldBlockUrl } from '../../electron/main/browser/adBlockFilter';

describe('adBlockFilter', () => {
  it('blocks known ad/popunder domains and subdomains', () => {
    expect(isBlockedHost('doubleclick.net')).toBe(true);
    expect(isBlockedHost('ad.doubleclick.net')).toBe(true);
    expect(isBlockedHost('syndication.exoclick.com')).toBe(true);
    expect(isBlockedHost('www.youtube.com')).toBe(false);
  });

  it('blocks ad and popunder URL patterns', () => {
    expect(shouldBlockUrl('https://cdn.example.com/pagead/show_ads.js')).toBe(true);
    expect(shouldBlockUrl('https://example.com/popunder?id=1')).toBe(true);
    expect(shouldBlockUrl('https://example.com/watch?v=123')).toBe(false);
  });
});
