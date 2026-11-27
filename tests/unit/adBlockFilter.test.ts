import { describe, it, expect } from 'vitest';
import {
  isBlockedHost,
  isWhitelistedHost,
  parseEasyListDomains,
  shouldBlockUrl,
} from '../../electron/main/browser/adBlockFilter';

describe('adBlockFilter', () => {
  it('blocks known ad/popunder domains and subdomains', () => {
    expect(isBlockedHost('doubleclick.net')).toBe(true);
    expect(isBlockedHost('ad.doubleclick.net')).toBe(true);
    expect(isBlockedHost('syndication.exoclick.com')).toBe(true);
    expect(isBlockedHost('www.youtube.com')).toBe(false);
  });

  it('blocks ad and popunder URL patterns and respects whitelist', () => {
    expect(shouldBlockUrl('https://cdn.example.com/pagead/show_ads.js')).toBe(true);
    expect(shouldBlockUrl('https://example.com/popunder?id=1')).toBe(true);
    expect(shouldBlockUrl('https://example.com/watch?v=123')).toBe(false);
    expect(isWhitelistedHost('sub.example.com', ['example.com'])).toBe(true);
    expect(shouldBlockUrl('https://doubleclick.net/ad.js', ['doubleclick.net'])).toBe(false);
  });

  it('parses EasyList ||domain^ and hosts-file rules', () => {
    const domains = parseEasyListDomains(`
      ! Comment
      ||ads.example.com^
      0.0.0.0 tracker.test.org
      127.0.0.1 localhost
    `);
    expect(domains).toEqual(['ads.example.com', 'tracker.test.org']);
  });
});
